import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faCoins } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useNavigate, Link } from 'react-router-dom';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dolar Estadounidense', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'EUR', symbol: '\u20AC', name: 'Euro', flag: '\u{1F1EA}\u{1F1FA}' },
  { code: 'GBP', symbol: '\u00A3', name: 'Libra Esterlina', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'JPY', symbol: '\u00A5', name: 'Yen Japon\u00E9s', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'COP', symbol: '$', name: 'Peso Colombiano', flag: '\u{1F1E8}\u{1F1F4}' },
  { code: 'ARS', symbol: '$', name: 'Peso Argentino', flag: '\u{1F1E6}\u{1F1F7}' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano', flag: '\u{1F1F5}\u{1F1EA}' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasile\u00F1o', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'CLP', symbol: '$', name: 'Peso Chileno', flag: '\u{1F1E8}\u{1F1F1}' }
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
    currency_name: 'D\u00F3lar Estadounidense'
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
        currency_name: selectedStore.currency_name || 'D\u00F3lar Estadounidense'
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
        throw new Error('Error al guardar la configuraci\u00F3n');
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

  if (!selectedStore) {
    return (
      <div className="no-store-message">
        <h2>Selecciona una tienda</h2>
        <p>
          Debes seleccionar una tienda desde el men\u00FA lateral para ver su configuraci\u00F3n
        </p>
        <Link to="/admin/stores" className="btn btn-primary">
          Ir a Tiendas
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1>Configuraci\u00F3n</h1>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">Configuraci\u00F3n guardada exitosamente</div>}

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faCoins} className="gap-2" />
              Moneda de tu Tienda
            </div>
          </div>

          <div className="form-group">
            <label>Selecciona la moneda que usar\u00E1s en tu tienda</label>
            <div className="currency-dropdown">
              <button
                type="button"
                onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                className="currency-dropdown-btn"
              >
                <span>
                  <strong>{formData.currency_symbol}</strong> - {formData.currency_name} ({formData.currency_code})
                </span>
                <span className="text-xs">{'\u25BC'}</span>
              </button>

              {currencyDropdownOpen && (
                <div className="currency-dropdown-list">
                  {CURRENCIES.map((currency) => (
                    <button
                      key={currency.code}
                      type="button"
                      onClick={() => selectCurrency(currency)}
                      className={`currency-option ${formData.currency_code === currency.code ? 'active' : ''}`}
                    >
                      <span>
                        <strong>{currency.symbol}</strong> {currency.code} - {currency.name}
                      </span>
                      {formData.currency_code === currency.code && (
                        <span className="icon-success">{'\u2713'}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <small className="currency-hint">
              Los precios en tu tienda se mostrar\u00E1n con esta moneda
            </small>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faPalette} className="gap-2" />
              Colores de tu Tienda
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="color-grid">
              <div className="form-group">
                <label>Color Primario (Texto y Bordes)</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    className="flex-1"
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color Secundario (Fondo)</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    className="flex-1"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color de Acento (Botones)</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    name="accent_color"
                    value={formData.accent_color}
                    onChange={handleChange}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    name="accent_color"
                    value={formData.accent_color}
                    onChange={handleChange}
                    className="flex-1"
                    placeholder="#D4AF37"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color del Encabezado</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    name="header_color"
                    value={formData.header_color}
                    onChange={handleChange}
                    className="color-preview"
                  />
                  <input
                    type="text"
                    name="header_color"
                    value={formData.header_color}
                    onChange={handleChange}
                    className="flex-1"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            <div className="preview-section">
              <h3>Vista Previa</h3>
              <div style={{
                backgroundColor: formData.secondary_color,
                border: `3px solid ${formData.primary_color}`,
                borderRadius: 'var(--radius-lg)',
                padding: '24px'
              }}>
                <div style={{
                  backgroundColor: formData.header_color,
                  color: formData.accent_color,
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <h2 className="font-bold">
                    {user?.business_name || user?.username}
                  </h2>
                  <small>{formData.currency_symbol} Moneda: {formData.currency_code}</small>
                </div>

                <div style={{ color: formData.primary_color }} className="font-semibold">
                  Este es un ejemplo de texto con tu color primario
                </div>

                <div className="flex gap-2" style={{ marginTop: '16px' }}>
                  <button type="button" style={{
                    backgroundColor: formData.accent_color,
                    color: formData.primary_color,
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                    {formData.currency_symbol} 12.99
                  </button>
                  <button type="button" style={{
                    backgroundColor: formData.primary_color,
                    color: formData.secondary_color,
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                    Bot\u00F3n Secundario
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
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Configuraci\u00F3n'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Settings;
