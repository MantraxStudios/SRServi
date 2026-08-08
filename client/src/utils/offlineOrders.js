// Cola de pedidos OFFLINE del tótem.
//
// Cuando el servidor se cae, las ventas en EFECTIVO se guardan aquí (IndexedDB)
// con un identificador único (client_uid). Al volver la conexión se envían a
// `POST /api/orders` incluyendo ese uid; el servidor es idempotente, así que
// reintentar no crea duplicados.
//
// Se usa IndexedDB (no localStorage) porque sobrevive reinicios del WebView,
// no tiene el límite de ~5MB y no bloquea el hilo principal.

const DB_NAME = 'srservi-offline';
const DB_VERSION = 1;
const STORE = 'pending_orders';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'client_uid' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

// UUID robusto (crypto.randomUUID no existe en WebViews viejos).
export function newClientUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (_) { /* fallback */ }
  }
  return 'off-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Guarda un pedido pendiente. `payload` es el body exacto de POST /api/orders.
export async function queueOrder(payload) {
  const client_uid = payload.client_uid || newClientUid();
  const record = { client_uid, payload: { ...payload, client_uid }, created_at: Date.now() };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const r = store.put(record);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  db.close();
  return record;
}

export async function getPendingOrders() {
  let db;
  try { db = await openDb(); } catch (_) { return []; }
  const list = await new Promise((resolve) => {
    const store = tx(db, 'readonly');
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => resolve([]);
  });
  db.close();
  return list.sort((a, b) => a.created_at - b.created_at);
}

export async function countPending() {
  try {
    return (await getPendingOrders()).length;
  } catch (_) { return 0; }
}

export async function removePendingOrder(client_uid) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const r = store.delete(client_uid);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  db.close();
}

// Envía los pedidos pendientes al servidor, de a uno (secuencial → evita
// carreras de idempotencia). Devuelve cuántos se sincronizaron.
// `apiBase` es el prefijo de la API (p.ej. '' o 'https://...').
let flushing = false;
export async function flushPendingOrders(apiBase = '') {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    const pending = await getPendingOrders();
    for (const rec of pending) {
      try {
        const res = await fetch(apiBase + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec.payload)
        });
        if (res.ok) {
          await removePendingOrder(rec.client_uid);
          synced++;
        } else if (res.status >= 400 && res.status < 500) {
          // Error permanente (datos inválidos): descartar para no atascar la cola.
          await removePendingOrder(rec.client_uid);
        } else {
          // 5xx / servidor todavía caído: dejar en cola y reintentar luego.
          break;
        }
      } catch (_) {
        // Sin red aún: cortar y reintentar en el próximo flush.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}
