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
import { SOCKET_URL, getImageUrl } from '../config.js';

const API = 'https://srservi2.srautomatic.com';

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
        response = await fetch(API + '/api/orders/process-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        });
      } else {
        response = await fetch(API + '/api/orders', {
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
            className="btn btn-secondary btn-full"
            onClick={() => navigate('/')}
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

  const renderProductCard = (product) => {
    const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
    const isOutOfStock = !isUnlimited && product.stock === 0;
    return (
      <div
        key={product.id}
        className={`store-product-wrapper${isOutOfStock ? ' out-of-stock' : ''}`}
      >
        <div
          className={`store-product-card${isOutOfStock ? ' out-of-stock' : ''}`}
          onClick={() => openProductModal(product)}
        >
          {isOutOfStock && (
            <div className="out-of-stock-badge">
              Agotado
            </div>
          )}
          <div className="store-product-image">
            {product.image ? (
              <img
                src={getImageUrl(product.image)}
                alt={product.name}
                className={isOutOfStock ? 'grayscale' : ''}
              />
            ) : (
              <FontAwesomeIcon icon={faBox} className="placeholder-icon" />
            )}
          </div>
        </div>
        <div className="store-product-info">
          <div className={`store-product-details${isOutOfStock ? ' out-of-stock' : ''}`}>
            <span className="store-product-name">{product.name}:</span>
            <span className="store-product-price">{colors.currency.symbol}{Number(product.price).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="store-container" style={{
      '--store-primary': colors.primary,
      '--store-secondary': colors.secondary,
      '--store-accent': colors.accent,
      '--store-header': colors.header || colors.primary
    }}>
      <header className="store-header">
        {store?.store?.is_premium ? (
          <div className="store-header-content">
            <div className="store-header-brand">
              {store?.store?.logo_url && (
                <img
                  src={store.store.logo_url}
                  alt={store?.store?.name}
                  className="store-header-logo"
                />
              )}
              <h1 className="store-header-name">
                {store?.store?.name}
              </h1>
            </div>
            <p className="store-header-powered">
              AutoServicio By SRAutomatic
            </p>
          </div>
        ) : (
          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <p className="store-header-powered">
              AutoServicio By SRAutomatic
            </p>
          </div>
        )}
      </header>

      {!configFromUrl && configurations.length > 1 && (
        <div className="config-selector">
          <div className="config-selector-list">
            {configurations.map(config => (
              <button
                key={config.id}
                className={`config-btn${selectedConfiguration?.id === config.id ? ' active' : ''}`}
                onClick={() => setSelectedConfiguration(config)}
              >
                {config.accept_cash && <FontAwesomeIcon icon={faMoneyBillWave} />}
                {config.accept_card && <FontAwesomeIcon icon={faCreditCard} />}
                {config.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="category-tabs">
        <div
          ref={categoryRef}
          className="category-tabs-list"
        >
        <button
          className={`category-tab${activeCategory === 'all' ? ' active' : ''}`}
          data-category="all"
          onClick={() => setActiveCategory('all')}
        >
          Todo
        </button>
        {Object.keys(groupedProducts).map(cat => (
          <button
            key={cat}
            className={`category-tab${activeCategory === cat ? ' active' : ''}`}
            data-category={cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
        </div>
      </div>

      {!hasProducts && (
        <div className="store-empty">
          <div className="store-empty-icon" style={{
            background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}40)`
          }}>
            <FontAwesomeIcon icon={faBox} style={{ color: colors.accent }} />
          </div>
          <h2>
            Esta tienda aún no tiene productos
          </h2>
          <p>
            El propietario aún no ha agregado productos a su catálogo. ¡Vuelve pronto!
          </p>
        </div>
      )}

      {hasProducts && activeCategory === 'all' && (
        <div className="category-sections">
          {Object.entries(groupedProducts).map(([category, products], catIndex) => (
            <div key={category} className="category-section">
              <div className="category-section-header">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon
                    icon={faTags}
                    className="category-section-icon"
                  />
                  <h3 className="category-section-title">
                    {category}
                  </h3>
                </div>
                <div className="category-section-line" />
              </div>
              <div className="products-grid">
                {products.map(product => renderProductCard(product))}
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
              products.map(product => renderProductCard(product))
            )}
        </div>
      )}

      {hasProducts && (
      <div className="cart-bar">
        <div className="cart-bar-left" onClick={() => setCartOpen(true)}>
          <div className="cart-bar-icon">
            <FontAwesomeIcon icon={faShoppingCart} />
            <span className="cart-bar-count">{getCartCount()}</span>
          </div>
          <span className="cart-bar-text">Ver carrito</span>
        </div>
        <div className="cart-bar-right">
          <span className="cart-bar-total">
            {colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}
          </span>
          <button
            className="cart-bar-pay-btn"
            onClick={() => setCartOpen(true)}
          >
            PAGAR
          </button>
        </div>
      </div>
      )}

      {notification && (
        <div className="toast">
          {notification.image ? (
            <img
              src={getImageUrl(notification.image)}
              alt={notification.name}
              className="toast-image"
            />
          ) : (
            <div className="toast-placeholder">
              <FontAwesomeIcon icon={faBox} />
            </div>
          )}
          <div>
            <div className="toast-name">{notification.name}</div>
            {notification.agotado ? (
              <div className="toast-status-soldout">Agotado</div>
            ) : (
              <div className="toast-status-added">Agregado ✓</div>
            )}
          </div>
        </div>
      )}

      <input
        ref={barcodeInputRef}
        className="barcode-input"
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
        autoFocus
      />

      {ingredientsModalOpen && selectedProduct && (
        <div
          className="store-modal-overlay"
          onClick={() => setIngredientsModalOpen(false)}
        >
          <div
            className="store-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="store-modal-header">
              <button
                className="store-modal-close"
                onClick={() => {
                  setIngredientsModalOpen(false);
                  setProductModalStep('main');
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? 'Complementos' : `1. Complementos`}
              </h2>
            </div>

            <div className="store-modal-body" style={{
              padding: '12px 20px',
              borderBottom: `2px solid var(--store-primary)`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              flex: 'none',
              overflow: 'visible'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--store-primary)'
              }}>
                Seleccionados:
              </span>
              <span style={{
                fontSize: '20px',
                fontWeight: '700',
                color: productConfig.selectedIngredients.length > 0 ? 'var(--store-accent)' : 'var(--store-primary)'
              }}>
                {productConfig.selectedIngredients.length}
              </span>
              {selectedProduct.ingredients[0]?.max_selections && (
                <>
                  <span style={{ color: 'var(--store-primary)' }}>/</span>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: 'var(--store-primary)'
                  }}>
                    {selectedProduct.ingredients[0].max_selections}
                  </span>
                </>
              )}
            </div>

            <div className="store-modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.ingredients.map(ingredient => {
                  const ingredientIsOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
                  const isSelected = !!productConfig.selectedIngredients.find(i => i.id === ingredient.id);
                  return (
                  <div
                    key={ingredient.id}
                    className={`option-item${isSelected ? ' selected' : ''}`}
                    style={{
                      backgroundColor: ingredientIsOutOfStock ? '#f8f9fa' : (isSelected ? 'var(--store-accent)' : '#fff'),
                      border: `2px solid ${isSelected ? 'var(--store-accent)' : ingredientIsOutOfStock ? '#dc3545' : '#e0e0e0'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: ingredientIsOutOfStock ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: ingredientIsOutOfStock ? 0.6 : 1,
                      padding: 0,
                      flexDirection: 'column',
                      display: 'flex'
                    }}
                    onClick={() => toggleIngredient(ingredient)}
                  >
                    {ingredientIsOutOfStock && (
                      <div className="out-of-stock-badge" style={{
                        top: '8px',
                        right: 'auto',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '11px',
                        padding: '4px 10px'
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
                          borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                      }}>
                        <span style={{ color: 'var(--store-accent)', fontSize: '56px' }}>🍽️</span>
                      </div>
                    )}
                    <div style={{
                      padding: '8px',
                      textAlign: 'center'
                    }}>
                      <div className="option-item-name" style={{
                        color: isSelected ? '#fff' : 'var(--store-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {ingredient.name}
                      </div>
                      {Number(ingredient.price) > 0 && (
                        <div className="option-item-price" style={{
                          color: isSelected ? '#fff' : 'var(--store-accent)'
                        }}>
                          +{colors.currency.symbol}{Number(ingredient.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ color: 'var(--store-accent)', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="store-modal-footer">
              {productModalStep === 'main' ? (
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={() => setIngredientsModalOpen(false)}
                >
                  Listo
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={selectedProduct.extras?.length > 0 ? handleNextToExtras : addToCart}
                  disabled={addingToCart}
                  style={{
                    backgroundColor: addingToCart ? '#28a745' : undefined,
                    cursor: addingToCart ? 'default' : undefined
                  }}
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
          className="store-modal-overlay"
          onClick={() => setExtrasModalOpen(false)}
        >
          <div
            className="store-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="store-modal-header">
              <button
                className="store-modal-close"
                onClick={() => {
                  setExtrasModalOpen(false);
                  setProductModalStep('main');
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? 'Extras' : `2. Extras`}
              </h2>
            </div>

            <div className="store-modal-body" style={{
              padding: '12px 20px',
              borderBottom: `2px solid var(--store-primary)`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              flex: 'none',
              overflow: 'visible'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--store-primary)'
              }}>
                Seleccionados:
              </span>
              <span style={{
                fontSize: '20px',
                fontWeight: '700',
                color: productConfig.selectedExtras.length > 0 ? 'var(--store-accent)' : 'var(--store-primary)'
              }}>
                {productConfig.selectedExtras.length}
              </span>
            </div>

            <div className="store-modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.extras.map(extra => {
                  const extraIsOutOfStock = !extra.unlimited_stock && extra.stock === 0;
                  const isSelected = !!productConfig.selectedExtras.find(e => e.id === extra.id);
                  return (
                  <div
                    key={extra.id}
                    className={`option-item${isSelected ? ' selected' : ''}`}
                    style={{
                      backgroundColor: extraIsOutOfStock ? '#f8f9fa' : (isSelected ? 'var(--store-accent)' : '#fff'),
                      border: `2px solid ${isSelected ? 'var(--store-accent)' : extraIsOutOfStock ? '#dc3545' : '#e0e0e0'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: extraIsOutOfStock ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: extraIsOutOfStock ? 0.6 : 1,
                      padding: 0,
                      flexDirection: 'column',
                      display: 'flex'
                    }}
                    onClick={() => toggleExtra(extra)}
                  >
                    {extraIsOutOfStock && (
                      <div className="out-of-stock-badge" style={{
                        top: '8px',
                        right: 'auto',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '11px',
                        padding: '4px 10px'
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
                          borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                      }}>
                        <span style={{ color: 'var(--store-accent)', fontSize: '56px' }}>🍽️</span>
                      </div>
                    )}
                    <div style={{
                      padding: '8px',
                      textAlign: 'center'
                    }}>
                      <div className="option-item-name" style={{
                        color: isSelected ? '#fff' : 'var(--store-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {extra.name}
                      </div>
                      {Number(extra.price) > 0 && (
                        <div className="option-item-price" style={{
                          color: isSelected ? '#fff' : 'var(--store-accent)'
                        }}>
                          +{colors.currency.symbol}{Number(extra.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ color: 'var(--store-accent)', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="store-modal-footer">
              {productModalStep === 'main' ? (
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={() => setExtrasModalOpen(false)}
                >
                  Listo
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={addToCart}
                  disabled={addingToCart}
                  style={{
                    backgroundColor: addingToCart ? '#28a745' : undefined,
                    cursor: addingToCart ? 'default' : undefined
                  }}
                >
                  {addingToCart ? '✓ ¡Agregado!' : `Agregar - ${colors.currency.symbol}${(calculateProductPrice() * productConfig.quantity).toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`cart-drawer${cartOpen ? ' open' : ''}`} style={{
        position: 'fixed',
        bottom: cartOpen ? 0 : '-85%',
        left: 0,
        right: 0,
        top: 'auto',
        height: '85%',
        maxWidth: 'none',
        transform: 'none',
        backgroundColor: '#f8f9fa',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
        transition: 'bottom 0.3s ease',
        zIndex: 1001,
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px'
      }}>
        <div className="cart-header">
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
            🛒 Mi Pedido
          </h2>
          <button
            className="store-modal-close"
            style={{
              position: 'static',
              backgroundColor: 'rgba(255,255,255,0.2)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
            onClick={() => setCartOpen(false)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="cart-items">
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
                <div className="cart-item" key={item.id}>
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

                  <div className="cart-item-info">
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <h4 className="cart-item-name" style={{
                        margin: 0,
                        fontSize: '18px'
                      }}>
                        {item.product_name}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="btn btn-danger"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          padding: 0,
                          minWidth: 'auto',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#fee2e2'
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>

                    {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                      <div className="cart-item-details">
                        {item.selected_ingredients.join(', ')}
                      </div>
                    )}

                    {item.selected_extras && item.selected_extras.length > 0 && (
                      <div className="cart-item-details">
                        + {item.selected_extras.join(', ')}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '12px'
                    }}>
                      <div className="cart-item-quantity">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          -
                        </button>
                        <span style={{
                          fontWeight: '700',
                          fontSize: '18px',
                          minWidth: '30px',
                          textAlign: 'center'
                        }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="cart-item-price" style={{
                        fontSize: '20px',
                        color: 'var(--store-accent)'
                      }}>
                        {colors.currency.symbol}{Number(item.total).toFixed(2)}
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

                <div className="cart-total" style={{
                  paddingTop: '12px',
                  borderTop: '2px dashed #dee2e6',
                  fontSize: '20px',
                  marginBottom: 0
                }}>
                  <span>Total:</span>
                  <span className="cart-total-amount">{colors.currency.symbol}{Number(getFinalTotal()).toFixed(2)}</span>
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
                    onFocus={(e) => e.target.style.borderColor = 'var(--store-accent)'}
                    onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                  />
                  {appliedCoupon ? (
                    <button
                      className="btn btn-danger btn-full"
                      onClick={removeCoupon}
                      style={{ marginTop: '8px' }}
                    >
                      Quitar cupón
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-full"
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCodeInput.trim()}
                      style={{
                        marginTop: '8px',
                        opacity: couponLoading || !couponCodeInput.trim() ? 0.5 : 1,
                        cursor: couponLoading || !couponCodeInput.trim() ? 'not-allowed' : 'pointer'
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
          <div className="cart-footer">
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
                      backgroundColor: orderType === 'serve' ? 'var(--store-primary)' : '#fff',
                      color: orderType === 'serve' ? '#fff' : '#212529',
                      border: `2px solid ${orderType === 'serve' ? 'var(--store-accent)' : '#dee2e6'}`,
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
                      backgroundColor: orderType === 'takeout' ? 'var(--store-primary)' : '#fff',
                      color: orderType === 'takeout' ? '#fff' : '#212529',
                      border: `2px solid ${orderType === 'takeout' ? 'var(--store-accent)' : '#dee2e6'}`,
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
              className="btn btn-primary btn-full btn-lg"
              onClick={handleCheckout}
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
          className="modal-overlay"
          style={{ zIndex: 1000 }}
          onClick={() => setCartOpen(false)}
        />
      )}

      {paymentModalOpen && (
        <div className="store-modal-overlay" style={{ zIndex: 2000, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <div style={{
            backgroundColor: 'var(--store-secondary)',
            borderRadius: '20px',
            padding: '30px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h2 style={{
              color: 'var(--store-primary)',
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
                  border: `5px solid var(--store-accent)`,
                  borderTop: `5px solid var(--store-primary)`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#666', fontSize: '14px' }}>
                  Esperando confirmacion del terminal...
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  {selectedConfiguration?.accept_card && (
                    <button
                      onClick={() => processPayment('card')}
                      style={{
                        padding: '20px',
                        backgroundColor: 'var(--store-secondary)',
                        color: 'var(--store-primary)',
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
                        backgroundColor: 'var(--store-secondary)',
                        color: 'var(--store-primary)',
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
        <div className="store-modal-overlay" style={{ zIndex: 2000, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <div style={{
            backgroundColor: 'var(--store-secondary)',
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              Esperando Pago
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              Acerque o pase la tarjeta en el terminal Point
            </p>
            <div style={{
              width: '80px',
              height: '80px',
              border: `6px solid var(--store-accent)`,
              borderTop: `6px solid var(--store-primary)`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
              Esperando confirmacion del pago...
            </p>
            <p style={{
              color: paymentTimeLeft <= 30 ? '#DC3545' : 'var(--store-primary)',
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
              className="btn btn-danger"
            >
              Cancelar pago
            </button>
          </div>
        </div>
      )}

      {paymentConfirmed && (
        <div className="store-modal-overlay" style={{ zIndex: 2000, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <div style={{
            backgroundColor: 'var(--store-secondary)',
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              Muchas gracias por su compra
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '16px' }}>
              Por favor espere su orden
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: 'var(--store-primary)',
                color: 'var(--store-secondary)',
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
              className="btn btn-primary btn-full btn-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {paymentCancelled && (
        <div className="store-modal-overlay" style={{ zIndex: 2000, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <div style={{
            backgroundColor: 'var(--store-secondary)',
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
            <div className="flex flex-col gap-4">
              <button
                onClick={() => {
                  setPaymentCancelled(false);
                  setPendingOrderData(null);
                  setProcessingPayment(true);
                  processPayment('card');
                }}
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--store-primary)',
                  color: 'var(--store-secondary)',
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
                  backgroundColor: 'var(--store-accent)',
                  color: 'var(--store-primary)',
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
                className="btn btn-danger btn-full btn-lg"
                style={{
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
        <div className="store-modal-overlay" style={{ zIndex: 2000, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <div style={{
            backgroundColor: 'var(--store-secondary)',
            borderRadius: '20px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              Muchas gracias por su compra
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '16px' }}>
              Por favor espere su orden
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: 'var(--store-primary)',
                color: 'var(--store-secondary)',
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
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: '25px' }}
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
