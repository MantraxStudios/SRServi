import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStore, faChevronRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const STORAGE_KEYS = {
  lastStoreCode: 'srservi_last_store_code',
  lastClientCode: 'srservi_last_client_code',
  lastClientStores: 'srservi_last_client_stores',
  lastClientName: 'srservi_last_client_name',
  lastTerminalId: 'srservi_last_terminal_id',
  lastTerminalName: 'srservi_last_terminal_name',
  lastTerminalProvider: 'srservi_last_terminal_provider',
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .idx-root {
    font-family: 'DM Sans', sans-serif;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: flex;
    background: #08080a;
    color: #fff;
  }

  .idx-left {
    position: relative;
    flex: 0 0 400px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 40px 36px;
    background: #0d0d10;
    border-right: 1px solid rgba(212,175,55,0.1);
    overflow: hidden;
    z-index: 1;
  }

  .idx-left::before {
    content: '';
    position: absolute;
    top: -120px; left: -120px;
    width: 340px; height: 340px;
    background: radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 65%);
    pointer-events: none;
  }

  .idx-left::after {
    content: '';
    position: absolute;
    bottom: -80px; right: -80px;
    width: 260px; height: 260px;
    background: radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 65%);
    pointer-events: none;
  }

  .idx-top-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #D4AF37 40%, #f0d060 60%, transparent 100%);
    opacity: 0.8;
  }

  .idx-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 42px;
    background: linear-gradient(135deg, #b8901e 0%, #e8c540 45%, #c9a227 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -1px;
    line-height: 1;
    margin-bottom: 4px;
  }

  .idx-tagline {
    color: rgba(255,255,255,0.38);
    font-size: 11.5px;
    letter-spacing: 3px;
    text-transform: uppercase;
    font-weight: 500;
    margin-bottom: 28px;
  }

  .idx-divider {
    width: 28px; height: 1.5px;
    background: linear-gradient(90deg, #D4AF37, transparent);
    border-radius: 2px;
    margin-bottom: 24px;
  }

  .idx-label {
    color: #D4AF37;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .idx-input {
    display: block;
    width: 100%;
    font-family: 'DM Serif Display', serif;
    font-size: 34px;
    text-align: center;
    letter-spacing: 12px;
    text-transform: uppercase;
    background: rgba(255,255,255,0.03);
    border: 1.5px solid rgba(212,175,55,0.25);
    border-radius: 10px;
    color: #fff;
    padding: 14px 10px;
    outline: none;
    margin-bottom: 12px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }

  .idx-input::placeholder { color: rgba(255,255,255,0.15); letter-spacing: 8px; }

  .idx-input:focus {
    border-color: #D4AF37;
    background: rgba(212,175,55,0.04);
    box-shadow: 0 0 0 3px rgba(212,175,55,0.1), 0 0 24px rgba(212,175,55,0.06);
  }

  .idx-btn {
    display: block;
    width: 100%;
    padding: 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.25s;
  }

  .idx-btn-active {
    background: linear-gradient(135deg, #c9a227 0%, #e8c93a 100%);
    color: #08080a;
    box-shadow: 0 4px 18px rgba(212,175,55,0.28), 0 1px 3px rgba(0,0,0,0.4);
  }

  .idx-btn-active:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(212,175,55,0.38), 0 1px 4px rgba(0,0,0,0.5);
  }

  .idx-btn-disabled {
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.18);
    cursor: not-allowed;
  }

  .idx-error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    color: #f87171;
    border-radius: 8px;
    padding: 9px 13px;
    font-size: 12.5px;
    margin-bottom: 14px;
  }

  .idx-hint {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .idx-hint-title {
    color: rgba(212,175,55,0.7);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 5px;
  }

  .idx-hint-text {
    color: rgba(255,255,255,0.35);
    font-size: 12px;
    line-height: 1.6;
  }

  .idx-hint-text span {
    color: rgba(255,255,255,0.65);
    font-weight: 600;
  }

  .idx-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px 32px;
    background: #08080a;
    position: relative;
    overflow: hidden;
  }

  .idx-right::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 55% 45% at 50% 50%, rgba(212,175,55,0.045) 0%, transparent 70%),
      radial-gradient(ellipse 30% 60% at 80% 20%, rgba(212,175,55,0.02) 0%, transparent 60%);
    pointer-events: none;
  }

  .idx-right::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(212,175,55,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,175,55,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  .idx-img-label {
    position: relative;
    z-index: 1;
    color: rgba(212,175,55,0.55);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 16px;
    text-align: center;
  }

  .idx-img-frame {
    position: relative;
    z-index: 1;
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .idx-img-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(ellipse at center, rgba(212,175,55,0.08) 0%, transparent 65%);
    border-radius: 24px;
    pointer-events: none;
  }

  .idx-img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 14px;
    border: 1px solid rgba(212,175,55,0.12);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.5),
      0 20px 60px rgba(0,0,0,0.7),
      0 4px 16px rgba(212,175,55,0.08);
    position: relative;
    z-index: 1;
  }

  /* Picker views */
  .idx-picker-root {
    font-family: 'DM Sans', sans-serif;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #08080a;
    color: #fff;
    position: relative;
  }

  .idx-picker-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 50% at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 30% 40% at 10% 80%, rgba(212,175,55,0.03) 0%, transparent 60%);
    pointer-events: none;
  }

  .idx-picker-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 480px;
    max-height: calc(100vh - 48px);
    background: #0f0f12;
    border: 1px solid rgba(212,175,55,0.12);
    border-radius: 18px;
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04);
    overflow: hidden;
  }

  .idx-picker-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1.5px;
    background: linear-gradient(90deg, transparent, #D4AF37 40%, #f0d060 60%, transparent);
    opacity: 0.7;
  }

  .idx-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: rgba(212,175,55,0.6);
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0;
    margin-bottom: 20px;
    transition: color 0.2s;
  }

  .idx-back-btn:hover { color: #D4AF37; }

  .idx-picker-title {
    font-family: 'DM Serif Display', serif;
    font-size: 26px;
    background: linear-gradient(135deg, #b8901e 0%, #e8c540 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 4px;
    line-height: 1.1;
  }

  .idx-picker-sub {
    color: rgba(255,255,255,0.38);
    font-size: 12.5px;
    margin-bottom: 20px;
  }

  .idx-store-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
    padding-right: 4px;
  }

  .idx-store-list::-webkit-scrollbar { width: 3px; }
  .idx-store-list::-webkit-scrollbar-track { background: transparent; }
  .idx-store-list::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 4px; }

  .idx-store-item {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 13px 15px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(212,175,55,0.15);
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.15s;
    text-align: left;
    font-family: 'DM Sans', sans-serif;
  }

  .idx-store-item:hover {
    background: rgba(212,175,55,0.06);
    border-color: rgba(212,175,55,0.35);
    transform: translateX(3px);
  }

  .idx-store-logo {
    width: 40px; height: 40px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }

  .idx-store-logo img { width: 100%; height: 100%; object-fit: cover; }

  .idx-store-info { flex: 1; min-width: 0; }

  .idx-store-name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .idx-store-code {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1px;
    margin-top: 1px;
  }

  .idx-store-arrow { opacity: 0.5; }

  .idx-loading-text {
    text-align: center;
    color: rgba(255,255,255,0.4);
    font-size: 13px;
    padding: 20px 0;
  }

  .idx-warning-text {
    text-align: center;
    color: #d97706;
    font-size: 13px;
    padding: 20px 0;
  }

  .idx-continue-btn {
    margin-top: 14px;
    width: 100%;
    padding: 13px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: linear-gradient(135deg, #c9a227 0%, #e8c93a 100%);
    color: #08080a;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 18px rgba(212,175,55,0.25);
  }

  .idx-continue-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(212,175,55,0.35);
  }
