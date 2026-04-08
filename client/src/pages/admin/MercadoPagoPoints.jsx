import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faCreditCard, faSync, faExchangeAlt, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

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
  const [mpDevices, setMpDevices] = useState({});
  const [loadingDevices, setLoadingDevices] = useState({});
  const [changingMode, setChangingMode] = useState(null);

  useEffect(() => {
    fetchTerminals();
  }, []);

  const fetchTerminals = async () => {
    try {
      const response = await fetch(API + '/api/mercado-pago-terminals', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setTerminals(list);
      // Auto-fetch devices for each terminal
      list.forEach(t => fetchDevices(t.id));
    } catch (error) {
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async (terminalId) => {
    setLoadingDevices(prev => ({ ...prev, [terminalId]: true }));
    try {
      const response = await fetch(API + `/api/mercado-pago-terminals/${terminalId}/devices`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (response.ok) {
        const data = await response.json();
        setMpDevices(prev => ({ ...prev, [terminalId]: data }));
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoadingDevices(prev => ({ ...prev, [terminalId]: false }));
    }
  };

  const changeMode = async (terminalId, deviceId, newMode) => {
    setChangingMode(deviceId);
    try {
      const response = await fetch(API + `/api/mercado-pago-terminals/${terminalId}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ device_id: deviceId, operating_mode: newMode })
      });
      if (response.ok) {
        // Refresh devices
        await fetchDevices(terminalId);
      } else {
        const err = await response.json();
        alert(err.error || 'Error al cambiar modo');
      }
    } catch (err) {
      alert('Error de conexion');
    } finally {
      setChangingMode(null);
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
      setFormData({ name: '', mercadopago_access_token: '', mercadopago_terminal_id: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingTerminal(null); };

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo guardar');
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
        throw new Error(errorData.error || 'No se pudo eliminar');
      }
      fetchTerminals();
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faCreditCard} style={{ marginRight: '10px' }} />Mercado Pago Point</h1>
        <button onClick={() => openModal()} className="btn btn-primary">
          <FontAwesomeIcon icon={faPlus} /> Nueva Máquina
        </button>
      </header>

      <div className="admin-main">
        <div className="card" style={{ marginBottom: '20px', padding: '16px', background: '#fffbe6', border: '2px solid #e6c200', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}><FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#e6a800' }} /> Configuracion inicial de MercadoPago Point</h3>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#555' }}>
            <li>En la <strong>app de Mercado Pago</strong> del celular, ve a <strong>Tu negocio &gt; Sucursales y cajas</strong></li>
            <li>Crea una <strong>Sucursal</strong> (si no tienes una)</li>
            <li>Dentro de la sucursal, crea una <strong>Caja</strong></li>
            <li>En la app, vincula tu <strong>dispositivo Point</strong> a esa caja (Bluetooth/USB)</li>
            <li>Obtener tu <strong>Access Token</strong> desde <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>mercadopago.com/developers</a> &gt; Tu aplicacion &gt; Credenciales de produccion</li>
            <li>Aqui en SRServi, crea una <strong>Nueva Maquina</strong> con el Access Token y el Terminal ID</li>
            <li>El Terminal ID lo encuentras abajo en <strong>Dispositivos MercadoPago</strong> al crear la maquina</li>
            <li>Asegurate de que el modo sea <strong>PDV</strong> para cobrar desde SRServi</li>
          </ol>
        </div>

        {terminals.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">Sin máquinas configuradas</h3>
            <p className="empty-state-text">Crea tus terminales Point aquí.</p>
            <button onClick={() => openModal()} className="btn btn-primary" style={{ marginTop: '20px' }}>Crear primera máquina</button>
          </div>
        ) : (
          <div className="terminals-grid">
            {terminals.map(terminal => {
              const devices = mpDevices[terminal.id] || [];
              const isLoadingDevs = loadingDevices[terminal.id];

              return (
                <div key={terminal.id} className="terminal-card">
                  <div className="terminal-card-actions">
                    <button onClick={() => openModal(terminal)} className="store-action-btn"><FontAwesomeIcon icon={faEdit} /></button>
                    <button onClick={() => handleDelete(terminal.id)} className="store-action-btn danger"><FontAwesomeIcon icon={faTrash} /></button>
                  </div>

                  <h3 className="terminal-card-name">{terminal.name}</h3>

                  <div className="terminal-field-label">Terminal ID</div>
                  <div className="terminal-field-value">{terminal.mercadopago_terminal_id}</div>

                  <div className="terminal-field-label">Access Token</div>
                  <div className="terminal-field-value masked">{terminal.mercadopago_access_token?.slice(0, 24)}...</div>

                  {/* Dispositivos MP */}
                  <div style={{ marginTop: '16px', borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#555' }}>Dispositivos MercadoPago</span>
                      <button onClick={() => fetchDevices(terminal.id)} disabled={isLoadingDevs}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '12px' }}>
                        <FontAwesomeIcon icon={faSync} spin={isLoadingDevs} /> {isLoadingDevs ? '' : 'Refresh'}
                      </button>
                    </div>

                    {isLoadingDevs && devices.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#999' }}>Consultando API...</p>
                    )}

                    {!isLoadingDevs && devices.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#999' }}>No se encontraron dispositivos</p>
                    )}

                    {devices.map(dev => (
                      <div key={dev.id} style={{ padding: '10px', background: '#fafafa', borderRadius: '8px', marginBottom: '6px', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'monospace', wordBreak: 'break-all' }}>{dev.id}</div>
                            {dev.external_pos_id && <div style={{ fontSize: '11px', color: '#888' }}>POS: {dev.external_pos_id}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#666' }}>Modo:</span>
                          <button
                            onClick={() => changeMode(terminal.id, dev.id, 'PDV')}
                            disabled={changingMode === dev.id}
                            style={{
                              padding: '4px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', border: '2px solid',
                              background: dev.operating_mode === 'PDV' ? '#2ecc71' : '#fff',
                              color: dev.operating_mode === 'PDV' ? '#fff' : '#555',
                              borderColor: dev.operating_mode === 'PDV' ? '#2ecc71' : '#ddd'
                            }}
                          >
                            {dev.operating_mode === 'PDV' && <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '4px' }} />}
                            PDV
                          </button>
                          <button
                            onClick={() => changeMode(terminal.id, dev.id, 'STANDALONE')}
                            disabled={changingMode === dev.id}
                            style={{
                              padding: '4px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', border: '2px solid',
                              background: dev.operating_mode === 'STANDALONE' ? '#3498db' : '#fff',
                              color: dev.operating_mode === 'STANDALONE' ? '#fff' : '#555',
                              borderColor: dev.operating_mode === 'STANDALONE' ? '#3498db' : '#ddd'
                            }}
                          >
                            {dev.operating_mode === 'STANDALONE' && <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '4px' }} />}
                            STANDALONE
                          </button>
                          {changingMode === dev.id && <span style={{ fontSize: '11px', color: '#888' }}>Cambiando...</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingTerminal ? 'Editar Máquina Point' : 'Nueva Máquina Point'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre de la máquina</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ejemplo: Point Barra 1" required />
              </div>
              <div className="form-group">
                <label>Access Token de Mercado Pago</label>
                <input type="text" name="mercadopago_access_token" value={formData.mercadopago_access_token} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Terminal ID (Point)</label>
                <input type="text" name="mercadopago_terminal_id" value={formData.mercadopago_terminal_id} onChange={handleChange} required />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingTerminal ? 'Guardar Cambios' : 'Crear Máquina'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default MercadoPagoPoints;
