import { useState, useEffect, useRef, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
        setProducts(data);
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
        quantity: quantity
      }]);
    }
    
    setFoundProduct(null);
    setAddQuantity(1);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`/api/products/search/${encodeURIComponent(searchQuery)}?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const results = await response.json();
        setProducts(results);
      }
    } catch (err) {
      console.error('Error searching:', err);
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
      const response = await fetch('/api/market/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      <header className="admin-header">
        <h1>
          <FontAwesomeIcon icon={faBox} style={{ marginRight: '10px' }} />
          Modo Market - POS
        </h1>
        <button 
          className="btn btn-secondary"
          onClick={clearCart}
          disabled={cart.length === 0}
        >
          <FontAwesomeIcon icon={faTrash} />
          Vaciar Carrito
        </button>
      </header>

      <div className="admin-main" style={{ padding: '20px' }}>
        {error && (
          <div className="error" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: '12px',
            backgroundColor: '#f8d7da',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <FontAwesomeIcon icon={faExclamationTriangle} />
            {error}
          </div>
        )}

        {paymentSuccess && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#28a745',
              color: 'white',
              padding: '60px',
              borderRadius: '20px',
              textAlign: 'center',
              animation: 'scaleIn 0.3s ease'
            }}>
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: '80px', marginBottom: '20px' }} />
              <h2 style={{ fontSize: '32px', marginBottom: '10px' }}>¡Pago Exitoso!</h2>
              <p style={{ fontSize: '24px' }}>
                Total: ${paymentSuccess.amount?.toFixed(2) || getTotal().toFixed(2)}
              </p>
              <p style={{ fontSize: '16px', marginTop: '10px', opacity: 0.8 }}>
                ID: {paymentSuccess.id}
              </p>
              <button
                onClick={() => {
                  setPaymentSuccess(null);
                  clearCart();
                }}
                style={{
                  marginTop: '20px',
                  padding: '12px 30px',
                  fontSize: '18px',
                  backgroundColor: 'white',
                  color: '#28a745',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Aceptar
              </button>
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
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '50px',
              borderRadius: '20px',
              textAlign: 'center',
              maxWidth: '500px',
              width: '90%'
            }}>
              <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '60px', color: '#007bff', marginBottom: '20px' }} />
              <h2 style={{ fontSize: '28px', marginBottom: '10px', color: '#333' }}>
                Esperando Pago...
              </h2>
              <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px' }}>
                El cliente debe pagar en la maquina Point
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                fontSize: '32px',
                fontWeight: '700',
                color: '#007bff',
                marginBottom: '20px'
              }}>
                <FontAwesomeIcon icon={faClock} />
                {formatTime(paymentTimeLeft)}
              </div>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '14px', color: '#666' }}>Total a cobrar</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#28a745' }}>
                  ${pendingOrderData?.amount?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setPaymentWaiting(false);
                    setPendingOrderData(null);
                  }}
                  style={{
                    padding: '12px 30px',
                    fontSize: '16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
          <div className="card">
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FontAwesomeIcon icon={faBarcode} />
              Escanear Producto
            </h2>

            <form onSubmit={handleBarcodeSubmit} style={{ marginBottom: '20px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escanee codigo de barras..."
                  disabled={paymentWaiting}
                  style={{
                    width: '100%',
                    padding: '20px',
                    fontSize: '24px',
                    textAlign: 'center',
                    border: '3px solid var(--gray)',
                    borderRadius: '12px',
                    outline: 'none',
                    letterSpacing: '2px'
                  }}
                  autoFocus
                />
                <div style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--gray)',
                  fontSize: '14px'
                }}>
                  ENTER
                </div>
              </div>
            </form>

            {foundProduct && (
              <div style={{
                border: '3px solid var(--gold)',
                borderRadius: '16px',
                padding: '24px',
                backgroundColor: '#fffbf0'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '24px', marginBottom: '5px', color: 'var(--gold-dark)' }}>
                    {foundProduct.name}
                  </h3>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#666' }}>
                    ${parseFloat(foundProduct.price).toFixed(2)}
                  </div>
                  {foundProduct.barcode && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                      {foundProduct.barcode}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                    Cantidad:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}
                      style={{
                        width: '50px',
                        height: '50px',
                        border: '2px solid var(--gray)',
                        borderRadius: '10px',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '24px'
                      }}
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <input
                      type="number"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: '100px',
                        height: '50px',
                        textAlign: 'center',
                        fontSize: '28px',
                        fontWeight: '700',
                        border: '2px solid var(--gray)',
                        borderRadius: '10px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setAddQuantity(addQuantity + 1)}
                      style={{
                        width: '50px',
                        height: '50px',
                        border: '2px solid var(--gray)',
                        borderRadius: '10px',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '24px'
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '16px', fontSize: '18px' }}
                    onClick={() => addToCart(foundProduct, addQuantity)}
                  >
                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                    Agregar {addQuantity} al Carrito
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '16px' }}
                    onClick={() => setFoundProduct(null)}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>Buscar Producto</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
                  placeholder="Nombre del producto..."
                  disabled={paymentWaiting}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: '16px',
                    border: '2px solid var(--gray)',
                    borderRadius: '8px'
                  }}
                />
                <button className="btn btn-primary" onClick={searchProducts} disabled={paymentWaiting}>
                  <FontAwesomeIcon icon={faSearch} />
                </button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px' }}>
                {products.map(product => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setFoundProduct(product);
                      setAddQuantity(1);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '12px',
                      border: '1px solid var(--gray)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{product.name}</strong>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {product.category_name || 'Sin categoria'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: 'var(--gold-dark)' }}>
                        ${parseFloat(product.price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ position: 'sticky', top: '20px', maxHeight: 'calc(100vh - 40px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FontAwesomeIcon icon={faShoppingCart} />
              Carrito ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
            </h2>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                  Carrito vacio
                </p>
              ) : (
                cart.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid var(--gray)',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '600', fontSize: '16px' }}>{item.name}</div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        disabled={paymentWaiting}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        ${item.price.toFixed(2)} c/u
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={paymentWaiting}
                          style={{
                            width: '36px',
                            height: '36px',
                            border: '1px solid var(--gray)',
                            borderRadius: '8px',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <FontAwesomeIcon icon={faMinus} style={{ fontSize: '14px' }} />
                        </button>
                        <span style={{ fontWeight: '700', fontSize: '20px', minWidth: '40px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={paymentWaiting}
                          style={{
                            width: '36px',
                            height: '36px',
                            border: '1px solid var(--gray)',
                            borderRadius: '8px',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <FontAwesomeIcon icon={faPlus} style={{ fontSize: '14px' }} />
                        </button>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '18px', minWidth: '80px', textAlign: 'right' }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '3px solid var(--gold)', paddingTop: '20px', marginTop: 'auto' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '28px',
                fontWeight: '700',
                marginBottom: '20px'
              }}>
                <span>Total:</span>
                <span style={{ color: 'var(--gold-dark)' }}>${getTotal().toFixed(2)}</span>
              </div>

              <div style={{ marginBottom: '15px' }} ref={pointDropdownRef}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Seleccionar Point:
                </label>
                <div
                  onClick={() => !paymentWaiting && setPointDropdownOpen(!pointDropdownOpen)}
                  style={{
                    padding: '14px 16px',
                    border: '2px solid var(--gray)',
                    borderRadius: '10px',
                    cursor: paymentWaiting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    opacity: paymentWaiting ? 0.6 : 1
                  }}
                >
                  <span>
                    {selectedPoint ? (selectedPoint.name || selectedPoint.device_id) : 'Seleccione un Point...'}
                  </span>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    rotation={pointDropdownOpen ? 180 : 0}
                    style={{ transition: 'transform 0.2s' }}
                  />
                </div>
                {pointDropdownOpen && (
                  <div style={{
                    border: '1px solid var(--gray)',
                    borderRadius: '10px',
                    marginTop: '5px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: 'white'
                  }}>
                    {points.length === 0 ? (
                      <div style={{ padding: '16px', color: '#666', textAlign: 'center' }}>
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
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            backgroundColor: selectedPoint?.id === point.id ? '#fff8e1' : 'white',
                            borderBottom: '1px solid #eee'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = selectedPoint?.id === point.id ? '#fff8e1' : 'white'}
                        >
                          <div style={{ fontWeight: '600' }}>{point.name || point.device_id}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{point.device_id}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '18px', fontSize: '20px' }}
                disabled={cart.length === 0 || !selectedPoint || processingPayment || paymentWaiting}
                onClick={handlePayment}
              >
                <FontAwesomeIcon icon={processingPayment ? faSpinner : faCreditCard} spin={processingPayment} style={{ marginRight: '10px' }} />
                {processingPayment ? 'Procesando...' : 'Cobrar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        .admin-main {
          max-width: 1400px;
          margin: 0 auto;
        }
        
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      `}</style>
    </>
  );
}

export default Market;
