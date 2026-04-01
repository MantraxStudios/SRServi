import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faCoins } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useNavigate, Link } from 'react-router-dom';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dólar Estadounidense', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'Libra Esterlina', flag: '🇬🇧' },
  { code: 'JPY', symbol: '¥', name: 'Yen Japonés', flag: '🇯🇵' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano', flag: '🇲🇽' },
  { code: 'COP', symbol: '$', name: 'Peso Colombiano', flag: '🇨🇴' },
  { code: 'ARS', symbol: '$', name: 'Peso Argentino', flag: '🇦🇷' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano', flag: '🇵🇪' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileño', flag: '🇧🇷' },
  { code: 'CLP', symbol: '$', name: 'Peso Chileno', flag: '🇨🇱' }
];

function Settings() {
  const { user, token } = useAuth();
  const { selectedStore, fetchStores } = useStore();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
    accent_color: '#D4AF37',
    header_color: '#000000',
    currency_code: 'USD',
    currency_symbol: '$',
    currency_name: 'Dólar Estadounidense'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  useEffect(() => {
    if (selectedStore) {
      setFormData({
        primary_color: selectedStore.primary_color || '#000000',
        secondary_color: selectedStore.secondary_color || '#FFFFFF',
        accent_color: selectedStore.accent_color || '#D4AF37',
        header_color: selectedStore.header_color || '#000000',
        currency_code: selectedStore.currency_code || 'USD',
        currency_symbol: selectedStore.currency_symbol || '$',
        currency_name: selectedStore.currency_name || 'Dólar Estadounidense'
      });
    }
  }, [selectedStore]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const selectCurrency = (currency) => {
    setFormData(prev => ({
      ...prev,
      currency_code: currency.code,
      currency_symbol: currency.symbol,
      currency_name: currency.name
    }));
    setCurrencyDropdownOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Error al guardar la configuración');
      }

      setSuccess(true);
      fetchStores();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const previewStyles = {
    backgroundColor: formData.secondary_color,
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    marginTop: '20px',
    border: `3px solid ${formData.primary_color}`
  };

  const headerPreview = {
    backgroundColor: formData.header_color,
    color: formData.accent_color,
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    marginBottom: '16px',
    textAlign: 'center'
  };

  const buttonPreview = {
    backgroundColor: formData.accent_color,
    color: formData.primary_color,
    padding: '12px 24px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    marginRight: '8px'
  };

  const textPreview = {
    color: formData.primary_color,
    fontWeight: '600',
    marginBottom: '8px'
  };

  if (!selectedStore) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: '#666', marginBottom: '20px' }}>Selecciona una tienda</h2>
        <p style={{ color: '#999', marginBottom: '20px' }}>
          Debes seleccionar una tienda desde el menú lateral para ver su configuración
        </p>
        <Link
          to="/admin/stores"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#000',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '600'
          }}
        >
          Ir a Tiendas
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1>Configuración</h1>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">Configuración guardada exitosamente</div>}

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faCoins} style={{ marginRight: '10px' }} />
              Moneda de tu Tienda
            </div>
          </div>

          <div className="form-group">
            <label>Selecciona la moneda que usarás en tu tienda</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: 'white',
                  border: '2px solid #ccc',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>
                  <strong>{formData.currency_symbol}</strong> - {formData.currency_name} ({formData.currency_code})
                </span>
                <span style={{ fontSize: '12px' }}>▼</span>
              </button>

              {currencyDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '2px solid #ccc',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                  zIndex: 1000,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                }}>
                  {CURRENCIES.map((currency) => (
                    <button
                      key={currency.code}
                      type="button"
                      onClick={() => selectCurrency(currency)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: formData.currency_code === currency.code ? '#f0f0f0' : 'white',
                        border: 'none',
                        borderBottom: '1px solid #eee',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f5f5f5';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = formData.currency_code === currency.code ? '#f0f0f0' : 'white';
                      }}
                    >
                      <span>
                        <strong>{currency.symbol}</strong> {currency.code} - {currency.name}
                      </span>
                      {formData.currency_code === currency.code && (
                        <span style={{ color: 'green' }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
              Los precios en tu tienda se mostrarán con esta moneda
            </small>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faPalette} style={{ marginRight: '10px' }} />
              Colores de tu Tienda
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label>Color Primario (Texto y Bordes)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    style={{
                      width: '60px',
                      height: '50px',
                      border: '2px solid var(--gray)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  />
                  <input
                    type="text"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color Secundario (Fondo)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="color"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    style={{
                      width: '60px',
                      height: '50px',
                      border: '2px solid var(--gray)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  />
                  <input
                    type="text"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color de Acento (Botones)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="color"
                    name="accent_color"
                    value={formData.accent_color}
                    onChange={handleChange}
                    style={{
                      width: '60px',
                      height: '50px',
                      border: '2px solid var(--gray)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  />
                  <input
                    type="text"
                    name="accent_color"
                    value={formData.accent_color}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                    placeholder="#D4AF37"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color del Encabezado</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="color"
                    name="header_color"
                    value={formData.header_color}
                    onChange={handleChange}
                    style={{
                      width: '60px',
                      height: '50px',
                      border: '2px solid var(--gray)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  />
                  <input
                    type="text"
                    name="header_color"
                    value={formData.header_color}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Vista Previa</h3>
              <div style={previewStyles}>
                <div style={headerPreview}>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>
                    {user?.business_name || user?.username}
                  </h2>
                  <small style={{ opacity: 0.8 }}>{formData.currency_symbol} Moneda: {formData.currency_code}</small>
                </div>

                <div style={textPreview}>
                  Este es un ejemplo de texto con tu color primario
                </div>

                <div style={{ marginTop: '16px' }}>
                  <button type="button" style={buttonPreview}>
                    {formData.currency_symbol} 12.99
                  </button>
                  <button type="button" style={{
                    ...buttonPreview,
                    backgroundColor: formData.primary_color,
                    color: formData.secondary_color
                  }}>
                    Botón Secundario
                  </button>
                </div>

                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: formData.secondary_color === '#FFFFFF' ? '#F5F5F5' : 
                    (formData.secondary_color === '#000000' ? '#1a1a1a' : formData.secondary_color),
                  border: `2px solid ${formData.accent_color}`
                }}>
                  Tarjeta de ejemplo con {formData.currency_symbol} precio
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '30px', padding: '16px' }}
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Settings;
