import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode } from '@fortawesome/free-solid-svg-icons';

function Index() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

      navigate(`/store/${cleanCode}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
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
    </div>
  );
}

export default Index;
