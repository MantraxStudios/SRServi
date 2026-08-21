import { useState, useEffect, useContext } from 'react';
import { StoreContext } from './Layout';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTv, faGift, faCrown, faCircleInfo } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const fmtCLP = (n) => '$' + Number(n || 0).toLocaleString('es-CL');
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

// Envuelve la Cartelería: si el usuario no tiene acceso por su plan, ofrece un mes
// gratis y luego la suscripción mensual ($10.000) vía Mercado Pago.
export default function CctvAppGate({ children }) {
  const { planCaps } = useContext(StoreContext) || {};
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  // Mientras planCaps no cargó, no bloqueamos (para no parpadear el candado).
  const hasAccess = planCaps ? !!planCaps.cctv : true;
  const auth = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/apps/cctv/status`, { headers: auth })
      .then(r => r.json()).then(setStatus).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTrial = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/apps/cctv/start-trial`, { method: 'POST', headers: auth });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo iniciar la prueba');
      window.location.reload();
    } catch (e) { alert(e.message); setBusy(false); }
  };

  const subscribe = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/apps/cctv/subscribe`, { method: 'POST', headers: auth });
      const d = await r.json();
      if (d.init_point) window.location.href = d.init_point;
      else throw new Error(d.error || 'No se pudo iniciar el pago');
    } catch (e) { alert(e.message); setBusy(false); }
  };

  // Con acceso: mostramos el contenido y, si está en prueba, una barra con los días restantes.
  if (hasAccess) {
    return (
      <>
        {status?.status === 'trial' && status.trialEndsAt && (
          <div style={{ margin: '0 0 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <FontAwesomeIcon icon={faGift} style={{ color: GOLD }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
              Prueba gratis de Cartelería — quedan {daysLeft(status.trialEndsAt)} día(s)
            </span>
            <button onClick={subscribe} disabled={busy}
              style={{ marginLeft: 'auto', background: GOLD, border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 800, fontSize: 12.5, color: '#0a0a0a', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              Suscribirme
            </button>
          </div>
        )}
        {children}
      </>
    );
  }

  // Bloqueado: paywall con mes gratis (si no lo usó) + suscripción.
  const trialUsed = status?.trialUsed;
  const price = status?.app?.price ?? 10000;

  return (
    <div style={{ padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 16, padding: '36px 28px', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 64, height: 64, background: '#fff8e1', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <FontAwesomeIcon icon={faTv} style={{ fontSize: 26, color: GOLD }} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#09090b' }}>Cartelería Digital</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#71717a', lineHeight: 1.5 }}>
          Controla tus pantallas TV con menús, imágenes y videos.
        </p>
        <div style={{ margin: '0 0 22px', fontSize: 15, fontWeight: 800, color: '#09090b' }}>
          {fmtCLP(price)} <span style={{ fontWeight: 600, color: '#71717a', fontSize: 13 }}>/ mes</span>
        </div>

        {!trialUsed ? (
          <>
            <button onClick={startTrial} disabled={busy}
              style={{ width: '100%', background: GOLD, border: 'none', borderRadius: 10, padding: '13px 24px', cursor: busy ? 'default' : 'pointer', color: '#0a0a0a', fontWeight: 800, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
              <FontAwesomeIcon icon={faGift} /> Comenzar 1 mes gratis
            </button>
            <button onClick={subscribe} disabled={busy}
              style={{ width: '100%', marginTop: 10, background: 'transparent', border: '1px solid #e4e4e7', borderRadius: 10, padding: '11px 24px', cursor: busy ? 'default' : 'pointer', color: '#09090b', fontWeight: 700, fontSize: 13.5 }}>
              Suscribirme ahora
            </button>
          </>
        ) : (
          <>
            <div style={{ margin: '0 0 14px', fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faCircleInfo} /> Tu mes gratis terminó
            </div>
            <button onClick={subscribe} disabled={busy}
              style={{ width: '100%', background: GOLD, border: 'none', borderRadius: 10, padding: '13px 24px', cursor: busy ? 'default' : 'pointer', color: '#0a0a0a', fontWeight: 800, fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
              <FontAwesomeIcon icon={faCrown} /> Suscribirme por {fmtCLP(price)}/mes
            </button>
          </>
        )}
        <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#a1a1aa' }}>Pago mensual seguro con Mercado Pago.</p>
      </div>
    </div>
  );
}