`;

function Index() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientStores, setClientStores] = useState(null);
  const [clientName, setClientName] = useState('');
  const [pendingStore, setPendingStore] = useState(null);
  const [storePos, setStorePos] = useState([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === '1') {
        localStorage.removeItem(STORAGE_KEYS.lastStoreCode);
        localStorage.removeItem(STORAGE_KEYS.lastClientCode);
        localStorage.removeItem(STORAGE_KEYS.lastClientStores);
        localStorage.removeItem(STORAGE_KEYS.lastClientName);
        window.history.replaceState({}, '', '/');
        return;
      }

      const savedStoreCode = localStorage.getItem(STORAGE_KEYS.lastStoreCode);
      if (savedStoreCode) {
        const res = await fetch('/api/public/lookup/' + savedStoreCode);
        if (res.ok) {
          const data = await res.json();
          if (data.type === 'store') {
            fetchStorePos({ id: data.id, code: data.code, name: data.name }, false);
            return;
          }
          if (data.type === 'client') {
            const [single] = data.stores;
            if (single) { fetchStorePos(single, false); return; }
          }
        }
        localStorage.removeItem(STORAGE_KEYS.lastStoreCode);
      }

      const savedClientStores = localStorage.getItem(STORAGE_KEYS.lastClientStores);
      if (savedClientStores) {
        try {
          const parsed = JSON.parse(savedClientStores);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setClientStores(parsed);
            setClientName(localStorage.getItem(STORAGE_KEYS.lastClientName) || '');
            setCode(localStorage.getItem(STORAGE_KEYS.lastClientCode) || '');
          }
        } catch { /* ignore */ }
      }
    })();
  }, [navigate]);

  const persistStoreSelection = (storeCode) => {
    localStorage.setItem(STORAGE_KEYS.lastStoreCode, storeCode);
  };

  const persistClientLookup = (clientCode, name, stores) => {
    localStorage.setItem(STORAGE_KEYS.lastClientCode, clientCode);
    localStorage.setItem(STORAGE_KEYS.lastClientName, name || '');
    localStorage.setItem(STORAGE_KEYS.lastClientStores, JSON.stringify(stores));
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) setCode(value);
  };

  const fetchStorePos = async (store, fromClientPicker = false) => {
    setLoadingPos(true);
    setPendingStore(store);
    try {
      const res = await fetch('/api/public/pos-devices/' + store.code);
      const data = res.ok ? await res.json() : [];
      const allPos = (Array.isArray(data) ? data : []).map(d => ({ id: d.id, name: d.name, provider: d.provider }));
      setStorePos(allPos);

      const savedId = localStorage.getItem(STORAGE_KEYS.lastTerminalId);
      const savedProvider = localStorage.getItem(STORAGE_KEYS.lastTerminalProvider);
      if (savedId) {
        const stillExists = allPos.some(p => String(p.id) === String(savedId));
        const isNonMpProvider = savedProvider && savedProvider !== 'mercadopago';
        if (stillExists || isNonMpProvider || allPos.length === 0) {
          if (fromClientPicker) persistStoreSelection(store.code);
          navigate('/store/' + store.code);
          return;
        }
      }
      if (allPos.length === 1) {
        localStorage.setItem(STORAGE_KEYS.lastTerminalId, allPos[0].id);
        localStorage.setItem(STORAGE_KEYS.lastTerminalName, allPos[0].name);
        localStorage.setItem(STORAGE_KEYS.lastTerminalProvider, allPos[0].provider || '');
        if (fromClientPicker) persistStoreSelection(store.code);
        navigate('/store/' + store.code);
        return;
      }
      if (allPos.length === 0) {
        if (fromClientPicker) persistStoreSelection(store.code);
        navigate('/store/' + store.code);
        return;
      }
    } catch { setStorePos([]); }
    finally { setLoadingPos(false); }
  };

  const pickStoreFromList = (store) => { fetchStorePos(store, true); };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanCode.length !== 6) throw new Error('El código debe tener 6 caracteres');
      const response = await fetch('/api/public/lookup/' + cleanCode);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Código no encontrado');
      }
      const data = await response.json();
      if (data.type === 'store') {
        persistStoreSelection(data.code);
        fetchStorePos({ code: data.code, id: data.id, name: data.name }, false);
        return;
      }
      if (data.type === 'client') {
        const name = data.client?.name || '';
        if (data.stores.length === 1) {
          persistClientLookup(cleanCode, name, data.stores);
          persistStoreSelection(data.stores[0].code);
          fetchStorePos(data.stores[0], false);
          return;
        }
        persistClientLookup(cleanCode, name, data.stores);
        setClientName(name);
        setClientStores(data.stores);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handlePickPos = (pos) => {
    localStorage.setItem(STORAGE_KEYS.lastTerminalId, pos.id);
    localStorage.setItem(STORAGE_KEYS.lastTerminalName, pos.name);
    localStorage.setItem(STORAGE_KEYS.lastTerminalProvider, pos.provider || '');
    if (pendingStore) {
      persistStoreSelection(pendingStore.code);
      navigate('/store/' + pendingStore.code);
    }
  };

  const resetAll = () => {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    setClientStores(null);
    setClientName('');
    setCode('');
    setError('');
    setPendingStore(null);
    setStorePos([]);
  };

  /* POS picker */
  if (pendingStore) {
    return (
      <>
        <style>{styles}</style>
        <div className="idx-picker-root">
          <div className="idx-picker-card">
            <button onClick={() => { setPendingStore(null); setStorePos([]); }} className="idx-back-btn">
              <FontAwesomeIcon icon={faArrowLeft} size="xs" /> Volver
            </button>
            <div className="idx-picker-title">{pendingStore.name || 'Tienda'}</div>
            <div className="idx-picker-sub">Elige el POS para este tótem — solo se pregunta una vez</div>
            {loadingPos && <p className="idx-loading-text">Buscando POS…</p>}
            {!loadingPos && storePos.length === 0 && <p className="idx-warning-text">No hay POS vinculados a esta tienda</p>}
            {!loadingPos && storePos.length > 1 && (
              <div className="idx-store-list">
                {storePos.map(pos => (
                  <button key={pos.id} onClick={() => handlePickPos(pos)} className="idx-store-item">
                    <div className="idx-store-logo" style={{ background: '#fff' }}>
                      <FontAwesomeIcon icon={faStore} style={{ color: '#000', fontSize: '18px' }} />
                    </div>
                    <div className="idx-store-info">
                      <div className="idx-store-name">{pos.name}</div>
                      <div className="idx-store-code" style={{ color: '#D4AF37' }}>{pos.provider === 'mercadopago' ? 'MercadoPago' : 'Tuu'}</div>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="idx-store-arrow" style={{ color: '#D4AF37' }} />
                  </button>
                ))}
              </div>
            )}
            {!loadingPos && storePos.length === 0 && (
              <button onClick={() => { persistStoreSelection(pendingStore.code); navigate('/store/' + pendingStore.code); }} className="idx-continue-btn">
                Continuar sin POS
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  /* Store picker */
  if (clientStores) {
    return (
      <>
        <style>{styles}</style>
        <div className="idx-picker-root">
          <div className="idx-picker-card">
            <button onClick={resetAll} className="idx-back-btn">
              <FontAwesomeIcon icon={faArrowLeft} size="xs" /> Cambiar código
            </button>
            <div className="idx-picker-title">{clientName || 'Tiendas disponibles'}</div>
            <div className="idx-picker-sub">Elige la tienda a la que quieres entrar</div>
            <div className="idx-store-list">
              {clientStores.map(store => (
                <button key={store.id} onClick={() => pickStoreFromList(store)} className="idx-store-item" style={{ borderColor: (store.accent_color || '#D4AF37') + '30' }}>
                  <div className="idx-store-logo" style={{ background: store.secondary_color || '#1a1a1a' }}>
                    {store.logo_url
                      ? <img src={store.logo_url} alt={store.name} />
                      : <FontAwesomeIcon icon={faStore} style={{ color: store.primary_color || '#D4AF37', fontSize: '18px' }} />
                    }
                  </div>
                  <div className="idx-store-info">
                    <div className="idx-store-name" style={{ color: store.secondary_color || '#fff' }}>{store.name}</div>
                    <div className="idx-store-code" style={{ color: store.accent_color || '#D4AF37' }}>{store.code}</div>
                  </div>
                  <FontAwesomeIcon icon={faChevronRight} className="idx-store-arrow" style={{ color: store.accent_color || '#D4AF37' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* Main login */
  return (
    <>
      <style>{styles}</style>
      <div className="idx-root">
        <div className="idx-left">
          <div className="idx-top-bar" />
          <div className="idx-logo">SRServi</div>
          <div className="idx-tagline">Sistema de pedidos</div>
          <div className="idx-divider" />
          {error && <div className="idx-error">{error}</div>}
          <form onSubmit={handleCodeSubmit}>
            <div className="idx-label">Código de tienda</div>
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
              required
              className="idx-input"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className={'idx-btn ' + (loading || code.length !== 6 ? 'idx-btn-disabled' : 'idx-btn-active')}
            >
              {loading ? 'Buscando…' : 'Continuar'}
            </button>
          </form>
          <div className="idx-hint">
            <div className="idx-hint-title">¿Dónde está mi código?</div>
            <p className="idx-hint-text">
              Panel admin → <span>Tiendas</span> → código de cada tienda
            </p>
          </div>
        </div>
        <div className="idx-right">
          <div className="idx-img-label">¿Cómo encontrar mi código?</div>
          <div className="idx-img-frame">
            <div className="idx-img-glow" />
            <img src="/how.png" alt="Instrucciones para encontrar el código" className="idx-img" />
          </div>
        </div>
      </div>
    </>
  );
}

export default Index;
