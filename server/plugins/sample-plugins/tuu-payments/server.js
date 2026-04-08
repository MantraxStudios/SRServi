import crypto from 'crypto';

const TUU_API = 'https://integrations.payment.haulmer.com/RemotePayment/v2';
let ctx = null;
let activePolls = new Map();

// ---- DB helpers (uses plugin's own tables) ----

async function ensureTables() {
  await ctx.db.execute(`
    CREATE TABLE IF NOT EXISTS tuu_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      api_key VARCHAR(500) NOT NULL,
      dte_type INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await ctx.db.execute(`
    CREATE TABLE IF NOT EXISTS tuu_devices (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      serial VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await ctx.db.execute(`
    CREATE TABLE IF NOT EXISTS tuu_device_pos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      device_uid VARCHAR(100) NOT NULL,
      tuu_device_id INT NOT NULL,
      store_id INT NOT NULL,
      UNIQUE KEY unique_uid_store (device_uid, store_id),
      FOREIGN KEY (tuu_device_id) REFERENCES tuu_devices(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await ctx.db.execute(`
    CREATE TABLE IF NOT EXISTS tuu_transactions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      order_id INT DEFAULT NULL,
      idempotency_key VARCHAR(100) NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      transaction_ref VARCHAR(255) DEFAULT NULL,
      device_serial VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function getUserIdFromStore(storeId) {
  const [rows] = await ctx.db.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
  return rows[0]?.user_id || null;
}

async function getConfig(userId) {
  const [rows] = await ctx.db.execute('SELECT * FROM tuu_config WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function getDeviceForUid(deviceUid, storeId) {
  if (!deviceUid) return null;
  const [rows] = await ctx.db.execute(
    `SELECT d.* FROM tuu_devices d
     JOIN tuu_device_pos dp ON d.id = dp.tuu_device_id
     WHERE dp.device_uid = ? AND dp.store_id = ?`, [deviceUid, storeId]
  );
  return rows[0] || null;
}

async function getAnyDeviceForStore(storeId) {
  const userId = await getUserIdFromStore(storeId);
  const [rows] = await ctx.db.execute('SELECT * FROM tuu_devices WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

// ---- Tuu API ----

async function createPayment(apiKey, amount, deviceSerial, description, dteType) {
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch(`${TUU_API}/Create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      Amount: Math.round(amount),
      Device: deviceSerial,
      IdempotencyKey: idempotencyKey,
      Description: description || 'Pago SRServi',
      DteType: dteType || 0,
      extraData: { sourceName: 'SRServi', sourceVersion: '1.1.0' }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
  return { ...data, idempotencyKey: data.idempotencyKey || idempotencyKey };
}

async function checkStatus(apiKey, idempotencyKey) {
  const response = await fetch(`${TUU_API}/GetPaymentRequest/${idempotencyKey}`, {
    headers: { 'X-API-Key': apiKey }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Error ${response.status}`);
  }
  return response.json();
}

function startPolling(apiKey, idempotencyKey, storeId, orderId) {
  let attempts = 0;
  const intervalId = setInterval(async () => {
    attempts++;
    try {
      const data = await checkStatus(apiKey, idempotencyKey);
      ctx.logger.log(`Poll #${attempts} ${idempotencyKey}: ${data.status}`);

      if (data.status === 'Completed') {
        clearInterval(intervalId);
        activePolls.delete(idempotencyKey);
        await ctx.db.execute(
          'UPDATE tuu_transactions SET status = ?, transaction_ref = ?, updated_at = NOW() WHERE idempotency_key = ?',
          ['Completed', data.transactionReference || null, idempotencyKey]
        );
        if (orderId) {
          await ctx.db.execute("UPDATE orders SET status = 'paid', payment_process = 1 WHERE id = ?", [orderId]).catch(() => {});
        }
        emitToStore(storeId, 'tuu_payment_update', { idempotencyKey, orderId, status: 'Completed', transactionRef: data.transactionReference });
      } else if (data.status === 'Canceled' || data.status === 'Failed') {
        clearInterval(intervalId);
        activePolls.delete(idempotencyKey);
        await ctx.db.execute(
          'UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?',
          [data.status, idempotencyKey]
        );
        if (orderId) {
          await ctx.db.execute("UPDATE orders SET status = 'canceled' WHERE id = ?", [orderId]).catch(() => {});
        }
        emitToStore(storeId, 'tuu_payment_update', { idempotencyKey, orderId, status: data.status });
      }
    } catch (err) {
      ctx.logger.error(`Poll error: ${err.message}`);
    }
    if (attempts >= 60) { // 5 min
      clearInterval(intervalId);
      activePolls.delete(idempotencyKey);
      await ctx.db.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Timeout', idempotencyKey]);
      emitToStore(storeId, 'tuu_payment_update', { idempotencyKey, orderId, status: 'Timeout' });
    }
  }, 5000);
  activePolls.set(idempotencyKey, intervalId);
}

function emitToStore(storeId, event, data) {
  if (!ctx.io) return;
  ctx.io.emit(event, data); // broadcast, store client filters by orderId
}

// ---- INIT ----

export async function init(context) {
  ctx = context;
  await ensureTables();

  // --- Config routes (API Key, DTE) ---
  ctx.router.get('/config', async (req, res) => {
    try {
      const storeId = parseInt(req.query.store_id);
      const userId = await getUserIdFromStore(storeId);
      const config = await getConfig(userId);
      res.json(config ? { api_key: config.api_key, dte_type: config.dte_type } : { api_key: '', dte_type: 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  ctx.router.post('/config', async (req, res) => {
    try {
      const { store_id, api_key, dte_type } = req.body;
      const userId = await getUserIdFromStore(parseInt(store_id));
      await ctx.db.execute(
        'INSERT INTO tuu_config (user_id, api_key, dte_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE api_key = ?, dte_type = ?',
        [userId, api_key, dte_type || 0, api_key, dte_type || 0]
      );
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // --- Device routes ---
  // List POS devices + registered store devices (tablets etc)
  ctx.router.get('/devices', async (req, res) => {
    try {
      const storeId = parseInt(req.query.store_id);
      const userId = await getUserIdFromStore(storeId);
      const [posDevices] = await ctx.db.execute('SELECT * FROM tuu_devices WHERE user_id = ? ORDER BY name', [userId]);

      // Get registered store devices (tablets/phones)
      let storeDevices = [];
      try {
        const [rows] = await ctx.db.execute('SELECT * FROM store_devices WHERE store_id = ? ORDER BY last_seen DESC', [storeId]);
        storeDevices = rows;
      } catch { /* table might not exist */ }

      // Get assignments
      let assignments = [];
      try {
        const [rows] = await ctx.db.execute('SELECT * FROM tuu_device_pos WHERE store_id = ?', [storeId]);
        assignments = rows;
      } catch { /* table might not exist */ }

      res.json({ posDevices, storeDevices, assignments });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  ctx.router.post('/devices', async (req, res) => {
    try {
      const { store_id, name, serial } = req.body;
      if (!name || !serial) return res.status(400).json({ error: 'Nombre y serial requeridos' });
      const userId = await getUserIdFromStore(parseInt(store_id));
      const [result] = await ctx.db.execute(
        'INSERT INTO tuu_devices (user_id, name, serial) VALUES (?, ?, ?)',
        [userId, name, serial]
      );
      res.json({ id: result.insertId, name, serial });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  ctx.router.delete('/devices/:id', async (req, res) => {
    try {
      await ctx.db.execute('DELETE FROM tuu_device_pos WHERE tuu_device_id = ?', [req.params.id]);
      await ctx.db.execute('DELETE FROM tuu_devices WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Assign a POS to a specific device_uid for this store
  ctx.router.post('/devices/assign', async (req, res) => {
    try {
      const { store_id, device_uid, tuu_device_id } = req.body;
      if (!device_uid || !tuu_device_id) return res.status(400).json({ error: 'device_uid y tuu_device_id requeridos' });
      await ctx.db.execute(
        'INSERT INTO tuu_device_pos (device_uid, tuu_device_id, store_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tuu_device_id = ?',
        [device_uid, parseInt(tuu_device_id), parseInt(store_id), parseInt(tuu_device_id)]
      );
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // --- Check if Tuu is available for a store (public) ---
  ctx.router.get('/available', async (req, res) => {
    try {
      const storeId = parseInt(req.query.store_id);
      const deviceUid = req.query.device_uid;
      const userId = await getUserIdFromStore(storeId);
      const config = await getConfig(userId);
      if (!config?.api_key) return res.json({ available: false });
      // Check if this device has a POS assigned, or fallback to any POS
      const device = deviceUid ? await getDeviceForUid(deviceUid, storeId) : await getAnyDeviceForStore(storeId);
      res.json({ available: !!device?.serial, deviceName: device?.name || null });
    } catch (e) { res.json({ available: false }); }
  });

  // --- Payment (called from store checkout) ---
  ctx.router.post('/pay', async (req, res) => {
    try {
      const { store_id, order_id, amount, description } = req.body;
      if (!store_id || !amount) return res.status(400).json({ error: 'store_id y amount requeridos' });

      const userId = await getUserIdFromStore(parseInt(store_id));
      const config = await getConfig(userId);
      if (!config?.api_key) return res.status(400).json({ error: 'API Key de Tuu no configurada' });

      const device = await getDeviceForStore(parseInt(store_id));
      if (!device) return res.status(400).json({ error: 'No hay POS asignado a esta tienda' });

      const payment = await createPayment(config.api_key, amount, device.serial, description, config.dte_type);

      await ctx.db.execute(
        'INSERT INTO tuu_transactions (store_id, order_id, idempotency_key, amount, status, device_serial) VALUES (?, ?, ?, ?, ?, ?)',
        [parseInt(store_id), order_id || null, payment.idempotencyKey, Math.round(amount), 'Pending', device.serial]
      );

      startPolling(config.api_key, payment.idempotencyKey, parseInt(store_id), order_id);

      res.json({ success: true, idempotencyKey: payment.idempotencyKey, status: payment.status, deviceName: device.name });
    } catch (e) {
      ctx.logger.error('Pay error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Status check ---
  ctx.router.get('/status/:key', async (req, res) => {
    try {
      const [rows] = await ctx.db.execute(
        'SELECT * FROM tuu_transactions WHERE idempotency_key = ?', [req.params.key]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
      res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // --- Cancel ---
  ctx.router.post('/cancel/:key', async (req, res) => {
    const intervalId = activePolls.get(req.params.key);
    if (intervalId) { clearInterval(intervalId); activePolls.delete(req.params.key); }
    await ctx.db.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Canceled', req.params.key]);
    res.json({ success: true });
  });

  // --- Transaction history ---
  ctx.router.get('/transactions', async (req, res) => {
    try {
      const storeId = parseInt(req.query.store_id);
      const [rows] = await ctx.db.execute(
        'SELECT * FROM tuu_transactions WHERE store_id = ? ORDER BY created_at DESC LIMIT 50', [storeId]
      );
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // --- Test connection ---
  ctx.router.get('/test', async (req, res) => {
    try {
      const storeId = parseInt(req.query.store_id);
      const userId = await getUserIdFromStore(storeId);
      const config = await getConfig(userId);
      if (!config?.api_key) return res.json({ success: false, error: 'API Key no configurada' });

      const response = await fetch(`${TUU_API}/GetPaymentRequest/test-check`, {
        headers: { 'X-API-Key': config.api_key }
      });
      if (response.status === 401) return res.json({ success: false, error: 'API Key inválida' });

      const device = await getDeviceForStore(storeId);
      res.json({ success: true, device: device?.name || 'Sin POS asignado' });
    } catch (e) { res.json({ success: false, error: e.message }); }
  });

  // --- Register as payment provider ---
  ctx.hooks.registerPaymentProvider({
    name: 'Tuu POS',

    isAvailable: async (storeId) => {
      const userId = await getUserIdFromStore(storeId);
      const config = await getConfig(userId);
      if (!config?.api_key) return false;
      // Has at least one POS device
      const [devs] = await ctx.db.execute('SELECT id FROM tuu_devices WHERE user_id = ? LIMIT 1', [userId]);
      return devs.length > 0;
    },

    charge: async (storeId, amount, orderId, description, deviceUid) => {
      const userId = await getUserIdFromStore(storeId);
      const config = await getConfig(userId);
      if (!config?.api_key) throw new Error('API Key de Tuu no configurada');

      // Find POS: first try assigned to this device_uid, then fallback to any
      let device = deviceUid ? await getDeviceForUid(deviceUid, storeId) : null;
      if (!device) device = await getAnyDeviceForStore(storeId);
      if (!device) throw new Error('No hay POS asignado. Configura un POS en Tuu POS del admin.');

      const payment = await createPayment(config.api_key, amount, device.serial, description, config.dte_type);

      await ctx.db.execute(
        'INSERT INTO tuu_transactions (store_id, order_id, idempotency_key, amount, status, device_serial) VALUES (?, ?, ?, ?, ?, ?)',
        [storeId, orderId || null, payment.idempotencyKey, Math.round(amount), 'Pending', device.serial]
      );

      startPolling(config.api_key, payment.idempotencyKey, storeId, orderId);

      return { success: true, paymentKey: payment.idempotencyKey, deviceName: device.name };
    },

    status: async (paymentKey) => {
      const [rows] = await ctx.db.execute(
        'SELECT * FROM tuu_transactions WHERE idempotency_key = ?', [paymentKey]
      );
      return rows[0] || null;
    },

    cancel: async (paymentKey) => {
      const intervalId = activePolls.get(paymentKey);
      if (intervalId) { clearInterval(intervalId); activePolls.delete(paymentKey); }
      await ctx.db.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Canceled', paymentKey]);
      return { success: true };
    }
  });

  ctx.logger.log('Tuu Payments v1.1 initialized');
}

export function destroy() {
  for (const [, id] of activePolls) clearInterval(id);
  activePolls.clear();
  ctx = null;
}
