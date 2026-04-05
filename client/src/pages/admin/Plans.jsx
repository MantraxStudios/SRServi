import { useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { API_URL } from '../../config.js';
import { 
  faCrown, 
  faCheck, 
  faTimes,
  faStore,
  faCalendarAlt,
  faSpinner,
  faCreditCard
} from '@fortawesome/free-solid-svg-icons';

function Plans() {
  const { token } = useAuth();
  const { selectedStore, colors } = useContext(StoreContext);
  const [plans, setPlans] = useState([]);
  const [myPlan, setMyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [message, setMessage] = useState(null);
  const [mpLoading, setMpLoading] = useState(false);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    fetchPlans();
    fetchMyPlan();
    loadMercadoPagoScript();
    handlePaymentReturn();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(API_URL + '/api/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const fetchMyPlan = async () => {
    try {
      const response = await fetch(`${API_URL}/api/my-plan`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyPlan(data);
      }
    } catch (err) {
      console.error('Error fetching my plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMercadoPagoScript = () => {
    if (scriptLoaded.current) return;
    
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => {
      scriptLoaded.current = true;
      console.log('MercadoPago SDK loaded');
    };
    document.body.appendChild(script);
  };

  const handlePaymentReturn = async () => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const paymentId = params.get('payment_id');
    
    if (paymentStatus === 'success' || paymentId) {
      try {
        const response = await fetch(`${API_URL}/api/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ payment_id: paymentId })
        });
        
        const data = await response.json();
        
        if (data.success && data.activated) {
          setMessage({ type: 'success', text: '¡Pago exitoso! Tu suscripción ha sido activada.' });
        } else if (data.success) {
          setMessage({ type: 'info', text: 'Pago recibido. Procesando tu suscripción...' });
        }
      } catch (err) {
        setMessage({ type: 'success', text: '¡Pago exitoso! Tu suscripción ha sido activada.' });
      }
      fetchMyPlan();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'failure') {
      setMessage({ type: 'error', text: 'El pago falló. Por favor intenta nuevamente.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'pending') {
      setMessage({ type: 'warning', text: 'El pago está pendiente. Te notificaremos cuando se confirme.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleSubscribe = async (planId) => {
    setSubscribing(planId);
    setMessage(null);
    setMpLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/create-subscription-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId, billingCycle })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al procesar la solicitud' });
        return;
      }
      
      if (data.isFree) {
        setMessage({ type: 'success', text: data.message });
        fetchMyPlan();
        return;
      }
      
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setMessage({ type: 'error', text: 'No se pudo obtener el enlace de pago' });
      }
    } catch (err) {
      console.error('Error:', err);
      setMessage({ type: 'error', text: 'Error al procesar la solicitud' });
    } finally {
      setSubscribing(null);
      setMpLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (price === 0) return 'Gratis';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const parseFeatures = (features) => {
    if (!features) return [];
    if (typeof features === 'string') {
      try {
        return JSON.parse(features);
      } catch {
        return [features];
      }
    }
    return features;
  };

  const getCurrentPlanName = () => {
    if (!myPlan?.plan) return 'Gratis';
    return myPlan.plan.plan_name || 'Gratis';
  };

  const isCurrentPlan = (planName) => {
    return getCurrentPlanName() === planName;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '32px', color: colors.accent }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: colors.primary, marginBottom: '8px' }}>
          <FontAwesomeIcon icon={faCrown} style={{ marginRight: '12px', color: colors.accent }} />
          Planes y Suscripciones
        </h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Gestiona tu plan y desbloquea más funcionalidades
        </p>
      </div>

      {message && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          backgroundColor: message.type === 'success' ? 'rgba(40,167,69,0.1)' : 
                          message.type === 'warning' ? 'rgba(255,193,7,0.1)' : 
                          'rgba(220,53,69,0.1)',
          color: message.type === 'success' ? '#28a745' : 
                 message.type === 'warning' ? '#856404' : 
                 '#dc3545',
          border: `1px solid ${message.type === 'success' ? '#28a745' : 
                                message.type === 'warning' ? '#ffc107' : 
                                '#dc3545'}`
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        backgroundColor: colors.secondary,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '32px',
        border: `1px solid ${colors.primary}22`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            backgroundColor: colors.accent,
            color: colors.primary,
            padding: '8px 16px',
            borderRadius: '20px',
            fontWeight: '700',
            fontSize: '14px'
          }}>
            <FontAwesomeIcon icon={faCrown} style={{ marginRight: '8px' }} />
            {getCurrentPlanName()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
            <FontAwesomeIcon icon={faStore} />
            <span>{myPlan?.storeCount || 0} / {myPlan?.maxStores || 2} tiendas</span>
          </div>
          {myPlan?.plan?.ends_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span>Vence: {new Date(myPlan.plan.ends_at).toLocaleDateString('es-ES')}</span>
            </div>
          )}
        </div>
        <div style={{
          marginTop: '12px',
          height: '8px',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(((myPlan?.storeCount || 0) / (myPlan?.maxStores || 2)) * 100, 100)}%`,
            backgroundColor: myPlan?.storeCount >= myPlan?.maxStores ? colors.accent : colors.accent,
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <button onClick={() => setBillingCycle('monthly')}>Mensual</button>
        <button onClick={() => setBillingCycle('yearly')}>Anual</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {plans.map((plan) => {
          const features = parseFeatures(plan.features);
          const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
          const currentPlan = isCurrentPlan(plan.name);
          const isFree = plan.price_monthly === 0 && plan.price_yearly === 0;

          return (
            <div
              key={plan.id}
              style={{
                backgroundColor: colors.secondary,
                borderRadius: '16px',
                padding: '24px',
                border: currentPlan ? `2px solid ${colors.accent}` : `1px solid ${colors.primary}22`,
                position: 'relative',
                boxShadow: currentPlan ? `0 4px 20px ${colors.accent}33` : 'none',
                transform: currentPlan ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}
            >
              {currentPlan && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: colors.accent,
                  color: colors.primary,
                  padding: '4px 16px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  PLAN ACTUAL
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ 
                  fontSize: '22px', 
                  fontWeight: '700', 
                  color: colors.primary,
                  marginBottom: '8px'
                }}>
                  {plan.name}
                </h3>
                <p style={{ color: '#666', fontSize: '14px', minHeight: '40px' }}>
                  {plan.description}
                </p>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ 
                  fontSize: '36px', 
                  fontWeight: '700', 
                  color: colors.primary 
                }}>
                  {formatPrice(price)}
                </span>
                {price > 0 && (
                  <span style={{ color: '#666', fontSize: '14px' }}>
                    /{billingCycle === 'yearly' ? 'año' : 'mes'}
                  </span>
                )}
                {plan.price_yearly > 0 && billingCycle === 'yearly' && (
                  <div style={{ fontSize: '12px', color: '#28a745', marginTop: '4px' }}>
                    Ahorra ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(2)}/año
                  </div>
                )}
              </div>

              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: '0 0 24px 0' 
              }}>
                <li style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  padding: '8px 0',
                  color: '#333',
                  fontSize: '14px',
                  borderBottom: `1px solid ${colors.primary}11`
                }}>
                  <FontAwesomeIcon icon={faStore} style={{ color: colors.accent, width: '16px' }} />
                  <strong>{plan.max_stores}</strong> tiendas máximo
                </li>
                {features.map((feature, index) => (
                  <li key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px 0',
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    <FontAwesomeIcon icon={faCheck} style={{ color: '#28a745', width: '16px' }} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !currentPlan && !isFree && handleSubscribe(plan.id)}
                disabled={currentPlan || subscribing === plan.id}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: currentPlan || isFree ? 'default' : 'pointer',
                  backgroundColor: currentPlan ? colors.accent : (isFree ? '#e0e0e0' : colors.primary),
                  color: currentPlan ? colors.primary : (isFree ? '#666' : colors.secondary),
                  transition: 'all 0.2s ease',
                  opacity: subscribing === plan.id ? 0.7 : 1
                }}
              >
                {subscribing === plan.id ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                    Procesando...
                  </>
                ) : currentPlan ? (
                  <>
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: '8px' }} />
                    Plan Actual
                  </>
                ) : isFree ? (
                  <>
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: '8px' }} />
                    Incluido
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCreditCard} style={{ marginRight: '8px' }} />
                    Suscribirse
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '48px',
        textAlign: 'center',
        color: '#666',
        fontSize: '13px'
      }}>
        <p>¿Preguntas? Contacta a <strong>soporte@srautomatic.com</strong></p>
      </div>
    </div>
  );
}

export default Plans;
