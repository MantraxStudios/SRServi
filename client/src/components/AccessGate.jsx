import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faGift, faCrown, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

// Pantalla de bloqueo para cuentas sin plan activo. Orden correcto:
// 1) al entrar, reclamar el mes gratis self-service (sin aprobación);
// 2) cuando ese mes termina, recién ahí se ofrece el formulario de acceso
//    gratis (lo revisa y aprueba el superadmin) o contratar un plan.
export default function AccessGate({ token, onGoToPlans, onLogout }) {
  const [req, setReq] = useState(null);
  const [ended, setEnded] = useState(false);
  const [hasClaimedTrial, setHasClaimedTrial] = useState(true);
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(API + '/api/free-plan/request', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(API + '/api/my-plan', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([reqData, planData]) => {
        setReq(reqData?.request || null);
        setEnded(!!reqData?.ended);
        setHasClaimedTrial(!!planData?.has_claimed_trial);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const claimTrial = async () => {
    setClaiming(true);
    try {
      const r = await fetch(API + '/api/claim-trial', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      });
      const d = await r.json();
      if (r.ok) window.location.reload();
      else alert(d.error || 'No se pudo activar la prueba gratis');
    } catch { alert('Error de conexión'); }
    finally { setClaiming(false); }
  };

  const submit = async () => {
    if (!reason.trim()) return;
    setSending(true);
    try {
      const r = await fetch(API + '/api/free-plan/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ business_name: biz, reason })
      });
      const d = await r.json();
      if (r.ok) setReq(d.request);
      else alert(d.error || 'No se pudo enviar la solicitud');
    } catch { alert('Error de conexión'); }
    finally { setSending(false); }
  };

  const status = req?.status;

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <button onClick={onLogout} style={s.logout} title="Cerrar sesión">
          <FontAwesomeIcon icon={faSignOutAlt} /> Salir
        </button>

        <div style={s.iconBox}>
          <FontAwesomeIcon icon={(!loading && !hasClaimedTrial) ? faGift : faLock} style={{ fontSize: 26, color: GOLD }} />
        </div>
        <h1 style={s.title}>
          {(!loading && !hasClaimedTrial) ? '¡Ve por tu mes gratis! 🎁' : 'Activá tu plan para continuar'}
        </h1>
        <p style={s.sub}>
          {loading || hasClaimedTrial ? (
            <>Para usar SRServi necesitás un plan activo. Podés <strong>contratar un plan</strong> o
            <strong> solicitar un acceso gratis</strong> justificando por qué lo necesitás (lo revisamos y aprobamos).</>
          ) : (
            <>¡Te damos la bienvenida a SRServi! Empezá gratis: reclamá tu <strong>mes gratis</strong> ahora, sin tarjeta y sin aprobación.</>
          )}
        </p>

        {loading ? (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: '10px 0' }}>Cargando...</div>
        ) : !hasClaimedTrial ? (
          // Al entrar, primero se ofrece el mes gratis self-service. El
          // formulario de acceso gratis (con aprobación) recién aparece
          // cuando ese mes termine.
          <div style={{ textAlign: 'center' }}>
            <button onClick={claimTrial} disabled={claiming} style={s.primaryBtn}>
              <FontAwesomeIcon icon={faGift} /> {claiming ? 'Activando...' : 'Reclamar 1 mes gratis'}
            </button>
          </div>
        ) : ended ? (
          // El mes de acceso gratis ya terminó → ahora sí ofrecemos contratar un plan.
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...s.statusBox, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', marginBottom: 16 }}>
              <FontAwesomeIcon icon={faGift} /> Tu <strong>mes de acceso gratis</strong> terminó. Para seguir usando SRServi, elegí un plan.
            </div>
            <button onClick={onGoToPlans} style={s.primaryBtn}>
              <FontAwesomeIcon icon={faCrown} /> Ver planes y contratar
            </button>
          </div>
        ) : status === 'pending' ? (
          <div style={{ ...s.statusBox, background: '#fef9c3', color: '#a16207', border: '1px solid #fde047' }}>
            <FontAwesomeIcon icon={faGift} /> Tu solicitud de acceso gratis está <strong>en revisión</strong>. Te avisaremos cuando la aprobemos.
          </div>
        ) : status === 'approved' ? (
          <div style={{ ...s.statusBox, background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
            ✓ Tu acceso gratis fue aprobado. <button onClick={() => window.location.reload()} style={s.linkBtn}>Recargar</button>
          </div>
        ) : (
          <div style={{ textAlign: 'left' }}>
            <div style={s.formTitle}><FontAwesomeIcon icon={faGift} style={{ color: GOLD }} /> Solicitar acceso gratis</div>
            {status === 'rejected' && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>Tu solicitud anterior fue rechazada. Podés volver a intentarlo.</div>}
            <label style={s.label}>Nombre de tu negocio</label>
            <input value={biz} onChange={e => setBiz(e.target.value)} placeholder="Ej: Cafetería La Esquina" style={s.input} />
            <label style={s.label}>¿Por qué necesitás el acceso gratis? *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Explicá tu situación..." style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit' }} />
            <button onClick={submit} disabled={sending || !reason.trim()} style={{ ...s.secondaryBtn, opacity: (!reason.trim()) ? 0.6 : 1 }}>
              {sending ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' },
  card: { position: 'relative', width: '100%', maxWidth: 460, background: '#fff', borderRadius: 18, padding: '32px 26px', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', textAlign: 'center', margin: 'auto' },
  logout: { position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  iconBox: { width: 64, height: 64, background: '#fff8e1', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 16px' },
  title: { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' },
  sub: { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' },
  primaryBtn: { width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#111', color: GOLD, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  divider: { display: 'flex', alignItems: 'center', textAlign: 'center', color: '#cbd5e1', fontSize: 12, margin: '18px 0' },
  statusBox: { borderRadius: 12, padding: '14px 16px', fontSize: 13.5, lineHeight: 1.5 },
  formTitle: { fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: 700, color: '#555', display: 'block', margin: '10px 0 5px' },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  secondaryBtn: { width: '100%', marginTop: 14, padding: '12px', borderRadius: 12, border: 'none', background: GOLD, color: '#0a0a0a', fontWeight: 800, fontSize: 14, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#16a34a', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' },
};
