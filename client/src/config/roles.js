export const SECTIONS = [
  { key: 'dashboard',      label: 'Dashboard',           icon: '📊', group: 'Operaciones', actions: ['view'] },
  { key: 'orders',         label: 'Pedidos',              icon: '🛒', group: 'Operaciones', actions: ['view', 'edit', 'delete'] },
  { key: 'tables',         label: 'Mesas',                icon: '🪑', group: 'Operaciones', actions: ['view', 'edit'] },
  { key: 'delivery',       label: 'Delivery',             icon: '🏍', group: 'Operaciones', actions: ['view', 'edit'] },
  { key: 'products',       label: 'Productos',            icon: '📦', group: 'Operaciones', actions: ['view', 'edit', 'delete'] },
  { key: 'categories',     label: 'Categorías e ingredientes', icon: '📁', group: 'Operaciones', actions: ['view', 'edit', 'delete'] },
  { key: 'analytics',      label: 'Análisis',             icon: '📈', group: 'Operaciones', actions: ['view'] },
  { key: 'cash_registers', label: 'Caja',                 icon: '💰', group: 'Operaciones', actions: ['view', 'edit'] },
  { key: 'ratings',        label: 'Calificaciones',       icon: '⭐', group: 'Operaciones', actions: ['view'] },
  { key: 'ventas_mes',     label: 'Ventas del Mes',       icon: '💵', group: 'Operaciones', actions: ['view', 'edit'] },
  { key: 'workers',        label: 'Vendedores',           icon: '👥', group: 'Gestión',     actions: ['view', 'edit', 'delete'] },
  { key: 'tasks',          label: 'Tareas',               icon: '✅', group: 'Gestión',     actions: ['view', 'edit', 'delete'] },
  { key: 'inventory',      label: 'Inventario',           icon: '🏭', group: 'Gestión',     actions: ['view', 'edit'] },
  { key: 'procedures',     label: 'Procedimientos',       icon: '📋', group: 'Gestión',     actions: ['view', 'edit', 'delete'] },
  { key: 'attendance',     label: 'Asistencia',           icon: '🕐', group: 'Gestión',     actions: ['view'] },
  { key: 'coupons',        label: 'Cupones',              icon: '%',  group: 'Gestión',     actions: ['view', 'edit', 'delete'] },
  { key: 'whatsapp',       label: 'WhatsApp',             icon: '💬', group: 'Canales',     actions: ['view', 'edit'] },
  { key: 'canales',        label: 'Rappi / Instagram / TikTok', icon: '🌐', group: 'Canales', actions: ['view', 'edit'] },
  { key: 'configurations', label: 'Configuraciones',      icon: '⚙️', group: 'Config',      actions: ['view', 'edit'] },
  { key: 'settings',       label: 'Colores y QR',         icon: '🎨', group: 'Config',      actions: ['view', 'edit'] },
];

export const ACTION_LABELS = { view: 'Ver', edit: 'Editar', delete: 'Eliminar' };

export function buildEmptyPermissions() {
  return Object.fromEntries(SECTIONS.map(s => [s.key, Object.fromEntries(s.actions.map(a => [a, false]))]));
}

export function buildFullPermissions() {
  return Object.fromEntries(SECTIONS.map(s => [s.key, Object.fromEntries(s.actions.map(a => [a, true]))]));
}
