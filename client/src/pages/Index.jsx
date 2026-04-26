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

  // On mount: auto-resume the last session so workers don't have to re-enter
  // the code every time the totem reboots.
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
        const res = await fetch(`/api/public/lookup/${savedStoreCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.type === 'store') {
            fetchStorePos({ id: data.id, code: data.code, name: data.name }, false);
            return;
          }
          if (data.type === 'client') {
            const [single] = data.stores;
            if (single) {
              fetchStorePos(single, false);
              return;
            }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanCode.length !== 6) {
        throw new Error('El codigo debe tener 6 caracteres');
      }

      const response = await fetch(`/api/public/lookup/${cleanCode}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Codigo no encontrado');
      }

      const data = await response.json();

      if (data.type === 'store') {
        // Direct store code → remember it and go in
        persistStoreSelection(data.code);
        // Clear any client picker state since this is a direct store login
        localStorage.removeItem(STORAGE_KEYS.lastClientCode);
        localStorage.removeItem(STORAGE_KEYS.lastClientStores);
        localStorage.removeItem(STORAGE_KEYS.lastClientName);
        navigate(`/store/${data.code}`);
        return;
      }

      if (data.type === 'client') {
        const name = data.client?.name || '';
        if (data.stores.length === 1) {
          // Only one store — skip the picker and go straight in,
          // but still remember the client code for future quick swaps
          persistClientLookup(cleanCode, name, data.stores);
          persistStoreSelection(data.stores[0].code);
          navigate(`/store/${data.stores[0].code}`);
          return;
        }
        // Multiple stores — remember and show picker
        persistClientLookup(cleanCode, name, data.stores);
        setClientName(name);
        setClientStores(data.stores);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
    }
  };

  const fetchStorePos = async (store, fromClientPicker = false) => {
    setLoadingPos(true);
    setPendingStore(store);
    try {
      const res = await fetch('/api/public/pos-devices/' + store.code);
      const data = res.ok ? await res.json() : [];
      const allPos = (Array.isArray(data) ? data : []).map(d => ({ id: d.id, name: d.name, provider: d.provider }));
      setStorePos(allPos);

      // If a terminal is already saved, go straight in without asking again
      const savedId = localStorage.getItem(STORAGE_KEYS.lastTerminalId);
      const savedProvider = localStorage.getItem(STORAGE_KEYS.lastTerminalProvider);
      if (savedId) {
        const stillExists = allPos.some(p => String(p.id) === String(savedId));
        const isNonMpProvider = savedProvider && savedProvider !== 'mercadopago';
        if (stillExists || isNonMpProvider || allPos.length === 0) {
          if (fromClientPicker) persistStoreSelection(store.code);
          navigate(`/store/${store.code}`);
          return;
        }
      }

      // Auto-select if only one POS available
      if (allPos.length === 1) {
        localStorage.setItem(STORAGE_KEYS.lastTerminalId, allPos[0].id);
        localStorage.setItem(STORAGE_KEYS.lastTerminalName, allPos[0].name);
        localStorage.setItem(STORAGE_KEYS.lastTerminalProvider, allPos[0].provider || '');
        if (fromClientPicker) persistStoreSelection(store.code);
        navigate(`/store/${store.code}`);
        return;
      }

      // No POS configured → go straight in
      if (allPos.length === 0) {
        if (fromClientPicker) persistStoreSelection(store.code);
        navigate(`/store/${store.code}`);
        return;
      }

      // Multiple POS and none saved yet → show picker
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
      if (cleanCode.length !== 6) throw new Error('El codigo debe tener 6 caracteres');
      const response = await fetch(`/api/public/lookup/${cleanCode}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Codigo no encontrado');
      }
      const data = await response.json();
      if (data.type === 'store') {
        persistStoreSelection(data.code);
        const store = { code: data.code, id: data.id, name: data.name };
        fetchStorePos(store, false);
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
      navigate(`/store/${pendingStore.code}`);
    }
  };

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEYS.lastStoreCode);
    localStorage.removeItem(STORAGE_KEYS.lastClientCode);
    localStorage.removeItem(STORAGE_KEYS.lastClientStores);
    localStorage.removeItem(STORAGE_KEYS.lastClientName);
    localStorage.removeItem(STORAGE_KEYS.lastTerminalId);
    localStorage.removeItem(STORAGE_KEYS.lastTerminalName);
    localStorage.removeItem(STORAGE_KEYS.lastTerminalProvider);
    setClientStores(null);
    setClientName('');
    setCode('');
    setError('');
    setPendingStore(null);
    setStorePos([]);
  };

  if (pendingStore) {
    return (
      <div className="index-container">
        <div className="index-card client-store-picker">
          <button onClick={() => { setPendingStore(null); setStorePos([]); }} className="client-picker-back">
            <FontAwesomeIcon icon={faArrowLeft} /> Volver
          </button>
          <h1 className="index-title">{pendingStore.name || 'Tienda'}</h1>
          <p className="index-subtitle">Elige el POS para este tótem (solo se pregunta una vez)</p>
          {loadingPos && <p style={{ textAlign: 'center', color: '#888' }}>Buscando POS...</p>}
          {!loadingPos && storePos.length === 0 && (
            <p style={{ textAlign: 'center', color: '#d97706', marginTop: '20px' }}>
              No hay POS vinculados a esta tienda
            </p>
          )}
          {!loadingPos && storePos.length > 1 && (
            <div className="client-store-list">
              {storePos.map(pos => (
                <button
                  key={pos.id}
                  onClick={() => handlePickPos(pos)}
                  className="client-store-item"
                  style={{ borderColor: '#D4AF37', background: '#1a1a1a' }}
                >
                  <div className="client-store-item-logo" style={{ background: '#fff' }}>
                    <FontAwesomeIcon icon={faStore} style={{ color: '#000', fontSize: '20px' }} />
                  </div>
                  <div className="client-store-item-info">
                    <div className="client-store-item-name" style={{ color: '#fff' }}>{pos.name}</div>
                    <div className="client-store-item-code" style={{ color: '#D4AF37' }}>
                      {pos.provider === 'mercadopago' ? 'MercadoPago' : 'Tuu'}
                    </div>
                  </div>
                  <FontAwesomeIcon icon={faChevronRight} className="client-store-item-arrow" style={{ color: '#D4AF37' }} />
                </button>
              ))}
            </div>
          )}
          {!loadingPos && storePos.length === 0 && (
            <button onClick={() => { persistStoreSelection(pendingStore.code); navigate(`/store/${pendingStore.code}`); }} className="btn btn-primary btn-full" style={{ marginTop: '16px' }}>
              Continuar sin POS
            </button>
          )}
        </div>
      </div>
    );
  }

  if (clientStores) {
    return (
      <div className="index-container">
        <div className="index-card client-store-picker">
          <button onClick={resetAll} className="client-picker-back">
            <FontAwesomeIcon icon={faArrowLeft} /> Cambiar código
          </button>
          <h1 className="index-title">{clientName || 'Tiendas disponibles'}</h1>
          <p className="index-subtitle">Elige la tienda a la que quieres entrar</p>
          <div className="client-store-list">
            {clientStores.map(store => (
              <button
                key={store.id}
                onClick={() => pickStoreFromList(store)}
                className="client-store-item"
                style={{
                  borderColor: store.accent_color || '#D4AF37',
                  background: `linear-gradient(135deg, ${store.primary_color || '#0a0a0a'} 0%, #1a1a1a 100%)`
                }}
              >
                <div className="client-store-item-logo" style={{ background: store.secondary_color || '#fff' }}>
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={store.name} />
                  ) : (
                    <FontAwesomeIcon icon={faStore} style={{ color: store.primary_color || '#000' }} />
                  )}
                </div>
                <div className="client-store-item-info">
                  <div className="client-store-item-name" style={{ color: store.secondary_color || '#fff' }}>
                    {store.name}
                  </div>
                  <div className="client-store-item-code" style={{ color: store.accent_color || '#D4AF37' }}>
                    {store.code}
                  </div>
                </div>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className="client-store-item-arrow"
                  style={{ color: store.accent_color || '#D4AF37' }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="index-container">
      <div className="index-card">
        <h1 className="index-title">SRServi</h1>
        <p className="index-subtitle">Ingresa el codigo de tu negocio o cliente para hacer tu pedido</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleCodeSubmit}>
          <div className="form-group">
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              className="code-input"
              placeholder="ABC123"
              maxLength={6}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading || code.length !== 6}
          >
            {loading ? 'Buscando...' : 'Continuar'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <p style={{ color: '#D4AF37', fontSize: '13px', marginBottom: '10px', fontWeight: '600', letterSpacing: '0.5px' }}>
            ¿Dónde encuentro mi código?
          </p>
          <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '12px', lineHeight: '1.5' }}>
            Inicia sesión en el panel de administración → haz clic en <strong style={{ color: '#fff' }}>Tiendas</strong> → ahí verás el código de cada tienda
          </p>
          <img
            src="/how.png"
            alt="Instrucciones para encontrar el código de tienda"
            style={{ width: '100%', maxWidth: '380px', borderRadius: '10px', border: '1px solid #333', opacity: 0.92 }}
          />
        </div>
      </div>
    </div>
  );
}

export default Index;
