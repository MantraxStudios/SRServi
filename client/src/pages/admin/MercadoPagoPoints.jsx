import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { API_URL } from '../../config.js';
import { faPlus, faEdit, faTrash, faCreditCard } from '@fortawesome/free-solid-svg-icons';

function MercadoPagoPoints() {
  const { token } = useAuth();
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    mercadopago_access_token: '',
    mercadopago_terminal_id: ''
  });

  useEffect(() => {
    fetchTerminals();
  }, []);

  const fetchTerminals = async () => {
    try {
      const response = await fetch(`${API_URL}/api/mercado-pago-terminals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setTerminals(Array.isArray(data) ? data : []);
    } catch (error) {
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (terminal = null) => {
    if (terminal) {
      setEditingTerminal(terminal);
      setFormData({
        name: terminal.name || '',
        mercadopago_access_token: terminal.mercadopago_access_token || '',
        mercadopago_terminal_id: terminal.mercadopago_terminal_id || ''
      });
    } else {
      setEditingTerminal(null);
      setFormData({
        name: '',
        mercadopago_access_token: '',
        mercadopago_terminal_id: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTerminal(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingTerminal
        ? `/api/mercado-pago-terminals/${editingTerminal.id}`
        : '/api/mercado-pago-terminals';

      const response = await fetch(url, {
        method: editingTerminal ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo guardar la máquina');
      }

      closeModal();
      fetchTerminals();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (terminalId) => {
    if (!confirm('¿Seguro que deseas eliminar esta máquina Point?')) return;

    try {
      const response = await fetch(`/api/mercado-pago-terminals/${terminalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo eliminar la máquina');
      }

      fetchTerminals();
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>
          <FontAwesomeIcon icon={faCreditCard} style={{ marginRight: '10px' }} />
          Mercado Pago Point
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
          Nueva Máquina
        </button>
      </div>

      {terminals.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'var(--color-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '2px dashed var(--color-primary)'
        }}>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>Sin máquinas configuradas</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Crea tus terminales Point aquí y luego las podrás seleccionar en cada compra desde la tienda pública.
          </p>
          <button
            onClick={() => openModal()}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-secondary)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Crear primera máquina
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {terminals.map(terminal => (
            <div key={terminal.id} style={{
              backgroundColor: 'var(--color-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              border: '2px solid var(--color-primary)',
              position: 'relative'
            }}>
              <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => openModal(terminal)}
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
                  onClick={() => handleDelete(terminal.id)}
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

              <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-primary)', fontSize: '18px' }}>
                {terminal.name}
              </h3>

              <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                Terminal ID
              </div>
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '10px',
                fontFamily: 'monospace',
                fontSize: '13px',
                marginBottom: '12px',
                wordBreak: 'break-all'
              }}>
                {terminal.mercadopago_terminal_id}
              </div>

              <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                Access Token
              </div>
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '12px',
                color: '#888',
                wordBreak: 'break-all'
              }}>
                {terminal.mercadopago_access_token?.slice(0, 24)}...
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <h2>{editingTerminal ? 'Editar Máquina Point' : 'Nueva Máquina Point'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre de la máquina</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ejemplo: Point Barra 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Access Token de Mercado Pago</label>
                <input
                  type="text"
                  name="mercadopago_access_token"
                  value={formData.mercadopago_access_token}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Terminal ID (Point)</label>
                <input
                  type="text"
                  name="mercadopago_terminal_id"
                  value={formData.mercadopago_terminal_id}
                  onChange={handleChange}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTerminal ? 'Guardar Cambios' : 'Crear Máquina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MercadoPagoPoints;
