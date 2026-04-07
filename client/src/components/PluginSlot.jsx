import { useRef, useEffect } from 'react';
import { usePlugins } from '../context/PluginContext';

/**
 * PluginSlot - Renders plugin content at designated positions
 *
 * Usage: <PluginSlot name="store-footer" context={{ storeId: 123 }} />
 *
 * Plugins provide a render(container, context) function that writes
 * vanilla DOM into the container. This avoids React version conflicts.
 */
function PluginSlot({ name, context = {} }) {
  const containerRef = useRef(null);
  const { getPluginsForSlot } = usePlugins();
  const plugins = getPluginsForSlot(name);

  useEffect(() => {
    if (!containerRef.current || plugins.length === 0) return;

    const container = containerRef.current;
    container.innerHTML = '';

    for (const plugin of plugins) {
      if (typeof plugin.render === 'function') {
        try {
          const wrapper = document.createElement('div');
          wrapper.dataset.pluginSlot = `${name}:${plugin.pluginId}`;
          container.appendChild(wrapper);
          plugin.render(wrapper, context);
        } catch (err) {
          console.error(`Plugin "${plugin.pluginId}" error in slot "${name}":`, err);
        }
      }
    }

    return () => {
      container.innerHTML = '';
    };
  }, [name, plugins, context]);

  if (plugins.length === 0) return null;

  return <div ref={containerRef} className="plugin-slot" data-slot={name} />;
}

export default PluginSlot;
