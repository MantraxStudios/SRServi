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
            className="btn btn-primary btn-lg btn-full"
            disabled={loading || code.length !== 6}
          >
            {loading ? 'Buscando...' : 'Continuar'}
          </button>
        </form>

        <div className="index-divider">
          <p>Eres dueno de un negocio?</p>
          <Link to="/login" className="btn btn-secondary btn-full">
            <FontAwesomeIcon icon={faQrcode} />
            Ir al Panel de Administracion
          </Link>
        </div>
      </div>

      {showTerminalModal && (
        <div className="modal-overlay">
          <div className="totem-modal">
            <h2>Configura tu totem</h2>
            <p>Selecciona las opciones para este totem.</p>

            {configurations.length > 0 && (
              <>
                <label className="totem-label">Metodo de Pago</label>
                <div className="totem-options">
                  {configurations.map(config => (
                    <button
                      key={config.id}
                      type="button"
                      className={`totem-option ${selectedConfigId === String(config.id) ? 'selected' : ''}`}
                      onClick={() => setSelectedConfigId(String(config.id))}
                    >
                      <div className="totem-radio">
                        {selectedConfigId === String(config.id) && (
                          <span className="totem-radio-check">✓</span>
                        )}
                      </div>
                      <div className="totem-option-info">
                        <div className="totem-option-name">{config.name}</div>
                        <div className="totem-option-methods">
                          {config.accept_cash && (
                            <span className="totem-method totem-method-cash">
                              <FontAwesomeIcon icon={faMoneyBillWave} /> Efectivo
                            </span>
                          )}
                          {config.accept_card && (
                            <span className="totem-method totem-method-card">
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
                <label className="totem-label">Maquina Point</label>
                <select
                  className="totem-select"
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
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
              className="btn btn-primary btn-lg btn-full"
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
