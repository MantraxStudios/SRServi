import { useRef, useEffect } from 'react';
import { usePlugins } from '../context/PluginContext';

function PluginSlot({ name, context = {} }) {
  const containerRef = useRef(null);
  const { registry } = usePlugins();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    for (const [pluginId, pluginDef] of Object.entries(registry)) {
      const slotDef = pluginDef?.slots?.[name];
      if (slotDef && typeof slotDef.render === 'function') {
        try {
          const wrapper = document.createElement('div');
          wrapper.dataset.pluginSlot = `${name}:${pluginId}`;
          container.appendChild(wrapper);
          slotDef.render(wrapper, context);
        } catch (err) {
          console.error(`Plugin "${pluginId}" error in slot "${name}":`, err);
        }
      }
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [name, registry]);

  return <div ref={containerRef} className="plugin-slot" data-slot={name} />;
}

export default PluginSlot;
