import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUnlock, faSave, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

const API = 'https://srservi2.srautomatic.com';

function StorePin() {
  const { selectedStore } = useStore();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (selectedStore) {
      fetchPin();
    } else {
      setLoading(false);
      setPin('');
    }
  }, [selectedStore]);

  const fetchPin = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/stores/${selectedStore.id}/edit-pin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPin(data.pin || '');
      }
    } catch (err) {
      console.error('Error fetching pin:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePin = async () => {
    if (!selectedStore) return;
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/stores/${selectedStore.id}/edit-pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: pin || null })
      });
      if (response.ok) {
        setMessage(pin ? 'PIN guardado correctamente' : 'PIN eliminado');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Error al guardar el PIN');
      }
    } catch (err) {
      setMessage('Error al guardar el PIN');
    } finally {
      setSaving(false);
    }
  };

  const removePin = async () => {
    setPin('');
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      await fetch(API + `/api/stores/${selectedStore.id}/edit-pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: null })
      });
      setMessage('PIN eliminado');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error al eliminar el PIN');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>PIN de Edición en Tienda</h1>
      </header>
      <div className="admin-main">
        <div className="card" style={{ maxWidth: '500px' }}>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <FontAwesomeIcon
                icon={pin ? faLock : faUnlock}
                style={{ fontSize: '24px', color: pin ? 'var(--store-accent, #D4AF37)' : '#999' }}
              />
              <div>
                <h3 style={{ margin: 0 }}>
                  {pin ? 'PIN Activo' : 'Sin PIN'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
                  {pin
                    ? 'Los usuarios pueden reordenar productos en la tienda ingresando este PIN.'
                    : 'Configura un PIN para permitir reordenar productos desde la vista pública de la tienda.'
                  }
                </p>
              </div>
            </div>

            <div className="form-group">
              <label>PIN (4 dígitos)</label>
              <input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ingresa 4 dígitos"
                maxLength={4}
                style={{ fontSize: '20px', letterSpacing: '8px', textAlign: 'center' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={savePin}
                disabled={saving || (pin && pin.length < 4)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <FontAwesomeIcon icon={faSave} />
                {saving ? 'Guardando...' : 'Guardar PIN'}
              </button>
              {pin && (
                <button
                  onClick={removePin}
                  disabled={saving}
                  className="btn btn-danger"
                >
                  <FontAwesomeIcon icon={faTrash} />
                  Quitar
                </button>
              )}
            </div>

            {message && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda',
                color: message.includes('Error') ? '#721c24' : '#155724'
              }}>
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ maxWidth: '500px', marginTop: '16px' }}>
          <div style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px' }}>¿Cómo funciona?</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
              <li>Configura un PIN de 4 dígitos desde aquí</li>
              <li>En la tienda pública aparecerá un botón de edición (lápiz)</li>
              <li>Al presionarlo, se pedirá el PIN</li>
              <li>Con el PIN correcto, se podrán arrastrar los productos para reordenar</li>
              <li>El nuevo orden se guarda automáticamente</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default StorePin;
