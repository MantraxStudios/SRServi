import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faCoins, faChevronDown, faCheck, faFire, faClock, faQrcode, faEye, faEyeSlash, faDownload, faHashtag, faShieldAlt, faKey, faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useNavigate, Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';

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
    inactivity_timeout: 120,
    hide_decimals: false,
    show_top_selling: true
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [mpToken, setMpToken] = useState('');
  const [mpConfigured, setMpConfigured] = useState(false);
  const [mpPreview, setMpPreview] = useState('');
  const [mpSaving, setMpSaving] = useState(false);
  const [mpSuccess, setMpSuccess] = useState('');
  const [mpError, setMpError] = useState('');
  const [showMpToken, setShowMpToken] = useState(false);
  const qrRef = useRef(null);

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null); // { secret, otpauthUrl }
  const [totpCode, setTotpCode] = useState('');
  const [totpDisableCode, setTotpDisableCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [totpSuccess, setTotpSuccess] = useState('');
  const [totpStep, setTotpStep] = useState('idle'); // 'idle' | 'setup' | 'disable'

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const padding = 40;
    const size = canvas.width + padding * 2;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = size;
    tmpCanvas.height = size + 60;
    const ctx = tmpCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    ctx.drawImage(canvas, padding, padding);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(selectedStore?.name || 'Tienda', tmpCanvas.width / 2, size + 35);
    const link = document.createElement('a');
    link.download = `QR-${selectedStore?.name || 'tienda'}.png`;
    link.href = tmpCanvas.toDataURL('image/png');
    link.click();
  };

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
        inactivity_timeout: selectedStore.inactivity_timeout ?? 120,
        hide_decimals: selectedStore.hide_decimals ?? false,
        show_top_selling: selectedStore.show_top_selling ?? true
      });
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedStore && token) {
      fetch(`/api/stores/${selectedStore.id}/mp-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(data => {
        setMpConfigured(data.configured);
        setMpPreview(data.token_preview || '');
      }).catch(() => {});
    }
  }, [selectedStore, token]);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/2fa/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(data => {
        setTotpEnabled(data.enabled || false);
      }).catch(() => {});
    }
  }, [token]);

  const saveMpConfig = async () => {
    setMpSaving(true);
    setMpError('');
    setMpSuccess('');
    try {
      const res = await fetch(`/api/stores/${selectedStore.id}/mp-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mp_access_token: mpToken })
      });
      const data = await res.json();
      if (res.ok) {
        setMpSuccess(mpToken ? 'MercadoPago QR configurado correctamente' : 'MercadoPago QR desvinculado');
        setMpConfigured(!!mpToken);
        setMpPreview(mpToken ? '****' + mpToken.slice(-6) : '');
        setMpToken('');
        setTimeout(() => setMpSuccess(''), 3000);
      } else {
        setMpError(data.error || 'Error al guardar');
      }
    } catch {
      setMpError('Error de conexión');
    } finally {
      setMpSaving(false);
    }
  };

  const startTotpSetup = async () => {
    setTotpError('');
    setTotpLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar código');
      setTotpSetup(data);
      setTotpStep('setup');
      setTotpCode('');
    } catch (err) {
      setTotpError(err.message);
    } finally {
      setTotpLoading(false);
    }
  };

  const confirmTotpEnable = async () => {
    setTotpError('');
    setTotpLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      setTotpEnabled(true);
      setTotpStep('idle');
      setTotpSetup(null);
      setTotpCode('');
      setTotpSuccess('Verificación en 2 pasos activada correctamente');
      setTimeout(() => setTotpSuccess(''), 4000);
    } catch (err) {
      setTotpError(err.message);
    } finally {
      setTotpLoading(false);
    }
  };

  const confirmTotpDisable = async () => {
    setTotpError('');
    setTotpLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: totpDisableCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      setTotpEnabled(false);
      setTotpStep('idle');
      setTotpDisableCode('');
      setTotpSuccess('Verificación en 2 pasos desactivada');
      setTimeout(() => setTotpSuccess(''), 4000);
    } catch (err) {
      setTotpError(err.message);
    } finally {
      setTotpLoading(false);
    }
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

        <form onSubmit={handleSubmit}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '15px' }}>
                <input
                  type="checkbox"
                  checked={!!formData.show_top_selling}
                  onChange={(e) => setFormData(prev => ({ ...prev, show_top_selling: e.target.checked }))}
                  style={{ width: '20px', height: '20px' }}
                />
                <div>
                  <strong>Mostrar "Más vendidos"</strong>
                  <div style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>
                    Muestra el badge de llama 🔥 y reordena los productos más vendidos al inicio
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
              <FontAwesomeIcon icon={faHashtag} className="gap-2" />
              Visualización de Precios
            </div>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '15px' }}>
                <input
                  type="checkbox"
                  checked={!!formData.hide_decimals}
                  onChange={(e) => setFormData(prev => ({ ...prev, hide_decimals: e.target.checked }))}
                  style={{ width: '20px', height: '20px' }}
                />
                <div>
                  <strong>Ocultar decimales (.00)</strong>
                  <div style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>
                    Los precios enteros se muestran sin centavos — ej: <strong>$1.200</strong> en vez de <strong>$1.200.00</strong>
                  </div>
                </div>
              </label>
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

        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading}
          style={{ marginTop: '8px', marginBottom: '8px' }}
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
        </form>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faQrcode} className="gap-2" />
              Pagos con QR - MercadoPago
            </div>
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            {mpSuccess && <div className="success" style={{ marginBottom: '12px' }}>{mpSuccess}</div>}
            {mpError && <div className="error" style={{ marginBottom: '12px' }}>{mpError}</div>}

            <div style={{ padding: '12px', borderRadius: '8px', background: mpConfigured ? '#dcfce7' : '#fef3c7', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FontAwesomeIcon icon={faQrcode} style={{ fontSize: '20px', color: mpConfigured ? '#166534' : '#92400e' }} />
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: mpConfigured ? '#166534' : '#92400e' }}>
                  {mpConfigured ? 'QR Configurado' : 'QR No Configurado'}
                </div>
                {mpConfigured && <div style={{ fontSize: '12px', color: '#666' }}>Token: {mpPreview}</div>}
              </div>
            </div>

            <div className="form-group">
              <label>Access Token de MercadoPago</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showMpToken ? 'text' : 'password'}
                    value={mpToken}
                    onChange={(e) => setMpToken(e.target.value)}
                    placeholder={mpConfigured ? 'Ingresa nuevo token para cambiar' : 'APP_USR-...'}
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMpToken(!showMpToken)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                  >
                    <FontAwesomeIcon icon={showMpToken ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                Obtén tu Access Token en <a href="https://www.mercadopago.cl/developers/panel/app" target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>MercadoPago Developers</a>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveMpConfig}
                disabled={mpSaving || !mpToken}
              >
                {mpSaving ? 'Guardando...' : mpConfigured ? 'Actualizar Token' : 'Configurar QR'}
              </button>
              {mpConfigured && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    if (!confirm('Desvincular MercadoPago QR de esta tienda?')) return;
                    setMpSaving(true);
                    setMpError('');
                    try {
                      const res = await fetch(`/api/stores/${selectedStore.id}/mp-config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ mp_access_token: null })
                      });
                      if (res.ok) {
                        setMpConfigured(false);
                        setMpPreview('');
                        setMpSuccess('MercadoPago QR desvinculado');
                        setTimeout(() => setMpSuccess(''), 3000);
                      }
                    } catch {} finally { setMpSaving(false); }
                  }}
                  disabled={mpSaving}
                >
                  Desvincular
                </button>
              )}
            </div>

            {mpConfigured && selectedStore && (
              <div style={{ marginTop: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '700' }}>QR de tu tienda</h4>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                  Los clientes escanean este código para pagar. El QR dirige al checkout de MercadoPago de tu tienda.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div ref={qrRef} style={{ padding: '20px', background: '#fff', borderRadius: '12px', border: '2px solid #e0e0e0' }}>
                    <QRCodeCanvas
                      value={`https://srservi2.srautomatic.com/store/${selectedStore.code}?delivery=true`}
                      size={220}
                      level="H"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{selectedStore.name}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Código: {selectedStore.code}</div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={downloadQR}>
                    <FontAwesomeIcon icon={faDownload} /> Descargar QR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <div className="card-title">
              <FontAwesomeIcon icon={faShieldAlt} className="gap-2" />
              Verificación en 2 pasos (2FA)
            </div>
          </div>

          {totpError && <div className="error" style={{ marginBottom: '12px' }}>{totpError}</div>}
          {totpSuccess && <div className="success" style={{ marginBottom: '12px' }}>{totpSuccess}</div>}

          {totpStep === 'idle' && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '14px',
                borderRadius: '10px', marginBottom: '16px',
                background: totpEnabled ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${totpEnabled ? '#16a34a' : '#D4AF37'}`
              }}>
                <FontAwesomeIcon
                  icon={totpEnabled ? faLock : faUnlock}
                  style={{ fontSize: '22px', color: totpEnabled ? '#16a34a' : '#D4AF37' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    {totpEnabled ? 'Verificación en 2 pasos activada' : 'Verificación en 2 pasos desactivada'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {totpEnabled
                      ? 'Tu cuenta está protegida. Se pedirá un código al iniciar sesión.'
                      : 'Actívala para mayor seguridad. Funciona con Google Authenticator, Authy y otras apps.'}
                  </div>
                </div>
              </div>
              {totpEnabled ? (
                <button
                  onClick={() => { setTotpStep('disable'); setTotpDisableCode(''); setTotpError(''); }}
                  className="btn btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
                >
                  <FontAwesomeIcon icon={faUnlock} style={{ marginRight: '6px' }} />
                  Desactivar 2FA
                </button>
              ) : (
                <button
                  onClick={startTotpSetup}
                  className="btn btn-primary"
                  disabled={totpLoading}
                  style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}
                >
                  <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '6px' }} />
                  {totpLoading ? 'Generando...' : 'Activar verificación en 2 pasos'}
                </button>
              )}
            </div>
          )}

          {totpStep === 'setup' && totpSetup && (
            <div>
              <p style={{ fontSize: '14px', color: '#444', marginBottom: '16px' }}>
                <strong>Paso 1:</strong> Abre <strong>Google Authenticator</strong>, <strong>Authy</strong> u otra app de autenticación y escanea este código QR:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '16px', background: '#fff', border: '2px solid #000', borderRadius: '12px' }}>
                  <QRCodeCanvas value={totpSetup.otpauthUrl} size={200} level="H" bgColor="#ffffff" fgColor="#000000" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>¿No puedes escanear? Ingresa este código manualmente:</p>
                  <div style={{
                    fontFamily: 'monospace', fontSize: '14px', fontWeight: 700,
                    background: '#f3f4f6', padding: '8px 14px', borderRadius: '8px',
                    letterSpacing: '3px', color: '#1a1a1a', border: '1px solid #e0e0e0'
                  }}>
                    {totpSetup.secret}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '14px', color: '#444', marginBottom: '10px' }}>
                <strong>Paso 2:</strong> Ingresa el código de 6 dígitos que muestra la app para confirmar:
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setTotpError(''); }}
                    placeholder="000000"
                    style={{ fontSize: '22px', letterSpacing: '8px', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
                <button
                  onClick={confirmTotpEnable}
                  className="btn btn-primary"
                  disabled={totpLoading || totpCode.length !== 6}
                  style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800, height: '46px' }}
                >
                  {totpLoading ? 'Verificando...' : 'Confirmar'}
                </button>
              </div>
              <button
                onClick={() => { setTotpStep('idle'); setTotpSetup(null); setTotpError(''); }}
                style={{ marginTop: '10px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '13px' }}
              >
                Cancelar
              </button>
            </div>
          )}

          {totpStep === 'disable' && (
            <div>
              <p style={{ fontSize: '14px', color: '#444', marginBottom: '14px' }}>
                Para desactivar la verificación en 2 pasos, ingresa el código actual de tu app de autenticación:
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpDisableCode}
                    onChange={e => { setTotpDisableCode(e.target.value.replace(/\D/g, '')); setTotpError(''); }}
                    placeholder="000000"
                    style={{ fontSize: '22px', letterSpacing: '8px', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
                <button
                  onClick={confirmTotpDisable}
                  className="btn"
                  disabled={totpLoading || totpDisableCode.length !== 6}
                  style={{ background: '#dc2626', border: 'none', color: '#fff', fontWeight: 800, height: '46px' }}
                >
                  {totpLoading ? 'Desactivando...' : 'Desactivar'}
                </button>
              </div>
              <button
                onClick={() => { setTotpStep('idle'); setTotpError(''); }}
                style={{ marginTop: '10px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '13px' }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


export default Settings;
