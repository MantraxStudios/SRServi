import { useState } from 'react';

const sections = [
  { id: 'intro', label: 'Introduccion' },
  { id: 'structure', label: 'Estructura' },
  { id: 'pluginjson', label: 'plugin.json' },
  { id: 'serverjs', label: 'server.js' },
  { id: 'storejs', label: 'store.js' },
  { id: 'adminjs', label: 'admin.js' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'slots', label: 'Slots' },
  { id: 'settings', label: 'Settings' },
  { id: 'payments', label: 'Pagos' },
  { id: 'api', label: 'API Endpoints' },
  { id: 'socket', label: 'WebSocket' },
  { id: 'examples', label: 'Ejemplos' },
];

function Code({ children }) {
  return <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '16px', borderRadius: '8px', fontSize: '13px', overflow: 'auto', lineHeight: '1.6', margin: '8px 0' }}>{children}</pre>;
}

function H2({ id, children }) {
  return <h2 id={id} style={{ color: '#D4AF37', borderBottom: '2px solid #333', paddingBottom: '8px', marginTop: '40px' }}>{children}</h2>;
}

function H3({ children }) {
  return <h3 style={{ color: '#eee', marginTop: '24px' }}>{children}</h3>;
}

function Badge({ children, color = '#D4AF37' }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: color + '22', color, border: `1px solid ${color}44`, marginLeft: '6px' }}>{children}</span>;
}

