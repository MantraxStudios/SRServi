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
          onClick={() => {
            if (planInfo && !planInfo.canCreate) {
              setStoreLimitError(planInfo.currentPlan === 'Gratis' 
                ? `Has alcanzado el límite de ${planInfo.maxStores} tiendas en tu plan Gratis. Actualiza a un plan superior para crear más tiendas.`
                : `Has alcanzado el límite de ${planInfo.maxStores} tiendas.`);
            } else {
              openModal();
            }
          }}
          style={{
            backgroundColor: planInfo && !planInfo.canCreate ? '#999' : 'var(--color-primary)',
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

      {planInfo && !planInfo.canCreate && (
        <div style={{
          backgroundColor: 'rgba(245,124,0,0.1)',
          border: '1px solid #f57c00',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#f57c00', fontSize: '20px' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#f57c00' }}>Límite de tiendas alcanzado</strong>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '13px' }}>
              Tu plan {planInfo.currentPlan} permite máximo {planInfo.maxStores} tiendas ({planInfo.storeCount}/{planInfo.maxStores}).
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/plans')}
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-primary)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            <FontAwesomeIcon icon={faStore} style={{ marginRight: '6px' }} />
            Ver Planes
          </button>
        </div>
      )}

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
            maxWidth: '700px',
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

            {storeLimitError && (
              <div style={{
                backgroundColor: 'rgba(220,53,69,0.1)',
                border: '1px solid #dc3545',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#dc3545', fontSize: '20px', marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#dc3545' }}>No puedes crear más tiendas</strong>
                  <p style={{ margin: '4px 0 8px 0', color: '#666', fontSize: '13px' }}>
                    {storeLimitError}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); navigate('/admin/plans'); }}
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-primary)',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    <FontAwesomeIcon icon={faStore} style={{ marginRight: '6px' }} />
                    Ver Planes para Más Tiendas
                  </button>
                </div>
              </div>
            )}

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

              {(() => {
                const isPremium = planInfo && planInfo.plan && planInfo.plan.name !== 'Gratis';
                
                if (!isPremium) {
                  return null;
                }
                
                return (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '12px', 
                      fontWeight: '600', 
                      color: '#333',
                      fontSize: '14px'
                    }}>
                      Logo de la Tienda <span style={{ fontSize: '10px', backgroundColor: '#f57c00', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>PREMIUM</span>
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '12px',
                      border: '2px dashed #e0e0e0'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '12px',
                        backgroundColor: formData.secondary_color || '#f0f0f0',
                        border: `2px solid ${formData.primary_color || '#e0e0e0'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        {logoPreview || formData.logo_url ? (
                          <img src={logoPreview || getImageUrl(formData.logo_url)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '24px', color: '#999' }}>🖼️</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
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
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            cursor: 'pointer'
                          }}
                        />
                        <p style={{ margin: '6px 0 0 0', color: '#666', fontSize: '11px' }}>
                          Selecciona una imagen para el logo (JPG, PNG, GIF)
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
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
                          width: '36px', 
                          height: '36px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
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
                          padding: '6px 8px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '11px',
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
                          width: '36px', 
                          height: '36px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
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
                          padding: '6px 8px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '11px',
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
                          width: '36px', 
                          height: '36px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
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
                          padding: '6px 8px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '11px',
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
                        backgroundColor: formData.header_color
                      }} />
                      <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Header</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        name="header_color"
                        value={formData.header_color}
                        onChange={handleChange}
                        style={{ 
                          width: '36px', 
                          height: '36px', 
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      />
                      <input
                        type="text"
                        name="header_color"
                        value={formData.header_color}
                        onChange={handleChange}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '11px',
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
