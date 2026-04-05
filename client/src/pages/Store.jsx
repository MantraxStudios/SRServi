import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShoppingCart, 
  faPlus, 
  faMinus, 
  faTimes, 
  faTimesCircle,
  faBox,
  faArrowLeft,
  faCopy,
  faCreditCard,
  faMoneyBillWave,
  faCheck,
  faTags
} from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import { SOCKET_URL, getImageUrl, API_URL } from '../config.js';

function Store() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const terminalFromUrl = searchParams.get('terminal');
  const configFromUrl = searchParams.get('config');
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]); 
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderType, setOrderType] = useState('serve');
  const [productConfig, setProductConfig] = useState({
    selectedIngredients: [],
    selectedExtras: [],
    quantity: 1
  });
  const [ingredientsModalOpen, setIngredientsModalOpen] = useState(false);
  const [extrasModalOpen, setExtrasModalOpen] = useState(false);
  const [productModalStep, setProductModalStep] = useState('main');
  const [addingToCart, setAddingToCart] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [lastOrderNumber, setLastOrderNumber] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [availableTerminals, setAvailableTerminals] = useState([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfiguration, setSelectedConfiguration] = useState(null);
  const categoryRef = useRef(null);

  useEffect(() => {
    setActiveCategory('all');
  }, [store?.id]);

  useEffect(() => {
    if (selectedConfiguration?.is_minimarket && store?.store?.code) {
      navigate(`/market/${store.store.code}${configFromUrl ? `?config=${configFromUrl}` : ''}`);
    }
  }, [selectedConfiguration, store]);

  useEffect(() => {
    const container = categoryRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cat = entry.target.dataset.category;
            if (cat) setActiveCategory(cat);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    const reobserve = () => {
      const tabs = container.querySelectorAll('.categoryTab');
      tabs.forEach((tab) => observer.observe(tab));
    };

    reobserve();
    const mutationObserver = new MutationObserver(reobserve);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [cashPaymentSuccess, setCashPaymentSuccess] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(90);
  const [notification, setNotification] = useState(null);
  const [barcode, setBarcode] = useState('');
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchStore();
    
    const socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      console.log('Conectado al servidor WebSocket');
      if (store?.store?.id) {
        socket.emit('register_store', store.store.id);
      }
    });
    
    socket.on('product_created', (product) => {
      console.log('Producto creado en tiempo real:', product);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: [...prev.products, product]
        };
      });
    });
    
    socket.on('product_updated', (product) => {
      console.log('Producto actualizado en tiempo real:', product);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map(p => p.id === product.id ? product : p)
        };
      });
    });
    
    socket.on('product_deleted', (data) => {
      console.log('Producto eliminado en tiempo real:', data);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.filter(p => p.id !== data.id)
        };
      });
    });
    
    socket.on('category_created', () => fetchStore());
    socket.on('category_updated', () => fetchStore());
    socket.on('category_deleted', () => fetchStore());
    socket.on('ingredient_created', () => fetchStore());
    socket.on('ingredient_updated', () => fetchStore());
    socket.on('ingredient_deleted', () => fetchStore());
    socket.on('extra_created', () => fetchStore());
    socket.on('extra_updated', () => fetchStore());
    socket.on('extra_deleted', () => fetchStore());
    socket.on('inventory_updated', (data) => {
      console.log('Inventario actualizado en tiempo real:', data);
      setStore(prev => {
        if (!prev) return prev;
        const updatedProducts = prev.products.map(product => {
          if (product.id === data.product_id) {
            return {
              ...product,
              stock: data.stock !== undefined ? data.stock : product.stock,
              unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : product.unlimited_stock
            };
          }
          if (product.ingredients) {
            product.ingredients = product.ingredients.map(ing => {
              if (ing.id === data.product_id) {
                return {
                  ...ing,
                  stock: data.stock !== undefined ? data.stock : ing.stock,
                  unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : ing.unlimited_stock
                };
              }
              return ing;
            });
          }
          if (product.extras) {
            product.extras = product.extras.map(ext => {
              if (ext.id === data.product_id) {
                return {
                  ...ext,
                  stock: data.stock !== undefined ? data.stock : ext.stock,
                  unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : ext.unlimited_stock
                };
              }
              return ext;
            });
          }
          return product;
        });
        return { ...prev, products: updatedProducts };
      });
    });
    
    return () => {
      socket.disconnect();
    };
  }, [code, terminalFromUrl]);

  useEffect(() => {
    if (store?.store?.id) {
      const socket = io(SOCKET_URL);
      socket.emit('register_store', store.store.id);
      socket.disconnect();
    }
  }, [store?.store?.id]);

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/public/${code}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Código no encontrado');
        }
        if (response.status === 403) {
          const data = await response.json();
          throw new Error(data.error || 'Tienda suspendida');
        }
        throw new Error('Error al cargar la tienda');
      }

      const data = await response.json();
      const uniqueProducts = (data.products || []).filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );
      const uniqueCategories = (data.categories || []).filter((cat, index, self) =>
        index === self.findIndex((c) => c.id === cat.id)
      );
      const uniqueIngredients = (data.ingredients || []).filter((ing, index, self) =>
        index === self.findIndex((i) => i.id === ing.id)
      );
      const uniqueExtras = (data.extras || []).filter((ext, index, self) =>
        index === self.findIndex((e) => e.id === ext.id)
      );
      const deduplicatedData = {
        ...data,
        products: uniqueProducts,
        categories: uniqueCategories,
        ingredients: uniqueIngredients,
        extras: uniqueExtras
      };
      console.log('Store data received:', deduplicatedData);
      console.log('Number of products:', deduplicatedData.products?.length || 0);
      setStore(deduplicatedData);

      const terminalsResponse = await fetch(`/api/public/${code}/mercado-pago-terminals`);
      if (terminalsResponse.ok) {
        const terminalsData = await terminalsResponse.json();
        const safeTerminals = Array.isArray(terminalsData) ? terminalsData : [];
        setAvailableTerminals(safeTerminals);
        const hasTerminalFromUrl = terminalFromUrl && safeTerminals.some(terminal => String(terminal.id) === String(terminalFromUrl));
        setSelectedTerminalId(prev =>
          hasTerminalFromUrl
            ? String(terminalFromUrl)
            : (prev && safeTerminals.some(terminal => String(terminal.id) === String(prev)))
            ? prev
            : (safeTerminals[0]?.id ? String(safeTerminals[0].id) : '')
        );
      } else {
        setAvailableTerminals([]);
        setSelectedTerminalId('');
      }

      const configsResponse = await fetch(`/api/public/store-configurations/${data.store.id}`);
      if (configsResponse.ok) {
        const configsData = await configsResponse.json();
        setConfigurations(configsData);
        
        if (configFromUrl) {
          const urlConfig = configsData.find(c => String(c.id) === String(configFromUrl));
          setSelectedConfiguration(urlConfig || null);
        } else {
          const defaultConfig = configsData.find(c => c.is_default) || configsData[0];
          setSelectedConfiguration(defaultConfig || null);
        }
      } else {
        setConfigurations([]);
        setSelectedConfiguration(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const colors = store?.store ? {
    primary: store.store.primary_color || '#000000',
    secondary: store.store.secondary_color || '#FFFFFF',
    accent: store.store.accent_color || '#D4AF37',
    header: store.store.header_color || '#000000',
    currency: {
      symbol: store.store.currency_symbol || '$',
      code: store.store.currency_code || 'USD',
      name: store.store.currency_name || 'Dólar Estadounidense'
    }
  } : {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#D4AF37',
    header: '#000000',
    currency: {
      symbol: '$',
      code: 'USD',
      name: 'Dólar Estadounidense'
    }
  };

  const openProductModal = (product) => {
    if (!product.unlimited_stock && product.stock === 0) {
      setNotification({ name: product.name, agotado: true });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    setSelectedProduct(product);
    setProductConfig({
      selectedIngredients: [],
      selectedExtras: [],
      quantity: 1,
      notes: ''
    });
    
    const hasIngredients = product.ingredients && product.ingredients.length > 0;
    
    if (hasIngredients) {
      setProductModalStep('complements');
      setTimeout(() => setIngredientsModalOpen(true), 100);
    } else {
      setProductModalStep('main');
      setTimeout(() => addToCart(), 100);
    }
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setProductModalStep('main');
    setAddingToCart(false);
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
  };

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
    const interval = setInterval(() => {
      if (barcodeInputRef.current && document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBarcodeScan = (barcodeValue) => {
    if (!store?.products) return;
    const found = store.products.find(p => p.barcode === barcodeValue);
    if (found) {
      if (!found.unlimited_stock && found.stock === 0) {
        setNotification({ name: found.name, agotado: true });
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      setNotification({ name: found.name, image: found.image });
      setTimeout(() => setNotification(null), 2000);
      const unitPrice = found.price;
      const cartItem = {
        id: Date.now(),
        product_id: found.id,
        product_name: found.name,
        unit_price: unitPrice,
        quantity: 1,
        total: unitPrice
      };
      setCart([...cart, cartItem]);
    } else if (barcodeValue.length > 0) {
      setNotification({ name: 'Producto no encontrado', image: null });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const toggleIngredient = (ingredient) => {
    const isOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
    if (isOutOfStock) {
      return;
    }
    setProductConfig(prev => {
      const exists = prev.selectedIngredients.find(i => i.id === ingredient.id);
      if (exists) {
        return {
          ...prev,
          selectedIngredients: prev.selectedIngredients.filter(i => i.id !== ingredient.id)
        };
      } else {
        const ingredientConfig = selectedProduct.ingredients.find(i => i.id === ingredient.id);
        const maxSelections = ingredientConfig?.max_selections || 1;
        if (prev.selectedIngredients.length >= maxSelections) {
          alert(`Solo puedes seleccionar máximo ${maxSelections} ingrediente(s) de "${ingredientConfig.name}"`);
          return prev;
        }
        return {
          ...prev,
          selectedIngredients: [...prev.selectedIngredients, ingredient]
        };
      }
    });
  };

  const toggleExtra = (extra) => {
    const isOutOfStock = !extra.unlimited_stock && extra.stock === 0;
    if (isOutOfStock) {
      return;
    }
    setProductConfig(prev => {
      const exists = prev.selectedExtras.find(e => e.id === extra.id);
      if (exists) {
        return {
          ...prev,
          selectedExtras: prev.selectedExtras.filter(e => e.id !== extra.id)
        };
      } else {
        return {
          ...prev,
          selectedExtras: [...prev.selectedExtras, extra]
        };
      }
    });
  };

  const calculateProductPrice = () => {
    if (!selectedProduct) return 0;
    
    let price = selectedProduct.price;
    
    productConfig.selectedIngredients.forEach(ing => {
      price += ing.price || 0;
    });
    
    productConfig.selectedExtras.forEach(extra => {
      price += extra.price || 0;
    });
    
    return price;
  };

  const addToCart = () => {
    if (!selectedProduct) return;

    setAddingToCart(true);
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
    
    setTimeout(() => {
      const unitPrice = calculateProductPrice();
      const cartItem = {
        id: Date.now(),
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        unit_price: unitPrice,
        quantity: productConfig.quantity,
        total: unitPrice * productConfig.quantity,
        selected_ingredients: productConfig.selectedIngredients.map(i => i.name),
        selected_extras: productConfig.selectedExtras.map(e => e.name)
      };

      setCart([...cart, cartItem]);
      setNotification({ name: selectedProduct.name, image: selectedProduct.image });
      setAddingToCart(false);
      setProductModalStep('main');
      setTimeout(() => {
        setNotification(null);
        closeProductModal();
      }, 1500);
    }, 800);
  };

  const handleNextToExtras = () => {
    const requiredIngredients = selectedProduct.ingredients.filter(ing => ing.is_required);
    const missingRequired = requiredIngredients.filter(req => 
      !productConfig.selectedIngredients.some(sel => sel.id === req.id)
    );
    
    if (missingRequired.length > 0) {
      alert(`Por favor selecciona los siguientes ingredientes obligatorios:\n${missingRequired.map(i => '• ' + i.name).join('\n')}`);
      return;
    }
    
    setIngredientsModalOpen(false);
    
    if (selectedProduct.extras && selectedProduct.extras.length > 0) {
      setProductModalStep('extras');
      setTimeout(() => setExtrasModalOpen(true), 100);
    } else {
      setTimeout(() => addToCart(), 100);
    }
  };

  const handleBackToMain = () => {
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
    setProductModalStep('main');
  };

  const handleBackToComplements = () => {
    setExtrasModalOpen(false);
    setProductModalStep('complements');
    setTimeout(() => setIngredientsModalOpen(true), 100);
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0) {
          return { 
            ...item, 
            quantity: newQuantity,
            total: Number(item.unit_price) * newQuantity
          };
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

  const getFinalTotal = () => {
    const subtotal = getCartTotal();
    const discount = Number(appliedCoupon?.discount_total || 0);
    return Math.max(subtotal - discount, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    alert('Código copiado: ' + code);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setPaymentModalOpen(true);
  };

  const applyCoupon = async () => {
    if (!couponCodeInput.trim() || cart.length === 0) return;
    try {
      setCouponLoading(true);
      const response = await fetch(`/api/public/${code}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_code: couponCodeInput.trim(),
          subtotal: getCartTotal()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo aplicar el cupón');
      }
      setAppliedCoupon(data);
      setCouponCodeInput(data.coupon_code || couponCodeInput.trim().toUpperCase());
    } catch (err) {
      alert(err.message);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
  };

  const processPayment = async (selectedMethod = paymentMethod) => {
    if (cart.length === 0) return;
    if (selectedMethod === 'card' && !selectedTerminalId) {
      alert('No hay máquina Point asignada para esta sesión');
      return;
    }

    setPaymentMethod(selectedMethod);
    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentConfirmed(false);
    setPaymentCancelled(false);

    const finalTotal = getFinalTotal();
    const orderData = {
      store_id: store.store.id,
      order_type: orderType,
      payment_method: selectedMethod,
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        selected_ingredients: item.selected_ingredients,
        selected_extras: item.selected_extras
      })),
      selected_terminal_id: selectedMethod === 'card' && selectedTerminalId ? parseInt(selectedTerminalId) : null,
      coupon_code: appliedCoupon?.coupon_code || null,
      total: Number(finalTotal).toFixed(2)
    };

    try {
      let response;
      
      if (selectedMethod === 'card') {
        response = await fetch(`${API_URL}/api/orders/process-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        });
      } else {
        response = await fetch(`${API_URL}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el pedido');
      }

      const result = await response.json();
      const order = result.order || result;
      const storeId = store.store.id;
      
      setPendingOrderData({ order, storeId });

      if (selectedMethod === 'card') {
        setPaymentWaiting(true);
        setPaymentTimeLeft(90);
      } else {
        setLastOrderNumber(order.order_number);
        setCashPaymentSuccess(true);
        setPaymentModalOpen(false);
        setCart([]);
        setCartOpen(false);
      }
    } catch (err) {
      setPaymentError(err.message);
      alert(err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  useEffect(() => {
    if (!paymentWaiting || !pendingOrderData) return;

    const orderId = pendingOrderData.order.id;
    const storeId = pendingOrderData.storeId;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/payment-status?store_id=${storeId}`);
        if (!res.ok) return;
        const data = await res.json();

        const mpStatus = data.mp_status || data.status;
        const payStatus = data.payment_status || data.status;
        const paidAmount = data.paid_amount || '0';

        // La nueva API de MP Point usa 'processed' para pagos exitosos.
        // El backend ya mapea 'processed' -> 'approved', pero cubrimos ambos por seguridad.
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
          await fetch(`/api/orders/${orderId}/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store_id: storeId })
          });
          setPaymentConfirmed(true);
          setLastOrderNumber(pendingOrderData.order.order_number);
          setCart([]);
          setCartOpen(false);
          setPaymentModalOpen(false);
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
  }, [paymentWaiting, pendingOrderData, pendingOrderData?.order?.id]);

  useEffect(() => {
    setAppliedCoupon(null);
  }, [cart]);

  const groupProductsByCategory = () => {
    if (!store?.products) return {};
    
    const grouped = {};
    store.products.forEach(product => {
      const category = product.category_name || 'Sin Categoria';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="loading" style={{ backgroundColor: '#F5F5F5' }}>
        Cargando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="index-container">
        <div className="index-card">
          <h1 className="index-title" style={{ color: '#DC3545' }}>Error</h1>
          <p className="index-subtitle">{error}</p>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ width: '100%' }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const groupedProducts = groupProductsByCategory();
  const hasProducts = Object.keys(groupedProducts).length > 0;

  return (
    <div className="store-container" style={{ backgroundColor: colors.secondary }}>
      <header style={{
        background: `linear-gradient(135deg, ${colors.header}, ${colors.primary})`,
        color: colors.accent,
        padding: '16px 24px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
      }}>
        {store?.store?.is_premium ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {store?.store?.logo_url && (
                <img 
                  src={store.store.logo_url} 
                  alt={store?.store?.name} 
                  style={{ 
                    maxHeight: '80px',
                    maxWidth: '140px',
                    objectFit: 'contain'
                  }} 
                />
              )}
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: '700',
                color: colors.accent,
                margin: 0
              }}>
                {store?.store?.name}
              </h1>
            </div>
            <p style={{ 
              fontSize: '16px',
              fontWeight: '600',
              color: colors.secondary,
              margin: 0,
              opacity: 0.9
            }}>
              AutoServicio By SRAutomatic
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <p style={{ 
              fontSize: '16px',
              fontWeight: '600',
              color: colors.secondary,
              margin: 0,
              opacity: 0.9
            }}>
              AutoServicio By SRAutomatic
            </p>
          </div>
        )}
      </header>

      {!configFromUrl && configurations.length > 1 && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: colors.secondary,
          borderBottom: `2px solid ${colors.primary}20`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            {configurations.map(config => (
              <button
                key={config.id}
                onClick={() => setSelectedConfiguration(config)}
                style={{
                  flexShrink: 0,
                  padding: '10px 20px',
                  borderRadius: '20px',
                  border: `2px solid ${selectedConfiguration?.id === config.id ? colors.accent : '#ddd'}`,
                  backgroundColor: selectedConfiguration?.id === config.id ? colors.primary : colors.secondary,
                  color: selectedConfiguration?.id === config.id ? colors.accent : '#666',
                  fontWeight: selectedConfiguration?.id === config.id ? '700' : '500',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {config.accept_cash && <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '12px' }} />}
                {config.accept_card && <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '12px' }} />}
                {config.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '16px 16px 8px', backgroundColor: colors.secondary }}>
        <div
          ref={categoryRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
        <style>{`.categoryTab{outline:none!important}.categoryTab:focus{outline:none!important}.categoryTab:active{transform:scale(0.97)}`}</style>
        <button
          className="categoryTab"
          data-category="all"
          onClick={() => setActiveCategory('all')}
          style={{
            flexShrink: 0,
            padding: '14px 28px',
            borderRadius: '25px',
            border: `2px solid ${activeCategory === 'all' ? colors.accent : '#ddd'}`,
            backgroundColor: activeCategory === 'all' ? colors.accent : colors.secondary,
            color: activeCategory === 'all' ? colors.primary : '#666',
            fontWeight: activeCategory === 'all' ? '700' : '500',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 6px 25px rgba(0, 0, 0, 0.25)'
          }}
        >
          Todo
        </button>
        {Object.keys(groupedProducts).map(cat => (
          <button
            key={cat}
            className="categoryTab"
            data-category={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              flexShrink: 0,
              padding: '14px 28px',
              borderRadius: '25px',
              border: `2px solid ${activeCategory === cat ? colors.accent : '#ddd'}`,
              backgroundColor: activeCategory === cat ? colors.accent : colors.secondary,
              color: activeCategory === cat ? colors.primary : '#666',
              fontWeight: activeCategory === cat ? '700' : '500',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 6px 25px rgba(0, 0, 0, 0.25)'
            }}
          >
            {cat}
          </button>
        ))}
        </div>
      </div>

      {!hasProducts && (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}40)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px'
          }}>
            <FontAwesomeIcon icon={faBox} style={{ fontSize: '60px', color: colors.accent }} />
          </div>
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: colors.primary, 
            marginBottom: '16px' 
          }}>
            Esta tienda aún no tiene productos
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: '#666', 
            marginBottom: '24px',
            lineHeight: '1.6'
          }}>
            El propietario aún no ha agregado productos a su catálogo. ¡Vuelve pronto!
          </p>
        </div>
      )}

      {hasProducts && activeCategory === 'all' && (
        <div className="category-sections">
          {Object.entries(groupedProducts).map(([category, products], catIndex) => (
            <div key={category} className="category-section">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '20px 16px 16px 16px',
                marginBottom: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <FontAwesomeIcon 
                    icon={faTags} 
                    style={{ 
                      fontSize: '18px',
                      color: colors.accent
                    }} 
                  />
                  <h3 style={{
                    fontSize: '22px',
                    fontWeight: '700',
                    color: colors.primary,
                    margin: 0
                  }}>
                    {category}
                  </h3>
                </div>
                <div style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: colors.accent,
                  borderRadius: '2px',
                  opacity: 0.3,
                  marginLeft: '16px'
                }} />
              </div>
              <div className="products-grid">
                {products.map(product => {
                  const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
                  const isOutOfStock = !isUnlimited && product.stock === 0;
                  return (
                  <div 
                    key={product.id} 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: isOutOfStock ? 'default' : 'pointer'
                    }}
                  >
                    <div 
                      style={{
                        backgroundColor: isOutOfStock ? '#f8f9fa' : '#ffffff',
                        border: 'none',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 6px 30px rgba(0, 0, 0, 0.25)',
                        opacity: isOutOfStock ? 0.6 : 1,
                        width: '300px',
                        height: '300px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={() => openProductModal(product)}
                      onMouseEnter={(e) => {
                        if (!isOutOfStock) {
                          e.currentTarget.style.transform = 'translateY(-8px)';
                          e.currentTarget.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.35)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isOutOfStock) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 0, 0, 0.25)';
                        }
                      }}
                    >
                      {isOutOfStock && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          zIndex: 2,
                          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                        }}>
                          Agotado
                        </div>
                      )}
                      <div className="product-image" style={{
                        width: '260px',
                        height: '260px',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        {product.image ? (
                          <img 
                            src={getImageUrl(product.image)} 
                            alt={product.name} 
                            style={{ 
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                              transition: 'transform 0.3s ease',
                              filter: isOutOfStock ? 'grayscale(100%)' : 'none'
                            }}
                          />
                        ) : (
                          <FontAwesomeIcon icon={faBox} style={{ fontSize: '60px', color: isOutOfStock ? '#adb5bd' : '#dee2e6' }} />
                        )}
                      </div>
                    </div>
                    <div className="product-info" style={{ 
                      marginTop: '12px',
                      textAlign: 'center',
                      width: '100%'
                    }}>
                      <div style={{ 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: isOutOfStock ? '#adb5bd' : '#212529',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ fontWeight: '600' }}>{product.name}:</span>
                        <span style={{ fontWeight: '700' }}>{colors.currency.symbol}{Number(product.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasProducts && activeCategory !== 'all' && (
        <div className="products-grid">
          {Object.entries(groupedProducts)
            .filter(([category]) => activeCategory === category)
            .flatMap(([category, products]) =>
              products.map(product => {
                const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
                const isOutOfStock = !isUnlimited && product.stock === 0;
                return (
                <div 
                  key={product.id} 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: isOutOfStock ? 'default' : 'pointer'
                  }}
                >
                  <div 
                    style={{
                      backgroundColor: isOutOfStock ? '#f8f9fa' : '#ffffff',
                      border: 'none',
                      borderRadius: '32px',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 6px 30px rgba(0, 0, 0, 0.25)',
                      opacity: isOutOfStock ? 0.6 : 1,
                      width: '300px',
                      height: '300px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => openProductModal(product)}
                    onMouseEnter={(e) => {
                      if (!isOutOfStock) {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.35)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOutOfStock) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 0, 0, 0.25)';
                      }
                    }}
                  >
                    {isOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        zIndex: 2,
                        boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                      }}>
                        Agotado
                      </div>
                    )}
                    <div className="product-image" style={{
                      width: '260px',
                      height: '260px',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {product.image ? (
                        <img 
                          src={getImageUrl(product.image)} 
                          alt={product.name} 
                          style={{ 
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            transition: 'transform 0.3s ease',
                            filter: isOutOfStock ? 'grayscale(100%)' : 'none'
                          }}
                        />
                      ) : (
                        <FontAwesomeIcon icon={faBox} style={{ fontSize: '60px', color: isOutOfStock ? '#adb5bd' : '#dee2e6' }} />
                      )}
                    </div>
                  </div>
                  <div className="product-info" style={{ 
                    marginTop: '12px',
                    textAlign: 'center',
                    width: '100%'
                  }}>
                    <div style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: isOutOfStock ? '#adb5bd' : '#212529',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ fontWeight: '600' }}>{product.name}:</span>
                      <span style={{ fontWeight: '700' }}>{colors.currency.symbol}{Number(product.price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            }))}
        </div>
      )}

      {hasProducts && (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        zIndex: 1000,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }} onClick={() => setCartOpen(true)}>
          <div style={{
            position: 'relative',
            backgroundColor: colors.accent,
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: '20px', color: colors.primary }} />
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              backgroundColor: '#DC3545',
              color: '#fff',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '700'
            }}>{getCartCount()}</span>
          </div>
          <span style={{ color: colors.accent, fontSize: '14px', fontWeight: '600' }}>Ver carrito</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{ color: colors.accent, fontSize: '20px', fontWeight: '700' }}>
            {colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}
          </span>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              backgroundColor: colors.accent,
              color: colors.primary,
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            PAGAR
          </button>
        </div>
      </div>
      )}

      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          backgroundColor: 'white',
          border: '1px solid #e9ecef',
          padding: '14px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 1002,
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          animation: 'slideUp 0.3s ease'
        }}>
          {notification.image ? (
            <img 
              src={getImageUrl(notification.image)} 
              alt={notification.name}
              style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #f1f3f5' }}
            />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e9ecef' }}>
              <FontAwesomeIcon icon={faBox} style={{ color: '#adb5bd', fontSize: '24px' }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#212529' }}>{notification.name}</div>
            {notification.agotado ? (
              <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '2px' }}>Agotado</div>
            ) : (
              <div style={{ fontSize: '12px', color: '#28a745', marginTop: '2px' }}>Agregado ✓</div>
            )}
          </div>
        </div>
      )}

      <input
        ref={barcodeInputRef}
        type="text"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && barcode) {
            e.preventDefault();
            handleBarcodeScan(barcode);
            setBarcode('');
          }
        }}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          border: 'none',
          outline: 'none',
          padding: 0
        }}
        autoFocus
      />

      {ingredientsModalOpen && selectedProduct && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}
          onClick={() => setIngredientsModalOpen(false)}
        >
          <div 
            style={{
              backgroundColor: colors.secondary,
              borderRadius: 'var(--radius-xl)',
              width: '95vw',
              maxWidth: '900px',
              height: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              backgroundColor: colors.header,
              color: colors.accent,
              padding: '20px',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              textAlign: 'center',
              position: 'relative'
            }}>
              <button 
                onClick={() => {
                  setIngredientsModalOpen(false);
                  setProductModalStep('main');
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.accent,
                  fontSize: '24px',
                  cursor: 'pointer',
                  position: 'absolute',
                  top: '10px',
                  right: '10px'
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? 'Complementos' : `1. Complementos`}
              </h2>
            </div>
            
            <div style={{
              padding: '12px 20px',
              backgroundColor: colors.secondary,
              borderBottom: `2px solid ${colors.primary}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: colors.primary
              }}>
                Seleccionados:
              </span>
              <span style={{
                fontSize: '20px',
                fontWeight: '700',
                color: productConfig.selectedIngredients.length > 0 ? colors.accent : colors.primary
              }}>
                {productConfig.selectedIngredients.length}
              </span>
              {selectedProduct.ingredients[0]?.max_selections && (
                <>
                  <span style={{ color: colors.primary }}>/</span>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: colors.primary
                  }}>
                    {selectedProduct.ingredients[0].max_selections}
                  </span>
                </>
              )}
            </div>
            
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.ingredients.map(ingredient => {
                  const ingredientIsOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
                  return (
                  <div 
                    key={ingredient.id}
                    style={{
                      backgroundColor: ingredientIsOutOfStock ? '#f8f9fa' : (productConfig.selectedIngredients.find(i => i.id === ingredient.id) ? colors.accent : '#fff'),
                      border: `2px solid ${productConfig.selectedIngredients.find(i => i.id === ingredient.id) ? colors.accent : ingredientIsOutOfStock ? '#dc3545' : '#e0e0e0'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: ingredientIsOutOfStock ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: ingredientIsOutOfStock ? 0.6 : 1
                    }}
                    onClick={() => toggleIngredient(ingredient)}
                  >
                    {ingredientIsOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        Agotado
                      </div>
                    )}
                    {ingredient.unlimited_stock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        ∞ Stock
                      </div>
                    )}
                    {ingredient.image ? (
                      <img 
                        src={ingredient.image}
                        alt={ingredient.name}
                        style={{
                          width: '100%',
                          height: '140px',
                          objectFit: 'cover',
                          borderBottom: `1px solid ${productConfig.selectedIngredients.find(i => i.id === ingredient.id) ? colors.accent : '#e0e0e0'}`
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${productConfig.selectedIngredients.find(i => i.id === ingredient.id) ? colors.accent : '#e0e0e0'}`
                      }}>
                        <span style={{ color: colors.accent, fontSize: '56px' }}>🍽️</span>
                      </div>
                    )}
                    <div style={{
                      padding: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '13px',
                        color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) ? '#fff' : colors.primary,
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {ingredient.name}
                      </div>
                      {Number(ingredient.price) > 0 && (
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600',
                          color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) ? '#fff' : colors.accent
                        }}>
                          +{colors.currency.symbol}{Number(ingredient.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {productConfig.selectedIngredients.find(i => i.id === ingredient.id) && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ color: colors.accent, fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div style={{
              padding: '20px',
              borderTop: `2px solid ${colors.primary}`
            }}>
              {productModalStep === 'main' ? (
                <button 
                  onClick={() => setIngredientsModalOpen(false)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    backgroundColor: colors.accent,
                    color: colors.primary,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  Listo
                </button>
              ) : (
                <button 
                  onClick={selectedProduct.extras?.length > 0 ? handleNextToExtras : addToCart}
                  disabled={addingToCart}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    backgroundColor: addingToCart ? '#28a745' : colors.accent,
                    color: colors.primary,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '700',
                    cursor: addingToCart ? 'default' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => !addingToCart && (e.target.style.transform = 'scale(1.02)')}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {selectedProduct.extras?.length > 0 ? 'Siguiente ›' : (addingToCart ? '✓ ¡Agregado!' : `Agregar - ${colors.currency.symbol}${(calculateProductPrice() * productConfig.quantity).toFixed(2)}`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {extrasModalOpen && selectedProduct && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}
          onClick={() => setExtrasModalOpen(false)}
        >
          <div 
            style={{
              backgroundColor: colors.secondary,
              borderRadius: 'var(--radius-xl)',
              width: '95vw',
              maxWidth: '900px',
              height: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              backgroundColor: colors.header,
              color: colors.accent,
              padding: '20px',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              textAlign: 'center',
              position: 'relative'
            }}>
              <button 
                onClick={() => {
                  setExtrasModalOpen(false);
                  setProductModalStep('main');
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.accent,
                  fontSize: '24px',
                  cursor: 'pointer',
                  position: 'absolute',
                  top: '10px',
                  right: '10px'
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? 'Extras' : `2. Extras`}
              </h2>
            </div>
            
            <div style={{
              padding: '12px 20px',
              backgroundColor: colors.secondary,
              borderBottom: `2px solid ${colors.primary}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: colors.primary
              }}>
                Seleccionados:
              </span>
              <span style={{
                fontSize: '20px',
                fontWeight: '700',
                color: productConfig.selectedExtras.length > 0 ? colors.accent : colors.primary
              }}>
                {productConfig.selectedExtras.length}
              </span>
            </div>
            
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.extras.map(extra => {
                  const extraIsOutOfStock = !extra.unlimited_stock && extra.stock === 0;
                  return (
                  <div 
                    key={extra.id}
                    style={{
                      backgroundColor: extraIsOutOfStock ? '#f8f9fa' : (productConfig.selectedExtras.find(e => e.id === extra.id) ? colors.accent : '#fff'),
                      border: `2px solid ${productConfig.selectedExtras.find(e => e.id === extra.id) ? colors.accent : extraIsOutOfStock ? '#dc3545' : '#e0e0e0'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: extraIsOutOfStock ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: extraIsOutOfStock ? 0.6 : 1
                    }}
                    onClick={() => toggleExtra(extra)}
                  >
                    {extraIsOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        Agotado
                      </div>
                    )}
                    {extra.unlimited_stock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        ∞ Stock
                      </div>
                    )}
                    {extra.image ? (
                      <img 
                        src={extra.image}
                        alt={extra.name}
                        style={{
                          width: '100%',
                          height: '140px',
                          objectFit: 'cover',
                          borderBottom: `1px solid ${productConfig.selectedExtras.find(e => e.id === extra.id) ? colors.accent : '#e0e0e0'}`
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${productConfig.selectedExtras.find(e => e.id === extra.id) ? colors.accent : '#e0e0e0'}`
                      }}>
                        <span style={{ color: colors.accent, fontSize: '56px' }}>🍽️</span>
                      </div>
                    )}
                    <div style={{
                      padding: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '13px',
                        color: productConfig.selectedExtras.find(e => e.id === extra.id) ? '#fff' : colors.primary,
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {extra.name}
                      </div>
                      {Number(extra.price) > 0 && (
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600',
                          color: productConfig.selectedExtras.find(e => e.id === extra.id) ? '#fff' : colors.accent
                        }}>
                          +{colors.currency.symbol}{Number(extra.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {productConfig.selectedExtras.find(e => e.id === extra.id) && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ color: colors.accent, fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div style={{
              padding: '20px',
              borderTop: `2px solid ${colors.primary}`
            }}>
              {productModalStep === 'main' ? (
                <button 
                  onClick={() => setExtrasModalOpen(false)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    backgroundColor: colors.accent,
                    color: colors.primary,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  Listo
                </button>
              ) : (
                <button 
                  onClick={addToCart}
                  disabled={addingToCart}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    backgroundColor: addingToCart ? '#28a745' : colors.accent,
                    color: colors.primary,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '700',
                    cursor: addingToCart ? 'default' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => !addingToCart && (e.target.style.transform = 'scale(1.02)')}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {addingToCart ? '✓ ¡Agregado!' : `Agregar - ${colors.currency.symbol}${(calculateProductPrice() * productConfig.quantity).toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: cartOpen ? 0 : '-85%',
        left: 0,
        right: 0,
        height: '85%',
        backgroundColor: '#f8f9fa',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
        transition: 'bottom 0.3s ease',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        overflow: 'hidden'
      }} className={cartOpen ? 'open' : ''}>
        <div style={{
          backgroundColor: colors.primary,
          color: colors.accent,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
            🛒 Mi Pedido
          </h2>
          <button 
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }} 
            onClick={() => setCartOpen(false)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {cart.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '80px', marginBottom: '20px' }}>🛒</div>
              <p style={{ fontSize: '18px', fontWeight: '600' }}>
                Tu carrito está vacío
              </p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                Agrega productos para comenzar
              </p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  border: '1px solid #e9ecef'
                }} key={item.id}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: '#f8f9fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '40px' }}>🍽️</span>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px'
                      }}>
                        <h4 style={{ 
                          margin: 0, 
                          fontSize: '18px', 
                          color: '#212529',
                          fontWeight: '700'
                        }}>
                          {item.product_name}
                        </h4>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          style={{
                            backgroundColor: '#fee2e2',
                            border: 'none',
                            color: '#dc3545',
                            cursor: 'pointer',
                            fontSize: '14px',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                      
                      {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#6c757d', 
                          marginBottom: '4px',
                          lineHeight: '1.4'
                        }}>
                          {item.selected_ingredients.join(', ')}
                        </div>
                      )}
                      
                      {item.selected_extras && item.selected_extras.length > 0 && (
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#6c757d',
                          lineHeight: '1.4'
                        }}>
                          + {item.selected_extras.join(', ')}
                        </div>
                      )}
                      
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            style={{
                              backgroundColor: '#e9ecef',
                              color: colors.primary,
                              border: 'none',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: '700',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = colors.primary;
                              e.target.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#e9ecef';
                              e.target.style.color = colors.primary;
                            }}
                          >
                            -
                          </button>
                          <span style={{ 
                            fontWeight: '700', 
                            color: colors.primary,
                            fontSize: '18px',
                            minWidth: '30px',
                            textAlign: 'center'
                          }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            style={{
                              backgroundColor: '#e9ecef',
                              color: colors.primary,
                              border: 'none',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: '700',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = colors.primary;
                              e.target.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#e9ecef';
                              e.target.style.color = colors.primary;
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div style={{ 
                          fontSize: '20px', 
                          fontWeight: '700', 
                          color: colors.accent 
                        }}>
                          {colors.currency.symbol}{Number(item.total).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                padding: '16px',
                marginTop: '20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  fontSize: '16px',
                  color: '#6c757d'
                }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: '600', color: '#212529' }}>
                    {colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}
                  </span>
                </div>

                {appliedCoupon && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    fontSize: '14px',
                    color: '#28a745',
                    fontWeight: '600'
                  }}>
                    <span>Descuento ({appliedCoupon.coupon_code}):</span>
                    <span>-{colors.currency.symbol}{Number(appliedCoupon.discount_total || 0).toFixed(2)}</span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '2px dashed #dee2e6',
                  fontSize: '20px',
                  fontWeight: '700',
                  color: colors.primary
                }}>
                  <span>Total:</span>
                  <span>{colors.currency.symbol}{Number(getFinalTotal()).toFixed(2)}</span>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="¿Tienes un cupón?"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '2px solid #dee2e6',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = colors.accent}
                    onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                  />
                  {appliedCoupon ? (
                    <button
                      onClick={removeCoupon}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}
                    >
                      Quitar cupón
                    </button>
                  ) : (
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCodeInput.trim()}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: colors.primary,
                        color: '#fff',
                        cursor: couponLoading || !couponCodeInput.trim() ? 'not-allowed' : 'pointer',
                        opacity: couponLoading || !couponCodeInput.trim() ? 0.5 : 1,
                        fontWeight: '600',
                        fontSize: '14px'
                      }}
                    >
                      {couponLoading ? 'Aplicando...' : 'Aplicar cupón'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fff',
            borderTop: '1px solid #e9ecef',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#212529', 
                marginBottom: '12px',
                textAlign: 'center'
              }}>
                ¿Cómo lo quieres?
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: selectedConfiguration?.allow_serve && selectedConfiguration?.allow_takeout ? '1fr 1fr' : '1fr', 
                gap: '12px' 
              }}>
                {selectedConfiguration?.allow_serve && (
                  <button
                    onClick={() => setOrderType('serve')}
                    style={{
                      padding: '16px 12px',
                      fontSize: '15px',
                      backgroundColor: orderType === 'serve' ? colors.primary : '#fff',
                      color: orderType === 'serve' ? '#fff' : '#212529',
                      border: `2px solid ${orderType === 'serve' ? colors.accent : '#dee2e6'}`,
                      borderRadius: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: orderType === 'serve' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '32px' }}>🍽️</span>
                    <span>Comer aquí</span>
                  </button>
                )}
                {selectedConfiguration?.allow_takeout && (
                  <button
                    onClick={() => setOrderType('takeout')}
                    style={{
                      padding: '16px 12px',
                      fontSize: '15px',
                      backgroundColor: orderType === 'takeout' ? colors.primary : '#fff',
                      color: orderType === 'takeout' ? '#fff' : '#212529',
                      border: `2px solid ${orderType === 'takeout' ? colors.accent : '#dee2e6'}`,
                      borderRadius: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: orderType === 'takeout' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '32px' }}>🥡</span>
                    <span>Llevar</span>
                  </button>
                )}
              </div>
              {!selectedConfiguration?.allow_serve && !selectedConfiguration?.allow_takeout && (
                <p style={{ textAlign: 'center', color: '#dc3545', padding: '20px' }}>
                  No hay opciones de pedido disponibles
                </p>
              )}
            </div>
            
            <button
              onClick={handleCheckout}
              style={{
                width: '100%',
                padding: '18px',
                fontSize: '18px',
                backgroundColor: colors.accent,
                color: colors.primary,
                border: 'none',
                borderRadius: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
              }}
            >
              <span style={{ fontSize: '20px' }}>✓</span>
              Confirmar Pedido - {colors.currency.symbol}{Number(getFinalTotal()).toFixed(2)}
            </button>
            
            <button
              onClick={() => setCart([])}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '12px',
                fontSize: '14px',
                backgroundColor: 'transparent',
                color: '#dc3545',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>

      {cartOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
          onClick={() => setCartOpen(false)}
        />
      )}

      {paymentModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: colors.secondary,
            borderRadius: '20px',
            padding: '30px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h2 style={{
              color: colors.primary,
              marginBottom: '10px',
              fontSize: '24px'
            }}>
              {processingPayment ? 'Procesando Pago...' : 'Metodo de Pago'}
            </h2>
            <p style={{
              color: '#666',
              marginBottom: '25px',
              fontSize: '14px'
            }}>
              {processingPayment 
                ? (paymentMethod === 'card' 
                    ? 'Acerque o pase la tarjeta en el terminal Point' 
                    : 'Procesando...')
                : 'Selecciona como deseas pagar'
              }
            </p>

            {processingPayment ? (
              <div style={{
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  border: `5px solid ${colors.accent}`,
                  borderTop: `5px solid ${colors.primary}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#666', fontSize: '14px' }}>
                  Esperando confirmacion del terminal...
                </p>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '15px'
                }}>
                  {selectedConfiguration?.accept_card && (
                    <button
                      onClick={() => processPayment('card')}
                      style={{
                        padding: '20px',
                        backgroundColor: colors.secondary,
                        color: colors.primary,
                        border: `3px solid #ddd`,
                        borderRadius: '15px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                      }}
                    >
                      <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '28px' }} />
                      <span style={{ fontSize: '18px', fontWeight: '700' }}>Tarjeta</span>
                    </button>
                  )}

                  {selectedConfiguration?.accept_cash && (
                    <button
                      onClick={() => processPayment('cash')}
                      style={{
                        padding: '20px',
                        backgroundColor: colors.secondary,
                        color: colors.primary,
                        border: `3px solid #ddd`,
                        borderRadius: '15px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                      }}
                    >
                      <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '28px' }} />
                      <span style={{ fontSize: '18px', fontWeight: '700' }}>Efectivo</span>
                    </button>
                  )}

                  {!selectedConfiguration?.accept_cash && !selectedConfiguration?.accept_card && (
                    <p style={{ color: '#666' }}>No hay metodos de pago disponibles</p>
                  )}
                </div>

                {selectedConfiguration?.accept_card && availableTerminals.length > 0 && (
                  <div style={{
                    marginTop: '14px',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    Maquina Point asignada:{' '}
                    <strong>
                      {availableTerminals.find(terminal => String(terminal.id) === String(selectedTerminalId))?.name || 'No disponible'}
                    </strong>
                  </div>
                )}

                <p style={{
                  color: '#999',
                  marginTop: '20px',
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  Al tocar Tarjeta o Efectivo el pedido se procesa inmediatamente
                </p>

                <button
                  onClick={() => {
                    setPaymentModalOpen(false);
                  }}
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {paymentWaiting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: colors.secondary,
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: colors.primary, marginBottom: '10px', fontSize: '24px' }}>
              Esperando Pago
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              Acerque o pase la tarjeta en el terminal Point
            </p>
            <div style={{
              width: '80px',
              height: '80px',
              border: `6px solid ${colors.accent}`,
              borderTop: `6px solid ${colors.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
              Esperando confirmacion del pago...
            </p>
            <p style={{
              color: paymentTimeLeft <= 30 ? '#DC3545' : colors.primary,
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '20px'
            }}>
              {Math.floor(paymentTimeLeft / 60)}:{String(paymentTimeLeft % 60).padStart(2, '0')}
            </p>
            <button
              onClick={async () => {
                if (!pendingOrderData) return;
                try {
                  await fetch(`/api/orders/${pendingOrderData.order.id}/cancel-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store_id: pendingOrderData.storeId })
                  });
                } catch (e) { console.error(e); }
                setPaymentWaiting(false);
                setPaymentCancelled(true);
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#DC3545',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Cancelar pago
            </button>
          </div>
        </div>
      )}

      {paymentConfirmed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: colors.secondary,
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ color: colors.primary, marginBottom: '10px', fontSize: '24px' }}>
              Muchas gracias por su compra
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '16px' }}>
              Por favor espere su orden
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: colors.primary,
                color: colors.secondary,
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.8 }}>Numero de Orden</p>
                <p style={{ fontSize: '48px', fontWeight: '700', margin: 0 }}>{lastOrderNumber}</p>
              </div>
            )}
            <button
              onClick={() => {
                setPaymentConfirmed(false);
                setPendingOrderData(null);
                setLastOrderNumber(null);
                setPaymentModalOpen(false);
              }}
              style={{
                marginTop: '25px',
                padding: '14px 30px',
                backgroundColor: colors.accent,
                color: colors.primary,
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {paymentCancelled && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: colors.secondary,
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>❌</div>
            <h2 style={{ color: '#DC3545', marginBottom: '10px', fontSize: '24px' }}>
              Pago No Completado
            </h2>
            {pendingOrderData?.order?.order_number && (
              <p style={{ color: '#DC3545', marginBottom: '10px', fontSize: '18px', fontWeight: '700' }}>
                Orden #{pendingOrderData.order.order_number}
              </p>
            )}
            <p style={{ color: '#666', marginBottom: '25px', fontSize: '14px' }}>
              El pago no fue completado o se cancelo. Como quieres pagar?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button
                onClick={() => {
                  setPaymentCancelled(false);
                  setPendingOrderData(null);
                  setProcessingPayment(true);
                  processPayment('card');
                }}
                style={{
                  padding: '18px',
                  backgroundColor: colors.primary,
                  color: colors.secondary,
                  border: 'none',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '22px' }} />
                <span style={{ fontSize: '18px', fontWeight: '700' }}>Reintentar con Tarjeta</span>
              </button>
              <button
                onClick={() => {
                  setPaymentCancelled(false);
                  setPaymentModalOpen(true);
                }}
                style={{
                  padding: '18px',
                  backgroundColor: colors.accent,
                  color: colors.primary,
                  border: 'none',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '22px' }} />
                <span style={{ fontSize: '18px', fontWeight: '700' }}>Pagar en Efectivo</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch(`/api/orders/${pendingOrderData.order.id}/cancel-payment`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ store_id: pendingOrderData.storeId })
                    });
                  } catch (e) { console.error(e); }
                  setPaymentCancelled(false);
                  setPendingOrderData(null);
                  setPaymentWaiting(false);
                  setCart([]);
                  setCartOpen(false);
                  setPaymentModalOpen(false);
                }}
                style={{
                  padding: '18px',
                  backgroundColor: '#DC3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '22px' }} />
                <span style={{ fontSize: '18px', fontWeight: '700' }}>Cancelar Orden</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cashPaymentSuccess && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: colors.secondary,
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ color: colors.primary, marginBottom: '10px', fontSize: '24px' }}>
              Muchas gracias por su compra
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '16px' }}>
              Por favor espere su orden
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: colors.primary,
                color: colors.secondary,
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.8 }}>Numero de Orden</p>
                <p style={{ fontSize: '48px', fontWeight: '700', margin: 0 }}>{lastOrderNumber}</p>
              </div>
            )}
            <p style={{
              color: '#999',
              fontSize: '13px',
              fontStyle: 'italic'
            }}>
              Pague con efectivo justo en caja para procesar su orden
            </p>
            <button
              onClick={() => {
                setCashPaymentSuccess(false);
                setLastOrderNumber(null);
              }}
              style={{
                marginTop: '25px',
                padding: '14px 30px',
                backgroundColor: colors.accent,
                color: colors.primary,
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Store;