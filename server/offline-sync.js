// ─────────────────────────────────────────────────────────────────────────────
// Sincronización offline: exporta TODOS los datos de un usuario desde el servidor
// real (nube) e importa el dump en la BD local de la app de escritorio.
//
// exportUserData(userId) → { user, plan, tables: { name: rows[] }, images: [] }
// importUserData(dump)   → vuelca el dump en la BD local preservando los IDs.
//
// El exportador es genérico: recorre todas las tablas base y filtra por store_id /
// user_id automáticamente (via INFORMATION_SCHEMA), y las tablas hijas por el id de
// su padre. Así cubre tablas nuevas sin mantenimiento manual.
// ─────────────────────────────────────────────────────────────────────────────
import { pool } from './database.js';

const DB_NAME = process.env.DB_NAME || 'srservi';

// Tablas globales / de servicios en la nube que NO tienen sentido offline
// (integraciones, superadmin, colas, marketing, plugins, etc.).
const SKIP = new Set([
  '_migrations', 'migrations', 'superadmin', 'plans', 'apk_releases', 'app_activity',
  'changelogs', 'instagram_configs', 'tiktok_configs', 'scheduled_whatsapp_messages',
  'totem_rentals', 'totem_rental_payments', 'plugins', 'plugin_settings',
  'plugin_workshop', 'plugin_workshop_versions', 'free_plan_requests', 'sales_leads',
  'feedback_campaigns', 'feedback_responses', 'feedback_tokens', 'admin_feedback',
  'delivery_customers', 'delivery_sessions', 'delivery_settings', 'rappi_config',
  'pedidosya_config', 'fudo_configs', 'people_counter_config', 'people_counter_events',
  'ai_activity_log', 'user_plans', 'users', 'stores',
]);

// Tablas hijas sin store_id/user_id: se filtran por el id de su padre.
// { tabla: { fk: 'columna', parent: 'clave del set de ids padre' } }
const CHILD_MAP = {
  product_ingredients: { fk: 'product_id', parent: 'products' },
  product_extras: { fk: 'product_id', parent: 'products' },
  product_complement_groups: { fk: 'product_id', parent: 'products' },
  inventory: { fk: 'product_id', parent: 'products' },
  combo_items: { fk: 'combo_id', parent: 'combos' },
  order_items: { fk: 'order_id', parent: 'orders' },
  inventory_section_items: { fk: 'section_id', parent: 'inventory_sections' },
  product_recipes: { fk: 'item_id', parent: 'items' }, // productos+ingredientes+extras
};

async function getColumns(table) {
  const [rows] = await pool.execute(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [DB_NAME, table]
  );
  return rows.map(r => r.COLUMN_NAME || r.column_name);
}

async function getBaseTables() {
  const [rows] = await pool.execute(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
    [DB_NAME]
  );
  return rows.map(r => r.TABLE_NAME || r.table_name);
}

function collectImages(rows, imageSet) {
  for (const row of rows) {
    for (const v of Object.values(row)) {
      if (typeof v === 'string' && v.startsWith('/uploads/')) imageSet.add(v);
    }
  }
}

