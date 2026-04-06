import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faCreditCard } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

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
      const response = await fetch(API + '/api/mercado-pago-terminals', {
        headers: { Authorization: 'Bearer ' + token }
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
        throw new Error(errorData.error || 'No se pudo guardar la maquina');
      }

      closeModal();
      fetchTerminals();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (terminalId) => {
    if (!confirm('Seguro que deseas eliminar esta maquina Point?')) return;

    try {
      const response = await fetch(`/api/mercado-pago-terminals/${terminalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo eliminar la maquina');
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
    <>
      <header className="admin-header">
        <h1>
          <FontAwesomeIcon icon={faCreditCard} />
          {' '}Mercado Pago Point
        </h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FontAwesomeIcon icon={faPlus} />
          Nueva Maquina
        </button>
      </header>

      <div className="admin-main">
        {terminals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FontAwesomeIcon icon={faCreditCard} />
            </div>
            <h3 className="empty-state-title">Sin maquinas configuradas</h3>
            <p className="empty-state-text">
              Crea tus terminales Point aqui y luego las podras seleccionar en cada compra desde la tienda publica.
            </p>
            <button className="btn btn-primary" onClick={() => openModal()}>
              Crear primera maquina
            </button>
          </div>
        ) : (
          <div className="content-grid">
            {terminals.map(terminal => (
              <div key={terminal.id} className="card relative">
                <div className="card-header">
                  <h3 className="card-title">
                    {terminal.name}
                  </h3>
                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-secondary" onClick={() => openModal(terminal)}>
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(terminal.id)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-muted">
                  Terminal ID
                </div>
                <div className="badge badge-info">
                  {terminal.mercadopago_terminal_id}
                </div>

                <div className="text-xs text-muted">
                  Access Token
                </div>
                <div className="badge badge-info">
                  {terminal.mercadopago_access_token?.slice(0, 24)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingTerminal ? 'Editar Maquina Point' : 'Nueva Maquina Point'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre de la maquina</label>
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
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTerminal ? 'Guardar Cambios' : 'Crear Maquina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default MercadoPagoPoints;
