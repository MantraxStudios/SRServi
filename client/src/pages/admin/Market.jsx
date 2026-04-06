import { useState, useEffect, useRef, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { getImageUrl } from '../../config.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const API = 'https://srservi2.srautomatic.com';

import {
  faBarcode,
  faShoppingCart,
  faTrash,
  faPlus,
  faMinus,
  faCreditCard,
  faCheck,
  faTimes,
  faSearch,
  faBox,
  faExclamationTriangle,
  faChevronDown,
  faSpinner,
  faClock
} from '@fortawesome/free-solid-svg-icons';

function Market() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [pointDropdownOpen, setPointDropdownOpen] = useState(false);
  const [addQuantity, setAddQuantity] = useState(1);
  const [foundProduct, setFoundProduct] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(600);
  const barcodeInputRef = useRef(null);
  const pointDropdownRef = useRef(null);

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pointDropdownRef.current && !pointDropdownRef.current.contains(e.target)) {
        setPointDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedStore?.id) {
      fetchProducts();
      fetchPoints();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredProducts(products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  useEffect(() => {
    if (!paymentWaiting || !pendingOrderData) return;

    const orderId = pendingOrderData.id;
    const storeId = selectedStore.id;
    const terminalId = pendingOrderData.terminal_id;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/market/payment-status/${orderId}?store_id=${storeId}&terminal_id=${terminalId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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
          setPaymentSuccess({
            id: orderId,
            amount: pendingOrderData.amount,
            status: 'approved'
          });
          setPaymentWaiting(false);
          setPendingOrderData(null);
        } else if (isCancelled) {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          setPaymentWaiting(false);
          setPendingOrderData(null);
          setError('Pago cancelado o expirado');
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    }, 2000);

    const timerInterval = setInterval(() => {
      setPaymentTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          clearInterval(pollInterval);
          setPaymentWaiting(false);
          setPendingOrderData(null);
          setError('Tiempo de espera agotado');
          setTimeout(() => setError(null), 3000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [paymentWaiting, pendingOrderData, selectedStore, token]);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/products?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const uniqueProducts = (data || []).filter((product, index, self) =>
          index === self.findIndex((p) => p.id === product.id)
        );
        setProducts(uniqueProducts);
        setFilteredProducts(uniqueProducts);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await fetch(`/api/mercado-pago-terminals?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPoints(data);
        if (data.length > 0 && !selectedPoint) {
          setSelectedPoint(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching points:', err);
    }
  };

  const handleBarcodeSubmit = async (e) => {
    e?.preventDefault();
    if (!barcode.trim()) return;

    try {
      const response = await fetch(`/api/products/barcode/${barcode}?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const product = await response.json();
        setFoundProduct(product);
        setAddQuantity(1);
      } else {
        setError('Producto no encontrado');
        setTimeout(() => setError(null), 2000);
      }
    } catch (err) {
      setError('Error al buscar producto');
      setTimeout(() => setError(null), 2000);
    }

    setBarcode('');
  };

  const addToCart = (product, quantity) => {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.image,
        quantity: quantity
      }]);
    }

    setFoundProduct(null);
    setAddQuantity(1);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setFoundProduct(null);
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handlePayment = async () => {
    if (cart.length === 0 || !selectedPoint) return;

    setProcessingPayment(true);
    const total = getTotal();

    try {
      const response = await fetch(API + '/api/market/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          store_id: selectedStore.id,
          terminal_id: selectedPoint.id,
          amount: total,
          description: `Venta Market - ${new Date().toLocaleString()}`
        })
      });

      if (response.ok) {
        const paymentData = await response.json();
        setPendingOrderData({
          id: paymentData.id,
          amount: total,
          external_reference: paymentData.external_reference,
          terminal_id: selectedPoint.id
        });
        setPaymentWaiting(true);
        setPaymentTimeLeft(600);
      } else {
        const err = await response.json();
        setError(err.error || 'Error al procesar pago');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError('Error al procesar pago');
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBarcodeSubmit();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <style>{`
        .market-container {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
          height: calc(100vh - 100px);
          padding: 20px;
        }

        .market-products {
          overflow-y: auto;
          padding-right: 10px;
        }

        .market-products::-webkit-scrollbar {
          width: 8px;
        }

        .market-products::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .market-products::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 4px;
        }

        .barcode-section {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .product-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .product-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          border-color: var(--gold);
        }

        .product-card-image {
          height: 160px;
          background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .product-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .product-card-info {
          padding: 14px;
        }

        .product-card-name {
          font-size: 15px;
          font-weight: 600;
          color: #333;
          margin-bottom: 6px;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .product-card-price {
          font-size: 22px;
          font-weight: 700;
          color: var(--gold-dark);
        }

        .search-bar {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }

        .search-bar input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 15px;
        }

        .search-bar input:focus {
          outline: none;
          border-color: var(--gold);
        }

        .cart-panel {
          background: white;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 140px);
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .cart-items {
          flex: 1;
          overflow-y: auto;
          margin: 15px 0;
        }

        .cart-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 12px;
          margin-bottom: 10px;
        }

        .cart-item-image {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          background: #f0f0f0;
          overflow: hidden;
          flex-shrink: 0;
        }

        .cart-item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cart-item-info {
          flex: 1;
        }

        .cart-item-name {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .cart-item-price {
          color: #666;
          font-size: 13px;
        }

        .cart-item-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .qty-btn {
          width: 32px;
          height: 32px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qty-btn:hover {
          background: #f0f0f0;
        }

        .qty-value {
          font-weight: 700;
          font-size: 16px;
          min-width: 30px;
          text-align: center;
        }

        .cart-total {
          padding-top: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .cart-items::-webkit-scrollbar {
          width: 6px;
        }

        .cart-items::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .cart-items::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }

        .quick-add-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .quick-add-card {
          background: white;
          border-radius: 20px;
          padding: 30px;
          width: 350px;
          text-align: center;
        }

        .quick-add-image {
          width: 150px;
          height: 150px;
          border-radius: 16px;
          overflow: hidden;
          margin: 0 auto 20px;
          background: #f5f5f5;
        }

        .quick-add-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .quick-add-qty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin: 20px 0;
        }

        .quick-add-qty input {
          width: 80px;
          height: 60px;
          text-align: center;
          font-size: 28px;
          font-weight: 700;
          border: 2px solid #ddd;
          border-radius: 10px;
        }

        .quick-add-qty button {
          width: 50px;
          height: 50px;
          border: 2px solid #ddd;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          font-size: 24px;
        }

        .quick-add-buttons {
          display: flex;
          gap: 10px;
        }

        .quick-add-buttons button {
          flex: 1;
          padding: 14px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-add {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%);
          color: white;
          border: none;
        }

        .btn-cancel {
          background: #f0f0f0;
          color: #666;
          border: none;
        }
      `}</style>

      <header className="admin-header">
        <h1>
          <FontAwesomeIcon icon={faBox} />
          {' '}Market POS
        </h1>
        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            onClick={clearCart}
            disabled={cart.length === 0 || paymentWaiting}
          >
            <FontAwesomeIcon icon={faTrash} />
            Vaciar
          </button>
        </div>
      </header>

      {error && (
        <div className="market-error-banner">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {error}
        </div>
      )}

      {paymentSuccess && (
        <div className="quick-add-overlay" onClick={() => { setPaymentSuccess(null); clearCart(); }}>
          <div className="market-success-overlay">
            <FontAwesomeIcon icon={faCheck} className="market-success-icon" />
            <h2 className="market-success-title">Pago Exitoso!</h2>
            <p className="market-success-amount">
              Total: ${paymentSuccess.amount?.toFixed(2) || getTotal().toFixed(2)}
            </p>
            <button
              onClick={() => { setPaymentSuccess(null); clearCart(); }}
              className="market-success-btn"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {paymentWaiting && (
        <div className="quick-add-overlay">
          <div className="market-waiting-card">
            <FontAwesomeIcon icon={faCreditCard} className="market-waiting-icon" />
            <h2 className="market-waiting-title">
              Esperando Pago...
            </h2>
            <p className="market-waiting-text">
              El cliente debe pagar en la maquina Point
            </p>
            <div className="market-waiting-timer">
              <FontAwesomeIcon icon={faClock} />
              {' '}{formatTime(paymentTimeLeft)}
            </div>
            <div className="market-waiting-amount-box">
              <div className="market-waiting-amount-label">Total a cobrar</div>
              <div className="market-waiting-amount-value">
                ${pendingOrderData?.amount?.toFixed(2) || '0.00'}
              </div>
            </div>
            <button
              onClick={() => {
                setPaymentWaiting(false);
                setPendingOrderData(null);
              }}
              className="btn btn-danger"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {foundProduct && (
        <div className="quick-add-overlay">
          <div className="quick-add-card">
            <button
              onClick={() => setFoundProduct(null)}
              className="found-product-close"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="quick-add-image">
              {foundProduct.image ? (
                <img
                  src={getImageUrl(foundProduct.image)}
                  alt={foundProduct.name}
                />
              ) : (
                <FontAwesomeIcon icon={faBox} className="product-image-placeholder" />
              )}
            </div>
            <h3 className="found-product-name">{foundProduct.name}</h3>
            <div className="found-product-price">
              ${parseFloat(foundProduct.price).toFixed(2)}
            </div>
            <div className="quick-add-qty">
              <button onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}>
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <input
                type="number"
                value={addQuantity}
                onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
              />
              <button onClick={() => setAddQuantity(addQuantity + 1)}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
            <div className="quick-add-buttons">
              <button className="btn-cancel" onClick={() => setFoundProduct(null)}>Cancelar</button>
              <button className="btn-add" onClick={() => addToCart(foundProduct, addQuantity)}>
                <FontAwesomeIcon icon={faPlus} />
                {' '}Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="market-container">
        <div className="market-products">
          <div className="barcode-section">
            <form onSubmit={handleBarcodeSubmit}>
              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escanee codigo de barras..."
                  disabled={paymentWaiting}
                  className="market-barcode-input"
                />
                <div className="market-barcode-hint">
                  ENTER
                </div>
              </div>
            </form>
            <div className="search-bar">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                disabled={paymentWaiting}
              />
            </div>
          </div>

          <div className="product-grid">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="product-card"
                onClick={() => {
                  setFoundProduct(product);
                  setAddQuantity(1);
                }}
              >
                <div className="product-card-image">
                  {product.image ? (
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.name}
                    />
                  ) : (
                    <FontAwesomeIcon icon={faBox} className="product-image-placeholder" />
                  )}
                </div>
                <div className="product-card-info">
                  <div className="product-card-name">{product.name}</div>
                  <div className="product-card-price">${parseFloat(product.price).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="market-empty-products">
              <FontAwesomeIcon icon={faSearch} className="market-empty-products-icon" />
              <p>No se encontraron productos</p>
            </div>
          )}
        </div>

        <div className="cart-panel">
          <h2 className="market-cart-title">
            <FontAwesomeIcon icon={faShoppingCart} />
            Carrito ({cart.reduce((sum, item) => sum + item.quantity, 0)})
          </h2>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="market-cart-empty">
                <FontAwesomeIcon icon={faShoppingCart} className="market-cart-empty-icon" />
                <p>Carrito vacio</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-image">
                    {item.image ? (
                      <img
                        src={getImageUrl(item.image)}
                        alt={item.name}
                      />
                    ) : (
                      <FontAwesomeIcon icon={faBox} className="product-image-placeholder" />
                    )}
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">${item.price.toFixed(2)} c/u</div>
                    <div className="market-item-subtotal">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, -1)}
                      disabled={paymentWaiting}
                    >
                      <FontAwesomeIcon icon={faMinus} className="text-xs" />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, 1)}
                      disabled={paymentWaiting}
                    >
                      <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      disabled={paymentWaiting}
                      className="cart-remove-btn"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-sm" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="cart-total">
            <div className="market-checkout-panel">
              <div>
                <div className="market-terminal-label">TERMINAL POINT</div>
                <div ref={pointDropdownRef}>
                  <div
                    onClick={() => !paymentWaiting && setPointDropdownOpen(!pointDropdownOpen)}
                    className={`market-terminal-selector ${paymentWaiting ? 'disabled' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faCreditCard} className="pos-terminal-icon" />
                      <div className="market-terminal-name">
                        {selectedPoint ? (selectedPoint.name || selectedPoint.device_id) : 'Seleccionar...'}
                      </div>
                    </div>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`pos-dropdown-arrow ${pointDropdownOpen ? 'open' : ''}`}
                    />
                  </div>
                  {pointDropdownOpen && (
                    <div className="market-terminal-dropdown">
                      {points.length === 0 ? (
                        <div className="market-terminal-empty">
                          No hay puntos de venta
                        </div>
                      ) : (
                        points.map(point => (
                          <div
                            key={point.id}
                            onClick={() => {
                              setSelectedPoint(point);
                              setPointDropdownOpen(false);
                            }}
                            className="market-terminal-option"
                          >
                            <div className="market-terminal-option-name">{point.name || point.device_id}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="market-total-section">
                <div className="market-total-label">TOTAL A COBRAR</div>
                <div className="market-total-value">
                  ${getTotal().toFixed(2)}
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={cart.length === 0 || !selectedPoint || processingPayment || paymentWaiting}
                className="market-pay-btn"
              >
                <FontAwesomeIcon icon={processingPayment ? faSpinner : faCreditCard} spin={processingPayment} />
                {processingPayment ? 'Procesando...' : 'COBRAR'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Market;
