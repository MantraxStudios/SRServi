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
    currency_name: 'Dólar Estadounidense',
    mercadopago_access_token: '',
    mercadopago_terminal_id: ''
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
      currency_name: 'Dólar Estadounidense',
      mercadopago_access_token: '',
      mercadopago_terminal_id: ''
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
        currency_name: store.currency_name || 'Dólar Estadounidense',
        mercadopago_access_token: store.mercadopago_access_token || '',
        mercadopago_terminal_id: store.mercadopago_terminal_id || ''
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <h3 style={{ 
                margin: 0, 
                color: '#333',
                fontSize: '20px',
                fontWeight: '700'
              }}>
                {editingStore ? 'Editar Tienda' : 'Nueva Tienda'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  color: '#333',
                  fontSize: '14px'
                }}>
                  Nombre de la Tienda *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Mi Restaurante"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px', 
                  fontWeight: '600', 
                  color: '#333',
                  fontSize: '14px'
                }}>
                  Colores de la Tienda
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        backgroundColor: formData.primary_color
                      }} />
                      <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Principal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        name="primary_color"
                        value={formData.primary_color}
                        onChange={handleChange}
                        style={{ 
                          width: '44px', 
                          height: '44px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      />
                      <input
                        type="text"
                        name="primary_color"
                        value={formData.primary_color}
                        onChange={handleChange}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        backgroundColor: formData.secondary_color,
                        border: '1px solid #ddd'
                      }} />
                      <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Secundario</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        name="secondary_color"
                        value={formData.secondary_color}
                        onChange={handleChange}
                        style={{ 
                          width: '44px', 
                          height: '44px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      />
                      <input
                        type="text"
                        name="secondary_color"
                        value={formData.secondary_color}
                        onChange={handleChange}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        backgroundColor: formData.accent_color
                      }} />
                      <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Acento</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        name="accent_color"
                        value={formData.accent_color}
                        onChange={handleChange}
                        style={{ 
                          width: '44px', 
                          height: '44px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      />
                      <input
                        type="text"
                        name="accent_color"
                        value={formData.accent_color}
                        onChange={handleChange}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  color: '#333',
                  fontSize: '14px'
                }}>
                  Moneda
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '14px',
                      color: '#333'
                    }}
                  >
                    <span>
                      <span style={{ marginRight: '8px' }}>
                        {CURRENCIES.find(c => c.code === formData.currency_code)?.flag || '🏳️'}
                      </span>
                      <strong>{formData.currency_symbol}</strong> {formData.currency_code} - {formData.currency_name}
                    </span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                  </button>
                  {currencyDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      marginTop: '4px',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {CURRENCIES.map(currency => (
                        <div
                          key={currency.code}
                          onClick={() => selectCurrency(currency)}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            backgroundColor: formData.currency_code === currency.code ? '#f0f7ff' : '#fff',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.currency_code !== currency.code) {
                              e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.currency_code !== currency.code) {
                              e.currentTarget.style.backgroundColor = '#fff';
                            }
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>{currency.flag}</span>
                          <strong style={{ fontSize: '16px', minWidth: '30px' }}>{currency.symbol}</strong>
                          <span style={{ fontWeight: '600', minWidth: '50px' }}>{currency.code}</span>
                          <span style={{ color: '#666', fontSize: '13px' }}>{currency.name}</span>
                          {formData.currency_code === currency.code && (
                            <span style={{ marginLeft: 'auto', color: '#007bff' }}>✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ 
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                border: '2px solid #e9ecef'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#00B1EA',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}>
                    MP
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#333', fontSize: '16px' }}>Mercado Pago Point</h4>
                    <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '12px' }}>Configuracion para pagos con tarjeta</p>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    Access Token de Mercado Pago
                  </label>
                  <input
                    type="password"
                    name="mercadopago_access_token"
                    value={formData.mercadopago_access_token}
                    onChange={handleChange}
                    placeholder="APP_USR-xxxxxxxx-xxxxxx-..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <p style={{ margin: '6px 0 0 0', color: '#666', fontSize: '12px' }}>
                    Lo encuentras en Mercado Pago Developers → Tus Apps → Credenciales de produccion
                  </p>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#333',
                    fontSize: '14px'
                  }}>
                    ID del Terminal Point
                  </label>
                  <input
                    type="text"
                    name="mercadopago_terminal_id"
                    value={formData.mercadopago_terminal_id}
                    onChange={handleChange}
                    placeholder="NEWLAND_N950__XXXXXXXX"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <p style={{ margin: '6px 0 0 0', color: '#666', fontSize: '12px' }}>
                    Lo encuentras en Mercado Pago Developers → Tu negocio → Point
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f0f0f0' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#666'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    backgroundColor: formData.primary_color || '#000',
                    color: formData.secondary_color || '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: loading ? 0.7 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  {loading ? 'Guardando...' : (editingStore ? 'Actualizar Tienda' : 'Crear Tienda')}
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
