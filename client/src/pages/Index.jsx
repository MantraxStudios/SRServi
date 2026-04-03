import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode } from '@fortawesome/free-solid-svg-icons';

function Index() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [terminals, setTerminals] = useState([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
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

      const terminalsResponse = await fetch(`/api/public/${cleanCode}/mercado-pago-terminals`);
      if (!terminalsResponse.ok) {
        throw new Error('No se pudo validar el código de tienda');
      }

      const terminalsData = await terminalsResponse.json();
      const safeTerminals = Array.isArray(terminalsData) ? terminalsData : [];

      if (safeTerminals.length > 0) {
        setPendingCode(cleanCode);
        setTerminals(safeTerminals);
        setSelectedTerminalId(String(safeTerminals[0].id));
        setShowTerminalModal(true);
        setLoading(false);
        return;
      }

      navigate(`/store/${cleanCode}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleConfirmTerminal = () => {
    if (!pendingCode || !selectedTerminalId) return;
    navigate(`/store/${pendingCode}?terminal=${selectedTerminalId}`);
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
              Selecciona tu máquina Point
            </h2>
            <p style={{ margin: '0 0 18px 0', color: '#666', fontSize: '14px' }}>
              Estas son las máquinas disponibles para el código de tienda ingresado.
            </p>
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
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleConfirmTerminal}
              disabled={!selectedTerminalId}
            >
              Continuar a la tienda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Index;
