import { useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const API = 'https://srservi2.srautomatic.com';

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
      const response = await fetch(API + '/api/plans');
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
      const response = await fetch(API + '/api/my-plan', {
        headers: { 'Authorization': 'Bearer ' + token }
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
        const response = await fetch(API + '/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ payment_id: paymentId })
        });

        const data = await response.json();

        if (data.success && data.activated) {
          setMessage({ type: 'success', text: '\u00A1Pago exitoso! Tu suscripci\u00F3n ha sido activada.' });
        } else if (data.success) {
          setMessage({ type: 'info', text: 'Pago recibido. Procesando tu suscripci\u00F3n...' });
        }
      } catch (err) {
        setMessage({ type: 'success', text: '\u00A1Pago exitoso! Tu suscripci\u00F3n ha sido activada.' });
      }
      fetchMyPlan();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'failure') {
      setMessage({ type: 'error', text: 'El pago fall\u00F3. Por favor intenta nuevamente.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'pending') {
      setMessage({ type: 'warning', text: 'El pago est\u00E1 pendiente. Te notificaremos cuando se confirme.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleSubscribe = async (planId) => {
    setSubscribing(planId);
    setMessage(null);
    setMpLoading(true);

    try {
      const response = await fetch(API + '/api/create-subscription-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
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
      <div className="flex justify-center items-center" style={{ height: '50vh' }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ color: colors.accent }} />
      </div>
    );
  }

  return (
    <div className="plans-page">
      <div className="plans-header">
        <h1>
          <FontAwesomeIcon icon={faCrown} style={{ color: colors.accent }} />
          {' '}Planes y Suscripciones
        </h1>
        <p>
          Gestiona tu plan y desbloquea m&aacute;s funcionalidades
        </p>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success' : message.type === 'warning' ? 'badge-warning' : 'error'}>
          {message.text}
        </div>
      )}

      <div className="plans-current-box">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="plans-current-badge" style={{ backgroundColor: colors.accent, color: colors.primary }}>
            <FontAwesomeIcon icon={faCrown} />
            {' '}{getCurrentPlanName()}
          </div>
          <div className="plans-current-info">
            <FontAwesomeIcon icon={faStore} />
            <span>{myPlan?.storeCount || 0} / {myPlan?.maxStores || 2} tiendas</span>
          </div>
          {myPlan?.plan?.ends_at && (
            <div className="plans-current-info">
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span>Vence: {new Date(myPlan.plan.ends_at).toLocaleDateString('es-ES')}</span>
            </div>
          )}
        </div>
        <div className="plans-progress-bar">
          <div className="plans-progress-fill" style={{
            width: `${Math.min(((myPlan?.storeCount || 0) / (myPlan?.maxStores || 2)) * 100, 100)}%`,
            backgroundColor: colors.accent
          }} />
        </div>
      </div>

      <div className="hidden">
        <button onClick={() => setBillingCycle('monthly')}>Mensual</button>
        <button onClick={() => setBillingCycle('yearly')}>Anual</button>
      </div>

      <div className="plans-grid">
        {plans.map((plan) => {
          const features = parseFeatures(plan.features);
          const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
          const currentPlan = isCurrentPlan(plan.name);
          const isFree = plan.price_monthly === 0 && plan.price_yearly === 0;

          return (
            <div
              key={plan.id}
              className={`plan-card ${currentPlan ? 'current' : ''}`}
            >
              {currentPlan && (
                <div className="plan-card-badge" style={{ backgroundColor: colors.accent, color: colors.primary }}>
                  PLAN ACTUAL
                </div>
              )}

              <div className="text-center">
                <h3 className="plan-card-title">
                  {plan.name}
                </h3>
                <p className="plan-card-desc">
                  {plan.description}
                </p>
              </div>

              <div className="text-center">
                <span className="plan-card-price">
                  {formatPrice(price)}
                </span>
                {price > 0 && (
                  <span className="plan-card-period">
                    /{billingCycle === 'yearly' ? 'a\u00F1o' : 'mes'}
                  </span>
                )}
                {plan.price_yearly > 0 && billingCycle === 'yearly' && (
                  <div className="plan-card-savings">
                    Ahorra ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(2)}/a\u00F1o
                  </div>
                )}
              </div>

              <ul className="plan-features">
                <li className="plan-feature-item">
                  <FontAwesomeIcon icon={faStore} style={{ color: colors.accent, width: '16px' }} />
                  <strong>{plan.max_stores}</strong> tiendas m&aacute;ximo
                </li>
                {features.map((feature, index) => (
                  <li key={index} className="plan-feature-item">
                    <FontAwesomeIcon icon={faCheck} className="icon-success" style={{ width: '16px' }} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !currentPlan && !isFree && handleSubscribe(plan.id)}
                disabled={currentPlan || subscribing === plan.id}
                className={`plan-subscribe-btn ${currentPlan ? 'btn-accent' : isFree ? 'btn-secondary' : 'btn-primary'}`}
                style={{ opacity: subscribing === plan.id ? 0.7 : 1 }}
              >
                {subscribing === plan.id ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    {' '}Procesando...
                  </>
                ) : currentPlan ? (
                  <>
                    <FontAwesomeIcon icon={faCheck} />
                    {' '}Plan Actual
                  </>
                ) : isFree ? (
                  <>
                    <FontAwesomeIcon icon={faCheck} />
                    {' '}Incluido
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCreditCard} />
                    {' '}Suscribirse
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="plans-footer">
        <p>{'?'}Preguntas? Contacta a <strong>soporte@srautomatic.com</strong></p>
      </div>
    </div>
  );
}

export default Plans;
