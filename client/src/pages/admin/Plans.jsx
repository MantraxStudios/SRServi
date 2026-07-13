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
  faCreditCard,
  faBuilding,
  faStar,
  faGift,
  faBan,
} from '@fortawesome/free-solid-svg-icons';

const PLAN_META = {
  Gratis: {
    icon: faStore,
    gradient: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
    color: '#6b7280',
    badge: null,
  },
  SOLO: {
    icon: faCrown,
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)',
    color: '#3b82f6',
    badge: null,
  },
  Empresas: {
    icon: faBuilding,
    gradient: 'linear-gradient(135deg, #92400e 0%, #D4AF37 100%)',
    color: '#D4AF37',
    badge: 'Más popular',
  },
  Personalizado: {
    icon: faStar,
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #c026d3 100%)',
    color: '#7c3aed',
    badge: 'Exclusivo',
  },
};

function getPlanMeta(name) {
  return PLAN_META[name] || {
    icon: faCrown,
    gradient: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
    color: '#374151',
    badge: null,
  };
}

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    script.onload = () => { scriptLoaded.current = true; };
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
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ payment_id: paymentId })
        });
        const data = await response.json();
        if (data.success && data.activated) {
          setMessage({ type: 'success', text: '¡Pago exitoso! Tu suscripción ha sido activada.' });
        } else if (data.success) {
          setMessage({ type: 'info', text: 'Pago recibido. Procesando tu suscripción...' });
        }
      } catch {
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

  const handleClaimTrial = async () => {
    setClaimingTrial(true);
    setMessage(null);
    try {
      const response = await fetch(API + '/api/claim-trial', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'No se pudo activar la prueba gratis' });
        return;
      }
      setMessage({ type: 'success', text: data.message });
      fetchMyPlan();
    } catch {
      setMessage({ type: 'error', text: 'Error al activar la prueba gratis' });
    } finally {
      setClaimingTrial(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!window.confirm('¿Seguro que querés cancelar tu suscripción? Volverás al plan Gratis de inmediato.')) return;
    setCancelling(true);
    setMessage(null);
    try {
      const response = await fetch(API + '/api/cancel-plan', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'No se pudo cancelar la suscripción' });
        return;
      }
      setMessage({ type: 'success', text: data.message });
      fetchMyPlan();
    } catch {
      setMessage({ type: 'error', text: 'Error al cancelar la suscripción' });
    } finally {
      setCancelling(false);
    }
  };

  const handleSubscribe = async (planId) => {
    if (!termsAccepted) {
      setMessage({ type: 'error', text: 'Tenés que aceptar los términos antes de continuar' });
      return;
    }
    setSubscribing(planId);
    setMessage(null);
    setMpLoading(true);
    try {
      const response = await fetch(API + '/api/create-subscription-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
    } catch {
      setMessage({ type: 'error', text: 'Error al procesar la solicitud' });
    } finally {
      setSubscribing(null);
      setMpLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (price === 0) return '0';
    const n = parseFloat(price);
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
  };

  const parseFeatures = (features) => {
    if (!features) return [];
    if (typeof features === 'string') {
      try { return JSON.parse(features); } catch { return [features]; }
    }
    return features;
  };

  const getCurrentPlanName = () => myPlan?.plan?.plan_name || 'Gratis';
  const isCurrentPlan = (planName) => getCurrentPlanName() === planName;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28, color: colors.accent }} />
      </div>
    );
  }

  const currentMeta = getPlanMeta(getCurrentPlanName());
  const usagePercent = Math.min(((myPlan?.storeCount || 0) / (myPlan?.maxStores || 2)) * 100, 100);

  return (
    <div className="plans-page">

      {/* Header */}
      <div className="plans-header">
        <div className="plans-header-icon">
          <FontAwesomeIcon icon={faCrown} />
        </div>
        <h1>Planes y Suscripciones</h1>
        <p>Elige el plan que mejor se adapte a tu negocio</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`plans-message plans-message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Current plan status */}
      <div className="plans-current-box">
        <div className="plans-current-left">
          <span className="plans-current-label">Tu plan actual</span>
          <div className="plans-current-badge" style={{ background: currentMeta.gradient }}>
            <FontAwesomeIcon icon={currentMeta.icon} />
            {getCurrentPlanName()}
          </div>
        </div>
        <div className="plans-current-right">
          <div className="plans-current-info-item">
            <FontAwesomeIcon icon={faStore} />
            <span><strong>{myPlan?.storeCount || 0}</strong> / {myPlan?.maxStores || 2} tiendas</span>
          </div>
          {myPlan?.plan?.ends_at && (
            <div className="plans-current-info-item">
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span>Vence: {new Date(myPlan.plan.ends_at).toLocaleDateString('es-ES')}</span>
            </div>
          )}
        </div>
        <div className="plans-progress-bar">
          <div
            className="plans-progress-fill"
            style={{ width: `${usagePercent}%`, background: currentMeta.gradient }}
          />
        </div>
        {getCurrentPlanName() !== 'Gratis' && (
          <button
            onClick={handleCancelPlan}
            disabled={cancelling}
            className="plans-cancel-btn"
          >
            {cancelling ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faBan} />}
            {' '}{cancelling ? 'Cancelando...' : 'Cancelar suscripción'}
          </button>
        )}
      </div>

      {/* Banner de prueba gratis */}
      {!myPlan?.has_claimed_trial && getCurrentPlanName() === 'Gratis' && (
        <div className="plans-trial-banner">
          <div className="plans-trial-banner-text">
            <FontAwesomeIcon icon={faGift} style={{ fontSize: 22, marginRight: 10 }} />
            <div>
              <strong>Probá el plan SOLO gratis por 3 meses</strong>
              <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>Sin tarjeta, sin compromiso. Se activa al instante.</p>
            </div>
          </div>
          <button onClick={handleClaimTrial} disabled={claimingTrial} className="plans-trial-btn">
            {claimingTrial ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Reclamar ahora'}
          </button>
        </div>
      )}

      {/* Términos y condiciones (obligatorio antes de pagar) */}
      <label className="plans-terms-check">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
        />
        <span>Acepto los términos y condiciones: una vez confirmado el pago, <strong>no habrá devolución</strong>.</span>
      </label>

      {/* Plans grid */}
      <div className="plans-grid">
        {plans.map((plan) => {
          const meta = getPlanMeta(plan.name);
          const features = parseFeatures(plan.features);
          const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
          const currentPlan = isCurrentPlan(plan.name);
          const isFree = plan.price_monthly === 0;

          return (
            <div
              key={plan.id}
              className={`plan-card${currentPlan ? ' current' : ''}`}
              style={{ '--plan-color': meta.color }}
            >
              {/* Colored top section */}
              <div className="plan-card-top" style={{ background: meta.gradient }}>
                {meta.badge && !currentPlan && (
                  <span className="plan-card-badge">{meta.badge}</span>
                )}
                {currentPlan && (
                  <span className="plan-card-badge plan-card-badge-current">
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} />
                    Activo
                  </span>
                )}
                <div className="plan-card-icon">
                  <FontAwesomeIcon icon={meta.icon} />
                </div>
                <h3 className="plan-card-title">{plan.name}</h3>
                <p className="plan-card-desc">{plan.description}</p>
              </div>

              {/* Body */}
              <div className="plan-card-body">
                {/* Price */}
                <div className="plan-card-price-area">
                  {isFree ? (
                    <div className="plan-card-price-free">Gratis</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                      <span className="plan-card-currency">$</span>
                      <span className="plan-card-price">{formatPrice(price)}</span>
                      <span className="plan-card-period">/{billingCycle === 'yearly' ? 'año' : 'mes'}</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="plan-features">
                  <li className="plan-feature-item">
                    <span className="plan-feature-check" style={{ color: meta.color }}>
                      <FontAwesomeIcon icon={faStore} />
                    </span>
                    <span><strong>{plan.max_stores}</strong> tiendas máximo</span>
                  </li>
                  {features.map((feature, i) => (
                    <li key={i} className="plan-feature-item">
                      <span className="plan-feature-check" style={{ color: meta.color }}>
                        <FontAwesomeIcon icon={faCheck} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => !currentPlan && !isFree && handleSubscribe(plan.id)}
                  disabled={currentPlan || subscribing === plan.id || isFree || !termsAccepted}
                  className="plan-subscribe-btn"
                  title={!currentPlan && !isFree && !termsAccepted ? 'Aceptá los términos y condiciones primero' : undefined}
                  style={{
                    background: currentPlan || isFree ? '#f3f4f6' : meta.gradient,
                    color: currentPlan || isFree ? '#9ca3af' : '#fff',
                    opacity: (!currentPlan && !isFree && !termsAccepted) ? 0.5 : 1,
                    cursor: currentPlan || isFree || subscribing === plan.id || !termsAccepted ? 'default' : 'pointer',
                  }}
                >
                  {subscribing === plan.id ? (
                    <><FontAwesomeIcon icon={faSpinner} spin /> Procesando...</>
                  ) : currentPlan ? (
                    <><FontAwesomeIcon icon={faCheck} /> Plan Actual</>
                  ) : isFree ? (
                    <><FontAwesomeIcon icon={faCheck} /> Incluido</>
                  ) : (
                    <><FontAwesomeIcon icon={faCreditCard} /> Suscribirse</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="plans-footer">
        <p>¿Preguntas? Contacta a <strong>soporte@srautomatic.com</strong></p>
      </div>
    </div>
  );
}

export default Plans;
