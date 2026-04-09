import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PluginContext = createContext();

export const usePlugins = () => useContext(PluginContext);

/**
 * PluginProvider - Loads active plugin manifests and scripts
 *
 * Plugins register themselves via window.__SRSERVI_PLUGINS__[pluginId] = { slots: { ... } }
 *
 * Slot types:
 * - sidebar: { label, icon, path } - adds nav item in admin sidebar
 * - admin-page: { render(container, ctx) } - renders in a plugin page
 * - store-header, store-footer, cart-summary, dashboard-widgets: { render(container, ctx) }
 */
export function PluginProvider({ children, mode = 'admin' }) {
  const [manifest, setManifest] = useState([]);
  const [registry, setRegistry] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};
    fetchManifest();
  }, []);

  const fetchManifest = async () => {
    try {
      const headers = {};
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch('/api/plugins/client-manifest', { headers });
      if (response.ok) {
        const data = await response.json();
        console.log(`[Plugins][${mode}] Manifest:`, data);
        setManifest(data);
        loadPluginScripts(data);
      } else {
        console.warn(`[Plugins][${mode}] Manifest fetch failed:`, response.status);
      }
    } catch (err) {
      console.error('Error loading plugin manifest:', err);
    } finally {
      setLoaded(true);
    }
  };

  const loadPluginScripts = (plugins) => {
    let pending = 0;

    const checkDone = () => {
      if (pending <= 0) {
        const reg = { ...window.__SRSERVI_PLUGINS__ };
        console.log(`[Plugins][${mode}] Registry:`, Object.keys(reg), reg);
        setRegistry(reg);
      }
    };

    for (const plugin of plugins) {
      const scriptUrl = mode === 'admin' ? plugin.adminJs : plugin.storeJs;
      if (!scriptUrl) continue;

      const scriptKey = `${plugin.id}-${mode}`;

      // Check if already loaded
      if (document.querySelector(`script[data-plugin-key="${scriptKey}"]`)) {
        continue;
      }

      pending++;
      const script = document.createElement('script');
      script.src = scriptUrl + '?v=' + plugin.version;
      script.dataset.pluginKey = scriptKey;
      script.onload = () => {
        console.log(`Plugin script loaded: ${plugin.id} (${mode})`);
        pending--;
        checkDone();
      };
      script.onerror = (err) => {
        console.error(`Error loading plugin script: ${plugin.id} (${mode})`, err);
        pending--;
        checkDone();
      };
      document.body.appendChild(script);
    }

    if (pending === 0) {
      // No scripts to load, sync registry immediately
      setTimeout(() => setRegistry({ ...window.__SRSERVI_PLUGINS__ }), 0);
    }
  };

  const getPluginsForSlot = useCallback((slotName) => {
    const results = [];
    for (const [pluginId, pluginDef] of Object.entries(registry)) {
      if (pluginDef?.slots?.[slotName]) {
        results.push({
          pluginId,
          ...pluginDef.slots[slotName]
        });
      }
    }
    return results;
  }, [registry]);

  const getSidebarItems = useCallback(() => {
    return getPluginsForSlot('sidebar');
  }, [getPluginsForSlot]);

  const refreshPlugins = () => {
    fetchManifest();
  };

  return (
    <PluginContext.Provider value={{
      manifest,
      registry,
      loaded,
      getPluginsForSlot,
      getSidebarItems,
      refreshPlugins
    }}>
      {children}
    </PluginContext.Provider>
  );
}

export default PluginContext;
