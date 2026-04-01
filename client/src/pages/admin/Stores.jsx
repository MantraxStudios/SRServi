import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faCopy } from '@fortawesome/free-solid-svg-icons';

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
  
  const [formData, setFormData] = useState({
    name: '',
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
    accent_color: '#D4AF37',
    header_color: '#000000',
    currency_code: 'USD',
    currency_symbol: '$',
    currency_name: 'Dólar Estadounidense'
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
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
      currency_name: 'Dólar Estadounidense'
    });
    setEditingStore(null);
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
        currency_name: store.currency_name || 'Dólar Estadounidense'
      });
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

    try {
      const url = editingStore
        ? `http://localhost:3001/api/stores/${editingStore.id}`
        : 'http://localhost:3001/api/stores';
      
      const method = editingStore ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchStores();
        setShowModal(false);
        resetForm();
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
      const response = await fetch(`http://localhost:3001/api/stores/${storeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>
          <FontAwesomeIcon icon={faEdit} style={{ marginRight: '10px' }} />
          Gestión de Tiendas
        </h2>
        <button
          onClick={() => openModal()}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-secondary)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Nueva Tienda
        </button>
      </div>

      {stores.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'var(--color-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '2px dashed var(--color-primary)'
        }}>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>No hay tiendas</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>Crea tu primera tienda para comenzar</p>
          <button
            onClick={() => openModal()}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-secondary)',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
            Crear Tienda
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {stores.map(store => (
            <div
              key={store.id}
              style={{
                backgroundColor: 'var(--color-secondary)',
                border: `2px solid ${store.primary_color || '#000'}`,
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                position: 'relative'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={() => copyCode(store.code)}
                  style={{
                    backgroundColor: copiedCode === store.code ? '#28a745' : '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    color: copiedCode === store.code ? '#fff' : '#666',
                    transition: 'all 0.2s'
                  }}
                  title="Copiar código"
                >
                  <FontAwesomeIcon icon={faCopy} />
                </button>
                <button
                  onClick={() => openModal(store)}
                  style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                  onClick={() => handleDelete(store.id)}
                  style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    color: '#dc3545'
                  }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>

              <h3 style={{ 
                margin: '0 40px 10px 0', 
                color: store.primary_color || '#000',
                fontSize: '18px'
              }}>
                {store.name}
              </h3>

              <div style={{
                display: 'inline-block',
                backgroundColor: store.primary_color || '#000',
                color: store.secondary_color || '#fff',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '700',
                marginBottom: '15px'
              }}>
                Código: {store.code}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: store.primary_color || '#000'
                  }} />
                  <span style={{ fontSize: '12px', color: '#666' }}>Primary</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: store.secondary_color || '#fff',
                    border: '1px solid #ddd'
                  }} />
                  <span style={{ fontSize: '12px', color: '#666' }}>Secondary</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: store.accent_color || '#D4AF37'
                  }} />
                  <span style={{ fontSize: '12px', color: '#666' }}>Accent</span>
                </div>
              </div>

              <div style={{
                fontSize: '14px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>Moneda:</span>
                <strong>{store.currency_symbol} {store.currency_code}</strong>
                <span>({store.currency_name})</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--color-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: '30px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--color-primary)' }}>
              {editingStore ? 'Editar Tienda' : 'Nueva Tienda'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'var(--color-primary)' }}>
                  Nombre de la Tienda
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #ddd',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'var(--color-primary)' }}>
                    Color Principal
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      name="primary_color"
                      value={formData.primary_color}
                      onChange={handleChange}
                      style={{ width: '50px', height: '40px', border: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      name="primary_color"
                      value={formData.primary_color}
                      onChange={handleChange}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'var(--color-primary)' }}>
                    Color Secundario
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      name="secondary_color"
                      value={formData.secondary_color}
                      onChange={handleChange}
                      style={{ width: '50px', height: '40px', border: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      name="secondary_color"
                      value={formData.secondary_color}
                      onChange={handleChange}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'var(--color-primary)' }}>
                    Color Acento
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      name="accent_color"
                      value={formData.accent_color}
                      onChange={handleChange}
                      style={{ width: '50px', height: '40px', border: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      name="accent_color"
                      value={formData.accent_color}
                      onChange={handleChange}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'var(--color-primary)' }}>
                  Moneda
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #ddd',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '14px'
                    }}
                  >
                    <span>{formData.currency_symbol} {formData.currency_code} - {formData.currency_name}</span>
                    <span>▼</span>
                  </button>
                  {currencyDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      border: '2px solid #ddd',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10
                    }}>
                      {CURRENCIES.map(currency => (
                        <div
                          key={currency.code}
                          onClick={() => selectCurrency(currency)}
                          style={{
                            padding: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: formData.currency_code === currency.code ? '#f0f0f0' : '#fff'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = formData.currency_code === currency.code ? '#f0f0f0' : '#fff'}
                        >
                          <span>{currency.flag}</span>
                          <span>{currency.symbol}</span>
                          <span style={{ fontWeight: '600' }}>{currency.code}</span>
                          <span style={{ color: '#666', fontSize: '12px' }}>{currency.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Guardando...' : (editingStore ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stores;
