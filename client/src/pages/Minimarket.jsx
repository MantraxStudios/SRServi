import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
      
      const orderRes = await fetch('/api/market/create-payment', {
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#0a0a0a',
        color: 'white'
      }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '48px', color: '#D4AF37' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: colors.secondary,
        color: colors.primary
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: colors.accent }}>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: colors.secondary,
      color: colors.primary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        .mini-product-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 2px solid ${colors.accent}40;
        }
        .mini-product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px ${colors.accent}30;
          border-color: ${colors.accent};
        }
        .mini-product-image {
          height: 140px;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .mini-product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
        .mini-product-card:hover .mini-product-image img {
          transform: scale(1.05);
        }
        @media (max-width: 900px) {
          .main-layout {
            flex-direction: column !important;
          }
          .cart-panel {
            position: fixed !important;
            right: 0 !important;
            top: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            transform: translateX(0%) !important;
          }
          .products-area {
            padding-right: 16px !important;
          }
        }
      `}</style>

      <header style={{
        background: `linear-gradient(135deg, ${colors.header}, ${colors.primary})`,
        color: colors.accent,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: colors.accent }}>
            {store?.name || 'MINIMARKET'}
          </h1>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: colors.secondary,
          padding: '8px 16px',
          borderRadius: '12px',
          border: `2px solid ${colors.accent}`
        }}>
          <FontAwesomeIcon icon={faShoppingCart} style={{ color: colors.accent, fontSize: '20px' }} />
          <span style={{ fontWeight: '700', fontSize: '16px', color: colors.primary }}>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </div>
      </header>

      <input
        ref={barcodeInputRef}
        type="text"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && barcode) {
            e.preventDefault();
            const found = products.find(p => p.barcode === barcode);
            if (found) {
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

      <div style={{ display: 'flex', height: 'calc(100vh - 65px)' }}>
        <div style={{ flex: 1, background: colors.secondary }}>
          {cart.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: '#999'
            }}>
              <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: '80px', opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ fontSize: '18px' }}>Escanee productos con el lector de barcode</p>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {cart.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: 'white',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: '#f5f5f5', overflow: 'hidden', flexShrink: 0 }}>
                      {item.image && <img src={item.image.startsWith('http') ? item.image : `http://localhost:3001${item.image}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: colors.primary }}>{item.name}</div>
                      <div style={{ fontSize: '13px', color: '#999' }}>${item.price} c/u</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQuantity(item.id, -1)} style={{ background: '#f0f0f0', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesomeIcon icon={faMinus} style={{ fontSize: '12px', color: colors.primary }} />
                      </button>
                      <span style={{ fontWeight: '700', fontSize: '18px', minWidth: '30px', textAlign: 'center', color: colors.primary }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} style={{ background: colors.accent, border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesomeIcon icon={faPlus} style={{ fontSize: '12px', color: colors.primary }} />
                      </button>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: colors.accent, minWidth: '80px', textAlign: 'right' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: '8px' }}>
                      <FontAwesomeIcon icon={faTrash} style={{ fontSize: '18px' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ 
                padding: '20px', 
                background: 'white', 
                borderTop: `3px solid ${colors.accent}`,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Terminal Point</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: colors.primary, marginTop: '4px' }}>
                    <FontAwesomeIcon icon={faCreditCard} style={{ color: colors.accent, marginRight: '8px' }} />
                    {selectedPoint ? (selectedPoint.name || selectedPoint.device_id) : 'No configurada'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Total</div>
                  <div style={{ fontSize: '42px', fontWeight: '800', color: colors.accent }}>${getTotal().toFixed(2)}</div>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={!selectedPoint || processingPayment || paymentWaiting}
                  style={{
                    width: '100%',
                    padding: '18px',
                    fontSize: '18px',
                    fontWeight: '700',
                    background: !selectedPoint || processingPayment || paymentWaiting ? '#ddd' : `linear-gradient(135deg, ${colors.accent}, ${colors.accent}cc)`,
                    color: colors.primary,
                    border: 'none',
                    borderRadius: '14px',
                    cursor: !selectedPoint || processingPayment || paymentWaiting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <FontAwesomeIcon icon={processingPayment ? faSpinner : faCreditCard} spin={processingPayment} style={{ marginRight: '10px' }} />
                  {processingPayment ? 'Procesando...' : 'PAGAR'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {paymentSuccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{ background: colors.secondary, borderRadius: '24px', padding: '50px', textAlign: 'center', maxWidth: '320px', border: `3px solid ${colors.accent}` }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 30px rgba(40, 167, 69, 0.4)' }}>
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: '48px', color: 'white' }} />
            </div>
            <h2 style={{ margin: '0 0 12px', color: '#28a745', fontSize: '26px' }}>¡Pago Exitoso!</h2>
            <p style={{ color: '#999', fontSize: '15px' }}>Su pedido ha sido procesado correctamente</p>
          </div>
        </div>
      )}

      {paymentWaiting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{ background: colors.secondary, borderRadius: '24px', padding: '50px', textAlign: 'center', maxWidth: '320px', border: `3px solid ${colors.accent}` }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '56px', color: colors.accent, marginBottom: '24px' }} />
            <h2 style={{ margin: '0 0 12px', color: colors.primary, fontSize: '24px' }}>Esperando Pago...</h2>
            <p style={{ color: '#999', fontSize: '15px' }}>Aproxime su tarjeta al terminal Point</p>
          </div>
        </div>
      )}

      {paymentCancelled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{ background: colors.secondary, borderRadius: '24px', padding: '50px', textAlign: 'center', maxWidth: '320px', border: '3px solid #dc3545' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg, #dc3545 0%, #a71d2a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <FontAwesomeIcon icon={faTimes} style={{ fontSize: '48px', color: 'white' }} />
            </div>
            <h2 style={{ margin: '0 0 12px', color: '#dc3545', fontSize: '26px' }}>{paymentCancelled}</h2>
            <p style={{ color: '#999', fontSize: '15px' }}>El pago no fue completado</p>
            <button 
              onClick={() => setPaymentCancelled(null)}
              style={{
                marginTop: '20px',
                padding: '12px 30px',
                background: colors.accent,
                color: colors.primary,
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
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
