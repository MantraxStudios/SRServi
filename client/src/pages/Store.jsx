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
  faMoneyBillWave
} from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';

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

  useEffect(() => {
    fetchStore();
    
    const socket = io('http://localhost:3001');
    
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
    
    return () => {
      socket.disconnect();
    };
  }, [code, terminalFromUrl]);

  useEffect(() => {
    if (store?.store?.id) {
      const socket = io('http://localhost:3001');
      socket.emit('register_store', store.store.id);
      socket.disconnect();
    }
  }, [store?.store?.id]);

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/public/${code}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Codigo no encontrado');
        }
        throw new Error('Error al cargar la tienda');
      }

      const data = await response.json();
      console.log('Store data received:', data);
      console.log('Number of products:', data.products?.length || 0);
      setStore(data);

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
    setSelectedProduct(product);
    setProductConfig({
      selectedIngredients: [],
      selectedExtras: [],
      quantity: 1,
      notes: ''
    });
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
  };

  const toggleIngredient = (ingredient) => {
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
    closeProductModal();
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
        response = await fetch('/api/orders/process-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        });
      } else {
        response = await fetch('/api/orders', {
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
        padding: '32px 24px',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: '700',
          color: colors.accent
        }}>
          {store?.store?.name}
        </h1>
        <p style={{ 
          fontSize: '13px',
          color: colors.secondary,
          marginTop: '6px',
          opacity: 0.85
        }}>
          AutoServicio By SRAutomatic
        </p>
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
            boxShadow: activeCategory === 'all' ? `0 4px 12px ${colors.accent}40` : 'none'
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
              boxShadow: activeCategory === cat ? `0 4px 12px ${colors.accent}40` : 'none'
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

      {hasProducts && (
        <div className="products-grid">
          {Object.entries(groupedProducts)
            .filter(([category]) => activeCategory === 'all' || activeCategory === category)
            .map(([category, products]) => (
            <div key={category}>
              {products.map(product => (
                <div 
                  key={product.id} 
                  style={{
                    backgroundColor: colors.secondary,
                    border: `2px solid ${colors.accent}40`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    marginBottom: '20px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}
                  onClick={() => openProductModal(product)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = `0 12px 32px ${colors.accent}30`;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderColor = `${colors.accent}40`;
                  }}
                >
                  <div className="product-image" style={{
                    height: '180px',
                    backgroundColor: `${colors.accent}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {product.image ? (
                      <img 
                        src={product.image.startsWith('http') ? product.image : `http://localhost:3001${product.image}`} 
                        alt={product.name} 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    ) : (
                      <FontAwesomeIcon icon={faBox} style={{ fontSize: '64px', color: colors.accent, opacity: 0.6 }} />
                    )}
                  </div>
                  <div className="product-info" style={{ padding: '20px' }}>
                    <h3 style={{ 
                      fontSize: '22px', 
                      fontWeight: '700', 
                      marginBottom: '8px', 
                      color: colors.primary 
                    }}>
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="product-description" style={{
                        color: '#666',
                        marginBottom: '12px',
                        lineHeight: '1.5',
                        fontSize: '14px'
                      }}>{product.description}</p>
                    )}
                    <div style={{ 
                      fontSize: '28px', 
                      fontWeight: '700', 
                      color: colors.accent,
                      marginTop: '8px'
                    }}>
                      {colors.currency.symbol}{Number(product.price).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {hasProducts && (
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: colors.accent,
        color: colors.primary,
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'all 0.2s ease'
      }} onClick={() => setCartOpen(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
        }}
      >
        <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: '24px' }} />
        {getCartCount() > 0 && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            backgroundColor: colors.primary,
            color: colors.secondary,
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '700'
          }}>{getCartCount()}</span>
        )}
      </div>
      )}

      {selectedProduct && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '500px',
            backgroundColor: colors.secondary,
            border: `3px solid ${colors.primary}`
          }}>
            <div className="modal-header" style={{
              backgroundColor: colors.header,
              color: colors.accent,
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              textAlign: 'center',
              padding: '20px',
              position: 'relative'
            }}>
              <button className="modal-close" onClick={closeProductModal} style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: colors.accent,
                fontSize: '24px',
                cursor: 'pointer',
                position: 'absolute',
                top: '10px',
                right: '10px'
              }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 className="modal-title" style={{ textAlign: 'center', margin: '0', padding: '10px 40px 0 40px' }}>{selectedProduct.name}</h2>
            </div>

            <div style={{ marginBottom: '20px', padding: '20px' }}>
              {selectedProduct.description && (
                <p style={{ color: '#666', marginBottom: '20px' }}>
                  {selectedProduct.description}
                </p>
              )}

              {selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                <div className="option-group">
                  <h3 className="option-group-title" style={{ color: colors.primary, marginBottom: '12px' }}>
                    Ingredientes
                    {selectedProduct.ingredients.some(i => i.is_required) && (
                      <span style={{ color: '#DC3545', fontSize: '14px' }}> (Requerido)</span>
                    )}
                  </h3>
                  <button
                    onClick={() => setIngredientsModalOpen(true)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      border: `2px solid ${colors.primary}`,
                      borderRadius: 'var(--radius-md)',
                      fontSize: '16px',
                      backgroundColor: colors.secondary,
                      color: colors.primary,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = colors.accent;
                      e.target.style.backgroundColor = `${colors.accent}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = colors.primary;
                      e.target.style.backgroundColor = colors.secondary;
                    }}
                  >
                    <span>
                      {productConfig.selectedIngredients.length > 0 
                        ? `Seleccionados: ${productConfig.selectedIngredients.length}` 
                        : 'Toca para seleccionar'}
                    </span>
                    <span style={{ fontSize: '20px' }}>›</span>
                  </button>
                </div>
              )}

              {selectedProduct.extras && selectedProduct.extras.length > 0 && (
                <div className="option-group">
                  <h3 className="option-group-title" style={{ color: colors.primary, marginBottom: '12px' }}>Extras</h3>
                  <button
                    onClick={() => setExtrasModalOpen(true)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      border: `2px solid ${colors.primary}`,
                      borderRadius: 'var(--radius-md)',
                      fontSize: '16px',
                      backgroundColor: colors.secondary,
                      color: colors.primary,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = colors.accent;
                      e.target.style.backgroundColor = `${colors.accent}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = colors.primary;
                      e.target.style.backgroundColor = colors.secondary;
                    }}
                  >
                    <span>
                      {productConfig.selectedExtras.length > 0 
                        ? `Seleccionados: ${productConfig.selectedExtras.length}` 
                        : 'Toca para seleccionar'}
                    </span>
                    <span style={{ fontSize: '20px' }}>›</span>
                  </button>
                </div>
              )}

              <div className="option-group">
                <h3 className="option-group-title" style={{ color: colors.primary }}>Cantidad</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.secondary,
                      border: 'none',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setProductConfig(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    disabled={productConfig.quantity <= 1}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <span style={{ fontSize: '24px', fontWeight: '700', minWidth: '40px', textAlign: 'center', color: colors.primary }}>
                    {productConfig.quantity}
                  </span>
                  <button 
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.secondary,
                      border: 'none',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setProductConfig(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>

            <button 
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                backgroundColor: colors.accent,
                color: colors.primary,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={addToCart}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
              }}
            >
              Agregar al Carrito - {colors.currency.symbol}{(calculateProductPrice() * productConfig.quantity).toFixed(2)}
            </button>
          </div>
        </div>
      )}

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
                onClick={() => setIngredientsModalOpen(false)}
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
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>Ingredientes</h2>
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
                {selectedProduct.ingredients.map(ingredient => (
                  <div 
                    key={ingredient.id}
                    style={{
                      backgroundColor: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                        ? colors.accent 
                        : '#fff',
                      border: `2px solid ${productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                        ? colors.accent 
                        : '#e0e0e0'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                    onClick={() => toggleIngredient(ingredient)}
                  >
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
                        color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                          ? '#fff' 
                          : colors.primary,
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
                          color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                            ? '#fff' 
                            : colors.accent
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
                ))}
              </div>
            </div>

            <div style={{
              padding: '20px',
              borderTop: `2px solid ${colors.primary}`
            }}>
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
                onClick={() => setExtrasModalOpen(false)}
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
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>Extras</h2>
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
                {selectedProduct.extras.map(extra => (
                  <div 
                    key={extra.id}
                    style={{
                      backgroundColor: productConfig.selectedExtras.find(e => e.id === extra.id) 
                        ? colors.accent 
                        : '#fff',
                      border: `2px solid ${productConfig.selectedExtras.find(e => e.id === extra.id) 
                        ? colors.accent 
                        : '#e0e0e0'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                    onClick={() => toggleExtra(extra)}
                  >
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
                        color: productConfig.selectedExtras.find(e => e.id === extra.id) 
                          ? '#fff' 
                          : colors.primary,
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
                          color: productConfig.selectedExtras.find(e => e.id === extra.id) 
                            ? '#fff' 
                            : colors.accent
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
                ))}
              </div>
            </div>

            <div style={{
              padding: '20px',
              borderTop: `2px solid ${colors.primary}`
            }}>
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
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed',
        top: 0,
        right: cartOpen ? 0 : '-100%',
        width: '400px',
        maxWidth: '100%',
        height: '100vh',
        backgroundColor: colors.secondary,
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
        transition: 'right 0.3s ease',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `3px solid ${colors.primary}`
      }} className={cartOpen ? 'open' : ''}>
        <div style={{
          backgroundColor: colors.header,
          color: colors.accent,
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Carrito</h2>
          <button 
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: colors.accent,
              fontSize: '24px',
              cursor: 'pointer'
            }} 
            onClick={() => setCartOpen(false)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {cart.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              Tu carrito esta vacio
            </p>
          ) : (
            cart.map(item => (
              <div style={{
                backgroundColor: colors.secondary,
                border: `2px solid ${colors.primary}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '12px'
              }} key={item.id}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '18px', color: colors.primary }}>
                    {item.product_name}
                  </h4>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#DC3545',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                
                {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    {item.selected_ingredients.join(', ')}
                  </div>
                )}
                
                {item.selected_extras && item.selected_extras.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    Extras: {item.selected_extras.join(', ')}
                  </div>
                )}
                
                {item.notes && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontStyle: 'italic' }}>
                    Nota: {item.notes}
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
                        backgroundColor: colors.primary,
                        color: colors.secondary,
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <span style={{ fontWeight: '600', color: colors.primary }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.secondary,
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: colors.accent }}>
                    {colors.currency.symbol}{Number(item.total).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{
          padding: '24px',
          borderTop: `2px solid ${colors.primary}`,
          backgroundColor: colors.secondary
        }}>
          {cart.length > 0 && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '16px',
                color: colors.primary
              }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: '600' }}>{colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  placeholder="Cupón de descuento"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: '2px solid #ddd',
                    fontSize: '14px'
                  }}
                />
                {appliedCoupon ? (
                  <button
                    onClick={removeCoupon}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                  >
                    Quitar
                  </button>
                ) : (
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCodeInput.trim()}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: colors.primary,
                      color: colors.secondary,
                      cursor: couponLoading || !couponCodeInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: couponLoading || !couponCodeInput.trim() ? 0.5 : 1,
                      fontWeight: '700'
                    }}
                  >
                    {couponLoading ? '...' : 'Aplicar'}
                  </button>
                )}
              </div>

              {appliedCoupon && (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '15px',
                    color: '#28a745'
                  }}>
                    <span>Descuento ({appliedCoupon.coupon_code}):</span>
                    <span style={{ fontWeight: '700' }}>-{colors.currency.symbol}{Number(appliedCoupon.discount_total || 0).toFixed(2)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '18px',
                    color: colors.primary
                  }}>
                    <span style={{ fontWeight: '700' }}>Total:</span>
                    <span style={{ fontWeight: '700' }}>{colors.currency.symbol}{Number(getFinalTotal()).toFixed(2)}</span>
                  </div>
                </>
              )}
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: colors.primary, 
                  marginBottom: '12px' 
                }}>
                  Como lo quieres?
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '12px' 
                }}>
                  <button
                    onClick={() => setOrderType('serve')}
                    style={{
                      padding: '16px',
                      fontSize: '16px',
                      backgroundColor: orderType === 'serve' ? colors.primary : colors.secondary,
                      color: orderType === 'serve' ? colors.secondary : colors.primary,
                      border: `3px solid ${orderType === 'serve' ? colors.accent : colors.primary}`,
                      borderRadius: 'var(--radius-lg)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>🍽️</span>
                    <span>Para Comer Aqui</span>
                  </button>
                  <button
                    onClick={() => setOrderType('takeout')}
                    style={{
                      padding: '16px',
                      fontSize: '16px',
                      backgroundColor: orderType === 'takeout' ? colors.primary : colors.secondary,
                      color: orderType === 'takeout' ? colors.secondary : colors.primary,
                      border: `3px solid ${orderType === 'takeout' ? colors.accent : colors.primary}`,
                      borderRadius: 'var(--radius-lg)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>🥡</span>
                    <span>Para Llevar</span>
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleCheckout}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '18px',
                  backgroundColor: colors.accent,
                  color: colors.primary,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '8px'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                Confirmar Pedido
              </button>
              
              <button
                onClick={() => setCart([])}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: 'transparent',
                  color: '#DC3545',
                  border: '2px solid #DC3545',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Vaciar Carrito
              </button>
            </>
          )}
        </div>
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