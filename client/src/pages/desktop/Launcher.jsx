import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Launcher de la app de escritorio (offline). Landing en /desktop.
// Flujo: login (nube) → descarga datos + imágenes → import local → menú.
// Verifica premium cada semana; con 7 días de gracia sin internet.
const GRACE_DAYS = 7;
const GOLD = '#D4AF37';

export default function Launcher() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const sd = typeof window !== 'undefined' ? window.srserviDesktop : null;
  const REMOTE = sd?.remoteHost || 'https://srservi2.srautomatic.com';
  const LOCAL = sd?.localHost || (typeof window !== 'undefined' && window.__SRSERVI_API__) || '';

  const [view, setView] = useState('loading'); // loading|login|syncing|menu|reconnect|blocked|nodesktop
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [planName, setPlanName] = useState('');

  const remoteLogin = useCallback(async (mail, pass) => {
    const r = await fetch(REMOTE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail, password: pass }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo iniciar sesión');
    if (d.requiresTwoFactor) throw new Error('Tu cuenta tiene verificación en 2 pasos (2FA). Desactívala para usar la app offline.');
    if (!d.token) throw new Error('Respuesta inesperada del servidor');
    return d;
  }, [REMOTE]);

  // Inicia sesión en el SERVIDOR LOCAL con las credenciales guardadas para tener
  // token válido en la SPA (Admin/Worker).
  const ensureLocalSession = useCallback(async (mail, pass) => {
    let creds = { email: mail, password: pass };
    if ((!creds.email || !creds.password) && sd) creds = (await sd.loadCreds()) || {};
    if (!creds.email || !creds.password) return;
    const r = await fetch(LOCAL + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    const d = await r.json().catch(() => ({}));
    if (d.token) authLogin(d.user, d.token);
  }, [LOCAL, authLogin, sd]);

  // Descarga todo desde la nube e importa localmente.
  const doSync = useCallback(async (token, mail, pass) => {
    setView('syncing');
    setProgress('Descargando tus datos…');
    const exp = await fetch(REMOTE + '/api/offline/export', { headers: { Authorization: 'Bearer ' + token } });
    if (!exp.ok) throw new Error('No se pudieron descargar los datos');
    const dump = await exp.json();

    const imgs = dump.images || [];
    setProgress(`Descargando imágenes… (${imgs.length})`);
    if (sd) await sd.downloadImages(imgs);

    setProgress('Guardando en tu equipo…');
    const imp = await fetch(LOCAL + '/api/offline/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dump),
    });
    if (!imp.ok) { const e = await imp.json().catch(() => ({})); throw new Error(e.error || 'Falló la importación local'); }

    const code = dump.tables?.stores?.[0]?.code || '';
    const plan = dump.plan?.plan_name || dump.plan?.name || 'Gratis';
    const premium = !!plan && plan !== 'Gratis';
    const blocked = !!dump.user?.is_banned;
    if (sd) await sd.setLicense({ synced: true, email: mail, store_code: code, plan_name: plan, last_verified_at: new Date().toISOString(), premium, blocked });

    await ensureLocalSession(mail, pass);
    setStoreCode(code); setPlanName(plan);
    setView(blocked ? 'blocked' : 'menu');
  }, [REMOTE, LOCAL, sd, ensureLocalSession]);

  // Verificación semanal de premium (re-login remoto → /verify).
  const verifyRemote = useCallback(async () => {
    const creds = sd ? await sd.loadCreds() : null;
    if (!creds?.email) return { ok: false };
    try {
      const d = await remoteLogin(creds.email, creds.password);
      const v = await fetch(REMOTE + '/api/offline/verify', { headers: { Authorization: 'Bearer ' + d.token } });
      const vd = await v.json();
      return { ok: true, ...vd, token: d.token, creds };
    } catch (e) { return { ok: false, error: e.message }; }
  }, [REMOTE, remoteLogin, sd]);

  // Arranque
  useEffect(() => {
    (async () => {
      if (!sd) { setView('nodesktop'); return; }
      const lic = await sd.getLicense();
      if (!lic || !lic.synced) { setView('login'); return; }
      setStoreCode(lic.store_code || ''); setPlanName(lic.plan_name || '');

      if (navigator.onLine) {
        const res = await verifyRemote();
        if (res.ok) {
          await sd.setLicense({ ...lic, last_verified_at: new Date().toISOString(), premium: res.premium, blocked: res.blocked, plan_name: res.plan_name });
          if (res.blocked) { setView('blocked'); return; }
          setPlanName(res.plan_name || lic.plan_name || '');
          await ensureLocalSession(lic.email);
          setView('menu');
          return;
        }
      }
      // offline o verificación fallida → ventana de gracia
      const days = (Date.now() - new Date(lic.last_verified_at || 0).getTime()) / 86400000;
      if (days <= GRACE_DAYS) {
        await ensureLocalSession(lic.email);
        setView('menu');
      } else {
        setView('reconnect');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const d = await remoteLogin(email.trim().toLowerCase(), password);
      if (sd) await sd.saveCreds(email.trim().toLowerCase(), password);
      await doSync(d.token, email.trim().toLowerCase(), password);
    } catch (e2) { setErr(e2.message); setView('login'); }
  };

  const handleResync = async () => {
    setErr('');
    const res = await verifyRemote();
    if (!res.ok) { setErr('No hay conexión para actualizar.'); return; }
    if (res.blocked) { setView('blocked'); return; }
    try { await doSync(res.token, res.creds.email, res.creds.password); } catch (e) { setErr(e.message); }
  };

  const retryReconnect = async () => {
    setView('loading');
    const res = await verifyRemote();
    if (res.ok && !res.blocked) {
      const lic = (sd && await sd.getLicense()) || {};
      await sd.setLicense({ ...lic, last_verified_at: new Date().toISOString(), premium: res.premium, blocked: res.blocked });
      await ensureLocalSession(lic.email);
      setView('menu');
    } else if (res.ok && res.blocked) { setView('blocked'); }
    else { setView('reconnect'); }
  };

  // ─────────────────────── UI ───────────────────────
  const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(160deg,#0a0a0a,#161616)', color: '#fff', fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 460, background: '#141414', border: '1px solid #262626', borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    brand: { fontSize: 26, fontWeight: 900, color: GOLD, textAlign: 'center', marginBottom: 4 },
    sub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 },
    input: { width: '100%', padding: '13px 14px', background: '#0d0d0d', border: '1.5px solid #2a2a2a', borderRadius: 12, color: '#fff', fontSize: 15, marginBottom: 12, boxSizing: 'border-box', outline: 'none' },
    btn: { width: '100%', padding: '14px', background: GOLD, color: '#000', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer' },
    err: { background: '#3a1212', border: '1px solid #7f1d1d', color: '#fca5a5', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginBottom: 14 },
    tile: { display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '18px 20px', background: '#0f0f0f', border: '1.5px solid #2a2a2a', borderRadius: 16, color: '#fff', cursor: 'pointer', marginBottom: 12, textAlign: 'left' },
    tileIcon: { fontSize: 30, width: 44, textAlign: 'center' },
    tileTitle: { fontSize: 17, fontWeight: 800 },
    tileDesc: { fontSize: 12.5, color: '#999' },
  };

  if (view === 'loading') return (
    <div style={S.page}><div style={{ textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, border: '5px solid #333', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#aaa' }}>Cargando…</div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div></div>
  );

  if (view === 'nodesktop') return (
    <div style={S.page}><div style={S.card}>
      <div style={S.brand}>SRServi POS</div>
      <div style={S.sub}>Esta pantalla es parte de la app de escritorio.</div>
    </div></div>
  );

  if (view === 'login') return (
    <div style={S.page}><div style={S.card}>
      <div style={S.brand}>SRServi POS</div>
      <div style={S.sub}>Inicia sesión para descargar tus datos y usar la app sin conexión</div>
      {err && <div style={S.err}>{err}</div>}
      <form onSubmit={handleLogin}>
        <input style={S.input} type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
        <input style={S.input} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
        <button style={S.btn} type="submit">Ingresar y descargar</button>
      </form>
    </div></div>
  );

  if (view === 'syncing') return (
    <div style={S.page}><div style={{ ...S.card, textAlign: 'center' }}>
      <div style={S.brand}>Sincronizando</div>
      <div style={{ width: 48, height: 48, border: '5px solid #333', borderTopColor: GOLD, borderRadius: '50%', margin: '20px auto', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#bbb', fontSize: 14 }}>{progress}</div>
      <div style={{ color: '#666', fontSize: 12, marginTop: 10 }}>La primera descarga puede tardar según tu catálogo.</div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div></div>
  );

  if (view === 'reconnect') return (
    <div style={S.page}><div style={{ ...S.card, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📶</div>
      <div style={S.brand}>Reconéctate a internet</div>
      <div style={S.sub}>Pasaron más de {GRACE_DAYS} días sin verificar tu cuenta. Conéctate una vez para seguir usando la app.</div>
      {err && <div style={S.err}>{err}</div>}
      <button style={S.btn} onClick={retryReconnect}>Reintentar</button>
    </div></div>
  );

  if (view === 'blocked') return (
    <div style={S.page}><div style={{ ...S.card, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
      <div style={{ ...S.brand, color: '#ef4444' }}>Cuenta bloqueada</div>
      <div style={S.sub}>Tu cuenta está suspendida. Escribe a soporte@srautomatic.com.</div>
    </div></div>
  );

  // menu
  const isPremium = !!planName && planName !== 'Gratis';
  return (
    <div style={S.page}><div style={S.card}>
      <div style={S.brand}>SRServi POS</div>
      <div style={S.sub}>¿Qué quieres abrir?</div>
      {err && <div style={S.err}>{err}</div>}

      <button style={S.tile} onClick={() => storeCode ? navigate(`/store/${storeCode}`) : setErr('No hay tienda sincronizada.')}>
        <span style={S.tileIcon}>🛒</span>
        <span><div style={S.tileTitle}>Punto de venta (Store)</div><div style={S.tileDesc}>Vender en el tótem / caja</div></span>
      </button>
      <button style={S.tile} onClick={() => navigate('/admin')}>
        <span style={S.tileIcon}>⚙️</span>
        <span><div style={S.tileTitle}>Panel de administración</div><div style={S.tileDesc}>Editor, productos, configuración</div></span>
      </button>
      <button style={S.tile} onClick={() => navigate('/worker-login')}>
        <span style={S.tileIcon}>👤</span>
        <span><div style={S.tileTitle}>Panel del trabajador</div><div style={S.tileDesc}>Tomar pedidos y caja</div></span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 16, borderTop: '1px solid #262626' }}>
        <span style={{ fontSize: 12, color: isPremium ? GOLD : '#888', fontWeight: 700 }}>
          {isPremium ? `Plan ${planName}` : 'Plan Gratis'}
        </span>
        <button onClick={handleResync} style={{ background: 'transparent', border: '1px solid #333', color: '#ccc', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
          ↻ Actualizar datos
        </button>
      </div>
    </div></div>
  );
}
