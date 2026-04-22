import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faPlus,
  faMinus,
  faShoppingCart,
  faMoneyBillWave,
  faCreditCard,
  faCheck,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faUtensils,
  faShoppingBag,
  faTrash,
  faArrowLeft,
  faArrowRight,
  faSearch,
  faExclamationTriangle,
  faMotorcycle,
  faConciergeBell,
  faBuilding,
  faPen
} from '@fortawesome/free-solid-svg-icons';
import { getImageUrl } from '../config.js';

const API = 'https://srservi2.srautomatic.com';

function WorkerNewOrder({ worker, storeId, storeCode, onClose, onOrderCreated }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [extras, setExtras] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('serve');

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productConfig, setProductConfig] = useState({
    selectedIngredients: [],
    selectedExtras: [],
    quantity: 1
  });
  const [modalStep, setModalStep] = useState('ingredients'); // 'ingredients' | 'extras'

  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [tuuAvailable, setTuuAvailable] = useState(false);
  const [tuuDeviceName, setTuuDeviceName] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [cashPaymentSuccess, setCashPaymentSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(90);
  const [mobileTab, setMobileTab] = useState('products');
  const [customTotal, setCustomTotal] = useState(null);
  const [editingTotal, setEditingTotal] = useState(false);

  const categoryScrollRef = useRef(null);
  const payEditInputRef = useRef(null);

  const token = localStorage.getItem('workerToken');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };

  // Fetch all data on mount
  useEffect(() => {
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (!storeCode) throw new Error('No se encontro el codigo de tienda');

      // Use public API that returns everything together (products with ingredients/extras)
      const [storeRes, terminalsRes, payMethodsRes, tuuRes] = await Promise.all([
        fetch(API + `/api/public/${storeCode}`),
        fetch(API + `/api/public/${storeCode}/mercado-pago-terminals`),
        fetch(API + `/api/public/worker-payment-methods/${storeId}`),
        fetch(API + `/api/tuu/available?store_id=${storeId}&device_uid=${localStorage.getItem('deviceUid') || ''}`)
      ]);

      if (!storeRes.ok) throw new Error('Error al cargar la tienda');

      const storeData = await storeRes.json();
      const terminalsData = terminalsRes.ok ? await terminalsRes.json() : [];
      const payMethodsData = payMethodsRes.ok ? await payMethodsRes.json() : [];
      const tuuData = tuuRes.ok ? await tuuRes.json() : { available: false };
      if (tuuData.available) {
        setTuuAvailable(true);
        setTuuDeviceName(tuuData.deviceName || '');
      }

      // Products come with ingredients/extras already attached
      const rawProducts = (storeData.products || []).filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );
      const safeCategories = (storeData.categories || []).filter((cat, index, self) =>
        index === self.findIndex((c) => c.id === cat.id)
      );
      const safeTerminals = Array.isArray(terminalsData) ? terminalsData : [];

      setProducts(rawProducts);
      setCategories(safeCategories);
      setTerminals(safeTerminals);

      if (safeTerminals.length > 0) {
        setSelectedTerminalId(String(safeTerminals[0].id));
      }

      setPaymentMethods(Array.isArray(payMethodsData) ? payMethodsData : []);

      const store = storeData.store || storeData;
      if (store.currency_symbol) {
        setCurrencySymbol(store.currency_symbol);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll payment status for card/tuu payments
  useEffect(() => {
    if (!paymentWaiting || !pendingOrderData) return;

    const orderId = pendingOrderData.order.id;
    const tuuKey = pendingOrderData.tuuKey;

    const pollInterval = setInterval(async () => {
      try {
        let isApproved = false;
        let isCancelled = false;

        if (tuuKey) {
          const tuuRes = await fetch(API + `/api/tuu/status/${tuuKey}`);
          if (tuuRes.ok) {
            const tuuData = await tuuRes.json();
            if (tuuData.status === 'Completed') {
              isApproved = true;
            } else if (['Canceled', 'Failed', 'Timeout'].includes(tuuData.status)) {
              isCancelled = true;
            }
          }
        }

        if (!isApproved && !isCancelled) {
          const res = await fetch(API + `/api/orders/${orderId}/payment-status?store_id=${storeId}`);
          if (!res.ok) return;
          const data = await res.json();

          const mpStatus = data.mp_status || data.status;
          const payStatus = data.payment_status || data.status;
          const paidAmount = data.paid_amount || '0';

          isApproved =
            (payStatus === 'approved' || payStatus === 'paid' || payStatus === 'processed' ||
             mpStatus === 'processed') &&
            (parseFloat(paidAmount) > 0 || payStatus === 'processed' || mpStatus === 'processed');
          isCancelled = mpStatus === 'canceled' || mpStatus === 'refunded' ||
            mpStatus === 'expired' || mpStatus === 'failed' ||
            payStatus === 'canceled' || payStatus === 'refunded' ||
            data.order_status === 'canceled' || data.order_status === 'refunded';
        }

        if (isApproved) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          await fetch(API + `/api/orders/${orderId}/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store_id: storeId })
          });
          setPaymentConfirmed(true);
          setLastOrderNumber(pendingOrderData.order.order_number);
          setCart([]);
          setPaymentWaiting(false);
        } else if (isCancelled) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          setPaymentWaiting(false);
          setPaymentCancelled(true);
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    }, 3000);

    const timerInterval = setInterval(() => {
      setPaymentTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          clearInterval(pollInterval);
          setPaymentWaiting(false);
          setPaymentCancelled(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [paymentWaiting, pendingOrderData?.order?.id]);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'all' || String(p.category_id) === String(activeCategory);
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Product modal logic
  const openProductModal = (product) => {
    if (!product.unlimited_stock && product.stock === 0) return;

    const hasIngredients = product.has_ingredients && product.ingredients && product.ingredients.length > 0;
    const hasExtras = product.has_extras && product.extras && product.extras.length > 0;

    if (!hasIngredients && !hasExtras) {
      // Add directly to cart
      const cartItem = {
        id: Date.now(),
        product_id: product.id,
        product_name: product.name,
        product_image: product.image,
        unit_price: product.price,
        quantity: 1,
        total: product.price,
        selected_ingredients: [],
        selected_extras: []
      };
      setCart(prev => [...prev, cartItem]);
      return;
    }

    setSelectedProduct(product);
    setProductConfig({ selectedIngredients: [], selectedExtras: [], quantity: 1 });
    setModalStep(hasIngredients ? 'ingredients' : 'extras');
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setProductConfig({ selectedIngredients: [], selectedExtras: [], quantity: 1 });
  };

  const toggleIngredient = (ingredient) => {
    if (!ingredient.unlimited_stock && ingredient.stock === 0) return;
    setProductConfig(prev => {
      const exists = prev.selectedIngredients.find(i => i.id === ingredient.id);
      if (exists) {
        return { ...prev, selectedIngredients: prev.selectedIngredients.filter(i => i.id !== ingredient.id) };
      }
      return { ...prev, selectedIngredients: [...prev.selectedIngredients, ingredient] };
    });
  };

  const toggleExtra = (extra) => {
    if (!extra.unlimited_stock && extra.stock === 0) return;
    setProductConfig(prev => {
      const exists = prev.selectedExtras.find(e => e.id === extra.id);
      if (exists) {
        return { ...prev, selectedExtras: prev.selectedExtras.filter(e => e.id !== extra.id) };
      }
      return { ...prev, selectedExtras: [...prev.selectedExtras, extra] };
    });
  };

  const calculateProductPrice = () => {
    if (!selectedProduct) return 0;
    let price = selectedProduct.price;
    productConfig.selectedIngredients.forEach(ing => { price += ing.price || 0; });
    productConfig.selectedExtras.forEach(ext => { price += ext.price || 0; });
    return price;
  };

  const handleNextFromIngredients = () => {
    const requiredIngredients = (selectedProduct.ingredients || []).filter(ing => ing.is_required);
    const missingRequired = requiredIngredients.filter(req =>
      !productConfig.selectedIngredients.some(sel => sel.id === req.id)
    );
    if (missingRequired.length > 0) {
      alert(`Por favor selecciona los ingredientes obligatorios:\n${missingRequired.map(i => '- ' + i.name).join('\n')}`);
      return;
    }

    if (selectedProduct.has_extras && selectedProduct.extras && selectedProduct.extras.length > 0) {
      setModalStep('extras');
    } else {
      addToCart();
    }
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const unitPrice = calculateProductPrice();
    const cartItem = {
      id: Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_image: selectedProduct.image,
      unit_price: unitPrice,
      quantity: productConfig.quantity,
      total: unitPrice * productConfig.quantity,
      selected_ingredients: productConfig.selectedIngredients.map(i => i.name),
      selected_extras: productConfig.selectedExtras.map(e => e.name)
    };
    setCart(prev => [...prev, cartItem]);
    closeProductModal();
  };

  // Cart helpers
  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = item.quantity + delta;
        if (newQty > 0) {
          return { ...item, quantity: newQty, total: Number(item.unit_price) * newQty };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const next = prev.filter(item => item.id !== itemId);
      if (next.length === 0) setCustomTotal(null);
      return next;
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const getEffectiveTotal = () => customTotal !== null ? customTotal : getCartTotal();;

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  // Payment
  const processPayment = async (method) => {
    if (cart.length === 0) return;
    if (method === 'card' && !selectedTerminalId) {
      alert('No hay terminal Point disponible');
      return;
    }

    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentConfirmed(false);
    setPaymentCancelled(false);

    const total = getEffectiveTotal();
    const orderData = {
      store_id: storeId,
      order_type: orderType,
      payment_method: 'card',
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        selected_ingredients: item.selected_ingredients,
        selected_extras: item.selected_extras
      })),
      selected_terminal_id: method === 'card' && selectedTerminalId ? parseInt(selectedTerminalId) : null,
      total: Number(total).toFixed(2),
      from_worker: true
    };

    try {
      // === TUU POS ===
      if (method === 'tuu') {
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        const chargeRes = await fetch(API + '/api/tuu/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId,
            order_id: order.id,
            amount: Math.round(Number(total)),
            description: `Pedido #${order.order_number || order.id}`,
            device_uid: localStorage.getItem('deviceUid') || ''
          })
        });
        const chargeData = await chargeRes.json();
        if (!chargeData.success) throw new Error(chargeData.error || 'Error al enviar cobro al POS');

        setPendingOrderData(prev => prev ? { ...prev, tuuKey: chargeData.idempotencyKey } : null);
        setPaymentWaiting(true);
        setPaymentTimeLeft(300);
        return;
      }

      // === Mercado Pago Point ===
      const endpoint = method === 'card' ? '/api/orders/process-payment' : '/api/orders';
      const response = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el pedido');
      }

      const result = await response.json();
      const order = result.order || result;
      setPendingOrderData({ order, storeId });

      if (method === 'card') {
        setPaymentWaiting(true);
        setPaymentTimeLeft(90);
      } else {
        setLastOrderNumber(order.order_number);
        setCashPaymentSuccess(true);
        setCart([]);
      }
    } catch (err) {
      setPaymentError(err.message);
      alert(err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSuccessClose = () => {
    setCashPaymentSuccess(false);
    setPaymentConfirmed(false);
    if (onOrderCreated) onOrderCreated();
    if (onClose) onClose();
  };

  // Auto-close success after 3 seconds
  useEffect(() => {
    if (cashPaymentSuccess || paymentConfirmed) {
      const timer = setTimeout(() => {
        handleSuccessClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [cashPaymentSuccess, paymentConfirmed]);

  const handleCancelledRetry = () => {
    setPaymentCancelled(false);
    setPendingOrderData(null);
  };

  // Render loading
  if (loading) {
    return (
      <div className="worker-pos-overlay">
        <div className="worker-pos-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '2rem', color: '#D4AF37' }} />
          <span style={{ marginLeft: '1rem', color: '#fff', fontSize: '1.1rem' }}>Cargando productos...</span>
        </div>
      </div>
    );
  }

  // Render error
  if (error) {
    return (
      <div className="worker-pos-overlay">
        <div className="worker-pos-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
          <span style={{ color: '#fff' }}>{error}</span>
          <button className="btn" style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  // Success overlay with animation
  if (cashPaymentSuccess || paymentConfirmed) {
    return (
      <div className="worker-pos-overlay">
        <div className="worker-pos-success-overlay">
          <div className="worker-pos-success-check">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <h2 className="worker-pos-success-title">
            {paymentConfirmed ? 'Pago confirmado' : 'Pedido creado'}
          </h2>
          {lastOrderNumber && (
            <p className="worker-pos-success-order">Pedido #{lastOrderNumber}</p>
          )}
          <div className="worker-pos-success-bar">
            <div className="worker-pos-success-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  // Waiting for terminal overlay
  if (paymentWaiting) {
    return (
      <div className="worker-pos-overlay">
        <div className="worker-pos-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          <div style={{ animation: 'pulse 2s infinite' }}>
            <svg viewBox="0 0 100 130" width="70" height="91" xmlns="http://www.w3.org/2000/svg" fill="none">
              <rect x="15" y="5" width="70" height="115" rx="9" stroke="#D4AF37" strokeWidth="2.5" fill="#D4AF37" fillOpacity="0.1"/>
              <rect x="23" y="13" width="54" height="36" rx="5" stroke="#D4AF37" strokeWidth="1.5" fill="#D4AF37" fillOpacity="0.2"/>
              <rect x="23" y="56" width="54" height="7" rx="3.5" stroke="#D4AF37" strokeWidth="1.5" fill="#D4AF37" fillOpacity="0.15"/>
              <rect x="23" y="70" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.4"/>
              <rect x="43" y="70" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.4"/>
              <rect x="63" y="70" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.4"/>
              <rect x="23" y="84" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.4"/>
              <rect x="43" y="84" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.4"/>
              <rect x="63" y="84" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.4"/>
              <rect x="23" y="98" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.3"/>
              <rect x="43" y="98" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.7"/>
              <rect x="63" y="98" width="14" height="10" rx="2.5" fill="#D4AF37" fillOpacity="0.3"/>
              <rect x="2" y="54" width="22" height="11" rx="2.5" fill="#D4AF37" fillOpacity="0.9"/>
              <line x1="6" y1="58.5" x2="20" y2="58.5" stroke="#000" strokeWidth="1.5" opacity="0.3"/>
              <line x1="6" y1="62" x2="17" y2="62" stroke="#000" strokeWidth="1" opacity="0.2"/>
            </svg>
          </div>
          <h2 style={{ color: '#fff', margin: 0 }}>Esperando pago en terminal</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            Presente la tarjeta en el lector Point
          </p>
          <div style={{ fontSize: '2rem', color: '#D4AF37', fontWeight: 700 }}>
            {paymentTimeLeft}s
          </div>
        </div>
      </div>
    );
  }

  // Payment cancelled overlay
  if (paymentCancelled) {
    return (
      <div className="worker-pos-overlay">
        <div className="worker-pos-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '3rem', color: '#ef4444' }} />
          </div>
          <h2 style={{ color: '#fff', margin: 0 }}>Pago cancelado o expirado</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
              onClick={handleCancelledRetry}
            >
              Reintentar
            </button>
            <button
              className="btn"
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
              onClick={() => { setPaymentCancelled(false); onClose(); }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="worker-pos-overlay">
      <div className="worker-pos-container">
        {/* Header */}
        <div className="worker-pos-header">
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FontAwesomeIcon icon={faShoppingCart} style={{ color: '#D4AF37' }} />
            Nuevo Pedido
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
              {getCartCount()} items
            </span>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {/* Mobile tab bar */}
        <div className="worker-pos-tab-bar">
          <button
            className={`worker-pos-tab-btn${mobileTab === 'products' ? ' active' : ''}`}
            onClick={() => setMobileTab('products')}
          >
            <FontAwesomeIcon icon={faUtensils} />
            Productos
          </button>
          <button
            className={`worker-pos-tab-btn${mobileTab === 'cart' ? ' active' : ''}`}
            onClick={() => setMobileTab('cart')}
          >
            <FontAwesomeIcon icon={faShoppingCart} />
            Carrito
            {getCartCount() > 0 && (
              <span className="worker-pos-tab-badge">{getCartCount()}</span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="worker-pos-body">
          {/* Left side - Products */}
          <div className={`worker-pos-products-panel${mobileTab === 'products' ? ' mobile-active' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Search */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Categories */}
            <div className="worker-pos-categories" ref={categoryScrollRef}>
              <button
                className={`worker-pos-category-btn ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`worker-pos-category-btn ${String(activeCategory) === String(cat.id) ? 'active' : ''}`}
                  onClick={() => setActiveCategory(String(cat.id))}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products grid */}
            <div className="worker-pos-products">
              {filteredProducts.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'rgba(255,255,255,0.4)' }}>
                  No se encontraron productos
                </div>
              )}
              {filteredProducts.map(product => {
                const outOfStock = !product.unlimited_stock && product.stock === 0;
                return (
                  <div
                    key={product.id}
                    className={`worker-pos-product-wrapper${outOfStock ? ' out-of-stock' : ''}`}
                    onClick={() => !outOfStock && openProductModal(product)}
                  >
                    <div className="worker-pos-product-card">
                      {product.image ? (
                        <img src={getImageUrl(product.image)} alt={product.name} />
                      ) : (
                        <FontAwesomeIcon icon={faUtensils} />
                      )}
                      {outOfStock && (
                        <span className="worker-pos-out-of-stock-badge">Agotado</span>
                      )}
                    </div>
                    <div className="worker-pos-product-info">
                      <div className="worker-pos-product-name">{product.name}</div>
                      <div className="worker-pos-product-price">{currencySymbol}{Number(product.price).toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Floating cart button - mobile only */}
            {cart.length > 0 && (
              <button className="worker-pos-float-cart" onClick={() => setMobileTab('cart')}>
                <span className="worker-pos-float-cart-count">{getCartCount()}</span>
                <span>Ver carrito</span>
                <span className="worker-pos-float-cart-total">{currencySymbol}{getCartTotal().toFixed(2)}</span>
              </button>
            )}
          </div>

          {/* Right side - Cart */}
          <div className={`worker-pos-cart${mobileTab === 'cart' ? ' mobile-active' : ''}`}>

            {/* Cart items - min-height:0 critical for flex shrink */}
            <div className="worker-pos-cart-items-scroll">
              {cart.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                  <FontAwesomeIcon icon={faShoppingBag} style={{ fontSize: '2.5rem', marginBottom: '0.75rem', display: 'block' }} />
                  Carrito vacío
                </div>
              )}
              {cart.map(item => (
                <div key={item.id} className="worker-pos-cart-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.product_name}
                    </div>
                    {(item.selected_ingredients?.length > 0 || item.selected_extras?.length > 0) && (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginTop: '2px' }}>
                        {[...(item.selected_ingredients || []), ...(item.selected_extras || [])].join(', ')}
                      </div>
                    )}
                    <div style={{ color: '#D4AF37', fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>
                      {currencySymbol}{(item.unit_price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, -1)}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: item.quantity === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)', color: item.quantity === 1 ? '#ef4444' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}
                    >
                      <FontAwesomeIcon icon={item.quantity === 1 ? faTrash : faMinus} />
                    </button>
                    <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, minWidth: '22px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart footer - always visible at bottom */}
            <div className="worker-pos-cart-footer">
              <div className="worker-pos-summary-total">
                <span>Total</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {editingTotal ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      autoFocus
                      value={customTotal !== null ? customTotal : getCartTotal().toFixed(2)}
                      onChange={e => setCustomTotal(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      onBlur={() => setEditingTotal(false)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTotal(false); }}
                      style={{
                        width: '100px', textAlign: 'right', background: 'rgba(255,255,255,0.08)',
                        border: '1px solid #D4AF37', borderRadius: '6px', color: '#D4AF37',
                        fontSize: '1rem', fontWeight: 700, padding: '2px 6px', outline: 'none'
                      }}
                    />
                  ) : (
                    <span style={{ color: customTotal !== null ? '#D4AF37' : undefined }}>
                      {currencySymbol}{getEffectiveTotal().toFixed(2)}
                      {customTotal !== null && (
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>
                          (orig. {currencySymbol}{getCartTotal().toFixed(2)})
                        </span>
                      )}
                    </span>
                  )}
                  {!editingTotal && (
                    <button
                      onClick={() => { setEditingTotal(true); if (customTotal === null) setCustomTotal(parseFloat(getCartTotal().toFixed(2))); }}
                      title="Editar total"
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px 4px', fontSize: '0.75rem' }}
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  )}
                </div>
              </div>

              {/* Order type */}
              <div className="worker-pos-order-type-center">
                <button
                  onClick={() => setOrderType('serve')}
                  className={`worker-pos-type-btn${orderType === 'serve' ? ' active' : ''}`}
                >
                  <FontAwesomeIcon icon={faUtensils} />
                  <span>Servir aquí</span>
                </button>
                <button
                  onClick={() => setOrderType('takeout')}
                  className={`worker-pos-type-btn${orderType === 'takeout' ? ' active' : ''}`}
                >
                  <FontAwesomeIcon icon={faShoppingBag} />
                  <span>Para llevar</span>
                </button>
              </div>

              <button
                disabled={cart.length === 0}
                className="worker-pos-checkout-btn"
                onClick={() => setShowPayModal(true)}
              >
                <FontAwesomeIcon icon={faShoppingCart} />
                Cobrar — {currencySymbol}{getEffectiveTotal().toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product configuration modal (ingredients/extras) */}
        {selectedProduct && (
          <div className="worker-pos-modal" onClick={(e) => { if (e.target === e.currentTarget) closeProductModal(); }}>
            <div style={{ background: '#1a1a1a', borderRadius: '16px', width: '90%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Modal header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>{selectedProduct.name}</h3>
                  <span style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600 }}>
                    {currencySymbol}{calculateProductPrice().toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={closeProductModal}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                {modalStep === 'ingredients' && selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                  <>
                    <h4 style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Ingredientes
                    </h4>
                    {selectedProduct.ingredients.map(ing => {
                      const isSelected = productConfig.selectedIngredients.some(s => s.id === ing.id);
                      const isOutOfStock = !ing.unlimited_stock && ing.stock === 0;
                      return (
                        <div
                          key={ing.id}
                          onClick={() => !isOutOfStock && toggleIngredient(ing)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.65rem 0.75rem', marginBottom: '0.4rem', borderRadius: '8px', cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            background: isSelected ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
                            border: isSelected ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
                            opacity: isOutOfStock ? 0.4 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '4px',
                              background: isSelected ? '#D4AF37' : 'rgba(255,255,255,0.08)',
                              border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {isSelected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: '0.6rem', color: '#000' }} />}
                            </div>
                            <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                              {ing.name}
                              {ing.is_required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                            </span>
                          </div>
                          {ing.price > 0 && (
                            <span style={{ color: '#D4AF37', fontSize: '0.8rem', fontWeight: 600 }}>
                              +{currencySymbol}{Number(ing.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {modalStep === 'extras' && selectedProduct.extras && selectedProduct.extras.length > 0 && (
                  <>
                    <h4 style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Extras
                    </h4>
                    {selectedProduct.extras.map(ext => {
                      const isSelected = productConfig.selectedExtras.some(s => s.id === ext.id);
                      const isOutOfStock = !ext.unlimited_stock && ext.stock === 0;
                      return (
                        <div
                          key={ext.id}
                          onClick={() => !isOutOfStock && toggleExtra(ext)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.65rem 0.75rem', marginBottom: '0.4rem', borderRadius: '8px', cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            background: isSelected ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
                            border: isSelected ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.06)',
                            opacity: isOutOfStock ? 0.4 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '4px',
                              background: isSelected ? '#D4AF37' : 'rgba(255,255,255,0.08)',
                              border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {isSelected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: '0.6rem', color: '#000' }} />}
                            </div>
                            <span style={{ color: '#fff', fontSize: '0.9rem' }}>{ext.name}</span>
                          </div>
                          {ext.price > 0 && (
                            <span style={{ color: '#D4AF37', fontSize: '0.8rem', fontWeight: 600 }}>
                              +{currencySymbol}{Number(ext.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Quantity */}
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>Cantidad:</span>
                  <button
                    onClick={() => setProductConfig(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, minWidth: '30px', textAlign: 'center' }}>
                    {productConfig.quantity}
                  </span>
                  <button
                    onClick={() => setProductConfig(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem' }}>
                {modalStep === 'extras' && selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                  <button
                    onClick={() => setModalStep('ingredients')}
                    style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Ingredientes
                  </button>
                )}
                <button
                  onClick={() => {
                    if (modalStep === 'ingredients') {
                      handleNextFromIngredients();
                    } else {
                      addToCart();
                    }
                  }}
                  style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '8px', border: 'none', background: '#D4AF37', color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  {modalStep === 'ingredients' && selectedProduct.has_extras && selectedProduct.extras && selectedProduct.extras.length > 0 ? (
                    <>
                      Extras
                      <FontAwesomeIcon icon={faArrowRight} />
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPlus} />
                      Agregar {currencySymbol}{(calculateProductPrice() * productConfig.quantity).toFixed(2)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment modal */}
        {showPayModal && (
          <div className="worker-pos-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowPayModal(false); }}>
            <div className="worker-pos-pay-modal">
              <div className="worker-pos-pay-modal-header">
                <h3>Cobrar pedido</h3>
                <button className="worker-pos-pay-modal-close" onClick={() => setShowPayModal(false)}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              <div className="worker-pos-pay-modal-total">
                <span>Total a cobrar</span>
                {editingTotal ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={customTotal !== null ? customTotal : getCartTotal()}
                    onChange={e => setCustomTotal(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    onBlur={() => setEditingTotal(false)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTotal(false); }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'block', margin: '6px auto 0', width: '180px', textAlign: 'center',
                      background: 'rgba(255,255,255,0.08)', border: '2px solid #D4AF37',
                      borderRadius: '10px', color: '#D4AF37', fontSize: '2rem', fontWeight: 800,
                      padding: '8px 10px', outline: 'none', letterSpacing: '-0.02em'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <span className="worker-pos-pay-modal-amount">
                      {currencySymbol}{getEffectiveTotal().toFixed(2)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingTotal(true); if (customTotal === null) setCustomTotal(parseFloat(getCartTotal().toFixed(2))); }}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </div>
                )}
              </div>

              <div className="worker-pos-pay-modal-options">
                {(paymentMethods.length > 0 || tuuAvailable || terminals.length > 0) ? (
                  <div>
                    {terminals.length > 0 && (
                      <button
                        className="worker-pos-pay-modal-option"
                        style={{ animationDelay: '0.1s' }}
                        disabled={processingPayment}
                        onClick={() => { setShowPayModal(false); processPayment('card'); }}
                      >
                        <div className="worker-pos-pay-modal-option-icon" style={{ backgroundColor: '#009EE320', color: '#009EE3' }}>
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </div>
                        <div className="worker-pos-pay-modal-option-info">
                          <span className="worker-pos-pay-modal-option-title">Mercado Pago Point</span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{terminals[0]?.name || 'Terminal'}</span>
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} className="worker-pos-pay-modal-option-arrow" />
                      </button>
                    )}
                    {tuuAvailable && (
                      <button
                        className="worker-pos-pay-modal-option"
                        style={{ animationDelay: terminals.length > 0 ? '0.18s' : '0.1s' }}
                        disabled={processingPayment}
                        onClick={() => { setShowPayModal(false); processPayment('tuu'); }}
                      >
                        <div className="worker-pos-pay-modal-option-icon" style={{ backgroundColor: '#9c27b020', color: '#9c27b0' }}>
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </div>
                        <div className="worker-pos-pay-modal-option-info">
                          <span className="worker-pos-pay-modal-option-title">Tuu POS</span>
                          {tuuDeviceName && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{tuuDeviceName}</span>}
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} className="worker-pos-pay-modal-option-arrow" />
                      </button>
                    )}
                    {paymentMethods.map((method, idx) => (
                      <button
                        key={method.id}
                        className="worker-pos-pay-modal-option"
                        style={{ animationDelay: `${0.26 + idx * 0.08}s` }}
                        disabled={processingPayment}
                        onClick={() => { setShowPayModal(false); processPayment(method.name.toLowerCase()); }}
                      >
                        <div className="worker-pos-pay-modal-option-icon" style={{ backgroundColor: `${method.color}20`, color: method.color }}>
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </div>
                        <div className="worker-pos-pay-modal-option-info">
                          <span className="worker-pos-pay-modal-option-title">{method.name}</span>
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} className="worker-pos-pay-modal-option-arrow" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#f59e0b' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No hay métodos de pago disponibles</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', opacity: 0.7 }}>Configúralos en Pago manual desde el panel admin</p>
                  </div>
                )}
                <button
                  onClick={() => setShowPayModal(false)}
                  style={{ width: '100%', marginTop: '12px', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default WorkerNewOrder;