// ─────────────────────────── EXPORT (servidor nube) ──────────────────────────
export async function exportUserData(userId) {
  const tables = {};
  const imageSet = new Set();
  const parentIds = { products: new Set(), combos: new Set(), orders: new Set(), inventory_sections: new Set(), items: new Set() };

  // 1) Usuario, tiendas, plan
  const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
  if (!userRows.length) throw new Error('Usuario no encontrado');
  const user = userRows[0];
  collectImages([user], imageSet);

  const [stores] = await pool.execute('SELECT * FROM stores WHERE user_id = ?', [userId]);
  const storeIds = stores.map(s => s.id);
  tables.stores = stores;
  collectImages(stores, imageSet);

  const [userPlans] = await pool.execute('SELECT * FROM user_plans WHERE user_id = ?', [userId]);
  tables.user_plans = userPlans;
  const planIds = [...new Set(userPlans.map(p => p.plan_id).filter(Boolean))];
  if (planIds.length) {
    const [plans] = await pool.execute(
      `SELECT * FROM plans WHERE id IN (${planIds.map(() => '?').join(',')})`, planIds
    );
    tables.plans = plans;
  }

  const allTables = await getBaseTables();

  // 2) Pass 1: tablas con store_id / user_id
  for (const t of allTables) {
    if (SKIP.has(t) || CHILD_MAP[t]) continue;
    const cols = await getColumns(t);
    let rows = null;
    if (cols.includes('store_id') && storeIds.length) {
      const [r] = await pool.execute(
        `SELECT * FROM \`${t}\` WHERE store_id IN (${storeIds.map(() => '?').join(',')})`, storeIds
      );
      rows = r;
    } else if (cols.includes('user_id')) {
      const [r] = await pool.execute(`SELECT * FROM \`${t}\` WHERE user_id = ?`, [userId]);
      rows = r;
    }
    if (rows) {
      tables[t] = rows;
      collectImages(rows, imageSet);
      if (t === 'products') rows.forEach(x => { parentIds.products.add(x.id); parentIds.items.add(x.id); });
      if (t === 'ingredients' || t === 'extras') rows.forEach(x => parentIds.items.add(x.id));
      if (t === 'combos') rows.forEach(x => parentIds.combos.add(x.id));
      if (t === 'orders') rows.forEach(x => parentIds.orders.add(x.id));
      if (t === 'inventory_sections') rows.forEach(x => parentIds.inventory_sections.add(x.id));
    }
  }

  // 3) Pass 2: tablas hijas por id de padre
  for (const [t, { fk, parent }] of Object.entries(CHILD_MAP)) {
    if (!allTables.includes(t)) continue;
    const ids = [...parentIds[parent]];
    if (!ids.length) { tables[t] = []; continue; }
    const [r] = await pool.execute(
      `SELECT * FROM \`${t}\` WHERE ${fk} IN (${ids.map(() => '?').join(',')})`, ids
    );
    tables[t] = r;
    collectImages(r, imageSet);
  }

  return { user, plan: tables.plans?.[0] || null, tables, images: [...imageSet] };
}

// ─────────────────────────── IMPORT (servidor local) ─────────────────────────
// Convierte valores que vienen del JSON (fechas ISO, objetos JSON) a algo que
// MySQL/MariaDB acepta en un INSERT.
function sanitizeValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
  if (Buffer.isBuffer(v)) return v; // columnas binarias
  if (typeof v === 'object') return JSON.stringify(v); // columnas JSON
  if (typeof v === 'string') {
    // Fecha ISO 2024-01-01T00:00:00.000Z → 2024-01-01 00:00:00
    const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (m) return `${m[1]} ${m[2]}`;
  }
  return v;
}

async function replaceTable(conn, table, rows) {
  await conn.query(`DELETE FROM \`${table}\``);
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `\`${c}\``).join(',');
  const placeholders = `(${cols.map(() => '?').join(',')})`;
  // Inserta por lotes para no exceder límites de paquete
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    for (const row of chunk) {
      values.push(placeholders);
      for (const c of cols) params.push(sanitizeValue(row[c]));
    }
    await conn.query(`INSERT INTO \`${table}\` (${colList}) VALUES ${values.join(',')}`, params);
  }
}

export async function importUserData(dump) {
  if (!dump || !dump.user) throw new Error('Dump inválido');
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Usuario (fila propia) — preserva hash de contraseña para login offline
    await replaceTable(conn, 'users', [dump.user]);

    // Resto de tablas del dump
    for (const [table, rows] of Object.entries(dump.tables || {})) {
      try {
        await replaceTable(conn, table, rows);
      } catch (e) {
        console.warn(`[offline-import] Tabla ${table}: ${e.message}`);
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    return { imported: Object.keys(dump.tables || {}).length + 1 };
  } finally {
    conn.release();
  }
}
