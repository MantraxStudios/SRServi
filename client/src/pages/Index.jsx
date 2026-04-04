import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode, faCreditCard, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';

function Index() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [terminals, setTerminals] = useState([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      if (cleanCode.length !== 6) {
        throw new Error('El codigo debe tener 6 caracteres');
      }

      const storeResponse = await fetch(`/api/public/${cleanCode}`);
      if (!storeResponse.ok) {
        throw new Error('Codigo no encontrado');
      }

      const storeData = await storeResponse.json();
      const storeId = storeData.store?.id;

      if (!storeId) {
        throw new Error('No se pudo obtener informacion de la tienda');
      }

      const [terminalsResponse, configsResponse] = await Promise.all([
        fetch(`/api/public/${cleanCode}/mercado-pago-terminals`),
        fetch(`/api/public/store-configurations/${storeId}`)
      ]);

      const terminalsData = terminalsResponse.ok ? await terminalsResponse.json() : [];
      const safeTerminals = Array.isArray(terminalsData) ? terminalsData : [];

      const configsData = configsResponse.ok ? await configsResponse.json() : [];
      const safeConfigs = Array.isArray(configsData) ? configsData : [];

      setPendingCode(cleanCode);
      setTerminals(safeTerminals);
      setConfigurations(safeConfigs);

      if (safeTerminals.length > 0) {
        setSelectedTerminalId(String(safeTerminals[0].id));
      } else {
        setSelectedTerminalId('');
      }

      const defaultConfig = safeConfigs.find(c => c.is_default) || safeConfigs[0];
      setSelectedConfigId(defaultConfig?.id ? String(defaultConfig.id) : '');

      setShowTerminalModal(true);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleConfirmTerminal = () => {
    if (!pendingCode) return;
    let url = `/store/${pendingCode}`;
    const params = new URLSearchParams();
    if (selectedTerminalId) {
      params.append('terminal', selectedTerminalId);
    }
    if (selectedConfigId) {
      params.append('config', selectedConfigId);
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    navigate(url);
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
    }
  };

  return (
    <div className="index-container">
      <div className="index-card">
        <h1 className="index-title">SRServi</h1>
        <p className="index-subtitle">Ingresa el codigo de tu negocio para hacer tu pedido</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '18px' }}
            disabled={loading || code.length !== 6}
          >
            {loading ? 'Buscando...' : 'Continuar'}
          </button>
        </form>

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #ccc' }}>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
            Eres dueno de un negocio?
          </p>
          <Link 
            to="/login"
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <FontAwesomeIcon icon={faQrcode} />
            Ir al Panel de Administracion
          </Link>
        </div>
      </div>

      {showTerminalModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '440px'
          }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '22px' }}>
               Configura tu totem
             </h2>
            <p style={{ margin: '0 0 18px 0', color: '#666', fontSize: '14px' }}>
               Selecciona las opciones para este totem.
             </p>

            {configurations.length > 0 && (
              <>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  Metodo de Pago
                </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '18px'
                }}>
                  {configurations.map(config => (
                    <button
                      key={config.id}
                      type="button"
                      onClick={() => setSelectedConfigId(String(config.id))}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '10px',
                        border: `2px solid ${selectedConfigId === String(config.id) ? '#D4AF37' : '#ddd'}`,
                        backgroundColor: selectedConfigId === String(config.id) ? '#D4AF3720' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `2px solid ${selectedConfigId === String(config.id) ? '#D4AF37' : '#ddd'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selectedConfigId === String(config.id) ? '#D4AF37' : '#fff'
                      }}>
                        {selectedConfigId === String(config.id) && (
                          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>{config.name}</div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                          {config.accept_cash && (
                            <span style={{ fontSize: '12px', color: '#28a745' }}>
                              <FontAwesomeIcon icon={faMoneyBillWave} /> Efectivo
                            </span>
                          )}
                          {config.accept_card && (
                            <span style={{ fontSize: '12px', color: '#007bff' }}>
                              <FontAwesomeIcon icon={faCreditCard} /> Tarjeta
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {terminals.length > 0 && (
              <>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  Maquina Point
                </label>
                <select
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '2px solid #ddd',
                    fontSize: '15px',
                    marginBottom: '16px'
                  }}
                >
                  {terminals.map((terminal) => (
                    <option key={terminal.id} value={terminal.id}>
                      {terminal.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleConfirmTerminal}
              disabled={!pendingCode || (configurations.length > 0 && !selectedConfigId)}
            >
              Entrar a la tienda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Index;
