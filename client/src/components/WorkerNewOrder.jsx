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
  faBuilding
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
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [cashPaymentSuccess, setCashPaymentSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(90);

  const categoryScrollRef = useRef(null);

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
      const [storeRes, terminalsRes] = await Promise.all([
        fetch(API + `/api/public/${storeCode}`),
        fetch(API + `/api/public/${storeCode}/mercado-pago-terminals`)
      ]);

      if (!storeRes.ok) throw new Error('Error al cargar la tienda');

      const storeData = await storeRes.json();
      const terminalsData = terminalsRes.ok ? await terminalsRes.json() : [];

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

  // Poll payment status for card payments
  useEffect(() => {
    if (!paymentWaiting || !pendingOrderData) return;

    const orderId = pendingOrderData.order.id;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(API + `/api/orders/${orderId}/payment-status?store_id=${storeId}`);
        if (!res.ok) return;
        const data = await res.json();

        const mpStatus = data.mp_status || data.status;
        const payStatus = data.payment_status || data.status;
        const paidAmount = data.paid_amount || '0';

        const isApproved =
          (payStatus === 'approved' || payStatus === 'paid' || payStatus === 'processed' ||
           mpStatus === 'processed') &&
          (parseFloat(paidAmount) > 0 || payStatus === 'processed' || mpStatus === 'processed');
        const isCancelled = mpStatus === 'canceled' || mpStatus === 'refunded' ||
          mpStatus === 'expired' || mpStatus === 'failed' ||
          payStatus === 'canceled' || payStatus === 'refunded' ||
          data.order_status === 'canceled' || data.order_status === 'refunded';

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
    }, 5000);

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

    const hasIngredients = product.ingredients && product.ingredients.length > 0;
    const hasExtras = product.extras && product.extras.length > 0;

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

    if (selectedProduct.extras && selectedProduct.extras.length > 0) {
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
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

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

    const total = getCartTotal();
    const orderData = {
      store_id: storeId,
      order_type: orderType,
      payment_method: method,
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
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '2.5rem', color: '#D4AF37' }} />
          <h2 style={{ color: '#fff', margin: 0 }}>Esperando pago en terminal</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            Presente la tarjeta en el lector Point
          </p>
          <div style={{ fontSize: '2rem', color: '#D4AF37', fontWeight: 700 }}>
            {paymentTimeLeft}s
          </div>
          <button
            className="btn"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
            onClick={() => { setPaymentWaiting(false); setPaymentCancelled(true); }}
          >
            <FontAwesomeIcon icon={faTimes} style={{ marginRight: '0.5rem' }} />
            Cancelar
          </button>
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

        {/* Body */}
        <div className="worker-pos-body">
          {/* Left side - Products */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                    className="worker-pos-product"
                    onClick={() => !outOfStock && openProductModal(product)}
                    style={{ opacity: outOfStock ? 0.4 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}
                  >
                    <div className="worker-pos-product-img">
                      {product.image ? (
                        <img src={getImageUrl(product.image)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px 8px 0 0' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px 8px 0 0' }}>
                          <FontAwesomeIcon icon={faUtensils} style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.2)' }} />
                        </div>
                      )}
                      {outOfStock && (
                        <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Agotado
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '0.5rem' }}>
                      <div className="worker-pos-product-name">{product.name}</div>
                      <div className="worker-pos-product-price">{currencySymbol}{Number(product.price).toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side - Cart */}
          <div className="worker-pos-cart">
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FontAwesomeIcon icon={faShoppingCart} style={{ color: '#D4AF37' }} />
              Carrito ({getCartCount()})
            </div>

            {/* Cart items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {cart.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                  <FontAwesomeIcon icon={faShoppingBag} style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }} />
                  Carrito vacio
                </div>
              )}
              {cart.map(item => (
                <div key={item.id} className="worker-pos-cart-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.product_name}
                    </div>
                    {(item.selected_ingredients?.length > 0 || item.selected_extras?.length > 0) && (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginTop: '2px' }}>
                        {[...(item.selected_ingredients || []), ...(item.selected_extras || [])].join(', ')}
                      </div>
                    )}
                    <div style={{ color: '#D4AF37', fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' }}>
                      {currencySymbol}{(item.unit_price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, -1)}
                      style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: item.quantity === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)', color: item.quantity === 1 ? '#ef4444' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}
                    >
                      <FontAwesomeIcon icon={item.quantity === 1 ? faTrash : faMinus} />
                    </button>
                    <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart footer */}
            <div className="worker-pos-cart-footer">
              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.75rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Total</span>
                <span style={{ color: '#D4AF37', fontSize: '1.3rem', fontWeight: 700 }}>
                  {currencySymbol}{getCartTotal().toFixed(2)}
                </span>
              </div>

              {/* Order type */}
              <div className="worker-pos-order-type-grid">
                {[
                  { value: 'serve', label: 'Servir aqui', icon: faUtensils },
                  { value: 'takeout', label: 'Para llevar', icon: faShoppingBag },
                  { value: 'delivery', label: 'Delivery', icon: faMotorcycle },
                  { value: 'pedidosya', label: 'PedidosYa', icon: faMotorcycle },
                  { value: 'rappi', label: 'Rappi', icon: faMotorcycle },
                  { value: 'mostrador', label: 'Mostrador', icon: faConciergeBell }
                ].map(type => (
                  <button
                    key={type.value}
                    onClick={() => setOrderType(type.value)}
                    className={`worker-pos-type-btn${orderType === type.value ? ' active' : ''}`}
                  >
                    <FontAwesomeIcon icon={type.icon} />
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Terminal selector (for card) */}
              {terminals.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <select
                    value={selectedTerminalId}
                    onChange={(e) => setSelectedTerminalId(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
                    }}
                  >
                    {terminals.map(t => (
                      <option key={t.id} value={String(t.id)} style={{ background: '#111', color: '#fff' }}>
                        {t.name || `Terminal ${t.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={cart.length === 0 || processingPayment}
                  onClick={() => processPayment('cash')}
                  style={{
                    flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    background: cart.length === 0 ? 'rgba(34,197,94,0.1)' : '#22c55e',
                    color: cart.length === 0 ? 'rgba(34,197,94,0.4)' : '#fff',
                    fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  {processingPayment ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faMoneyBillWave} />
                  )}
                  Efectivo
                </button>
                <button
                  disabled={cart.length === 0 || processingPayment || terminals.length === 0}
                  onClick={() => processPayment('card')}
                  style={{
                    flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', cursor: (cart.length === 0 || terminals.length === 0) ? 'not-allowed' : 'pointer',
                    background: (cart.length === 0 || terminals.length === 0) ? 'rgba(99,102,241,0.1)' : '#6366f1',
                    color: (cart.length === 0 || terminals.length === 0) ? 'rgba(99,102,241,0.4)' : '#fff',
                    fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  {processingPayment ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faCreditCard} />
                  )}
                  Tarjeta
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
                  {modalStep === 'ingredients' && selectedProduct.extras && selectedProduct.extras.length > 0 ? (
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
      </div>
    </div>
  );
}

export default WorkerNewOrder;
