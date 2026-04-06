import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getImageUrl } from '../config.js';

const API = 'https://srservi2.srautomatic.com';

import {
  faBarcode,
  faShoppingCart,
  faTrash,
  faPlus,
  faMinus,
  faCreditCard,
  faCheck,
  faSearch,
  faBox,
  faChevronDown,
  faSpinner,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

function Minimarket() {
  const { code } = useParams();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [products, setProducts] = useState([]);
  const [store, setStore] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [pointDropdownOpen, setPointDropdownOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [barcodeFeedback, setBarcodeFeedback] = useState(null);
  const pointDropdownRef = useRef(null);
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    const savedCode = localStorage.getItem('minimarket_store_code');
    if (savedCode && !code) {
      window.location.href = `/minimarket/${savedCode}`;
    }
  }, []);

  useEffect(() => {
    fetchStoreData();
  }, [code]);

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

  useEffect(() => {
    let interval;
    if (paymentWaiting && pendingOrderData) {
      interval = setInterval(checkPaymentStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [paymentWaiting, pendingOrderData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pointDropdownRef.current && !pointDropdownRef.current.contains(event.target)) {
        setPointDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colors = store?.store ? {
    primary: store.store.primary_color || '#000000',
    secondary: store.store.secondary_color || '#FFFFFF',
    accent: store.store.accent_color || '#D4AF37',
    header: store.store.header_color || '#000000',
  } : {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#D4AF37',
    header: '#000000',
  };

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/${code}`);
      if (!response.ok) throw new Error('Tienda no encontrada');
      const data = await response.json();
      const storeData = data.store || data;
      setStore(storeData);

      localStorage.setItem('minimarket_store_code', code);

      const productsRes = await fetch(`/api/public/products/${storeData.id}`);
      if (productsRes.ok) {
        const prodsData = await productsRes.json();
        setProducts(prodsData);
      }

      if (storeData.id) {
        const terminalsRes = await fetch(`/api/public/terminals/${storeData.id}`);
        if (terminalsRes.ok) {
          const terminals = await terminalsRes.json();
          setPoints(terminals);

          if (terminals.length > 0) {
            const configRes = await fetch(`/api/store/${code}`);
            if (configRes.ok) {
              const config = await configRes.json();
              if (config.default_minimarket_terminal) {
                const defaultTerminal = terminals.find(t => t.id === config.default_minimarket_terminal);
                if (defaultTerminal) {
                  setSelectedPoint(defaultTerminal);
                  return;
                }
              }
            }
            setSelectedPoint(terminals[0]);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!pendingOrderData) return;

    try {
      const storeId = store?.store?.id || store?.id;
      const res = await fetch(`/api/market/payment-status/${pendingOrderData.id}?store_id=${storeId}&terminal_id=${pendingOrderData.terminal_id}`);
      if (!res.ok) return;
      const data = await res.json();

      const mpStatus = data.mp_status || data.status;
      const payStatus = data.payment_status || data.status;
      const paidAmount = data.paid_amount || '0';

      const isApproved = (payStatus === 'approved' || payStatus === 'paid' || payStatus === 'processed' ||
        mpStatus === 'processed') && (parseFloat(paidAmount) > 0 || payStatus === 'processed' || mpStatus === 'processed');
      const isFailed = mpStatus === 'failed' || payStatus === 'failed';
      const isCancelled = mpStatus === 'canceled' || mpStatus === 'refunded' || mpStatus === 'expired' ||
        payStatus === 'canceled' || payStatus === 'refunded';

      if (isApproved) {
        setPaymentWaiting(false);
        setPaymentSuccess(true);
        setPendingOrderData(null);
        setCart([]);
        setTimeout(() => setPaymentSuccess(false), 5000);
      } else if (isFailed) {
        setPaymentWaiting(false);
        setPaymentCancelled('Pago Fallido');
        setPendingOrderData(null);
      } else if (isCancelled) {
        setPaymentWaiting(false);
        const cancelType = mpStatus === 'expired' ? 'Pago Expirado' : 'Pago Cancelado';
        setPaymentCancelled(cancelType);
        setPendingOrderData(null);
        setCart([]);
      }
    } catch (err) {
      console.error('Error checking payment:', err);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const getTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handlePayment = async () => {
    if (!selectedPoint || cart.length === 0) return;

    try {
      setProcessingPayment(true);
      const storeId = store?.store?.id || store?.id;

      const orderRes = await fetch(API + '/api/market/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          terminal_id: selectedPoint.id,
          amount: getTotal(),
          description: `Venta Minimarket - ${new Date().toLocaleString()}`
        })
      });

      if (!orderRes.ok) throw new Error('Error creando orden');

      const orderData = await orderRes.json();
      setPendingOrderData(orderData);
      setPaymentWaiting(true);
    } catch (err) {
      console.error('Payment error:', err);
      alert('Error al procesar pago');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="minimarket-loading">
        <FontAwesomeIcon icon={faSpinner} spin className="minimarket-loading-icon" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="minimarket-error" style={{
        '--store-primary': colors.primary,
        '--store-secondary': colors.secondary,
        '--store-accent': colors.accent
      }}>
        <div className="text-center">
          <h2 className="minimarket-error-title">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="minimarket-container" style={{
      '--store-primary': colors.primary,
      '--store-secondary': colors.secondary,
      '--store-accent': colors.accent
    }}>
      <header className="minimarket-header">
        <div>
          <h1 className="minimarket-header-title">
            {store?.name || 'MINIMARKET'}
          </h1>
        </div>
        <div className="minimarket-header-cart">
          <FontAwesomeIcon icon={faShoppingCart} className="minimarket-header-cart-icon" />
          <span className="minimarket-header-cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </div>
      </header>

      <input
        ref={barcodeInputRef}
        className="barcode-input"
        type="text"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && barcode) {
            e.preventDefault();
            const found = products.find(p => p.barcode === barcode);
            if (found) {
              if (!found.unlimited_stock && found.stock === 0) {
                setBarcodeFeedback('Agotado: ' + found.name);
                setTimeout(() => setBarcodeFeedback(null), 2000);
                setBarcode('');
                return;
              }
              addToCart(found);
              setBarcode('');
              setBarcodeFeedback(found.name);
              setTimeout(() => setBarcodeFeedback(null), 2000);
            } else if (barcode.length > 0) {
              setBarcodeFeedback('No encontrado');
              setTimeout(() => setBarcodeFeedback(null), 1500);
            }
          }
        }}
        autoFocus
      />

      <div className="minimarket-body">
        <div className="minimarket-panel">
          {cart.length === 0 ? (
            <div className="minimarket-empty">
              <div className="minimarket-empty-icon">
                <FontAwesomeIcon icon={faShoppingCart} className="minimarket-empty-icon-fa" />
              </div>
              <p className="minimarket-empty-title">Escanee productos</p>
              <p className="minimarket-empty-subtitle">con el lector de barcode</p>
            </div>
          ) : (
            <div className="minimarket-cart-layout">
              <div className="minimarket-cart-items">
                <div>
                  <h2 className="minimarket-cart-section-title">Carrito de compras</h2>
                </div>
                {cart.map(item => (
                  <div key={item.id} className="minimarket-cart-item">
                    <div className="minimarket-cart-item-image">
                      {item.image && <img src={getImageUrl(item.image)} alt={item.name} />}
                    </div>
                    <div className="minimarket-cart-item-info">
                      <div className="minimarket-cart-item-name">{item.name}</div>
                      <div className="minimarket-cart-item-unit-price">${item.price?.toFixed(2)} c/u</div>
                    </div>
                    <div className="minimarket-cart-item-qty">
                      <button onClick={() => updateQuantity(item.id, -1)} className="minimarket-qty-btn">
                        <FontAwesomeIcon icon={faMinus} className="minimarket-qty-btn-icon" />
                      </button>
                      <span className="minimarket-qty-value">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="minimarket-qty-btn minimarket-qty-btn-add">
                        <FontAwesomeIcon icon={faPlus} className="minimarket-qty-btn-icon" />
                      </button>
                    </div>
                    <div className="minimarket-cart-item-total">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="minimarket-cart-item-remove">
                      <FontAwesomeIcon icon={faTrash} className="minimarket-cart-item-remove-icon" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="minimarket-checkout">
                <div className="text-center">
                  <div className="minimarket-checkout-label">Total a Pagar</div>
                  <div className="minimarket-checkout-total">${getTotal().toFixed(2)}</div>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={!selectedPoint || processingPayment || paymentWaiting}
                  className="minimarket-pay-btn"
                >
                  <FontAwesomeIcon icon={processingPayment ? faSpinner : faCreditCard} spin={processingPayment} />
                  {processingPayment ? 'Procesando...' : 'PAGAR'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {paymentSuccess && (
        <div className="minimarket-modal-overlay">
          <div className="minimarket-modal">
            <div className="minimarket-modal-icon minimarket-modal-icon-success">
              <FontAwesomeIcon icon={faCheck} className="minimarket-modal-icon-fa" />
            </div>
            <h2 className="minimarket-modal-title minimarket-modal-title-success">¡Pago Exitoso!</h2>
            <p className="minimarket-modal-text">Su pedido ha sido procesado correctamente</p>
          </div>
        </div>
      )}

      {paymentWaiting && (
        <div className="minimarket-modal-overlay">
          <div className="minimarket-modal">
            <FontAwesomeIcon icon={faSpinner} spin className="minimarket-modal-spinner" />
            <h2 className="minimarket-modal-title minimarket-modal-title-waiting">Esperando Pago...</h2>
            <p className="minimarket-modal-text">Aproxime su tarjeta al terminal Point</p>
          </div>
        </div>
      )}

      {paymentCancelled && (
        <div className="minimarket-modal-overlay">
          <div className="minimarket-modal minimarket-modal-danger">
            <div className="minimarket-modal-icon minimarket-modal-icon-danger">
              <FontAwesomeIcon icon={faTimes} className="minimarket-modal-icon-fa" />
            </div>
            <h2 className="minimarket-modal-title minimarket-modal-title-danger">{paymentCancelled}</h2>
            <p className="minimarket-modal-text">El pago no fue completado</p>
            <button
              onClick={() => setPaymentCancelled(null)}
              className="minimarket-modal-accept-btn"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Minimarket;
