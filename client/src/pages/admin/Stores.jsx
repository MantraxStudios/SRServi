import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { faPlus, faEdit, faTrash, faCopy, faStore, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { getImageUrl } from '../../config.js';

const API = 'https://srservi2.srautomatic.com';

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

function Stores() {
  const { token, user } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [storeLimitError, setStoreLimitError] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
    accent_color: '#D4AF37',
    header_color: '#000000',
    currency_code: 'USD',
    currency_symbol: '$',
    currency_name: 'Dólar Estadounidense',
    mercadopago_access_token: '',
    mercadopago_terminal_id: ''
  });

  useEffect(() => {
    fetchStores();
    fetchPlanInfo();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch(API + '/api/stores', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanInfo = async () => {
    try {
      const response = await fetch(API + '/api/my-plan', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (response.ok) {
        const data = await response.json();
        setPlanInfo(data);
      }
    } catch (err) {
      console.error('Error fetching plan info:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      primary_color: '#000000',
      secondary_color: '#FFFFFF',
      accent_color: '#D4AF37',
      header_color: '#000000',
      currency_code: 'USD',
      currency_symbol: '$',
      currency_name: 'Dólar Estadounidense',
      logo_url: ''
    });
    setEditingStore(null);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const openModal = (store = null) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name,
        primary_color: store.primary_color || '#000000',
        secondary_color: store.secondary_color || '#FFFFFF',
        accent_color: store.accent_color || '#D4AF37',
        header_color: store.header_color || '#000000',
        currency_code: store.currency_code || 'USD',
        currency_symbol: store.currency_symbol || '$',
        currency_name: store.currency_name || 'Dólar Estadounidense',
        logo_url: store.logo_url || ''
      });
      setLogoFile(null);
      setLogoPreview(store.logo_url ? getImageUrl(store.logo_url) : null);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

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
    setLoading(true);
    setStoreLimitError(null);

    try {
      const url = editingStore
        ? API + '/api/stores/' + editingStore.id
        : API + '/api/stores';

      const method = editingStore ? 'PUT' : 'POST';
      const isPremium = planInfo && planInfo.plan && planInfo.plan.name !== 'Gratis';

      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        if (key !== 'logo_url' && key !== 'logo') {
          formDataToSend.append(key, formData[key]);
        }
      });

      if (logoFile && isPremium) {
        formDataToSend.append('logo', logoFile);
      } else if (!isPremium && editingStore) {
        formDataToSend.append('remove_logo', 'true');
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (response.ok) {
        fetchStores();
        fetchPlanInfo();
        setShowModal(false);
        resetForm();
      } else {
        const data = await response.json();
        if (data.code === 'STORE_LIMIT_REACHED') {
          setStoreLimitError(data.error);
        } else {
          console.error('Error saving store:', data.error);
        }
      }
    } catch (error) {
      console.error('Error saving store:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (storeId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta tienda? Se eliminarán todos los productos, categorías y pedidos asociados.')) {
      return;
    }

    try {
      const response = await fetch(API + '/api/stores/' + storeId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (response.ok) {
        fetchStores();
      }
    } catch (error) {
      console.error('Error deleting store:', error);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading && stores.length === 0) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>
          <FontAwesomeIcon icon={faEdit} />
          {' '}Gestion de Tiendas
        </h1>
        <button
          onClick={() => {
            if (planInfo && !planInfo.canCreate) {
              setStoreLimitError(planInfo.currentPlan === 'Gratis'
                ? `Has alcanzado el límite de ${planInfo.maxStores} tiendas en tu plan Gratis. Actualiza a un plan superior para crear más tiendas.`
                : `Has alcanzado el límite de ${planInfo.maxStores} tiendas.`);
            } else {
              openModal();
            }
          }}
          className={`btn ${planInfo && !planInfo.canCreate ? 'btn-secondary' : 'btn-primary'}`}
        >
          <FontAwesomeIcon icon={faPlus} />
          Nueva Tienda
        </button>
      </header>

      <div className="admin-main">
        {planInfo && !planInfo.canCreate && (
          <div className="store-limit-banner">
            <FontAwesomeIcon icon={faExclamationTriangle} className="store-limit-icon" />
            <div className="flex-1">
              <strong className="store-limit-title">Limite de tiendas alcanzado</strong>
              <p className="store-limit-text">
                Tu plan {planInfo.currentPlan} permite máximo {planInfo.maxStores} tiendas ({planInfo.storeCount}/{planInfo.maxStores}).
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/plans')}
              className="btn btn-accent btn-sm"
            >
              <FontAwesomeIcon icon={faStore} />
              Ver Planes
            </button>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No hay tiendas</h3>
            <p className="empty-state-text">Crea tu primera tienda para comenzar</p>
            <button
              onClick={() => openModal()}
              className="btn btn-primary"
            >
              <FontAwesomeIcon icon={faPlus} />
              Crear Tienda
            </button>
          </div>
        ) : (
          <div className="stores-grid">
            {stores.map(store => (
              <div
                key={store.id}
                className="store-card"
                style={{ borderColor: store.primary_color || '#000' }}
              >
                <div className="store-card-actions">
                  <button
                    onClick={() => copyCode(store.code)}
                    className={`store-action-btn${copiedCode === store.code ? ' store-card-btn--copied' : ''}`}
                    title="Copiar codigo"
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                  <button
                    onClick={() => openModal(store)}
                    className="store-action-btn"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    onClick={() => handleDelete(store.id)}
                    className="store-action-btn danger"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>

                <h3 className="store-card-name" style={{ color: store.primary_color || '#000' }}>
                  {store.name}
                </h3>

                <div
                  className="store-code-badge"
                  style={{
                    backgroundColor: store.primary_color || '#000',
                    color: store.secondary_color || '#fff'
                  }}
                >
                  Código: {store.code}
                </div>

                <div className="store-colors-row">
                  <div className="store-color-swatch">
                    <div className="store-color-dot" style={{ backgroundColor: store.primary_color || '#000' }} />
                    <span className="store-color-label">Primary</span>
                  </div>
                  <div className="store-color-swatch">
                    <div className="store-color-dot" style={{ backgroundColor: store.secondary_color || '#fff', border: '1px solid #ddd' }} />
                    <span className="store-color-label">Secondary</span>
                  </div>
                  <div className="store-color-swatch">
                    <div className="store-color-dot" style={{ backgroundColor: store.accent_color || '#D4AF37' }} />
                    <span className="store-color-label">Accent</span>
                  </div>
                </div>

                <div className="store-currency-info">
                  <span>Moneda:</span>
                  <strong>{store.currency_symbol} {store.currency_code}</strong>
                  <span>({store.currency_name})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="store-modal-header">
              <h3 className="store-modal-title">
                {editingStore ? 'Editar Tienda' : 'Nueva Tienda'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="store-modal-close"
              >
                ×
              </button>
            </div>

            {storeLimitError && (
              <div className="store-limit-error">
                <FontAwesomeIcon icon={faExclamationTriangle} className="store-error-icon" />
                <div className="flex-1">
                  <strong className="store-error-title">No puedes crear mas tiendas</strong>
                  <p className="store-error-text">
                    {storeLimitError}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); navigate('/admin/plans'); }}
                    className="btn btn-accent btn-sm"
                  >
                    <FontAwesomeIcon icon={faStore} />
                    Ver Planes para Más Tiendas
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre de la Tienda *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Mi Restaurante"
                />
              </div>

              {(() => {
                const isPremium = planInfo && planInfo.plan && planInfo.plan.name !== 'Gratis';

                if (!isPremium) {
                  return null;
                }

                return (
                  <div className="form-group">
                    <label>
                      Logo de la Tienda <span className="badge badge-warning">PREMIUM</span>
                    </label>
                    <div className="logo-upload-area">
                      <div
                        className="logo-preview-box"
                        style={{
                          backgroundColor: formData.secondary_color || '#f0f0f0',
                          border: `2px solid ${formData.primary_color || '#e0e0e0'}`
                        }}
                      >
                        {logoPreview || formData.logo_url ? (
                          <img src={logoPreview || getImageUrl(formData.logo_url)} alt="Logo" />
                        ) : (
                          <span className="logo-placeholder">{'\u{1F5BC}\u{FE0F}'}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setLogoFile(file);
                              setLogoPreview(URL.createObjectURL(file));
                            }
                          }}
                          className="file-input"
                        />
                        <p className="logo-hint">
                          Selecciona una imagen para el logo (JPG, PNG, GIF)
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="form-group">
                <label>Colores de la Tienda</label>
                <div className="color-picker-group">
                  <div>
                    <div className="color-picker-item-label">
                      <div className="color-dot-preview" style={{ backgroundColor: formData.primary_color }} />
                      <span className="color-picker-label-text">Principal</span>
                    </div>
                    <div className="color-picker-inputs">
                      <input
                        type="color"
                        name="primary_color"
                        value={formData.primary_color}
                        onChange={handleChange}
                        className="color-input-swatch"
                      />
                      <input
                        type="text"
                        name="primary_color"
                        value={formData.primary_color}
                        onChange={handleChange}
                        className="color-input-text"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="color-picker-item-label">
                      <div className="color-dot-preview" style={{ backgroundColor: formData.secondary_color, border: '1px solid #ddd' }} />
                      <span className="color-picker-label-text">Secundario</span>
                    </div>
                    <div className="color-picker-inputs">
                      <input
                        type="color"
                        name="secondary_color"
                        value={formData.secondary_color}
                        onChange={handleChange}
                        className="color-input-swatch"
                      />
                      <input
                        type="text"
                        name="secondary_color"
                        value={formData.secondary_color}
                        onChange={handleChange}
                        className="color-input-text"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="color-picker-item-label">
                      <div className="color-dot-preview" style={{ backgroundColor: formData.accent_color }} />
                      <span className="color-picker-label-text">Acento</span>
                    </div>
                    <div className="color-picker-inputs">
                      <input
                        type="color"
                        name="accent_color"
                        value={formData.accent_color}
                        onChange={handleChange}
                        className="color-input-swatch"
                      />
                      <input
                        type="text"
                        name="accent_color"
                        value={formData.accent_color}
                        onChange={handleChange}
                        className="color-input-text"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="color-picker-item-label">
                      <div className="color-dot-preview" style={{ backgroundColor: formData.header_color }} />
                      <span className="color-picker-label-text">Header</span>
                    </div>
                    <div className="color-picker-inputs">
                      <input
                        type="color"
                        name="header_color"
                        value={formData.header_color}
                        onChange={handleChange}
                        className="color-input-swatch"
                      />
                      <input
                        type="text"
                        name="header_color"
                        value={formData.header_color}
                        onChange={handleChange}
                        className="color-input-text"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Moneda</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                    className="currency-dropdown-btn"
                  >
                    <span>
                      {CURRENCIES.find(c => c.code === formData.currency_code)?.flag || '\u{1F3F3}\u{FE0F}'}
                      {' '}
                      <strong>{formData.currency_symbol}</strong> {formData.currency_code} - {formData.currency_name}
                    </span>
                    <span className="text-xs">▼</span>
                  </button>
                  {currencyDropdownOpen && (
                    <div className="currency-dropdown-list">
                      {CURRENCIES.map(currency => (
                        <div
                          key={currency.code}
                          onClick={() => selectCurrency(currency)}
                          className={`currency-option${formData.currency_code === currency.code ? ' selected' : ''}`}
                        >
                          <span className="text-lg">{currency.flag}</span>
                          <strong>{currency.symbol}</strong>
                          <span className="font-semibold">{currency.code}</span>
                          <span className="text-sm text-muted">{currency.name}</span>
                          {formData.currency_code === currency.code && (
                            <span className="text-muted">{'\u2713'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="store-form-actions">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-1"
                  style={{
                    backgroundColor: formData.primary_color || '#000',
                    color: formData.secondary_color || '#fff'
                  }}
                >
                  {loading ? 'Guardando...' : (editingStore ? 'Actualizar Tienda' : 'Crear Tienda')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Stores;
