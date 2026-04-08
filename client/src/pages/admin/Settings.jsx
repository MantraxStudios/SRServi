import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faCoins, faChevronDown, faCheck, faFire, faClock } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useNavigate, Link } from 'react-router-dom';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dolar Estadounidense' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Libra Esterlina' },
  { code: 'JPY', symbol: '¥', name: 'Yen Japonés' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano' },
  { code: 'COP', symbol: '$', name: 'Peso Colombiano' },
  { code: 'ARS', symbol: '$', name: 'Peso Argentino' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileño' },
  { code: 'CLP', symbol: '$', name: 'Peso Chileno' }
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
    currency_name: 'Dólar Estadounidense',
    smart_mode: true,
    inactivity_timeout: 120
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
        currency_name: selectedStore.currency_name || 'Dólar Estadounidense',
        smart_mode: selectedStore.smart_mode ?? true,
        inactivity_timeout: selectedStore.inactivity_timeout ?? 120
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

  if (!selectedStore) {
    return (
      <div className="no-store-message">
        <h2>Selecciona una tienda</h2>
        <p>
          Debes seleccionar una tienda desde el menú lateral para ver su configuración
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
        <h1>Configuración</h1>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">Configuración guardada exitosamente</div>}

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faCoins} className="gap-2" />
              Moneda de tu Tienda
            </div>
          </div>

          <div className="form-group">
            <label>Selecciona la moneda que usarás en tu tienda</label>
            <div className="currency-dropdown">
              <button
                type="button"
                onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                className="currency-dropdown-btn"
              >
                <span>
                  <strong>{formData.currency_symbol}</strong> - {formData.currency_name} ({formData.currency_code})
                </span>
                <span className="text-xs"><FontAwesomeIcon icon={faChevronDown} /></span>
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
                        <span className="icon-success"><FontAwesomeIcon icon={faCheck} /></span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <small className="currency-hint">
              Los precios en tu tienda se mostrarán con esta moneda
            </small>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faFire} className="gap-2" />
              Modo Smart e Inactividad
            </div>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '15px' }}>
                <input
                  type="checkbox"
                  checked={!!formData.smart_mode}
                  onChange={(e) => setFormData(prev => ({ ...prev, smart_mode: e.target.checked }))}
                  style={{ width: '20px', height: '20px' }}
                />
                <div>
                  <strong>Modo Smart</strong>
                  <div style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>
                    Los productos mas vendidos aparecen primero con un badge brillante (solo Premium)
                  </div>
                </div>
              </label>
            </div>
            <div className="form-group">
              <label>
                <FontAwesomeIcon icon={faClock} /> Tiempo de inactividad (segundos)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="30"
                  max="600"
                  value={formData.inactivity_timeout}
                  onChange={(e) => setFormData(prev => ({ ...prev, inactivity_timeout: parseInt(e.target.value) || 120 }))}
                  style={{ width: '100px' }}
                />
                <span style={{ fontSize: '13px', color: '#888' }}>
                  {Math.floor((formData.inactivity_timeout || 120) / 60)}m {(formData.inactivity_timeout || 120) % 60}s — despues de este tiempo sin uso aparece el modal "¿Sigues ahi?"
                </span>
              </div>
            </div>
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
              className="btn btn-primary btn-full btn-lg"
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
