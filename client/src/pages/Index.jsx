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
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .idx-root {
    font-family: 'Inter', sans-serif;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: flex;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
    color: #fff;
  }

  .idx-left {
    position: relative;
    flex: 0 0 450px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 50px 45px;
    background: linear-gradient(135deg, #000000 0%, #0d0d0d 100%);
    border-right: 2px solid #D4AF37;
    overflow: hidden;
    z-index: 1;
    box-shadow: 12px 0 40px rgba(212, 175, 55, 0.15);
  }

  .idx-left::before {
    content: '';
    position: absolute;
    top: -150px; left: -150px;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%);
    pointer-events: none;
    filter: blur(40px);
  }

  .idx-left::after {
    content: '';
    position: absolute;
    bottom: -100px; right: -100px;
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%);
    pointer-events: none;
    filter: blur(40px);
  }

  .idx-top-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent 0%, #D4AF37 20%, #ffffff 50%, #D4AF37 80%, transparent 100%);
    opacity: 1;
  }

  .idx-logo {
    font-family: 'Playfair Display', serif;
    font-size: 56px;
    font-weight: 900;
    background: linear-gradient(135deg, #ffffff 0%, #D4AF37 50%, #ffffff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -2px;
    line-height: 1;
    margin-bottom: 8px;
    text-shadow: 0 2px 20px rgba(212,175,55,0.3);
  }

  .idx-tagline {
    color: #D4AF37;
    font-size: 12px;
    letter-spacing: 3px;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 32px;
    text-shadow: 0 0 10px rgba(212,175,55,0.2);
  }

  .idx-divider {
    width: 50px; height: 2px;
    background: linear-gradient(90deg, #D4AF37, #ffffff, #D4AF37);
    border-radius: 2px;
    margin-bottom: 32px;
    box-shadow: 0 0 10px rgba(212,175,55,0.4);
  }

  .idx-label {
    color: #D4AF37;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .idx-input {
    display: block;
    width: 100%;
    font-family: 'Playfair Display', serif;
    font-size: 38px;
    text-align: center;
    letter-spacing: 14px;
    text-transform: uppercase;
    background: rgba(255,255,255,0.05);
    border: 2px solid #D4AF37;
    border-radius: 12px;
    color: #ffffff;
    padding: 16px 14px;
    outline: none;
    margin-bottom: 14px;
    transition: all 0.3s ease;
    box-shadow: inset 0 2px 10px rgba(212,175,55,0.05), 0 0 20px rgba(212,175,55,0.1);
  }

  .idx-input::placeholder { color: rgba(255,255,255,0.25); letter-spacing: 10px; }

  .idx-input:focus {
    border-color: #ffffff;
    background: rgba(255,255,255,0.08);
    box-shadow: inset 0 2px 10px rgba(212,175,55,0.08), 0 0 30px rgba(212,175,55,0.25), 0 0 60px rgba(212,175,55,0.15);
    transform: translateY(-2px);
  }

  .idx-btn {
    display: block;
    width: 100%;
    padding: 16px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    border-radius: 10px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .idx-btn-active {
    background: linear-gradient(135deg, #D4AF37 0%, #ffffff 100%);
    color: #000000;
    box-shadow: 0 8px 30px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
    font-weight: 800;
  }

  .idx-btn-active:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.4);
    letter-spacing: 2px;
  }

  .idx-btn-active:active {
    transform: translateY(-1px);
  }

  .idx-btn-disabled {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.25);
    cursor: not-allowed;
    border-color: rgba(212,175,55,0.2);
  }

  .idx-error {
    background: rgba(239,68,68,0.12);
    border: 2px solid rgba(239,68,68,0.5);
    color: #ff9999;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 13px;
    margin-bottom: 16px;
    box-shadow: 0 0 15px rgba(239,68,68,0.15);
  }

  .idx-hint {
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid rgba(212,175,55,0.3);
  }

  .idx-hint-title {
    color: #D4AF37;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .idx-hint-text {
    color: rgba(255,255,255,0.5);
    font-size: 13px;
    line-height: 1.7;
  }

  .idx-hint-text span {
    color: #D4AF37;
    font-weight: 700;
  }

  .idx-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 40px;
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
    position: relative;
    overflow: hidden;
  }

  .idx-right::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 50% 50%, rgba(212,175,55,0.08) 0%, transparent 70%),
      radial-gradient(ellipse 40% 70% at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 60%);
    pointer-events: none;
  }

  .idx-right::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(212,175,55,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,175,55,0.015) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
  }

  .idx-img-label {
    position: relative;
    z-index: 1;
    color: #D4AF37;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 20px;
    text-align: center;
    text-shadow: 0 0 10px rgba(212,175,55,0.2);
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
    inset: -30px;
    background: radial-gradient(ellipse at center, rgba(212,175,55,0.15) 0%, transparent 70%);
    border-radius: 30px;
    pointer-events: none;
    filter: blur(20px);
  }

  .idx-img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 16px;
    border: 2px solid #D4AF37;
    box-shadow:
      0 0 0 1px rgba(212,175,55,0.5),
      0 30px 60px rgba(0,0,0,0.6),
      0 8px 24px rgba(212,175,55,0.2),
      inset 0 1px 0 rgba(255,255,255,0.1);
    position: relative;
    z-index: 1;
  }

  /* ── MOBILE ── */
  @media (max-width: 640px) {
    .idx-root {
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
    }

    .idx-left {
      flex: 0 0 auto;
      width: 100%;
      padding: 30px 24px 20px;
      border-right: none;
      border-bottom: 2px solid #D4AF37;
      justify-content: flex-start;
      box-shadow: none;
    }

    .idx-logo { font-size: 38px; }

    .idx-tagline { font-size: 11px; margin-bottom: 18px; }

    .idx-divider { margin-bottom: 18px; width: 40px; }

    .idx-input { font-size: 28px; letter-spacing: 10px; padding: 14px 10px; border-radius: 10px; }

    .idx-btn { padding: 14px; font-size: 13px; }

    .idx-hint { margin-top: 16px; padding-top: 16px; }

    .idx-right {
      flex: 1;
      min-height: 0;
      padding: 18px 20px 22px;
    }

    .idx-img-label { margin-bottom: 12px; font-size: 10px; }

    .idx-img-frame {
      width: 100%;
      height: 100%;
    }

    .idx-img {
      border-radius: 12px;
    }
  }

  /* Picker views */
  .idx-picker-root {
    font-family: 'Inter', sans-serif;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
    color: #fff;
    position: relative;
  }

  .idx-picker-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 50% at 50% 0%, rgba(212,175,55,0.1) 0%, transparent 60%),
      radial-gradient(ellipse 30% 40% at 10% 80%, rgba(212,175,55,0.05) 0%, transparent 60%);
    pointer-events: none;
  }

  .idx-picker-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 520px;
    max-height: calc(100vh - 48px);
    background: linear-gradient(135deg, #000000 0%, #0d0d0d 100%);
    border: 2px solid #D4AF37;
    border-radius: 18px;
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
    overflow: hidden;
  }

  .idx-picker-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #D4AF37 20%, #ffffff 50%, #D4AF37 80%, transparent);
    opacity: 1;
  }

  .idx-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #D4AF37;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    padding: 6px 10px;
    margin-bottom: 24px;
    transition: all 0.3s ease;
    border-radius: 6px;
  }

  .idx-back-btn:hover { 
    color: #ffffff;
    background: rgba(212,175,55,0.1);
    transform: translateX(-2px);
  }

  .idx-picker-title {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #D4AF37 50%, #ffffff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 6px;
    line-height: 1.1;
  }

  .idx-picker-sub {
    color: rgba(255,255,255,0.55);
    font-size: 13px;
    margin-bottom: 24px;
    font-weight: 500;
  }

  .idx-store-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
    padding-right: 6px;
  }

  .idx-store-list::-webkit-scrollbar { width: 4px; }
  .idx-store-list::-webkit-scrollbar-track { background: transparent; }
  .idx-store-list::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 4px; }

  .idx-store-item {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 14px 18px;
    background: rgba(255,255,255,0.04);
    border: 2px solid rgba(212,175,55,0.25);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    font-family: 'Inter', sans-serif;
  }

  .idx-store-item:hover {
    background: rgba(212,175,55,0.1);
    border-color: #D4AF37;
    transform: translateX(4px);
    box-shadow: 0 0 20px rgba(212,175,55,0.15);
  }

  .idx-store-logo {
    width: 48px; height: 48px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
    border: 1.5px solid #D4AF37;
    background: rgba(212,175,55,0.05);
  }

  .idx-store-logo img { width: 100%; height: 100%; object-fit: cover; }

  .idx-store-info { flex: 1; min-width: 0; }

  .idx-store-name {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .idx-store-code {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    margin-top: 2px;
    color: #D4AF37;
  }

  .idx-store-arrow { 
    opacity: 0.6;
    color: #D4AF37;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .idx-store-item:hover .idx-store-arrow {
    opacity: 1;
    transform: translateX(4px);
  }

  .idx-loading-text {
    text-align: center;
    color: #D4AF37;
    font-size: 14px;
    padding: 24px 0;
    font-weight: 600;
  }

  .idx-warning-text {
    text-align: center;
    color: #fbbf24;
    font-size: 14px;
    padding: 24px 0;
    font-weight: 600;
  }

  .idx-continue-btn {
    margin-top: 16px;
    width: 100%;
    padding: 14px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    background: linear-gradient(135deg, #D4AF37 0%, #ffffff 100%);
    color: #000000;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 8px 30px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
  }

  .idx-continue-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.4);
  }

  .idx-continue-btn:active {
    transform: translateY(0);
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
          <div className="idx-logo">SRservi</div>
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
