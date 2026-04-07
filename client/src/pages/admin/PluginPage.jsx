import { useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePlugins } from '../../context/PluginContext';
import { useStore } from '../../components/Layout';

function PluginPage() {
  const { pluginId } = useParams();
  const { registry } = usePlugins();
  const { selectedStore } = useStore();
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const pluginDef = registry[pluginId];
    if (!pluginDef) {
      setError('Plugin no encontrado o no está activo');
      return;
    }

    if (pluginDef.adminPage && typeof pluginDef.adminPage.render === 'function') {
      try {
        containerRef.current.innerHTML = '';
        pluginDef.adminPage.render(containerRef.current, {
          storeId: selectedStore?.id,
          storeName: selectedStore?.name,
          token: localStorage.getItem('token')
        });
        setError(null);
      } catch (err) {
        setError(`Error renderizando plugin: ${err.message}`);
      }
    } else {
      setError('Este plugin no tiene una página de administración');
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [pluginId, registry, selectedStore]);

  if (error) {
    return (
      <>
        <header className="admin-header">
          <h1>{pluginId}</h1>
        </header>
        <div className="admin-main">
          <div className="card">
            <div className="empty-state">
              <p className="empty-state-text">{error}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className="plugin-page" data-plugin={pluginId} />
  );
}

export default PluginPage;