function Docs() {
  const [activeSection, setActiveSection] = useState('intro');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <nav style={{ width: '220px', flexShrink: 0, background: '#161b22', borderRight: '1px solid #30363d', padding: '20px 0', position: 'fixed', top: 0, bottom: 0, overflowY: 'auto' }}>
        <div style={{ padding: '0 16px 20px', borderBottom: '1px solid #30363d' }}>
          <h1 style={{ fontSize: '18px', color: '#D4AF37', margin: 0 }}>SRServi</h1>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>Plugin SDK Docs</span>
        </div>
        {sections.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={() => setActiveSection(s.id)}
            style={{ display: 'block', padding: '8px 16px', fontSize: '13px', color: activeSection === s.id ? '#D4AF37' : '#8b949e', textDecoration: 'none', borderLeft: activeSection === s.id ? '3px solid #D4AF37' : '3px solid transparent', background: activeSection === s.id ? '#D4AF3710' : 'transparent', fontWeight: activeSection === s.id ? '600' : '400' }}
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, marginLeft: '220px', padding: '32px 48px', maxWidth: '900px' }}>
        <H2 id="intro">Introduccion</H2>
        <p>El sistema de plugins de SRServi te permite extender la funcionalidad de las tiendas sin modificar el codigo fuente. Los plugins pueden:</p>
        <ul>
          <li>Escuchar eventos del servidor (pedidos, pagos, productos)</li>
          <li>Inyectar UI en la tienda publica y el panel admin</li>
          <li>Registrar endpoints API propios</li>
          <li>Integrar proveedores de pago</li>
          <li>Tener configuracion por tienda</li>
        </ul>
        <p style={{ background: '#161b22', padding: '12px 16px', borderRadius: '8px', borderLeft: '3px solid #D4AF37' }}>
          Los plugins requieren un plan <strong>Premium</strong> para instalarse y activarse.
        </p>

        <H2 id="structure">Estructura de un Plugin</H2>
        <Code>{`mi-plugin/
├── plugin.json        # Metadata y configuracion (REQUERIDO)
├── server.js          # Logica del servidor, hooks, rutas (opcional)
├── admin.js           # UI para el panel admin (opcional)
├── store.js           # UI para la tienda publica (opcional)
├── logo.png           # Logo del plugin (opcional, png/jpg/svg/webp)
└── otros archivos...  # Assets adicionales`}</Code>
        <p>El plugin se empaqueta como <strong>.zip</strong> y se sube desde el panel admin en Plugins o se publica en el Workshop.</p>

        <H2 id="pluginjson">plugin.json</H2>
        <p>Archivo de metadata obligatorio. Define la identidad y capacidades del plugin.</p>
        <Code>{`{
  "id": "mi-plugin",              // ID unico (slug, sin espacios)
  "name": "Mi Plugin",            // Nombre visible
  "version": "1.0.0",             // Semver
  "description": "Que hace",      // Descripcion corta
  "author": "Tu Nombre",          // Autor

  "hooks": [                      // Eventos del server a escuchar
    "order_created",
    "payment_completed"
  ],

  "adminSlots": ["sidebar"],      // Slots del admin a usar
  "storeSlots": ["store-header"], // Slots del store a usar

  "settings": {                   // Schema de configuracion
    "api_key": {
      "type": "string",
      "label": "API Key",
      "placeholder": "sk_...",
      "default": ""
    },
    "enabled": {
      "type": "boolean",
      "label": "Activar",
      "default": true
    },
    "timeout": {
      "type": "number",
      "label": "Timeout (seg)",
      "default": 30
    }
  },

  "routes": true                  // Habilitar rutas custom del server
}`}</Code>
        <p><strong>Campos requeridos:</strong> <code>id</code>, <code>name</code>, <code>version</code></p>

        <H2 id="serverjs">server.js</H2>
        <p>Se ejecuta en Node.js cuando el plugin se activa. Exporta <code>init(context)</code> y opcionalmente <code>destroy()</code>.</p>
        <Code>{`export async function init(context) {
  const { hooks, router, db, io, getSettings, logger } = context;

  // hooks.on(hookName, handler) - Escuchar eventos
  hooks.on('order_created', async (data) => {
    logger.log('Nuevo pedido:', data.order.id);
    const settings = await getSettings(data.store_id);
    // ... tu logica
  });

  // router - Express Router montado en /api/plugins/run/{pluginId}/
  router.get('/status', async (req, res) => {
    res.json({ ok: true });
  });

  router.post('/action', async (req, res) => {
    const { store_id } = req.body;
    const settings = await getSettings(store_id);
    // ... tu logica
    res.json({ success: true });
  });

  // db - Pool de MySQL (mysql2)
  const [rows] = await db.execute('SELECT * FROM stores LIMIT 1');

  // io - Socket.IO server
  io.emit('mi_evento', { data: 'hola' });
}

export async function destroy() {
  // Limpieza al desactivar
}`}</Code>

        <H3>Objeto Context</H3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ borderBottom: '2px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Propiedad</th>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Descripcion</th>
          </tr></thead>
          <tbody>
            {[
              ['hooks.on(name, handler)', 'Registra handler async para un hook'],
              ['hooks.registerPaymentProvider(provider)', 'Registra proveedor de pagos'],
              ['router', 'Express Router en /api/plugins/run/{id}/'],
              ['db', 'Pool MySQL (mysql2) - pool.execute(sql, params)'],
              ['io', 'Socket.IO server instance'],
              ['getSettings(storeId)', 'Async - retorna settings del plugin para la tienda'],
              ['logger.log/error/warn', 'Logger con prefijo del plugin'],
            ].map(([prop, desc], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#79c0ff' }}>{prop}</td>
                <td style={{ padding: '8px' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H2 id="storejs">store.js (Frontend Tienda)</H2>
        <p>Se carga en el navegador cuando un cliente visita la tienda. Debe registrarse en <code>window.__SRSERVI_PLUGINS__</code>.</p>
        <Code>{`(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};

  window.__SRSERVI_PLUGINS__['mi-plugin'] = {
    slots: {
      'store-header': {
        render: function(container, ctx) {
          // container = div DOM donde renderizar
          // ctx.storeId = ID de la tienda

          // Acceder a settings del plugin
          fetch('/api/plugins/run/mi-plugin/settings?store_id=' + ctx.storeId)
            .then(r => r.json())
            .then(settings => {
              container.innerHTML = '<div>Hola desde mi plugin!</div>';
            });

          // Acceder a CSS variables de la tienda
          var primary = getComputedStyle(document.documentElement)
            .getPropertyValue('--store-primary').trim();
        }
      }
    }
  };
})();`}</Code>
        <p><strong>CSS Variables disponibles:</strong> <code>--store-primary</code>, <code>--store-secondary</code>, <code>--store-accent</code>, <code>--store-header</code></p>

        <H2 id="adminjs">admin.js (Frontend Admin)</H2>
        <p>Se carga en el panel admin. Permite agregar items al sidebar y paginas custom.</p>
        <Code>{`(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};

  window.__SRSERVI_PLUGINS__['mi-plugin'] = {
    slots: {
      // Item en el sidebar del admin
      'sidebar': {
        label: 'Mi Plugin',
        path: '/admin/plugins/mi-plugin'
      },

      // Pagina custom (se renderiza en /admin/plugins/mi-plugin)
      'admin-page': {
        render: function(container, ctx) {
          container.innerHTML = '<h1>Panel de Mi Plugin</h1>';

          // Hacer fetch a tu API
          var token = localStorage.getItem('token');
          fetch('/api/plugins/run/mi-plugin/status', {
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(r => r.json()).then(data => {
            container.innerHTML += '<p>Status: ' + data.ok + '</p>';
          });
        }
      }
    }
  };
})();`}</Code>

        <H2 id="hooks">Hooks del Servidor</H2>
        <p>Eventos que tu plugin puede escuchar via <code>hooks.on()</code>:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ borderBottom: '2px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Hook</th>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Data</th>
          </tr></thead>
          <tbody>
            {[
              ['order_created', '{ store_id, order: { id, total, order_type, payment_method } }'],
              ['payment_started', '{ store_id, order, payment_method }'],
              ['payment_completed', '{ store_id, order, payment_method }'],
              ['payment_failed', '{ store_id, order_id, reason }'],
              ['product_created', '{ store_id, product }'],
              ['product_updated', '{ store_id, product }'],
              ['product_deleted', '{ store_id, product_id }'],
              ['category_created', '{ store_id, category }'],
              ['category_updated', '{ store_id, category }'],
              ['category_deleted', '{ store_id, id }'],
              ['extra_created / extra_updated / extra_deleted', '{ store_id, id }'],
              ['ingredient_created / ingredient_updated / ingredient_deleted', '{ store_id, id }'],
              ['inventory_updated', '{ store_id, product_id, stock, unlimited_stock }'],
              ['products_reordered', '{ store_id, products: [] }'],
            ].map(([hook, data], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#79c0ff' }}>{hook}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{data}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H2 id="slots">Slots (UI)</H2>
        <H3>Store Slots</H3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ borderBottom: '2px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Slot</th>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Ubicacion</th>
          </tr></thead>
          <tbody>
            {[
              ['store-header', 'Arriba del contenido de la tienda, debajo del header'],
              ['store-footer', 'Abajo del contenido, antes del cart bar'],
              ['cart-summary', 'Dentro del resumen del carrito'],
            ].map(([slot, desc], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#79c0ff' }}>{slot}</td>
                <td style={{ padding: '8px' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H3>Admin Slots</H3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr style={{ borderBottom: '2px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Slot</th>
            <th style={{ textAlign: 'left', padding: '8px', color: '#D4AF37' }}>Uso</th>
          </tr></thead>
          <tbody>
            {[
              ['sidebar', 'Agrega item al menu lateral { label, path }'],
              ['admin-page', 'Renderiza pagina custom en /admin/plugins/{id}'],
              ['dashboard-widgets', 'Widgets en el dashboard admin'],
            ].map(([slot, desc], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#79c0ff' }}>{slot}</td>
                <td style={{ padding: '8px' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H2 id="settings">Settings (Configuracion)</H2>
        <p>Cada plugin puede definir settings en <code>plugin.json</code>. Los admins configuran por tienda desde el panel.</p>
        <H3>Tipos soportados</H3>
        <Code>{`"settings": {
  "mi_string": {
    "type": "string",
    "label": "Texto visible",
    "placeholder": "Escribe aqui...",
    "default": ""
  },
  "mi_numero": {
    "type": "number",
    "label": "Cantidad",
    "default": 10
  },
  "mi_bool": {
    "type": "boolean",
    "label": "Activar/Desactivar",
    "default": true
  },
  "mi_select": {
    "type": "select",
    "label": "Elegir opcion",
    "options": [
      { "value": "a", "label": "Opcion A" },
      { "value": "b", "label": "Opcion B" }
    ],
    "default": "a"
  },
  "mi_secreto": {
    "type": "string",
    "label": "API Key",
    "secret": true,
    "default": ""
  }
}`}</Code>
        <H3>Acceder a settings</H3>
        <Code>{`// En server.js
const settings = await getSettings(storeId);
console.log(settings.mi_string);

// En store.js / admin.js (via API)
fetch('/api/plugins/run/MI_PLUGIN_ID/settings?store_id=' + storeId)
  .then(r => r.json())
  .then(settings => { ... });`}</Code>

        <H2 id="payments">Integracion de Pagos</H2>
        <p>Los plugins pueden registrar proveedores de pago que se integran automaticamente con el checkout de la tienda.</p>
        <Code>{`// server.js
export async function init(ctx) {
  ctx.hooks.registerPaymentProvider({
    name: 'Mi Pasarela',

    // Verificar si esta disponible para la tienda
    async isAvailable(storeId) {
      const settings = await ctx.getSettings(storeId);
      return !!settings.api_key;
    },

    // Cobrar
    async charge(storeId, amount, orderId, description, deviceUid) {
      const settings = await ctx.getSettings(storeId);
      // ... llamar API de pago
      return {
        success: true,
        paymentKey: 'unique-key-123',
        status: 'Pending'
      };
    },

    // Consultar estado
    async status(paymentKey) {
      return {
        status: 'Completed', // Pending|Completed|Canceled|Failed|Timeout
        transactionRef: 'tx_abc'
      };
    },

    // Cancelar
    async cancel(paymentKey) {
      return { success: true };
    }
  });
}`}</Code>
        <H3>Endpoints de pago (automaticos)</H3>
        <Code>{`GET  /api/plugins/payments/provider?store_id=N
POST /api/plugins/payments/charge
     { store_id, order_id, amount, description, device_uid }
GET  /api/plugins/payments/status/:paymentKey
POST /api/plugins/payments/cancel/:paymentKey`}</Code>

        <H2 id="api">API Endpoints</H2>

        <H3>Plugin Management <Badge>AUTH + PREMIUM</Badge></H3>
        <Code>{`GET    /api/admin/plugins                    # Listar plugins instalados
POST   /api/admin/plugins/upload              # Subir plugin .zip
POST   /api/admin/plugins/:id/activate        # Activar plugin
POST   /api/admin/plugins/:id/deactivate      # Desactivar plugin
DELETE /api/admin/plugins/:id                  # Desinstalar plugin
GET    /api/admin/plugins/:id/settings/:sid   # Leer settings de tienda
PUT    /api/admin/plugins/:id/settings/:sid   # Guardar settings`}</Code>

        <H3>Plugin Workshop <Badge color="#2ecc71">PUBLICO</Badge></H3>
        <Code>{`GET  /api/workshop/plugins                   # Buscar plugins (query: search)
GET  /api/workshop/plugins/:id/versions      # Versiones de un plugin
POST /api/workshop/install/:id               # Instalar desde workshop
POST /api/workshop/publish                   # Publicar plugin (multipart)
GET  /api/workshop/my-plugins                # Mis plugins publicados
DEL  /api/workshop/my-plugins/:id            # Eliminar mi plugin`}</Code>

        <H3>Rutas de tu Plugin</H3>
        <Code>{`// Se montan en /api/plugins/run/{tu-plugin-id}/
// Ejemplo: GET /api/plugins/run/mi-plugin/status

router.get('/mi-ruta', (req, res) => { ... });
router.post('/mi-accion', (req, res) => { ... });`}</Code>

        <H3>Archivos Estaticos</H3>
        <Code>{`GET /api/plugins/static/{pluginId}/archivo.png
# Sirve archivos de la carpeta del plugin instalado`}</Code>

        <H2 id="socket">WebSocket Events</H2>
        <p>El servidor emite estos eventos via Socket.IO que los totems/clientes reciben:</p>
        <Code>{`// Eventos de productos (tiempo real)
product_created   → { id, name, price, ... }
product_updated   → { id, name, price, ... }
product_deleted   → { id }
category_created  → (trigger fetchStore)
category_updated  → (trigger fetchStore)
category_deleted  → (trigger fetchStore)
inventory_updated → { product_id, stock, unlimited_stock }

// Eventos de control
totem_restart → { store_id }

// Desde tu plugin puedes emitir:
io.to('store_' + storeId).emit('mi_evento', data);
io.emit('evento_global', data);`}</Code>

        <H2 id="examples">Ejemplos Completos</H2>

        <H3>Plugin Minimo (solo UI en tienda)</H3>
        <Code>{`// plugin.json
{
  "id": "banner-promo",
  "name": "Banner Promocional",
  "version": "1.0.0",
  "storeSlots": ["store-header"],
  "settings": {
    "text": { "type": "string", "label": "Texto del banner", "default": "ENVIO GRATIS!" },
    "bg_color": { "type": "string", "label": "Color fondo (hex)", "default": "#ff6b35" }
  }
}

// store.js
(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};
  window.__SRSERVI_PLUGINS__['banner-promo'] = {
    slots: {
      'store-header': {
        render: function(container, ctx) {
          fetch('/api/plugins/run/banner-promo/settings?store_id=' + ctx.storeId)
            .then(function(r) { return r.json(); })
            .then(function(s) {
              container.innerHTML =
                '<div style="padding:12px;text-align:center;font-weight:700;' +
                'background:' + (s.bg_color || '#ff6b35') + ';color:#fff;font-size:14px;">' +
                (s.text || 'ENVIO GRATIS!') + '</div>';
            });
        }
      }
    }
  };
})();`}</Code>

        <H3>Plugin con Webhook (server hooks)</H3>
        <Code>{`// plugin.json
{
  "id": "slack-notify",
  "name": "Slack Notifier",
  "version": "1.0.0",
  "hooks": ["order_created"],
  "settings": {
    "webhook_url": { "type": "string", "label": "Slack Webhook URL" }
  }
}

// server.js
export async function init(ctx) {
  ctx.hooks.on('order_created', async (data) => {
    const settings = await ctx.getSettings(data.store_id);
    if (!settings.webhook_url) return;

    await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Nuevo pedido #' + data.order.id +
              ' - Total: $' + data.order.total
      })
    });
  });
}`}</Code>

        <H3>Plugin con Admin Page + Rutas</H3>
        <Code>{`// plugin.json
{
  "id": "mi-dashboard",
  "name": "Mi Dashboard",
  "version": "1.0.0",
  "adminSlots": ["sidebar"],
  "routes": true
}

// server.js
export async function init(ctx) {
  ctx.router.get('/stats', async (req, res) => {
    const [rows] = await ctx.db.execute(
      'SELECT COUNT(*) as total FROM orders WHERE store_id = ?',
      [req.query.store_id]
    );
    res.json({ total_orders: rows[0].total });
  });
}

// admin.js
(function() {
  window.__SRSERVI_PLUGINS__['mi-dashboard'] = {
    slots: {
      'sidebar': { label: 'Mi Dashboard', path: '/admin/plugins/mi-dashboard' },
      'admin-page': {
        render: function(container, ctx) {
          var token = localStorage.getItem('token');
          container.innerHTML = '<h2>Cargando...</h2>';
          fetch('/api/plugins/run/mi-dashboard/stats?store_id=' + ctx.storeId, {
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(r => r.json()).then(data => {
            container.innerHTML = '<h2>Total pedidos: ' + data.total_orders + '</h2>';
          });
        }
      }
    }
  };
})();`}</Code>

        <div style={{ marginTop: '60px', padding: '20px', background: '#161b22', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ color: '#8b949e', margin: 0 }}>SRServi Plugin SDK v1.0 — <a href="/" style={{ color: '#D4AF37' }}>Volver al inicio</a></p>
        </div>
      </main>
    </div>
  );
}

export default Docs;
