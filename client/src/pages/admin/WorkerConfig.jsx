import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCog, faMoneyBillWave, faCreditCard, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';

function WorkerConfig() {
  const { token } = useAuth();
  const { selectedStore, fetchStores } = useStore();
  const [acceptCash, setAcceptCash] = useState(true);
  const [acceptCard, setAcceptCard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setAcceptCash(selectedStore.worker_accept_cash !== false && selectedStore.worker_accept_cash !== 0);
      setAcceptCard(selectedStore.worker_accept_card !== false && selectedStore.worker_accept_card !== 0);
    }
  }, [selectedStore]);

  const handleSave = async () => {
    if (!selectedStore) return;
    if (!acceptCash && !acceptCard) {
      setError('Debes habilitar al menos un metodo de pago');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: selectedStore.name,
          primary_color: selectedStore.primary_color,
          secondary_color: selectedStore.secondary_color,
          accent_color: selectedStore.accent_color,
          header_color: selectedStore.header_color,
          currency_code: selectedStore.currency_code,
          currency_symbol: selectedStore.currency_symbol,
          currency_name: selectedStore.currency_name,
          worker_accept_cash: acceptCash,
          worker_accept_card: acceptCard
        })
      });

      if (!response.ok) throw new Error('Error al guardar');

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
      <>
        <header className="admin-header">
          <h1>Config. Worker</h1>
        </header>
        <div className="admin-main">
          <div className="card empty-state">
            <p className="empty-state-text">Selecciona una tienda para configurar el panel de trabajadores</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1>Config. Worker</h1>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">Configuracion guardada</div>}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FontAwesomeIcon icon={faUserCog} /> Metodos de pago del Worker Panel
            </h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: '24px' }}>
            Selecciona los metodos de pago que los trabajadores podran usar al crear pedidos desde el panel.
          </p>

          <div className="flex flex-col gap-4">
            <label
              className={`worker-config-option ${acceptCash ? 'active' : ''}`}
              onClick={() => setAcceptCash(!acceptCash)}
            >
              <div className={`worker-config-check ${acceptCash ? 'checked' : ''}`}>
                {acceptCash && <FontAwesomeIcon icon={faCheck} />}
              </div>
              <div className="worker-config-icon cash">
                <FontAwesomeIcon icon={faMoneyBillWave} />
              </div>
              <div className="worker-config-info">
                <span className="worker-config-name">Efectivo</span>
                <span className="worker-config-desc">Permitir cobro en efectivo</span>
              </div>
            </label>

            <label
              className={`worker-config-option ${acceptCard ? 'active' : ''}`}
              onClick={() => setAcceptCard(!acceptCard)}
            >
              <div className={`worker-config-check ${acceptCard ? 'checked' : ''}`}>
                {acceptCard && <FontAwesomeIcon icon={faCheck} />}
              </div>
              <div className="worker-config-icon card-icon">
                <FontAwesomeIcon icon={faCreditCard} />
              </div>
              <div className="worker-config-info">
                <span className="worker-config-name">Tarjeta (Point)</span>
                <span className="worker-config-desc">Permitir cobro con MercadoPago Point</span>
              </div>
            </label>
          </div>

          <button
            className="btn btn-primary btn-lg btn-full"
            style={{ marginTop: '24px' }}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar configuracion'}
          </button>
        </div>
      </div>
    </>
  );
}

export default WorkerConfig;
