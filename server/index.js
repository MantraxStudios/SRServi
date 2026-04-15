import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import PluginManager from './plugins/PluginManager.js';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
import {
  initDatabase,
  createUser,
  authenticateUser,
  getUserByCode,
  getUserById,
  getStores,
  createStore,
  updateStore,
  deleteStore,
  getStoreById,
  getStoreByCode,
  verifyStoreOwnership,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getExtras,
  createExtra,
  updateExtra,
  deleteExtra,
  getStoreConfigurations,
  getStoreConfigurationById,
  createStoreConfiguration,
  updateStoreConfiguration,
  deleteStoreConfiguration,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponForStore,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getProductByBarcode,
  searchProducts,
  getPublicProducts,
  getInventory,
  updateInventory,
  setInventoryStock,
  updateProductsOrder,
  updateCategoriesOrder,
  createOrder,
  getOrders,
  updateUserSettings,
  createWorker,
  getWorkers,
  deleteWorker,
  authenticateWorker,
  getWorkerOrders,
  updateOrderStatus,
  approveCashPayment,
  processMercadoPagoPayment,
  confirmCardPayment,
  getMercadoPagoOrderStatus,
  cancelMercadoPagoOrder,
  createMercadoPagoTerminal,
  getMercadoPagoTerminals,
  getMercadoPagoTerminalsByStore,
  getMercadoPagoTerminalById,
  updateMercadoPagoTerminal,
  deleteMercadoPagoTerminal,
  authenticateSuperadmin,
  getAllUsers,
  updateUserBySuperadmin,
  deleteUserBySuperadmin,
  getAllStores,
  updateStoreBySuperadmin,
  deleteStoreBySuperadmin,
  createSuperadmin,
  getAllPlans,
  getAllSubscriptions,
  getSubscriptionHistory,
  getUserPlan,
  canUserCreateStore,
  assignPlanToUser,
  assignPremiumByAdmin,
  getPlanById,
  getAnalytics,
  getSalesByDay,
  getTopProducts,
  getOrdersByHour,
  getRecentOrders,
  getWorkerPaymentMethods,
  createWorkerPaymentMethod,
  updateWorkerPaymentMethod,
  deleteWorkerPaymentMethod,
  setStoreEditPin,
  verifyStoreEditPin,
  getStoreEditPin,
  pool
} from './database.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.SERVER_PORT || 8888;
const HOST = process.env.SERVER_HOST || '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET || 'srservi-secret-key-2024';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 10000 }
});

console.log('MercadoPago Token configured:', !!process.env.MP_ACCESS_TOKEN);

app.use(cors());
app.use(express.json());

const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('register_store', (storeId) => {
    userSockets.set(storeId, socket.id);
    socket.storeId = storeId;
    socket.join(`store_${storeId}`);
    console.log(`Socket ${socket.id} registrado para tienda ${storeId} (room: store_${storeId})`);
  });
  
  socket.on('disconnect', () => {
    if (socket.storeId) {
      userSockets.delete(socket.storeId);
    }
    console.log('Cliente desconectado:', socket.id);
  });
});

export const emitProductUpdate = (storeId, event, product) => {
  const socketId = userSockets.get(storeId);
  if (socketId) {
    io.to(socketId).emit(event, product);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, false);
    }
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    const mimetype = allowedMimes.includes(file.mimetype);
    const extname = allowedExts.includes(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp, gif)'));
  }
});

const apkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/apks';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const apkUpload = multer({ storage: apkStorage, limits: { fileSize: 500 * 1024 * 1024 } });

app.use('/uploads', express.static('uploads', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }
  }
}));
// Serve plugin static files with path traversal protection
app.use('/api/plugins/static', (req, res, next) => {
  // Block path traversal attempts
  if (req.path.includes('..') || req.path.includes('server.js') || req.path.includes('.env')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Only allow specific file extensions
  const allowed = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.woff', '.woff2', '.ttf', '.json'];
  const ext = path.extname(req.path).toLowerCase();
  if (ext && !allowed.includes(ext)) {
    return res.status(403).json({ error: 'File type not allowed' });
  }
  next();
}, express.static(path.join(__serverDir, 'plugins', 'installed')));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, business_name } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const user = await createUser(username, email, password, business_name);
    
    const storeName = business_name || username;
    const store = await createStore(user.id, {
      name: storeName,
      primary_color: '#000000',
      secondary_color: '#FFFFFF',
      accent_color: '#D4AF37',
      header_color: '#000000',
      currency_code: 'USD',
      currency_symbol: '$',
      currency_name: 'Dólar Estadounidense'
    });
    
    const token = jwt.sign({ id: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ user, token, store });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    const user = await authenticateUser(email, password);
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    if (user.is_banned) {
      return res.status(403).json({ 
        error: 'Tu cuenta ha sido suspendida. Contacta a soporte@srautomatic.com para la apelación. La revisión puede demorar entre 1 semana y 1 mes.' 
      });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lookup a code: returns whether it's a store code or a client (user) code.
// If it's a client code, returns the list of stores for that user so the
// customer can pick one without memorizing every store code.
app.get('/api/public/lookup/:code', async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    if (!code) return res.status(400).json({ error: 'Código requerido' });

    // First, try to match it against a store code (most common case)
    const store = await getStoreByCode(code);
    if (store) {
      if (store.is_banned) {
        return res.status(403).json({
          error: 'Esta tienda ha sido suspendida. Contacta a soporte@srautomatic.com para la apelación.'
        });
      }
      return res.json({ type: 'store', id: store.id, code: store.code, name: store.name });
    }

    // Otherwise, try to match it against a client (user) code
    const [userRows] = await pool.execute(
      'SELECT id, business_name, username, is_banned FROM users WHERE code = ?',
      [code]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Código no encontrado' });
    }
    const user = userRows[0];
    if (user.is_banned) {
      return res.status(403).json({
        error: 'Esta cuenta ha sido suspendida. Contacta a soporte@srautomatic.com para la apelación.'
      });
    }

    const stores = await getStores(user.id);
    const visibleStores = stores
      .filter(s => !s.is_banned)
      .map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        primary_color: s.primary_color || '#000000',
        secondary_color: s.secondary_color || '#FFFFFF',
        accent_color: s.accent_color || '#D4AF37',
        logo_url: s.logo_url || null
      }));

    if (visibleStores.length === 0) {
      return res.status(404).json({ error: 'Este cliente aún no tiene tiendas disponibles' });
    }

    return res.json({
      type: 'client',
      client: {
        name: user.business_name || user.username
      },
      stores: visibleStores
    });
  } catch (error) {
    console.error('❌ Error en /api/public/lookup:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const store = await getStoreByCode(code.toUpperCase());

    if (!store) {
      return res.status(404).json({ error: 'Código no encontrado' });
    }
    
    if (store.is_banned) {
      return res.status(403).json({ 
        error: 'Esta tienda ha sido suspendida. Contacta a soporte@srautomatic.com para la apelación. La revisión puede demorar entre 1 semana y 1 mes.' 
      });
    }
    
    const products = await getPublicProducts(store.id);
    const categories = await getCategories(store.id);

    // Smart mode: get top selling product IDs (last 30 days)
    let topSellingIds = [];
    try {
      const [topRows] = await pool.execute(
        `SELECT oi.product_id, SUM(oi.quantity) as total_sold
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.store_id = ? AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY oi.product_id
         ORDER BY total_sold DESC
         LIMIT 5`,
        [store.id]
      );
      topSellingIds = topRows.map(r => r.product_id);
    } catch { /* ignore if table doesn't exist */ }

    res.json({
      store: {
        id: store.id,
        code: store.code,
        name: store.name,
        primary_color: store.primary_color || '#000000',
        secondary_color: store.secondary_color || '#FFFFFF',
        accent_color: store.accent_color || '#D4AF37',
        header_color: store.header_color || '#000000',
        logo_url: store.logo_url || null,
        currency_code: store.currency_code || 'USD',
        currency_symbol: store.currency_symbol || '$',
        currency_name: store.currency_name || 'Dólar Estadounidense',
        smart_mode: store.smart_mode ?? true,
        inactivity_timeout: store.inactivity_timeout ?? 120,
        hide_decimals: store.hide_decimals ?? false,
        show_top_selling: store.show_top_selling ?? true
      },
      products,
      categories,
      top_selling: (store.smart_mode !== false && store.smart_mode !== 0) && (store.show_top_selling !== false && store.show_top_selling !== 0) ? topSellingIds : []
    });
  } catch (error) {
    console.error('❌ Error en /api/public:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/:code/mercado-pago-terminals', async (req, res) => {
  try {
    const { code } = req.params;
    const store = await getStoreByCode(code.toUpperCase());
    
    if (!store) {
      return res.status(404).json({ error: 'Código no encontrado' });
    }

    const terminals = await getMercadoPagoTerminalsByStore(store.id);
    res.json(terminals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/terminals/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const terminals = await getMercadoPagoTerminalsByStore(parseInt(storeId));
    res.json(terminals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/pos-devices/:storeCode', async (req, res) => {
  try {
    const { storeCode } = req.params;
    const store = await getStoreByCode((storeCode || '').toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

    let mpLinked = [];
    try {
      const [rows] = await pool.execute(
        `SELECT id, name, mercadopago_terminal_id, 'mercadopago' as provider
         FROM mercado_pago_terminals
         WHERE user_id = ?`,
        [store.user_id]
      );
      mpLinked = rows;
    } catch (e) { console.log('[pos-devices] MP query error:', e.message); }

    let tuuDevices = [];
    try {
      const [tuuRows] = await pool.execute(
        `SELECT id, name, serial, 'tuu' as provider
         FROM tuu_devices
         WHERE user_id = ?`,
        [store.user_id]
      );
      tuuDevices = tuuRows;
    } catch (e) { console.log('[pos-devices] Tuu query error:', e.message); }

    console.log('[pos-devices] storeCode:', storeCode, 'store.id:', store.id, 'user_id:', store.user_id, 'mpLinked:', mpLinked.length, 'tuuDevices:', tuuDevices.length);

    const mpFormatted = mpLinked.map(t => ({ id: t.id, name: t.name, device_id: t.mercadopago_terminal_id, provider: 'mercadopago' }));
    const tuuFormatted = tuuDevices.map(d => ({ id: d.id, name: d.name, serial: d.serial, provider: 'tuu' }));

    res.json([...mpFormatted, ...tuuFormatted]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stores/code/:code', authenticateToken, async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    const store = await getStoreByCode(code);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/public/:code/coupons/validate', async (req, res) => {
  try {
    const { code } = req.params;
    const { coupon_code, subtotal } = req.body;
    const store = await getStoreByCode(code.toUpperCase());

    if (!store) {
      return res.status(404).json({ error: 'Código no encontrado' });
    }

    const result = await validateCouponForStore(store.id, coupon_code, Number(subtotal) || 0);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Ensure support_pin exists
    if (!user.support_pin) {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      try {
        await pool.execute('SHOW COLUMNS FROM users LIKE ?', ['support_pin']).then(async ([cols]) => {
          if (cols.length === 0) await pool.execute('ALTER TABLE users ADD COLUMN support_pin VARCHAR(6) DEFAULT NULL');
        });
        await pool.execute('UPDATE users SET support_pin = ? WHERE id = ?', [pin, req.user.id]);
        user.support_pin = pin;
      } catch {}
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const { primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = req.body;
     
    const user = await updateUserSettings(req.user.id, {
      primary_color,
      secondary_color,
      accent_color,
      header_color,
      currency_code,
      currency_symbol,
      currency_name
    });
     
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
 });

app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const stores = await getStores(req.user.id);
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching store:', id);
    const stores = await getStores(req.user.id);
    console.log('Stores found:', stores.length);
    const store = stores.find(s => s.id === parseInt(id));
    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }
    res.json(store);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stores', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const store = await createStore(req.user.id, { 
      name, 
      primary_color, 
      secondary_color, 
      accent_color, 
      header_color, 
      currency_code, 
      currency_symbol, 
      currency_name,
      logo_url
    });
    res.json(store);
  } catch (error) {
    if (error.code === 'STORE_LIMIT_REACHED') {
      return res.status(403).json({ 
        error: error.message,
        code: 'STORE_LIMIT_REACHED',
        maxStores: error.maxStores,
        currentPlan: error.currentPlan
      });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stores/:id', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, remove_logo, worker_accept_cash, worker_accept_card, smart_mode, inactivity_timeout, hide_decimals, show_top_selling } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    let logo_url;
    if (remove_logo === 'true') {
      logo_url = null;
    } else if (req.file) {
      logo_url = `/uploads/${req.file.filename}`;
    }
    const store = await updateStore(req.params.id, req.user.id, {
      name,
      primary_color,
      secondary_color,
      accent_color,
      header_color,
      currency_code,
      currency_symbol,
      currency_name,
      logo_url,
      worker_accept_cash,
      worker_accept_card,
      smart_mode,
      inactivity_timeout,
      hide_decimals,
      show_top_selling
    });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    await deleteStore(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store Edit PIN endpoints
app.put('/api/stores/:id/edit-pin', authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const storeId = parseInt(req.params.id);
    const isOwner = await verifyStoreOwnership(storeId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    await setStoreEditPin(storeId, req.user.id, pin);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stores/:id/edit-pin', authenticateToken, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    const isOwner = await verifyStoreOwnership(storeId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const pin = await getStoreEditPin(storeId);
    res.json({ pin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/public/:code/verify-edit-pin', async (req, res) => {
  try {
    const { code } = req.params;
    const { pin } = req.body;
    const store = await getStoreByCode(code.toUpperCase());
    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }
    const valid = await verifyStoreEditPin(store.id, pin);
    res.json({ valid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/public/:code/products/order', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    if (!req.body.products) return res.status(400).json({ error: 'products es requerido' });
    await updateProductsOrder(auth.store.id, req.body.products);
    emitProductUpdate(auth.store.id, 'products_reordered', { products: req.body.products });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/public/:code/categories/order', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    if (!req.body.categories) return res.status(400).json({ error: 'categories es requerido' });
    await updateCategoriesOrder(auth.store.id, req.body.categories);
    io.to(`store_${auth.store.id}`).emit('category_updated');
    io.emit('category_updated');
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ---- Store Devices (unique device IDs) ----

// Register/update a device (called by store on load)
app.post('/api/public/:code/register-device', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const { device_uid } = req.body;
    if (!device_uid) return res.status(400).json({ error: 'device_uid requerido' });
    await pool.execute(
      `INSERT INTO store_devices (device_uid, store_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_seen = NOW()`,
      [device_uid, store.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List devices for a store (admin)
app.get('/api/store-devices', authenticateToken, async (req, res) => {
  try {
    const storeId = parseInt(req.query.store_id);
    if (!storeId) return res.json([]);
    const isOwner = await verifyStoreOwnership(storeId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso' });
    const [rows] = await pool.execute(
      'SELECT * FROM store_devices WHERE store_id = ? ORDER BY last_seen DESC', [storeId]
    );
    res.json(rows);
  } catch (error) {
    if (error.message?.includes("doesn't exist")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// Update device (label, config, restart time)
app.put('/api/store-devices/:id', authenticateToken, async (req, res) => {
  try {
    const { label, config_id, restart_time } = req.body;
    // Add columns if missing
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM store_devices');
      const names = cols.map(c => c.Field);
      if (!names.includes('config_id')) await pool.execute('ALTER TABLE store_devices ADD COLUMN config_id INT DEFAULT NULL');
      if (!names.includes('restart_time')) await pool.execute('ALTER TABLE store_devices ADD COLUMN restart_time VARCHAR(10) DEFAULT NULL');
      if (!names.includes('pending_restart')) await pool.execute('ALTER TABLE store_devices ADD COLUMN pending_restart BOOLEAN DEFAULT FALSE');
    } catch { /* ignore */ }

    const fields = [];
    const values = [];
    if (label !== undefined) { fields.push('label = ?'); values.push(label || null); }
    if (config_id !== undefined) { fields.push('config_id = ?'); values.push(config_id || null); }
    if (restart_time !== undefined) { fields.push('restart_time = ?'); values.push(restart_time || null); }
    if (fields.length === 0) return res.json({ success: true });

    // Mark pending_restart when config changes
    if (config_id !== undefined || restart_time !== undefined) {
      fields.push('pending_restart = TRUE');
    }

    values.push(parseInt(req.params.id));
    await pool.execute(`UPDATE store_devices SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy label endpoint
app.put('/api/store-devices/:id/label', authenticateToken, async (req, res) => {
  try {
    const { label } = req.body;
    await pool.execute('UPDATE store_devices SET label = ? WHERE id = ?', [label || null, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: get device config (called by Store on load)
app.get('/api/public/device-config/:deviceUid/:storeId', async (req, res) => {
  try {
    // Add columns if missing
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM store_devices');
      const names = cols.map(c => c.Field);
      if (!names.includes('config_id')) await pool.execute('ALTER TABLE store_devices ADD COLUMN config_id INT DEFAULT NULL');
      if (!names.includes('restart_time')) await pool.execute('ALTER TABLE store_devices ADD COLUMN restart_time VARCHAR(10) DEFAULT NULL');
      if (!names.includes('pending_restart')) await pool.execute('ALTER TABLE store_devices ADD COLUMN pending_restart BOOLEAN DEFAULT FALSE');
    } catch { /* ignore */ }

    const [rows] = await pool.execute(
      'SELECT config_id, restart_time, pending_restart FROM store_devices WHERE device_uid = ? AND store_id = ?',
      [req.params.deviceUid, parseInt(req.params.storeId)]
    );
    if (rows.length === 0) return res.json({ config_id: null, restart_time: null, pending_restart: false });

    // Clear pending restart flag after reading
    if (rows[0].pending_restart) {
      await pool.execute(
        'UPDATE store_devices SET pending_restart = FALSE WHERE device_uid = ? AND store_id = ?',
        [req.params.deviceUid, parseInt(req.params.storeId)]
      );
    }

    res.json(rows[0]);
  } catch (error) {
    res.json({ config_id: null, restart_time: null, pending_restart: false });
  }
});

// Validate admin token for store editor
app.post('/api/public/:code/validate-admin', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ valid: false });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.json({ valid: false });
    if (store.user_id !== decoded.id) return res.json({ valid: false });
    res.json({ valid: true });
  } catch {
    res.json({ valid: false });
  }
});

// Public extras/ingredients CRUD with admin token
app.get('/api/public/:code/extras', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const [rows] = await pool.execute(
      `SELECT e.*, c.name as category_name FROM extras e LEFT JOIN categories c ON e.category_id = c.id WHERE e.store_id = ? ORDER BY e.name`,
      [store.id]
    );
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/public/:code/ingredients', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const [rows] = await pool.execute(
      `SELECT i.*, c.name as category_name FROM ingredients i LEFT JOIN categories c ON i.category_id = c.id WHERE i.store_id = ? ORDER BY i.name`,
      [store.id]
    );
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/public/:code/extras', upload.single('image'), async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const catId = req.body.category_id && req.body.category_id !== '' && req.body.category_id !== 'null' ? parseInt(req.body.category_id) : null;
    const [result] = await pool.execute(
      'INSERT INTO extras (store_id, user_id, name, price, category_id, image) VALUES (?, ?, ?, ?, ?, ?)',
      [store.id, store.user_id, req.body.name, parseFloat(req.body.price) || 0, catId, image]
    );
    try {
      await pool.execute('UPDATE extras SET stock = ?, unlimited_stock = ? WHERE id = ?',
        [parseInt(req.body.stock) || 0, req.body.unlimited_stock === 'true' ? 1 : 0, result.insertId]);
    } catch { /* stock columns may not exist yet */ }
    emitProductUpdate(store.id, 'extra_created', { id: result.insertId });
    res.json({ id: result.insertId, name: req.body.name });
  } catch (error) { console.error('Error creating extra:', error); res.status(500).json({ error: error.message }); }
});

app.post('/api/public/:code/ingredients', upload.single('image'), async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const catId = req.body.category_id && req.body.category_id !== '' && req.body.category_id !== 'null' ? parseInt(req.body.category_id) : null;
    const [result] = await pool.execute(
      'INSERT INTO ingredients (store_id, user_id, name, price, category_id, image) VALUES (?, ?, ?, ?, ?, ?)',
      [store.id, store.user_id, req.body.name, parseFloat(req.body.price) || 0, catId, image]
    );
    try {
      await pool.execute('UPDATE ingredients SET stock = ?, unlimited_stock = ? WHERE id = ?',
        [parseInt(req.body.stock) || 0, req.body.unlimited_stock === 'true' ? 1 : 0, result.insertId]);
    } catch { /* stock columns may not exist yet */ }
    emitProductUpdate(store.id, 'ingredient_created', { id: result.insertId });
    res.json({ id: result.insertId, name: req.body.name });
  } catch (error) { console.error('Error creating ingredient:', error); res.status(500).json({ error: error.message }); }
});

app.put('/api/public/:code/extras/:id', upload.single('image'), async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    const catId = req.body.category_id && req.body.category_id !== '' && req.body.category_id !== 'null' ? parseInt(req.body.category_id) : null;
    let imageUpdate = '';
    let params = [req.body.name, parseFloat(req.body.price) || 0, catId];
    if (req.file) {
      imageUpdate = ', image = ?';
      params.push(`/uploads/${req.file.filename}`);
    }
    params.push(parseInt(req.params.id), store.id);
    await pool.execute(`UPDATE extras SET name = ?, price = ?, category_id = ?${imageUpdate} WHERE id = ? AND store_id = ?`, params);
    emitProductUpdate(store.id, 'extra_updated', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { console.error('Error updating extra:', error); res.status(500).json({ error: error.message }); }
});

app.put('/api/public/:code/ingredients/:id', upload.single('image'), async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    const catId = req.body.category_id && req.body.category_id !== '' && req.body.category_id !== 'null' ? parseInt(req.body.category_id) : null;
    let imageUpdate = '';
    let params = [req.body.name, parseFloat(req.body.price) || 0, catId];
    if (req.file) {
      imageUpdate = ', image = ?';
      params.push(`/uploads/${req.file.filename}`);
    }
    params.push(parseInt(req.params.id), store.id);
    await pool.execute(`UPDATE ingredients SET name = ?, price = ?, category_id = ?${imageUpdate} WHERE id = ? AND store_id = ?`, params);
    emitProductUpdate(store.id, 'ingredient_updated', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { console.error('Error updating ingredient:', error); res.status(500).json({ error: error.message }); }
});

app.delete('/api/public/:code/extras/:id', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    await pool.execute('DELETE FROM extras WHERE id = ? AND store_id = ?', [parseInt(req.params.id), store.id]);
    emitProductUpdate(store.id, 'extra_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/public/:code/ingredients/:id', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    await pool.execute('DELETE FROM ingredients WHERE id = ? AND store_id = ?', [parseInt(req.params.id), store.id]);
    emitProductUpdate(store.id, 'ingredient_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Store custom styles (premium)
app.get('/api/public/:code/styles', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    try {
      const [rows] = await pool.execute('SELECT visual_settings, custom_css FROM store_styles WHERE store_id = ?', [store.id]);
      if (rows.length > 0) {
        return res.json({ visual_settings: rows[0].visual_settings || '{}', custom_css: rows[0].custom_css || '' });
      }
    } catch { /* table may not exist */ }
    res.json({ visual_settings: '{}', custom_css: '' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/public/:code/styles', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    // Ensure table
    await pool.execute(`CREATE TABLE IF NOT EXISTS store_styles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT UNIQUE NOT NULL,
      visual_settings JSON,
      custom_css TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`);

    const { visual_settings, custom_css } = req.body;
    await pool.execute(
      `INSERT INTO store_styles (store_id, visual_settings, custom_css) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE visual_settings = VALUES(visual_settings), custom_css = VALUES(custom_css)`,
      [auth.store.id, JSON.stringify(visual_settings || {}), custom_css || '']
    );
    res.json({ success: true });
  } catch (error) { console.error('Error saving styles:', error); res.status(500).json({ error: error.message }); }
});

// Update product stock from editor
app.put('/api/public/:code/products/:id/stock', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET || 'your-secret-key');
    if (store.user_id !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
    const productId = parseInt(req.params.id);
    const { stock, unlimited_stock } = req.body;
    await pool.execute(
      'INSERT INTO inventory (product_id, stock, unlimited_stock) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE stock = ?, unlimited_stock = ?',
      [productId, parseInt(stock) || 0, unlimited_stock ? 1 : 0, parseInt(stock) || 0, unlimited_stock ? 1 : 0]
    );
    emitProductUpdate(store.id, 'inventory_updated', { product_id: productId, stock: parseInt(stock) || 0, unlimited_stock: !!unlimited_stock });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Helper: verify PIN or admin token for public store routes
async function verifyStoreAccess(code, body) {
  const store = await getStoreByCode(code.toUpperCase());
  if (!store) return { error: 'Tienda no encontrada', status: 404 };

  // Try admin token first
  if (body.token) {
    try {
      const decoded = jwt.verify(body.token, process.env.JWT_SECRET || 'your-secret-key');
      if (decoded.id === store.user_id) return { store, authorized: true };
    } catch {}
  }

  // Try PIN
  if (body.pin) {
    const valid = await verifyStoreEditPin(store.id, body.pin);
    if (valid) return { store, authorized: true };
  }

  return { error: 'No autorizado', status: 403 };
}

// Global restart all totems for a store
app.post('/api/public/:code/restart-all', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    const store = auth.store;

    // Mark all devices for this store as pending restart
    try {
      await pool.execute('SHOW COLUMNS FROM store_devices LIKE ?', ['pending_restart']);
    } catch {
      try { await pool.execute('ALTER TABLE store_devices ADD COLUMN pending_restart BOOLEAN DEFAULT FALSE'); } catch {}
    }
    await pool.execute('UPDATE store_devices SET pending_restart = TRUE WHERE store_id = ?', [store.id]);

    // Emit to store room and also broadcast globally so all connected clients are notified
    io.to(`store_${store.id}`).emit('totem_restart', { store_id: store.id });
    io.emit('totem_restart', { store_id: store.id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public product management with PIN or admin token
app.post('/api/public/:code/products', upload.single('image'), async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    if (!req.body.name || !req.body.price) return res.status(400).json({ error: 'Nombre y precio requeridos' });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const product = await createProduct(auth.store.id, {
      name: req.body.name, description: req.body.description || '',
      barcode: req.body.barcode || null,
      price: parseFloat(req.body.price) || 0, category_id: req.body.category_id || null, image: imageUrl,
      has_extras: req.body.has_extras === 'true' || req.body.has_extras === true,
      has_ingredients: req.body.has_ingredients === 'true' || req.body.has_ingredients === true,
      max_extras: parseInt(req.body.max_extras) || 0,
      max_ingredients: parseInt(req.body.max_ingredients) || 0
    });

    await pool.execute(
      'INSERT INTO inventory (product_id, stock, unlimited_stock) VALUES (?, 0, TRUE) ON DUPLICATE KEY UPDATE unlimited_stock = TRUE',
      [product.id]
    );

    emitProductUpdate(auth.store.id, 'product_created', product);
    res.json(product);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/public/:code/products/:id', upload.single('image'), async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    if (!req.body.name) return res.status(400).json({ error: 'Nombre requerido' });

    let imageUrl;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.keep_image === 'true') {
      const existing = await getProductById(req.params.id);
      imageUrl = existing?.image || null;
    } else {
      imageUrl = null;
    }

    const product = await updateProduct(parseInt(req.params.id), auth.store.id, {
      name: req.body.name, description: req.body.description || '',
      barcode: req.body.barcode || null,
      price: parseFloat(req.body.price) || 0, category_id: req.body.category_id || null, image: imageUrl,
      has_extras: req.body.has_extras === 'true' || req.body.has_extras === true,
      has_ingredients: req.body.has_ingredients === 'true' || req.body.has_ingredients === true,
      max_extras: parseInt(req.body.max_extras) || 0,
      max_ingredients: parseInt(req.body.max_ingredients) || 0
    });
    emitProductUpdate(auth.store.id, 'product_updated', product);
    res.json(product);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/public/:code/products/:id', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    await deleteProduct(parseInt(req.params.id), auth.store.id);
    emitProductUpdate(auth.store.id, 'product_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Public category management with PIN or admin token
app.post('/api/public/:code/categories', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    if (!req.body.name) return res.status(400).json({ error: 'Nombre es requerido' });
    const category = await createCategory(auth.store.id, { name: req.body.name, description: req.body.description || '' });
    emitProductUpdate(auth.store.id, 'category_created', category);
    res.json(category);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/public/:code/categories/:id', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    if (!req.body.name) return res.status(400).json({ error: 'Nombre es requerido' });
    const category = await updateCategory(parseInt(req.params.id), auth.store.id, { name: req.body.name, description: req.body.description || '' });
    emitProductUpdate(auth.store.id, 'category_updated', category);
    res.json(category);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Sync product complements (ingredients + extras)
app.put('/api/public/:code/products/:id/complements', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    const productId = parseInt(req.params.id);
    const { ingredient_ids = [], extra_ids = [] } = req.body;

    // Mark that this product has explicit complement configuration
    await pool.execute('UPDATE products SET complements_configured = TRUE WHERE id = ?', [productId]);

    // Sync ingredients
    await pool.execute('DELETE FROM product_ingredients WHERE product_id = ?', [productId]);
    for (const ingId of ingredient_ids) {
      await pool.execute('INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (?, ?)', [productId, parseInt(ingId)]);
    }

    // Sync extras
    await pool.execute('DELETE FROM product_extras WHERE product_id = ?', [productId]);
    for (const extId of extra_ids) {
      await pool.execute('INSERT INTO product_extras (product_id, extra_id) VALUES (?, ?)', [productId, parseInt(extId)]);
    }

    res.json({ success: true });
  } catch (error) { console.error('Error syncing complements:', error); res.status(500).json({ error: error.message }); }
});

// Get product complement associations
app.get('/api/public/:code/products/:id/complements', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const [prodRows] = await pool.execute(
      'SELECT store_id, complements_configured FROM products WHERE id = ?', [productId]
    );
    if (prodRows.length === 0) return res.json({ ingredient_ids: [], extra_ids: [] });
    const { store_id, complements_configured } = prodRows[0];

    if (complements_configured) {
      const [ings] = await pool.execute('SELECT ingredient_id FROM product_ingredients WHERE product_id = ?', [productId]);
      const [exts] = await pool.execute('SELECT extra_id FROM product_extras WHERE product_id = ?', [productId]);
      return res.json({ ingredient_ids: ings.map(r => r.ingredient_id), extra_ids: exts.map(r => r.extra_id) });
    }

    // Not yet configured — return all store ingredients/extras so editor shows all selected
    const [ings] = await pool.execute('SELECT id FROM ingredients WHERE store_id = ?', [store_id]);
    const [exts] = await pool.execute('SELECT id FROM extras WHERE store_id = ?', [store_id]);
    res.json({ ingredient_ids: ings.map(r => r.id), extra_ids: exts.map(r => r.id) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/public/:code/categories/:id', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    await deleteCategory(parseInt(req.params.id), auth.store.id);
    emitProductUpdate(auth.store.id, 'category_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/plans', async (req, res) => {
  try {
    const plans = await getAllPlans();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/my-plan', authenticateToken, async (req, res) => {
  try {
    const plan = await getUserPlan(req.user.id);
    const storeInfo = await canUserCreateStore(req.user.id);
    res.json({ 
      plan,
      ...storeInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/can-create-store', authenticateToken, async (req, res) => {
  try {
    const canCreate = await canUserCreateStore(req.user.id);
    res.json(canCreate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subscribe-plan', authenticateToken, async (req, res) => {
  try {
    const { planId, billingCycle } = req.body;
    if (!planId) {
      return res.status(400).json({ error: 'Plan es requerido' });
    }
    const result = await assignPlanToUser(req.user.id, planId, billingCycle || 'monthly');
    res.json({ success: true, message: `Te has suscrito al plan ${result.plan}`, plan: result.plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-subscription-preference', authenticateToken, async (req, res) => {
  try {
    const { planId, billingCycle } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan es requerido' });
    }
    
    const plan = await getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    
    if (plan.price_monthly === 0 && plan.price_yearly === 0) {
      const result = await assignPlanToUser(req.user.id, planId, billingCycle || 'monthly');
      return res.json({ 
        success: true, 
        message: `Te has suscrito al plan ${result.plan}`,
        plan: result.plan,
        isFree: true 
      });
    }
    
    const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    const user = await getUserById(req.user.id);
    
    console.log('=== Creating MercadoPago Preference ===');
    console.log('User:', user.email);
    console.log('Plan:', plan.name, '- Price:', price, 'USD');
    console.log('Billing Cycle:', billingCycle);
    
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    const preference = {
      items: [
        {
          id: `plan-${plan.id}-${billingCycle}`,
          title: `Suscripción ${plan.name} - ${billingCycle === 'yearly' ? 'Anual' : 'Mensual'}`,
          description: `Acceso al plan ${plan.name} - ${plan.description}`,
          quantity: 1,
          currency_id: 'USD',
          unit_price: Number(price)
        }
      ],
      payer: {
        email: user.email,
        name: user.name || user.username
      },
      external_reference: `subscription-${req.user.id}-${planId}-${billingCycle}-${Date.now()}`,
      notification_url: `${process.env.BASE_URL || 'http://localhost:3001'}/api/mercadopago-webhook`,
      back_urls: {
        success: `${clientUrl}/admin/plans?payment=success`,
        failure: `${clientUrl}/admin/plans?payment=failure`,
        pending: `${clientUrl}/admin/plans?payment=pending`
      }
    };
    
    console.log('Calling MercadoPago API...');
    console.log('Preference:', JSON.stringify(preference, null, 2));
    
    const preferenceClient = new Preference(mpClient);
    const response = await preferenceClient.create({ body: preference });
    
    console.log('MercadoPago Response Success:', !!response.id);
    console.log('Init Point:', response.init_point);
    
    const initPoint = response.init_point;
    
    if (!initPoint) {
      console.error('No se получил init_point en la respuesta:', response);
      return res.status(500).json({ 
        error: 'Error al crear el enlace de pago. La respuesta de MercadoPago no contiene init_point.',
        details: response,
        hint: 'Verifica que tu cuenta de MercadoPago esté activa y tengas permisos para cobrar.'
      });
    }
    
    res.json({
      success: true,
      init_point: initPoint,
      preference_id: response.id
    });
    
  } catch (error) {
    console.error('=== MercadoPago Error ===');
    console.error('Error Message:', error.message);
    console.error('Error Status:', error.status);
    console.error('Error Cause:', error.cause);
    console.error('Error Response:', error.response?.data);
    
    let errorMessage = 'Error al crear la preferencia de pago';
    let errorHint = '';
    
    if (error.message?.includes('401') || error.message?.includes('invalid_token')) {
      errorMessage = 'Token de MercadoPago inválido o expirado.';
      errorHint = 'Ve a https://dashboard.mercadopago.com/apps y regenera tus tokens.';
    } else if (error.message?.includes('forbidden') || error.message?.includes('403')) {
      errorMessage = 'Tu cuenta de MercadoPago no tiene permisos para esta operación.';
      errorHint = 'Verifica que tu cuenta esté verificada y activa.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
      if (error.response.data.cause) {
        errorHint = JSON.stringify(error.response.data.cause);
      }
    }
    
    res.status(500).json({ error: errorMessage, hint: errorHint, details: error.message });
  }
});

app.post('/api/mercadopago-webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (type === 'payment') {
      const paymentId = data.id;
      
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: paymentId });
      
      if (payment.status === 'approved') {
        const externalRef = payment.external_reference;
        if (externalRef && externalRef.startsWith('subscription-')) {
          const parts = externalRef.split('-');
          const userId = parseInt(parts[1]);
          const planId = parseInt(parts[2]);
          const billingCycle = parts[3];
          
          await assignPlanToUser(userId, planId, billingCycle);
          console.log(`Suscripción activada para usuario ${userId} - Plan ${planId}`);
        }
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error en webhook de MercadoPago:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { payment_id } = req.body;
    
    if (!payment_id) {
      const userPlan = await getUserPlan(req.user.id);
      res.json({
        success: true,
        activated: userPlan && userPlan.plan_name && userPlan.plan_name !== 'Gratis'
      });
      return;
    }
    
    const paymentClient = new Payment(mpClient);
    const payment = await paymentClient.get({ id: payment_id });
    
    if (payment.status === 'approved') {
      const userPlan = await getUserPlan(req.user.id);
      res.json({
        success: true,
        activated: userPlan && userPlan.plan_name && userPlan.plan_name !== 'Gratis',
        plan: userPlan?.plan_name
      });
    } else {
      res.json({
        success: false,
        activated: false,
        status: payment.status
      });
    }
  } catch (error) {
    const userPlan = await getUserPlan(req.user.id);
    res.json({
      success: true,
      activated: userPlan && userPlan.plan_name && userPlan.plan_name !== 'Gratis'
    });
  }
});

app.get('/api/get-mp-public-key', async (req, res) => {
  try {
    res.json({
      public_key: process.env.MP_PUBLIC_KEY
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/verify-mp-credentials', authenticateToken, async (req, res) => {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const environment = process.env.MP_ENVIRONMENT || 'sandbox';
    
    if (!accessToken) {
      return res.json({
        valid: false,
        error: 'Token de acceso no configurado'
      });
    }
    
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return res.json({
        valid: true,
        environment,
        user_id: userData.id,
        nickname: userData.nickname,
        email: userData.email,
        site_id: userData.site_id
      });
    } else {
      const errorData = await response.json();
      return res.json({
        valid: false,
        error: errorData.message || 'Token inválido',
        status: response.status,
        environment
      });
    }
  } catch (error) {
    res.json({
      valid: false,
      error: error.message
    });
  }
});

// ==================== QR MercadoPago por tienda ====================

// Guardar/obtener token MP de la tienda
app.get('/api/stores/:id/mp-config', authenticateToken, async (req, res) => {
  try {
    const isOwner = await verifyStoreOwnership(parseInt(req.params.id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso' });
    const [rows] = await pool.execute('SELECT mp_access_token FROM stores WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tienda no encontrada' });
    const hasToken = !!rows[0].mp_access_token;
    res.json({ configured: hasToken, token_preview: hasToken ? '****' + rows[0].mp_access_token.slice(-6) : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stores/:id/mp-config', authenticateToken, async (req, res) => {
  try {
    const isOwner = await verifyStoreOwnership(parseInt(req.params.id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso' });
    const { mp_access_token } = req.body;

    if (mp_access_token) {
      // Verificar que el token sea válido
      const verifyRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${mp_access_token}` }
      });
      if (!verifyRes.ok) return res.status(400).json({ error: 'Token de MercadoPago inválido' });
    }

    await pool.execute('UPDATE stores SET mp_access_token = ? WHERE id = ?', [mp_access_token || null, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear preferencia QR para una orden
app.post('/api/store/:code/qr-payment', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    if (!store.mp_access_token) return res.status(400).json({ error: 'MercadoPago no configurado para esta tienda' });

    const { order_id, amount, description } = req.body;
    if (!amount) return res.status(400).json({ error: 'Monto requerido' });

    const externalRef = `qr-${store.code}-${order_id || Date.now()}`;

    const prefResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${store.mp_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          title: description || `Pedido ${store.name}`,
          quantity: 1,
          currency_id: store.currency_code || 'CLP',
          unit_price: Number(amount)
        }],
        external_reference: externalRef,
        notification_url: `${process.env.SERVER_URL || 'https://srservi2.srautomatic.com'}/api/store/${store.code}/qr-webhook`
      })
    });

    if (!prefResponse.ok) {
      const err = await prefResponse.json();
      return res.status(400).json({ error: 'Error creando preferencia', details: err });
    }

    const pref = await prefResponse.json();

    // Actualizar la orden con la referencia si existe
    if (order_id) {
      await pool.execute('UPDATE orders SET external_reference = ?, mp_order_id = ? WHERE id = ?', [externalRef, pref.id, order_id]);
    }

    res.json({
      preference_id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
      qr_data: pref.init_point,
      external_reference: externalRef
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook para confirmar pago QR
app.post('/api/store/:code/qr-webhook', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code);
    if (!store || !store.mp_access_token) return res.status(200).send('OK');

    const { type, data } = req.body;
    if (type === 'payment') {
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${store.mp_access_token}` }
      });
      if (paymentRes.ok) {
        const payment = await paymentRes.json();
        if (payment.status === 'approved' && payment.external_reference) {
          const [orders] = await pool.execute(
            'SELECT id FROM orders WHERE external_reference = ? AND store_id = ?',
            [payment.external_reference, store.id]
          );
          if (orders.length > 0) {
            await pool.execute(
              "UPDATE orders SET payment_process = 1, cash_approved = TRUE, status = 'preparing', reference_id = ?, sequence_id = ? WHERE id = ?",
              [payment.id?.toString(), payment.external_reference, orders[0].id]
            );
            const socketId = userSockets.get(store.id);
            if (socketId) {
              io.to(socketId).emit('qr_payment_completed', { order_id: orders[0].id, payment_id: payment.id });
            }
          }
        }
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('QR Webhook error:', error);
    res.status(200).send('OK');
  }
});

app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    const dateRange = req.query.range || 'week';
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const analytics = await getAnalytics(parseInt(storeId), dateRange);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/sales-by-day', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    const dateRange = req.query.range || 'week';
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const sales = await getSalesByDay(parseInt(storeId), dateRange);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/top-products', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    const dateRange = req.query.range || 'week';
    const limit = parseInt(req.query.limit) || 10;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const products = await getTopProducts(parseInt(storeId), limit, dateRange);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/orders-by-hour', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    const dateRange = req.query.range || 'week';
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const orders = await getOrdersByHour(parseInt(storeId), dateRange);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/recent-orders', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    const limit = parseInt(req.query.limit) || 10;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const orders = await getRecentOrders(parseInt(storeId), limit);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    const superadmin = await authenticateSuperadmin(email, password);
    if (!superadmin) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    // Ensure columns exist
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM superadmin');
      const names = cols.map(c => c.Field);
      if (!names.includes('username')) await pool.execute('ALTER TABLE superadmin ADD COLUMN username VARCHAR(255) DEFAULT NULL');
      if (!names.includes('avatar')) await pool.execute('ALTER TABLE superadmin ADD COLUMN avatar TEXT DEFAULT NULL');
    } catch {}
    let username = superadmin.email;
    let avatar = null;
    try {
      const [rows] = await pool.execute('SELECT username, avatar FROM superadmin WHERE id = ?', [superadmin.id]);
      if (rows[0]?.username) username = rows[0].username;
      if (rows[0]?.avatar) avatar = rows[0].avatar;
    } catch {}
    const token = jwt.sign({ id: superadmin.id, isSuperadmin: true, username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, superadmin: { id: superadmin.id, email: superadmin.email, username, avatar } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/setup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    await createSuperadmin(email, password);
    res.json({ success: true, message: 'Superadmin creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const authenticateSuperadminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    if (!decoded.isSuperadmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    req.superadmin = decoded;
    next();
  });
};

// Superadmin: update my profile (name + avatar)
app.put('/api/superadmin/profile', authenticateSuperadminToken, upload.single('avatar'), async (req, res) => {
  try {
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM superadmin');
      const names = cols.map(c => c.Field);
      if (!names.includes('username')) await pool.execute('ALTER TABLE superadmin ADD COLUMN username VARCHAR(255) DEFAULT NULL');
      if (!names.includes('avatar')) await pool.execute('ALTER TABLE superadmin ADD COLUMN avatar TEXT DEFAULT NULL');
    } catch {}
    const updates = [];
    const params = [];
    if (req.body.username) { updates.push('username = ?'); params.push(req.body.username); }
    if (req.file) { updates.push('avatar = ?'); params.push(`/uploads/${req.file.filename}`); }
    if (updates.length > 0) {
      params.push(req.superadmin.id);
      await pool.execute(`UPDATE superadmin SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await pool.execute('SELECT id, email, username, avatar FROM superadmin WHERE id = ?', [req.superadmin.id]);
    res.json(rows[0] || {});
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: get my profile
app.get('/api/superadmin/profile', authenticateSuperadminToken, async (req, res) => {
  try {
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM superadmin');
      const names = cols.map(c => c.Field);
      if (!names.includes('username')) await pool.execute('ALTER TABLE superadmin ADD COLUMN username VARCHAR(255) DEFAULT NULL');
      if (!names.includes('avatar')) await pool.execute('ALTER TABLE superadmin ADD COLUMN avatar TEXT DEFAULT NULL');
    } catch {}
    const [rows] = await pool.execute('SELECT id, email, username, avatar FROM superadmin WHERE id = ?', [req.superadmin.id]);
    res.json(rows[0] || {});
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: create new superadmin account
app.post('/api/superadmin/create', authenticateSuperadminToken, async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM superadmin LIKE ?', ['username']);
      if (cols.length === 0) await pool.execute('ALTER TABLE superadmin ADD COLUMN username VARCHAR(255) DEFAULT NULL');
    } catch {}
    await createSuperadmin(email, password);
    if (username) await pool.execute('UPDATE superadmin SET username = ? WHERE email = ?', [username, email]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: list all superadmins
app.get('/api/superadmin/list', authenticateSuperadminToken, async (req, res) => {
  try {
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM superadmin LIKE ?', ['username']);
      if (cols.length === 0) await pool.execute('ALTER TABLE superadmin ADD COLUMN username VARCHAR(255) DEFAULT NULL');
    } catch {}
    const [rows] = await pool.execute('SELECT id, email, username, avatar, created_at FROM superadmin ORDER BY id');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: delete superadmin (can't delete yourself)
app.delete('/api/superadmin/account/:id', authenticateSuperadminToken, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.superadmin.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await pool.execute('DELETE FROM superadmin WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/superadmin/users', authenticateSuperadminToken, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/superadmin/users/:id', authenticateSuperadminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, is_banned } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }
    await updateUserBySuperadmin(id, { email, password, is_banned });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/users/:id', authenticateSuperadminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteUserBySuperadmin(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/superadmin/stores', authenticateSuperadminToken, async (req, res) => {
  try {
    const stores = await getAllStores();
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/superadmin/stores/:id', authenticateSuperadminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_banned } = req.body;
    await updateStoreBySuperadmin(id, { is_banned });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/stores/:id', authenticateSuperadminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteStoreBySuperadmin(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/superadmin/subscriptions', authenticateSuperadminToken, async (req, res) => {
  try {
    const subscriptions = await getSubscriptionHistory();
    console.log('📋 Suscripciones encontradas:', subscriptions.length);
    res.json(subscriptions || []);
  } catch (error) {
    console.error('❌ Error en subscriptions:', error);
    res.json([]);
  }
});

app.post('/api/superadmin/assign-premium', authenticateSuperadminToken, async (req, res) => {
  try {
    const { user_id, plan_id, forever, ends_at } = req.body;
    if (!user_id || !plan_id) {
      return res.status(400).json({ error: 'user_id y plan_id son requeridos' });
    }
    const result = await assignPremiumByAdmin(user_id, plan_id, forever, ends_at);
    res.json(result);
  } catch (error) {
    console.error('Error asignando premium:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const parsedId = parseInt(storeId);
    console.log(`[Categories] GET store_id=${storeId} parsed=${parsedId}`);
    const categories = await getCategories(parsedId);
    console.log(`[Categories] Found ${categories.length} categories`);
    res.json(categories);
  } catch (error) {
    console.error(`[Categories] GET Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const category = await createCategory(parseInt(store_id), { name, description });
    emitProductUpdate(parseInt(store_id), 'category_created', category);
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const category = await updateCategory(parseInt(req.params.id), parseInt(store_id), { name, description });
    emitProductUpdate(parseInt(store_id), 'category_updated', category);
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const categoryId = req.params.id;
    await deleteCategory(parseInt(categoryId), parseInt(store_id));
    emitProductUpdate(parseInt(store_id), 'category_deleted', { id: categoryId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const ingredients = await getIngredients(parseInt(storeId));
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ingredients', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, price, category_id } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const ingredient = await createIngredient(parseInt(store_id), { name, price, category_id, image: imageUrl });
    emitProductUpdate(parseInt(store_id), 'ingredient_created', ingredient);
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ingredients/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, price, category_id, stock, unlimited_stock } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    let imageUrl;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else {
      const existing = await pool.execute('SELECT image FROM ingredients WHERE id = ?', [req.params.id]);
      imageUrl = existing[0][0]?.image || null;
    }
    const ingredient = await updateIngredient(parseInt(req.params.id), parseInt(store_id), { 
      name, 
      price, 
      category_id, 
      image: imageUrl,
      stock: stock !== undefined ? parseInt(stock) : 0,
      unlimited_stock: unlimited_stock === 'true' || unlimited_stock === true
    });
    req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { product_id: parseInt(req.params.id), stock: ingredient.stock, unlimited_stock: ingredient.unlimited_stock });
    emitProductUpdate(parseInt(store_id), 'ingredient_updated', ingredient);
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ingredients/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const ingredientId = req.params.id;
    await deleteIngredient(parseInt(ingredientId), parseInt(store_id));
    emitProductUpdate(parseInt(store_id), 'ingredient_deleted', { id: ingredientId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/extras', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const extras = await getExtras(parseInt(storeId));
    res.json(extras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/extras', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, price, category_id } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const extra = await createExtra(parseInt(store_id), { name, price, category_id, image: imageUrl });
    emitProductUpdate(parseInt(store_id), 'extra_created', extra);
    res.json(extra);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/extras/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, price, category_id, stock, unlimited_stock } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    let imageUrl;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else {
      const existing = await pool.execute('SELECT image FROM extras WHERE id = ?', [req.params.id]);
      imageUrl = existing[0][0]?.image || null;
    }
    const extra = await updateExtra(parseInt(req.params.id), parseInt(store_id), { 
      name, 
      price, 
      category_id, 
      image: imageUrl,
      stock: stock !== undefined ? parseInt(stock) : 0,
      unlimited_stock: unlimited_stock === 'true' || unlimited_stock === true
    });
    req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { product_id: parseInt(req.params.id), stock: extra.stock, unlimited_stock: extra.unlimited_stock });
    emitProductUpdate(parseInt(store_id), 'extra_updated', extra);
    res.json(extra);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/extras/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const extraId = req.params.id;
    await deleteExtra(parseInt(extraId), parseInt(store_id));
    emitProductUpdate(parseInt(store_id), 'extra_deleted', { id: extraId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/store-configurations', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const configurations = await getStoreConfigurations(parseInt(storeId));
    res.json(configurations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/store-configurations', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const configuration = await createStoreConfiguration(parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals });
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/store-configurations/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const configuration = await updateStoreConfiguration(parseInt(req.params.id), parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals });
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/store-configurations/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const configId = req.params.id;
    await deleteStoreConfiguration(parseInt(configId), parseInt(store_id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Worker Payment Methods
app.get('/api/worker-payment-methods', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) return res.status(400).json({ error: 'store_id requerido' });
    const methods = await getWorkerPaymentMethods(parseInt(storeId));
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/worker-payment-methods', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, color } = req.body;
    if (!store_id || !name) return res.status(400).json({ error: 'store_id y name requeridos' });
    const method = await createWorkerPaymentMethod(parseInt(store_id), { name, color });
    res.json(method);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/worker-payment-methods/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, color, is_active } = req.body;
    if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
    const method = await updateWorkerPaymentMethod(parseInt(req.params.id), parseInt(store_id), { name, color, is_active });
    res.json(method);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/worker-payment-methods/:id', authenticateToken, async (req, res) => {
  try {
    const store_id = req.query.store_id;
    if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
    await deleteWorkerPaymentMethod(parseInt(req.params.id), parseInt(store_id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public endpoint for workers to see payment methods
app.get('/api/public/worker-payment-methods/:storeId', async (req, res) => {
  try {
    const methods = await getWorkerPaymentMethods(parseInt(req.params.storeId));
    res.json(methods.filter(m => m.is_active));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/public/:code/store-configurations/:id', async (req, res) => {
  try {
    const auth = await verifyStoreAccess(req.params.code, req.body);
    if (!auth.authorized) return res.status(auth.status || 403).json({ error: auth.error });
    const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });
    const configuration = await updateStoreConfiguration(parseInt(req.params.id), auth.store.id, { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals });
    res.json(configuration);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/public/store-configurations/:storeId', async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const configurations = await getStoreConfigurations(parseInt(storeId));
    const activeConfigs = configurations.filter(c => c.is_active);
    res.json(activeConfigs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/products/:storeId', async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const products = await getPublicProducts(parseInt(storeId));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/coupons', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const coupons = await getCoupons(parseInt(storeId));
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coupons', authenticateToken, async (req, res) => {
  try {
    const { store_id, code, name, discount_type, discount_value, min_order_total, usage_limit, is_active } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!code || !name) {
      return res.status(400).json({ error: 'code y name son requeridos' });
    }
    const coupon = await createCoupon(parseInt(store_id), {
      code,
      name,
      discount_type,
      discount_value,
      min_order_total,
      usage_limit,
      is_active
    });
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/coupons/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, code, name, discount_type, discount_value, min_order_total, usage_limit, is_active } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!code || !name) {
      return res.status(400).json({ error: 'code y name son requeridos' });
    }
    const coupon = await updateCoupon(parseInt(req.params.id), parseInt(store_id), {
      code,
      name,
      discount_type,
      discount_value,
      min_order_total,
      usage_limit,
      is_active
    });
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/coupons/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    await deleteCoupon(parseInt(req.params.id), parseInt(store_id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const products = await getProducts(parseInt(storeId));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/barcode/:barcode', authenticateToken, async (req, res) => {
  try {
    const { barcode } = req.params;
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const product = await getProductByBarcode(barcode, parseInt(storeId));
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const products = await searchProducts(query, parseInt(storeId));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const inventory = await getInventory(parseInt(productId));
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { adjustment, store_id } = req.body;
    if (adjustment === undefined) {
      return res.status(400).json({ error: 'adjustment es requerido' });
    }
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const updated = await updateInventory(parseInt(productId), parseInt(adjustment), parseInt(store_id));
    if (store_id) {
      req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { product_id: parseInt(productId), ...updated });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:productId/stock', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { stock, store_id } = req.body;
    if (stock === undefined) {
      return res.status(400).json({ error: 'stock es requerido' });
    }
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const updated = await setInventoryStock(parseInt(productId), parseInt(stock));
    if (store_id) {
      req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { product_id: parseInt(productId), ...updated });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:productId/unlimited', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { unlimited_stock, store_id } = req.body;
    if (unlimited_stock === undefined) {
      return res.status(400).json({ error: 'unlimited_stock es requerido' });
    }
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    await pool.execute(
      'INSERT INTO inventory (product_id, unlimited_stock) VALUES (?, ?) ON DUPLICATE KEY UPDATE unlimited_stock = ?',
      [parseInt(productId), unlimited_stock, unlimited_stock]
    );
    const updated = await getInventory(parseInt(productId));
    if (store_id) {
      req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { product_id: parseInt(productId), ...updated });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/market/create-payment', authenticateToken, async (req, res) => {
  try {
    const { store_id, terminal_id, amount, description } = req.body;

    if (!store_id || !terminal_id || !amount) {
      return res.status(400).json({ error: 'store_id, terminal_id y amount son requeridos' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }

    const terminal = await getMercadoPagoTerminalById(parseInt(terminal_id));
    if (!terminal) {
      return res.status(404).json({ error: 'Terminal no encontrada' });
    }

    const mercadopago_access_token = terminal.mercadopago_access_token;
    const mercadopago_terminal_id = terminal.mercadopago_terminal_id;

    if (!mercadopago_access_token || !mercadopago_terminal_id) {
      return res.status(400).json({ error: 'Terminal no configurada correctamente' });
    }

    const idempotencyKey = `MARKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      type: 'point',
      external_reference: idempotencyKey,
      description: description || 'Venta Market POS',
      expiration_time: 'PT10M',
      transactions: {
        payments: [{
          amount: String(Math.round(amount))
        }]
      },
      config: {
        point: {
          terminal_id: mercadopago_terminal_id,
          print_on_terminal: 'no_ticket'
        }
      }
    };

    console.log('Enviando pago Point desde Market:', payload);

    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mercadopago_access_token}`,
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de Mercado Pago:', errorText);
      return res.status(400).json({ error: `Error al procesar pago: ${errorText}` });
    }

    const mpResponse = await response.json();
    console.log('Respuesta de Mercado Pago:', mpResponse);

    res.json({
      id: mpResponse.id,
      payment_id: mpResponse.id,
      status: mpResponse.status,
      external_reference: mpResponse.external_reference,
      amount: amount,
      terminal_id: terminal_id
    });
  } catch (error) {
    console.error('Error procesando pago Market:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/market/payment-status/:mpOrderId', authenticateToken, async (req, res) => {
  try {
    const { mpOrderId } = req.params;
    const { store_id, terminal_id } = req.query;

    if (!mpOrderId) {
      return res.status(400).json({ error: 'mpOrderId es requerido' });
    }

    if (!store_id || !terminal_id) {
      return res.status(400).json({ error: 'store_id y terminal_id son requeridos' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }

    const terminal = await getMercadoPagoTerminalById(parseInt(terminal_id));
    if (!terminal) {
      return res.status(404).json({ error: 'Terminal no encontrada' });
    }

    const mercadopago_access_token = terminal.mercadopago_access_token;
    if (!mercadopago_access_token) {
      return res.status(400).json({ error: 'Mercado Pago no configurado en la terminal' });
    }

    const response = await fetch(`https://api.mercadopago.com/v1/orders/${mpOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mercadopago_access_token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error consultando estado de pago:', errorText);
      return res.status(400).json({ error: `Error al consultar estado: ${errorText}` });
    }

    const mpResponse = await response.json();
    console.log('Estado de pago Market:', mpResponse.status, mpResponse.id);

    const firstPayment = mpResponse.payments?.[0];
    const paymentStatus = firstPayment?.status || mpResponse.status;
    const paidAmount = firstPayment?.paid_amount || firstPayment?.amount?.toString() || '0';

    res.json({
      id: mpResponse.id,
      status: mpResponse.status,
      mp_status: mpResponse.status,
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      external_reference: mpResponse.external_reference
    });
  } catch (error) {
    console.error('Error consultando estado de pago Market:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/order', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Request body:', req.body);
    console.log('📦 Content-Type:', req.headers['content-type']);
    const { store_id, products } = req.body;
    console.log('📦 Received order update:', { store_id, products });
    if (!store_id || !products) {
      return res.status(400).json({ error: 'store_id y products son requeridos' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    await updateProductsOrder(parseInt(store_id), products);
    console.log('✅ Order saved to database');
    emitProductUpdate(parseInt(store_id), 'products_reordered', { products });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error saving order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, barcode, description, price, category_id, has_extras, has_ingredients, max_extras, max_ingredients } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const product = await createProduct(parseInt(store_id), {
      name,
      barcode,
      description,
      price,
      category_id,
      image: imageUrl,
      has_extras: has_extras === 'true' || has_extras === true,
      has_ingredients: has_ingredients === 'true' || has_ingredients === true,
      max_extras: parseInt(max_extras) || 0,
      max_ingredients: parseInt(max_ingredients) || 0
    });

    emitProductUpdate(parseInt(store_id), 'product_created', product);
    if (pluginManager) pluginManager.hooks.emit('product_created', { store_id: parseInt(store_id), product });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, barcode, description, price, category_id, has_extras, has_ingredients, max_extras, max_ingredients } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }

    let imageUrl;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else {
      const existingProduct = await getProductById(req.params.id);
      imageUrl = existingProduct?.image || null;
    }

    const product = await updateProduct(parseInt(req.params.id), parseInt(store_id), {
      name,
      barcode,
      description,
      price,
      category_id,
      image: imageUrl,
      has_extras: has_extras === 'true' || has_extras === true,
      has_ingredients: has_ingredients === 'true' || has_ingredients === true,
      max_extras: parseInt(max_extras) || 0,
      max_ingredients: parseInt(max_ingredients) || 0
    });

    emitProductUpdate(parseInt(store_id), 'product_updated', product);
    if (pluginManager) pluginManager.hooks.emit('product_updated', { store_id: parseInt(store_id), product });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const productId = req.params.id;
    await deleteProduct(parseInt(productId), parseInt(store_id));
    emitProductUpdate(parseInt(store_id), 'product_deleted', { id: productId });
    if (pluginManager) pluginManager.hooks.emit('product_deleted', { store_id: parseInt(store_id), product_id: parseInt(productId) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { store_id, items, order_type, payment_method, coupon_code, from_worker, delivery } = req.body;

    if (!store_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos del pedido incompletos' });
    }

    console.log('Creating order:', { store_id, order_type, payment_method, items, from_worker, delivery });
    const order = await createOrder(parseInt(store_id), { order_type, payment_method, items, coupon_code, from_worker, delivery });

    const socketId = userSockets.get(parseInt(store_id));
    if (socketId) {
      io.to(socketId).emit('new_order', order);
    }

    if (pluginManager) {
      pluginManager.hooks.emit('order_created', { store_id: parseInt(store_id), order });
      if (payment_method === 'cash') {
        pluginManager.hooks.emit('payment_completed', { store_id: parseInt(store_id), order, payment_method: 'cash' });
      }
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Error creando orden:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/process-payment', async (req, res) => {
  try {
    const { store_id, items, order_type, payment_method, selected_terminal_id, coupon_code } = req.body;
    
    if (!store_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos del pedido incompletos' });
    }
    
    if (payment_method === 'card') {
      console.log('Procesando pago con tarjeta:', { store_id, order_type, selected_terminal_id });
      
      const mpResult = await processMercadoPagoPayment(parseInt(store_id), {
        items,
        order_type,
        selected_terminal_id: selected_terminal_id ? parseInt(selected_terminal_id) : null,
        coupon_code
      });
      
      console.log('Pago Mercado Pago procesado:', JSON.stringify(mpResult));
      
      const order = await createOrder(parseInt(store_id), { 
        order_type, 
        payment_method: 'card',
        items,
        mp_order_id: mpResult.mp_order_id,
        external_reference: mpResult.external_reference,
        coupon_code,
        terminal_id: selected_terminal_id ? parseInt(selected_terminal_id) : null
      });
      
      const socketId = userSockets.get(parseInt(store_id));
      if (socketId) {
        io.to(socketId).emit('new_order', order);
      }

      if (pluginManager) {
        pluginManager.hooks.emit('order_created', { store_id: parseInt(store_id), order });
        pluginManager.hooks.emit('payment_started', { store_id: parseInt(store_id), order, payment_method: 'card' });
      }

      res.json({
        success: true,
        order,
        mp_status: mpResult.status
      });
    } else {
      return res.status(400).json({ error: 'Metodo de pago no soportado para este endpoint' });
    }
  } catch (error) {
    console.error('❌ Error procesando pago:', error);
    const isValidationError = [
      'Configuracion de Mercado Pago',
      'La máquina seleccionada',
      'Cupón'
    ].some(text => String(error.message || '').includes(text));
    res.status(isValidationError ? 400 : 500).json({ error: error.message });
  }
});

app.get('/api/orders/:orderId/payment-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const storeId = req.query.store_id;
    console.log('>>> payment-status endpoint llamado | orderId:', orderId, '| storeId:', storeId);
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }

    const store = await getStoreById(parseInt(storeId));
    const [orders] = await pool.execute(
      'SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [parseInt(orderId), parseInt(storeId)]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const order = orders[0];

    if (order.payment_method !== 'card') {
      const status = order.status === 'completed' ? 'approved' : 'pending';
      return res.json({ mp_status: status, payment_status: status, order_status: order.status, order, mp_full: null });
    }

    let mercadopagoAccessToken = store?.mercadopago_access_token;
    if (order.terminal_id) {
      const [termRows] = await pool.execute("SELECT mercadopago_access_token FROM mercado_pago_terminals WHERE id = ?", [order.terminal_id]);
      if (termRows[0]?.mercadopago_access_token) mercadopagoAccessToken = termRows[0].mercadopago_access_token;
    }
    if (!mercadopagoAccessToken) {
      return res.json({ mp_status: 'pending', payment_status: 'pending', order_status: order.status, order, mp_full: null });
    }

    let mpStatus = null;
    let mpOrderId = order.mp_order_id;
    console.log('  mp_order_id desde DB:', mpOrderId, '| external_reference:', order.external_reference);

    if (mpOrderId) {
      try {
        console.log('  Llamando getMercadoPagoOrderStatus con:', mpOrderId);
        mpStatus = await getMercadoPagoOrderStatus(mpOrderId, mercadopagoAccessToken);
        console.log('  getMercadoPagoOrderStatus result status:', mpStatus?.status);
      } catch (err) {
        console.log('  [ERROR getMercadoPagoOrderStatus]:', err.message);
        mpStatus = null;
      }
    }

    console.log('  mpStatus después de consulta:', mpStatus ? mpStatus.status : 'null');
    console.log('  Intentando busqueda por external_reference:', order.external_reference);
    if (!mpStatus && order.external_reference) {
      try {
        const today = new Date();
        const beginDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
        const searchUrl = `https://api.mercadopago.com/v1/orders?limit=50&begin_date=${beginDate}&end_date=${endDate}`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mercadopagoAccessToken}`
          }
        });
        const searchData = await searchRes.json();
        console.log('=== MP ORDERS SEARCH ===');
        console.log('Total orders found:', (searchData.data || []).length);
        (searchData.data || []).forEach(o => {
          console.log('  MP Order:', o.id, '| status:', o.status, '| external_reference:', o.external_reference);
        });
        console.log('=== END MP ORDERS SEARCH ===');
        const found = (searchData.data || []).find(o => o.external_reference === order.external_reference);
        if (found) {
          mpOrderId = found.id;
          mpStatus = found;
          await pool.execute('UPDATE orders SET mp_order_id = ? WHERE id = ?', [mpOrderId, parseInt(orderId)]);
          console.log('mp_order_id actualizado desde busqueda:', mpOrderId, '| status:', found.status);
        }
      } catch (err) {
        console.log('Error buscando orden en MP:', err.message);
      }
    }

    if (!mpStatus) {
      return res.json({ mp_status: 'pending', payment_status: 'pending', order_status: order.status, order, mp_full: null });
    }

    // La nueva API de MP Point usa "processed" para pagos exitosos (no "approved")
    // El campo de monto es "amount", no "paid_amount"
    const rawStatus = mpStatus.transactions?.payments?.[0]?.status || mpStatus.status;
    const paymentStatus = (rawStatus === 'processed' || mpStatus.status === 'processed') ? 'approved' : rawStatus;
    const paidAmount =
      mpStatus.transactions?.payments?.[0]?.paid_amount ||
      mpStatus.transactions?.payments?.[0]?.amount ||
      (mpStatus.status === 'processed' ? '1' : '0');

    if (mpStatus.status === 'canceled' || mpStatus.status === 'expired' || mpStatus.status === 'failed') {
      await updateOrderStatus(parseInt(orderId), parseInt(storeId), 'canceled');
      const [rows] = await pool.execute(
        'SELECT * FROM orders WHERE id = ? AND store_id = ?',
        [parseInt(orderId), parseInt(storeId)]
      );
      return res.json({
        mp_status: mpStatus.status,
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        order_status: 'canceled',
        order: rows[0],
        mp_full: mpStatus
      });
    }

    const result = {
      mp_status: mpStatus.status,
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      order_status: order.status,
      order: order,
      mp_full: mpStatus
    };
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { store_id } = req.query;
    const [orders] = await pool.execute(
      'SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [parseInt(orderId), parseInt(store_id)]
    );
    const [cols] = await pool.execute('SHOW COLUMNS FROM orders');
    res.json({ order: orders[0] || null, columns: cols.map(c => c.Field) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:orderId/confirm-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const storeId = req.body.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }

    const updatedOrder = await confirmCardPayment(parseInt(orderId), parseInt(storeId));

    const socketId = userSockets.get(parseInt(storeId));
    if (socketId && updatedOrder) {
      const items = await getOrderItems(parseInt(orderId));
      io.to(socketId).emit('payment_confirmed', { ...updatedOrder, items });
    }

    if (pluginManager && updatedOrder) {
      pluginManager.hooks.emit('payment_completed', { store_id: parseInt(storeId), order: updatedOrder, payment_method: 'card' });
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:orderId/cancel-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const storeId = req.body.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }

    const [orders] = await pool.execute(
      'SELECT * FROM orders WHERE id = ? AND store_id = ?',
      [parseInt(orderId), parseInt(storeId)]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const order = orders[0];
    if (!order.mp_order_id) {
      return res.status(400).json({ error: 'Esta orden no tiene un pago de Mercado Pago' });
    }

    const store = await getStoreById(parseInt(storeId));
    let mercadopagoAccessToken = store?.mercadopago_access_token;
    if (order.terminal_id) {
      const [termRows] = await pool.execute("SELECT mercadopago_access_token FROM mercado_pago_terminals WHERE id = ?", [order.terminal_id]);
      if (termRows[0]?.mercadopago_access_token) mercadopagoAccessToken = termRows[0].mercadopago_access_token;
    }

    if (mercadopagoAccessToken) {
      try {
        await cancelMercadoPagoOrder(order.mp_order_id, mercadopagoAccessToken);
      } catch (cancelError) {
        console.error('Error cancelando orden en Mercado Pago:', cancelError.message);
      }
    }

    await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ? AND store_id = ?',
      ['canceled', parseInt(orderId), parseInt(storeId)]
    );

    if (pluginManager) {
      pluginManager.hooks.emit('payment_failed', { store_id: parseInt(storeId), order_id: parseInt(orderId), reason: 'canceled' });
    }

    res.json({ success: true, message: 'Pago cancelado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/store/:code/tv-orders', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

    const [rows] = await pool.execute(
      `SELECT id, order_number, status, total, created_at, completed_at
       FROM orders
       WHERE store_id = ? AND payment_process = 1
         AND (
           (status IN ('preparing', 'ready') AND DATE(created_at) = CURDATE())
           OR
           (status = 'completed' AND completed_at >= NOW() - INTERVAL 5 MINUTE)
         )
       ORDER BY created_at ASC`,
      [store.id]
    );

    res.json({
      store: {
        code: store.code,
        name: store.name,
        primary_color: store.primary_color || '#000000',
        secondary_color: store.secondary_color || '#FFFFFF',
        accent_color: store.accent_color || '#D4AF37',
        logo_url: store.logo_url || null
      },
      preparing: rows.filter(o => o.status === 'preparing').map(o => ({
        id: o.id,
        order_number: o.order_number,
        created_at: o.created_at
      })),
      ready: rows.filter(o => o.status === 'ready').map(o => ({
        id: o.id,
        order_number: o.order_number,
        created_at: o.created_at
      })),
      completed: rows.filter(o => o.status === 'completed').map(o => ({
        id: o.id,
        order_number: o.order_number,
        completed_at: o.completed_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/store/:code/orders', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

    const [rows] = await pool.execute(
      `SELECT o.*, w.name as completed_by_name
       FROM orders o
       LEFT JOIN workers w ON o.completed_by = w.id
       WHERE o.store_id = ? AND o.payment_process = 1 AND DATE(o.created_at) = CURDATE()
       ORDER BY o.created_at DESC`,
      [store.id]
    );

    const orders = [];
    for (const order of rows) {
      const [items] = await pool.execute(
        `SELECT oi.*, COALESCE(p.name, 'Producto eliminado') as product_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      orders.push({
        id: order.id,
        external_reference: order.external_reference,
        sequence_id: order.sequence_id,
        reference_id: order.reference_id,
        order_number: order.order_number,
        order_type: order.order_type,
        status: order.status,
        cash_approved: order.cash_approved ? 1 : 0,
        payment_process: order.payment_process,
        total: parseFloat(order.total),
        subtotal: parseFloat(order.subtotal || 0),
        discount_total: parseFloat(order.discount_total || 0),
        payment_method: order.payment_method,
        coupon_code: order.coupon_code,
        completed_by_name: order.completed_by_name,
        created_at: order.created_at,
        items: items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
          selected_ingredients: JSON.parse(item.selected_ingredients || '[]'),
          selected_extras: JSON.parse(item.selected_extras || '[]')
        }))
      });
    }

    res.json({
      store: { code: store.code, name: store.name },
      total_orders: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const orders = await getOrders(parseInt(storeId));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const orders = await getOrders(parseInt(storeId), true);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/store/:storeId/find', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { q } = req.query;
    if (!q?.trim()) return res.json(null);
    const term = q.trim().toUpperCase();
    const [rows] = await pool.execute(
      `SELECT o.*, w.name as completed_by_name
       FROM orders o
       LEFT JOIN workers w ON o.completed_by = w.id
       WHERE o.store_id = ?
       AND DATE(o.created_at) = CURDATE()
       AND (UPPER(o.order_number) = ? OR CAST(o.id AS CHAR) = ?)
       LIMIT 1`,
      [parseInt(storeId), term, term]
    );
    if (rows.length === 0) return res.json(null);
    const order = rows[0];
    const [items] = await pool.execute(
      `SELECT oi.*, COALESCE(p.name, 'Producto eliminado') as product_name
       FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [order.id]
    );
    const parsedItems = items.map(item => ({
      ...item,
      selected_ingredients: item.selected_ingredients ? JSON.parse(item.selected_ingredients) : [],
      selected_extras: item.selected_extras ? JSON.parse(item.selected_extras) : []
    }));
    res.json({ ...order, total: parseFloat(order.total) || 0, items: parsedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, worker_id, worker_name } = req.body;
    const { id } = req.params;
    const { store_id } = req.query;
    
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    
    const order = await updateOrderStatus(parseInt(id), parseInt(store_id), status, worker_id, worker_name);
    const io_instance = req.app.get('io');
    if (io_instance) {
      io_instance.to(`store_${store_id}`).emit('order_updated', order);
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/approve-cash', authenticateToken, async (req, res) => {
  try {
    const { worker_id, worker_name } = req.body;
    const { id } = req.params;
    const { store_id } = req.query;
    
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    
    console.log('approve-cash request:', { id, store_id, worker_id, worker_name });
    const order = await approveCashPayment(parseInt(id), parseInt(store_id), worker_id, worker_name);
    console.log('approve-cash result:', order);
    const io_instance = req.app.get('io');
    if (io_instance) {
      io_instance.to(`store_${store_id}`).emit('cash_approved', order);
    }
    res.json(order);
  } catch (error) {
    console.error('approve-cash error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workers/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    
    const worker = await authenticateWorker(username, password);
    
    if (!worker) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign(
      { id: worker.id, type: 'worker', store_id: worker.store_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      worker: {
        id: worker.id,
        username: worker.username,
        name: worker.name,
        store_id: worker.store_id,
        store_name: worker.store_name,
        store_code: worker.store_code
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workers', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user' && req.user.type !== 'worker') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const storeId = req.query.store_id || req.user.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (req.user.type === 'user') {
      const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
      }
    }
    const workers = await getWorkers(parseInt(storeId));
    res.json(workers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workers', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { store_id, username, password, name } = req.body;
    
    if (!store_id || !username || !password || !name) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    const worker = await createWorker(parseInt(store_id), { username, password, name });
    res.json(worker);
  } catch (error) {
    if (error.message.includes('Duplicate')) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/workers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { store_id } = req.query;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    await deleteWorker(parseInt(req.params.id), parseInt(store_id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workers/orders', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'worker') {
      return res.status(403).json({ error: 'Acceso solo para trabajadores' });
    }
    
    const orders = await getWorkerOrders(req.user.store_id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mercado-pago-terminals', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    let terminals;

    if (storeId) {
      const store = await getStoreById(storeId);
      if (!store || store.user_id !== req.user.id) {
        return res.json([]);
      }
      try {
        const [rows] = await pool.execute(
          `SELECT m.id, m.name, m.mercadopago_terminal_id, m.mercadopago_access_token, m.user_id, m.created_at
           FROM mercado_pago_terminals m
           JOIN mercadopago_terminal_stores ms ON ms.mercadopago_terminal_id = m.id
           WHERE ms.store_id = ? AND m.user_id = ?`,
          [storeId, req.user.id]
        );
        terminals = rows;
      } catch {
        terminals = await getMercadoPagoTerminals(req.user.id);
      }
    } else {
      terminals = await getMercadoPagoTerminals(req.user.id);
    }
    res.json(terminals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mercado-pago-terminals', authenticateToken, async (req, res) => {
  try {
    const { name, mercadopago_access_token, mercadopago_terminal_id, store_id } = req.body;
    
    if (!name || !mercadopago_access_token || !mercadopago_terminal_id) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const terminal = await createMercadoPagoTerminal(req.user.id, {
      name,
      mercadopago_access_token,
      mercadopago_terminal_id
    });

    if (store_id) {
      await pool.execute(
        'INSERT IGNORE INTO mercadopago_terminal_stores (mercadopago_terminal_id, store_id) VALUES (?, ?)',
        [terminal.id, store_id]
      );
    }
    
    res.json(terminal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/mercado-pago-terminals/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mercadopago_access_token, mercadopago_terminal_id } = req.body;
    
    if (!name || !mercadopago_access_token || !mercadopago_terminal_id) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const terminal = await updateMercadoPagoTerminal(parseInt(id), req.user.id, {
      name,
      mercadopago_access_token,
      mercadopago_terminal_id
    });
    
    res.json(terminal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mercado-pago-terminals/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMercadoPagoTerminal(parseInt(id), req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detect MP devices from access token (for setup wizard)
app.post('/api/mercado-pago-detect-devices', authenticateToken, async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Access token requerido' });
    const mpRes = await fetch('https://api.mercadopago.com/terminals/v1/list?limit=50', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` }
    });
    if (!mpRes.ok) return res.status(mpRes.status).json({ error: 'Token invalido o error de MercadoPago' });
    const data = await mpRes.json();
    res.json(data.data?.terminals || []);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// List MP devices from API
app.get('/api/mercado-pago-terminals/:id/devices', authenticateToken, async (req, res) => {
  try {
    const terminal = await getMercadoPagoTerminalById(parseInt(req.params.id));
    if (!terminal || terminal.user_id !== req.user.id) return res.status(404).json({ error: 'Terminal no encontrada' });
    const mpRes = await fetch('https://api.mercadopago.com/terminals/v1/list?limit=50', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${terminal.mercadopago_access_token}` }
    });
    if (!mpRes.ok) return res.status(mpRes.status).json({ error: 'Error al consultar MercadoPago' });
    const data = await mpRes.json();
    res.json(data.data?.terminals || []);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Change MP terminal operating mode
app.patch('/api/mercado-pago-terminals/:id/mode', authenticateToken, async (req, res) => {
  try {
    const terminal = await getMercadoPagoTerminalById(parseInt(req.params.id));
    if (!terminal || terminal.user_id !== req.user.id) return res.status(404).json({ error: 'Terminal no encontrada' });
    const { device_id, operating_mode } = req.body;
    if (!device_id || !operating_mode) return res.status(400).json({ error: 'device_id y operating_mode requeridos' });
    if (!['PDV', 'STANDALONE'].includes(operating_mode)) return res.status(400).json({ error: 'Modo debe ser PDV o STANDALONE' });
    const mpRes = await fetch('https://api.mercadopago.com/terminals/v1/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${terminal.mercadopago_access_token}` },
      body: JSON.stringify({ terminals: [{ id: device_id, operating_mode }] })
    });
    if (!mpRes.ok) {
      const err = await mpRes.text();
      return res.status(mpRes.status).json({ error: 'Error MercadoPago: ' + err });
    }
    const data = await mpRes.json();
    res.json(data);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==================== Support Tickets API ====================

// Ensure tickets tables
let _ticketTablesReady = false;
let _ticketAvatarReady = false;
async function ensureTicketTables() {
  if (_ticketTablesReady && _ticketAvatarReady) return;
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS support_tickets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      priority ENUM('low','normal','important','urgent') DEFAULT 'normal',
      status ENUM('open','closed','resolved') DEFAULT 'open',
      support_pin VARCHAR(6) DEFAULT '000000',
      assigned_to VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    // Add missing columns
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM support_tickets');
      const names = cols.map(c => c.Field);
      if (!names.includes('assigned_to')) await pool.execute('ALTER TABLE support_tickets ADD COLUMN assigned_to VARCHAR(255) DEFAULT NULL');
      if (!names.includes('support_pin')) await pool.execute('ALTER TABLE support_tickets ADD COLUMN support_pin VARCHAR(6) DEFAULT "000000"');
    } catch {}
    await pool.execute(`CREATE TABLE IF NOT EXISTS ticket_messages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      ticket_id INT NOT NULL,
      sender_type ENUM('user','admin') NOT NULL,
      sender_name VARCHAR(255),
      sender_avatar TEXT DEFAULT NULL,
      message TEXT,
      image TEXT DEFAULT NULL,
      image_admin_only BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
    )`);
    if (!_ticketAvatarReady) {
      try {
        const [cols] = await pool.execute('SHOW COLUMNS FROM ticket_messages LIKE ?', ['sender_avatar']);
        if (cols.length === 0) await pool.execute('ALTER TABLE ticket_messages ADD COLUMN sender_avatar TEXT DEFAULT NULL AFTER sender_name');
        _ticketAvatarReady = true;
      } catch {}
    }
    _ticketTablesReady = true;
  } catch (e) { console.error('Ticket tables error:', e.message); }
}

// User: create ticket
app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    await ensureTicketTables();
    const { subject, priority, message } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Asunto y mensaje requeridos' });
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const [result] = await pool.execute(
      'INSERT INTO support_tickets (user_id, subject, priority, support_pin) VALUES (?, ?, ?, ?)',
      [req.user.id, subject, priority || 'normal', pin]
    );
    await pool.execute(
      'INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, message) VALUES (?, ?, ?, ?)',
      [result.insertId, 'user', req.user.username || 'Usuario', message]
    );
    // Auto-reply from bot
    const botMsg = 'Bienvenido al soporte de SRServi. En cuanto haya un agente disponible su solicitud sera atendida. Esto puede demorar desde 1 hora hasta 24 horas, o puede ser atendida al instante.\n\nPor seguridad, nunca le pediremos datos personales, contrasenas o informacion sensible a traves de nuestra plataforma de soporte ni por correo electronico.';
    await pool.execute(
      'INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, message) VALUES (?, ?, ?, ?)',
      [result.insertId, 'admin', 'SRServi Bot', botMsg]
    );
    io.emit('ticket_created', { ticket_id: result.insertId });
    res.json({ id: result.insertId, support_pin: pin });
  } catch (error) { console.error('Error creating ticket:', error); res.status(500).json({ error: error.message }); }
});

// User: list my tickets
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    await ensureTicketTables();
    const [rows] = await pool.execute(
      'SELECT id, subject, priority, status, support_pin, assigned_to, created_at, updated_at FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) { console.error('Error listing tickets:', error); res.status(500).json({ error: error.message }); }
});

// User: get ticket messages (filter admin-only images)
app.get('/api/tickets/:id/messages', authenticateToken, async (req, res) => {
  try {
    await ensureTicketTables();
    const [ticket] = await pool.execute('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (ticket.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    const [msgs] = await pool.execute('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);
    const filtered = msgs.map(m => ({ ...m, image: m.image_admin_only ? null : m.image }));
    res.json({ ticket: ticket[0], messages: filtered });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// User: send message with optional image
app.post('/api/tickets/:id/messages', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    await ensureTicketTables();
    const [ticket] = await pool.execute('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (ticket.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket[0].status === 'resolved') return res.status(400).json({ error: 'Ticket resuelto' });
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const msg = req.body.message || '';
    if (!msg && !image) return res.status(400).json({ error: 'Mensaje o imagen requeridos' });
    const [result] = await pool.execute(
      'INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, message, image, image_admin_only) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, 'user', req.user.username || 'Usuario', msg, image, image ? 1 : 0]
    );
    await pool.execute('UPDATE support_tickets SET status = "open", updated_at = NOW() WHERE id = ?', [req.params.id]);
    io.emit('ticket_message', { ticket_id: parseInt(req.params.id), message_id: result.insertId, sender_type: 'user', sender_name: req.user.username || 'Usuario', message: msg });
    res.json({ id: result.insertId });
  } catch (error) { console.error('Error sending ticket message:', error); res.status(500).json({ error: error.message }); }
});

// User: close ticket
app.put('/api/tickets/:id/close', authenticateToken, async (req, res) => {
  try {
    await pool.execute('UPDATE support_tickets SET status = "closed" WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    io.emit('ticket_updated', { ticket_id: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// User: reopen ticket
app.put('/api/tickets/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const [ticket] = await pool.execute('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (ticket.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket[0].status === 'resolved') return res.status(400).json({ error: 'No se puede reabrir un ticket resuelto' });
    await pool.execute('UPDATE support_tickets SET status = "open" WHERE id = ?', [req.params.id]);
    io.emit('ticket_updated', { ticket_id: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: list all tickets
app.get('/api/superadmin/tickets', authenticateSuperadminToken, async (req, res) => {
  try {
    await ensureTicketTables();
    const [rows] = await pool.execute(
      `SELECT t.*, u.username, u.email, u.business_name
       FROM support_tickets t JOIN users u ON t.user_id = u.id
       ORDER BY FIELD(t.priority, 'urgent','important','normal','low'), t.updated_at DESC`
    );
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: get ticket messages (full, including admin-only images)
app.get('/api/superadmin/tickets/:id/messages', authenticateSuperadminToken, async (req, res) => {
  try {
    const [ticket] = await pool.execute(
      `SELECT t.*, u.username, u.email, u.business_name FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
      [req.params.id]
    );
    if (ticket.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    const [msgs] = await pool.execute('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json({ ticket: ticket[0], messages: msgs });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: send message (assigns admin to ticket on first reply)
app.post('/api/superadmin/tickets/:id/messages', authenticateSuperadminToken, upload.single('image'), async (req, res) => {
  try {
    await ensureTicketTables();
    // Ensure superadmin columns
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM superadmin');
      const names = cols.map(c => c.Field);
      if (!names.includes('username')) await pool.execute('ALTER TABLE superadmin ADD COLUMN username VARCHAR(255) DEFAULT NULL');
      if (!names.includes('avatar')) await pool.execute('ALTER TABLE superadmin ADD COLUMN avatar TEXT DEFAULT NULL');
    } catch {}
    // Get admin profile
    let adminName = 'Soporte';
    let adminAvatar = null;
    try {
      const [rows] = await pool.execute('SELECT id, email, username, avatar FROM superadmin WHERE id = ?', [req.superadmin.id]);
      console.log('Admin profile for ticket:', req.superadmin.id, rows[0]);
      if (rows[0]) {
        adminName = rows[0].username || rows[0].email || 'Soporte';
        adminAvatar = rows[0].avatar || null;
      }
    } catch (e) { console.error('Error getting admin profile:', e.message); }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    // Add sender_avatar column if missing
    try {
      await pool.execute('ALTER TABLE ticket_messages ADD COLUMN sender_avatar TEXT DEFAULT NULL');
      console.log('Added sender_avatar column');
    } catch (alterErr) {
      // Column already exists or other error - that's fine
      if (!alterErr.message.includes('Duplicate')) console.log('sender_avatar column:', alterErr.message);
    }
    const [result] = await pool.execute(
      'INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, sender_avatar, message, image, image_admin_only) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, 'admin', adminName, adminAvatar, req.body.message || '', image, req.body.admin_only === 'true' ? 1 : 0]
    );
    console.log('Message saved with avatar:', adminAvatar, 'insertId:', result.insertId);
    await pool.execute('UPDATE support_tickets SET assigned_to = COALESCE(assigned_to, ?), updated_at = NOW() WHERE id = ?', [adminName, req.params.id]);
    io.emit('ticket_message', { ticket_id: parseInt(req.params.id), message_id: result.insertId, sender_type: 'admin', sender_name: adminName, sender_avatar: adminAvatar, message: req.body.message || '' });
    res.json({ id: result.insertId });
  } catch (error) { console.error('Error sending admin message:', error); res.status(500).json({ error: error.message }); }
});

// Superadmin: resolve ticket
app.put('/api/superadmin/tickets/:id/resolve', authenticateSuperadminToken, async (req, res) => {
  try {
    await pool.execute('UPDATE support_tickets SET status = "resolved" WHERE id = ?', [req.params.id]);
    io.emit('ticket_updated', { ticket_id: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: verify support pin
app.post('/api/superadmin/tickets/:id/verify-pin', authenticateSuperadminToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT support_pin FROM support_tickets WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json({ valid: rows[0].support_pin === req.body.pin });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==================== Plugin Management API ====================

const requirePremium = async (req, res, next) => {
  try {
    const plan = await getUserPlan(req.user.id);
    const isPremium = plan && plan.plan_name && plan.plan_name !== 'Gratis';
    if (!isPremium) {
      return res.status(403).json({ error: 'Necesitas un plan Premium para usar plugins' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Error verificando plan' });
  }
};

const pluginUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/api/admin/plugins', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.json([]);
    const plugins = await pluginManager.getAllPlugins();
    res.json(plugins);
  } catch (error) {
    console.error('❌ Error in GET /api/admin/plugins:', error);
    // If table doesn't exist yet, return empty
    if (error.message && error.message.includes("doesn't exist")) {
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/plugins/upload', authenticateToken, pluginUpload.single('plugin'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    const result = await pluginManager.install(req.file.buffer);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/plugins/:id/activate', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.activate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/plugins/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.deactivate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/plugins/:id', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.uninstall(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/plugins/:id/settings/:storeId', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.json({});
    const settings = await pluginManager.getPluginSettings(req.params.id, parseInt(req.params.storeId));
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/plugins/:id/settings/:storeId', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.savePluginSettings(req.params.id, parseInt(req.params.storeId), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Client manifest - checks premium via token if provided
app.get('/api/plugins/client-manifest', async (req, res) => {
  try {
    if (!pluginManager) return res.json([]);

    const manifest = await pluginManager.getClientManifest();
    res.json(manifest);
  } catch (error) {
    console.error('❌ Error in GET /api/plugins/client-manifest:', error);
    res.json([]);
  }
});

// ==================== Plugin Workshop API ====================

const workshopDir = path.join(__serverDir, 'plugins', 'workshop-uploads');
if (!fs.existsSync(workshopDir)) fs.mkdirSync(workshopDir, { recursive: true });

const workshopUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, workshopDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use('/api/workshop/files', express.static(workshopDir));

// Publish a plugin (or new version)
app.post('/api/workshop/publish', authenticateToken, workshopUpload.fields([
  { name: 'plugin', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]), async (req, res) => {
  try {
    const { description, contact_email, changelog } = req.body;
    if (!req.files?.plugin?.[0]) return res.status(400).json({ error: 'Se requiere un archivo .zip' });
    if (!contact_email) return res.status(400).json({ error: 'Se requiere email de contacto' });

    const zipFile = req.files.plugin[0];
    const logoFile = req.files?.logo?.[0] || null;

    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(zipFile.path);
    const entries = zip.getEntries();

    let pluginJsonEntry = null;
    for (const entry of entries) {
      const normalized = entry.entryName.replace(/\\/g, '/');
      if (normalized.endsWith('plugin.json') && !entry.isDirectory) {
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length <= 2) { pluginJsonEntry = entry; break; }
      }
    }
    if (!pluginJsonEntry) {
      fs.unlinkSync(zipFile.path);
      if (logoFile) fs.unlinkSync(logoFile.path);
      return res.status(400).json({ error: 'plugin.json no encontrado en el ZIP' });
    }

    let pluginJson;
    try { pluginJson = JSON.parse(pluginJsonEntry.getData().toString('utf8')); } catch {
      fs.unlinkSync(zipFile.path);
      if (logoFile) fs.unlinkSync(logoFile.path);
      return res.status(400).json({ error: 'plugin.json inválido' });
    }

    if (!pluginJson.id || !pluginJson.name || !pluginJson.version) {
      fs.unlinkSync(zipFile.path);
      if (logoFile) fs.unlinkSync(logoFile.path);
      return res.status(400).json({ error: 'plugin.json debe tener id, name y version' });
    }

    const user = await getUserById(req.user.id);
    const author = user?.business_name || user?.username || 'Anónimo';
    const logoPath = logoFile ? `/api/workshop/files/${logoFile.filename}` : null;
    const zipPath = `/api/workshop/files/${zipFile.filename}`;

    const [existing] = await pool.execute('SELECT id, user_id FROM plugin_workshop WHERE plugin_id = ?', [pluginJson.id]);

    if (existing.length > 0) {
      if (existing[0].user_id !== req.user.id) {
        fs.unlinkSync(zipFile.path);
        if (logoFile) fs.unlinkSync(logoFile.path);
        return res.status(403).json({ error: 'No eres el autor de este plugin' });
      }
      // Check duplicate version
      const [dupVer] = await pool.execute(
        'SELECT id FROM plugin_workshop_versions WHERE plugin_id = ? AND version = ?',
        [pluginJson.id, pluginJson.version]
      );
      if (dupVer.length > 0) {
        fs.unlinkSync(zipFile.path);
        if (logoFile) fs.unlinkSync(logoFile.path);
        return res.status(400).json({ error: `La versión ${pluginJson.version} ya existe. Cambia la versión en plugin.json` });
      }
      // Update main entry
      let updateQuery = `UPDATE plugin_workshop SET name = ?, latest_version = ?, description = ?, author = ?, contact_email = ?,
         hooks = ?, admin_slots = ?, store_slots = ?, updated_at = NOW()`;
      let updateParams = [pluginJson.name, pluginJson.version, description || pluginJson.description || '', author, contact_email,
         JSON.stringify(pluginJson.hooks || []), JSON.stringify(pluginJson.adminSlots || []),
         JSON.stringify(pluginJson.storeSlots || [])];
      if (logoFile) {
        updateQuery += ', logo = ?';
        updateParams.push(logoPath);
      }
      updateQuery += ' WHERE plugin_id = ?';
      updateParams.push(pluginJson.id);
      await pool.execute(updateQuery, updateParams);
    } else {
      await pool.execute(
        `INSERT INTO plugin_workshop (plugin_id, user_id, name, latest_version, description, author, contact_email, logo, downloads, zip_path, hooks, admin_slots, store_slots)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [pluginJson.id, req.user.id, pluginJson.name, pluginJson.version,
         description || pluginJson.description || '', author, contact_email,
         logoPath, zipPath, JSON.stringify(pluginJson.hooks || []),
         JSON.stringify(pluginJson.adminSlots || []), JSON.stringify(pluginJson.storeSlots || [])]
      );
    }

    // Insert version
    await pool.execute(
      `INSERT INTO plugin_workshop_versions (plugin_id, version, zip_path, changelog, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [pluginJson.id, pluginJson.version, zipPath, changelog || null]
    );

    res.json({ success: true, plugin_id: pluginJson.id, name: pluginJson.name, version: pluginJson.version });
  } catch (error) {
    console.error('❌ Error publishing plugin:', error);
    res.status(500).json({ error: error.message });
  }
});

// Browse workshop
app.get('/api/workshop/plugins', async (req, res) => {
  try {
    // Migrate old column name if needed
    try {
      const [cols] = await pool.execute('SHOW COLUMNS FROM plugin_workshop');
      const colNames = cols.map(c => c.Field);
      if (colNames.includes('version') && !colNames.includes('latest_version')) {
        await pool.execute('ALTER TABLE plugin_workshop CHANGE version latest_version VARCHAR(50) NOT NULL');
      }
      if (colNames.includes('zip_path') && !colNames.includes('latest_version')) {
        // Old schema had zip_path on main table; just ignore it
      }
    } catch (migErr) { /* ignore migration errors */ }

    const search = req.query.search || '';
    let query = `SELECT plugin_id, name, latest_version, description, author, contact_email, logo, downloads, hooks, admin_slots, store_slots, created_at, updated_at
                 FROM plugin_workshop WHERE status = 'approved'`;
    const params = [];
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR author LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY downloads DESC, created_at DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    if (error.message?.includes("doesn't exist") || error.message?.includes("Unknown column")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// Get versions of a plugin
app.get('/api/workshop/plugins/:pluginId/versions', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT v.* FROM plugin_workshop_versions v WHERE v.plugin_id = ? AND v.status = 'approved' ORDER BY v.created_at DESC`,
      [req.params.pluginId]
    );
    res.json(rows);
  } catch (error) {
    if (error.message?.includes("doesn't exist")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// Install a specific version from workshop
app.post('/api/workshop/install/:pluginId', authenticateToken, async (req, res) => {
  try {
    const { pluginId } = req.params;
    const { version } = req.body || {};

    // If version specified, get that version's zip; otherwise get latest approved
    let zipPath;
    if (version) {
      const [vRows] = await pool.execute(
        'SELECT zip_path FROM plugin_workshop_versions WHERE plugin_id = ? AND version = ? AND status = ?',
        [pluginId, version, 'approved']
      );
      if (vRows.length === 0) return res.status(404).json({ error: 'Versión no encontrada o no aprobada' });
      zipPath = vRows[0].zip_path;
    } else {
      const [vRows] = await pool.execute(
        'SELECT zip_path FROM plugin_workshop_versions WHERE plugin_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
        [pluginId, 'approved']
      );
      if (vRows.length === 0) return res.status(404).json({ error: 'No hay versiones aprobadas' });
      zipPath = vRows[0].zip_path;
    }

    const zipFilePath = path.join(workshopDir, path.basename(zipPath));
    if (!fs.existsSync(zipFilePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not ready' });

    const zipBuffer = fs.readFileSync(zipFilePath);
    const result = await pluginManager.install(zipBuffer);
    await pool.execute('UPDATE plugin_workshop SET downloads = downloads + 1 WHERE plugin_id = ?', [pluginId]);

    res.json({ success: true, plugin: result });
  } catch (error) {
    console.error('❌ Error installing from workshop:', error);
    res.status(500).json({ error: error.message });
  }
});

// My published plugins (with versions)
app.get('/api/workshop/my-plugins', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM plugin_workshop WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]
    );
    for (const row of rows) {
      const [versions] = await pool.execute(
        'SELECT version, status, changelog, created_at FROM plugin_workshop_versions WHERE plugin_id = ? ORDER BY created_at DESC',
        [row.plugin_id]
      );
      row.versions = versions;
    }
    res.json(rows);
  } catch (error) {
    if (error.message?.includes("doesn't exist")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// Delete my published plugin
app.delete('/api/workshop/my-plugins/:pluginId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM plugin_workshop WHERE plugin_id = ? AND user_id = ?', [req.params.pluginId, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    await pool.execute('DELETE FROM plugin_workshop_versions WHERE plugin_id = ?', [req.params.pluginId]);
    await pool.execute('DELETE FROM plugin_workshop WHERE plugin_id = ? AND user_id = ?', [req.params.pluginId, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check installed plugins for current user
app.get('/api/workshop/installed-ids', authenticateToken, async (req, res) => {
  try {
    if (!pluginManager) return res.json([]);
    const plugins = await pluginManager.getAllPlugins();
    res.json(plugins.map(p => ({ plugin_id: p.plugin_id, version: p.version })));
  } catch (error) {
    res.json([]);
  }
});

// Superadmin: list all workshop plugins with versions
app.get('/api/superadmin/workshop', authenticateSuperadminToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM plugin_workshop ORDER BY created_at DESC');
    for (const row of rows) {
      const [versions] = await pool.execute(
        'SELECT * FROM plugin_workshop_versions WHERE plugin_id = ? ORDER BY created_at DESC',
        [row.plugin_id]
      );
      row.versions = versions;
    }
    res.json(rows);
  } catch (error) {
    if (error.message?.includes("doesn't exist")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// Superadmin: review plugin source code before approving
app.get('/api/superadmin/workshop/:pluginId/version/:version/review', authenticateSuperadminToken, async (req, res) => {
  try {
    const [versions] = await pool.execute(
      'SELECT zip_path FROM plugin_workshop_versions WHERE plugin_id = ? AND version = ?',
      [req.params.pluginId, req.params.version]
    );
    if (versions.length === 0) return res.status(404).json({ error: 'Version no encontrada' });
    const workshopDir = path.join(__serverDir, 'plugins', 'workshop-uploads');
    const zipFilePath = path.join(workshopDir, path.basename(versions[0].zip_path));
    if (!fs.existsSync(zipFilePath)) return res.status(404).json({ error: 'ZIP no encontrado' });

    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();
    const files = {};
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /import\s+.*from\s+['"]fs['"]/,
      /import\s+.*from\s+['"]child_process['"]/,
      /process\.env/,
      /eval\s*\(/,
      /Function\s*\(/,
      /localStorage/,
      /document\.cookie/,
    ];

    const warnings = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/\\/g, '/');
      const ext = path.extname(name).toLowerCase();
      if (['.js', '.json', '.css', '.html', '.md', '.txt'].includes(ext)) {
        const content = entry.getData().toString('utf8');
        files[name] = content;
        // Scan for dangerous patterns
        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            warnings.push({ file: name, pattern: pattern.source, message: `Uso sospechoso detectado: ${pattern.source}` });
          }
        }
      } else {
        files[name] = `[Archivo binario: ${entry.header.size} bytes]`;
      }
    }
    res.json({ files, warnings });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Superadmin: approve/reject a specific version
app.put('/api/superadmin/workshop/:pluginId/version/:version/status', authenticateSuperadminToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    await pool.execute(
      'UPDATE plugin_workshop_versions SET status = ? WHERE plugin_id = ? AND version = ?',
      [status, req.params.pluginId, req.params.version]
    );
    // If any version approved, mark main plugin as approved
    const [approved] = await pool.execute(
      'SELECT id FROM plugin_workshop_versions WHERE plugin_id = ? AND status = ?',
      [req.params.pluginId, 'approved']
    );
    const mainStatus = approved.length > 0 ? 'approved' : status;
    await pool.execute('UPDATE plugin_workshop SET status = ? WHERE plugin_id = ?', [mainStatus, req.params.pluginId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== APK Static Download ====================
app.get('/api/download/launcher', (req, res) => {
  const apkPath = path.join(__serverDir, '../client/dist/SRServiLauncherClient.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="SRServiLauncherClient.apk"');
  res.sendFile(apkPath);
});

app.get('/api/download/tv', (req, res) => {
  const apkPath = path.join(__serverDir, '../client/public/SRServiTVOrder.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="SRServiTVOrder.apk"');
  res.sendFile(apkPath);
});

// ==================== APK Releases ====================

app.get('/api/superadmin/apks', authenticateSuperadminToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM apk_releases ORDER BY version_code DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/apks', authenticateSuperadminToken, apkUpload.fields([
  { name: 'apk', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description, version } = req.body;
    if (!name || !version) return res.status(400).json({ error: 'Nombre y versión son requeridos' });
    if (!req.files?.apk?.[0]) return res.status(400).json({ error: 'Archivo APK es requerido' });

    const apkUrl = `/uploads/apks/${req.files.apk[0].filename}`;
    const logoUrl = req.files?.logo?.[0] ? `/uploads/apks/${req.files.logo[0].filename}` : null;

    // Auto-increment version_code
    const [last] = await pool.execute('SELECT MAX(version_code) as max_code FROM apk_releases');
    const versionCode = (last[0].max_code || 0) + 1;

    const [result] = await pool.execute(
      'INSERT INTO apk_releases (name, description, version, version_code, logo, apk_url) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', version, versionCode, logoUrl, apkUrl]
    );

    res.json({ id: result.insertId, name, version, version_code: versionCode, apk_url: apkUrl, logo: logoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/apks/:id', authenticateSuperadminToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM apk_releases WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint público para obtener la última versión
app.get('/api/apk/latest', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM apk_releases ORDER BY version_code DESC LIMIT 1');
    if (rows.length === 0) return res.status(404).json({ error: 'No hay versiones disponibles' });
    const release = rows[0];
    res.json({
      name: release.name,
      description: release.description,
      version: release.version,
      version_code: release.version_code,
      logo: release.logo,
      apk_url: release.apk_url,
      created_at: release.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint público para obtener todas las versiones
app.get('/api/apk/releases', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM apk_releases ORDER BY version_code DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let pluginManager = null;

// Prevent plugin errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('🔌 Uncaught exception (server kept running):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔌 Unhandled rejection (server kept running):', reason?.message || reason);
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Base de datos inicializada');

    app.set('io', io);

    // Initialize plugin system
    pluginManager = new PluginManager(app, pool, io);
    try {
      await pluginManager.loadAllActive();
    } catch (pluginError) {
      console.error('🔌 Error loading plugins (server continues):', pluginError.message);
    }

    // ==================== TUU POS NATIVO ====================
    const TUU_API = 'https://integrations.payment.haulmer.com/RemotePayment/v2';

    let tuuActivePolls = new global.Map ? new global.Map() : new Map();
    const squareActivePolls = new Map(); // checkoutId -> intervalId

    async function tuuGetUserIdFromStore(storeId) {
      const [rows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
      return rows[0]?.user_id || null;
    }

    async function tuuGetConfig(userId) {
      const [rows] = await pool.execute('SELECT * FROM tuu_config WHERE user_id = ?', [userId]);
      return rows[0] || null;
    }

    async function tuuGetDeviceForUid(deviceUid, storeId) {
      if (!deviceUid) return null;
      const [rows] = await pool.execute(
        `SELECT d.* FROM tuu_devices d JOIN tuu_device_pos dp ON d.id = dp.tuu_device_id WHERE dp.device_uid = ? AND dp.store_id = ?`,
        [deviceUid, storeId]
      );
      return rows[0] || null;
    }

    async function tuuGetAnyDeviceForStore(storeId) {
      const userId = await tuuGetUserIdFromStore(storeId);
      const [rows] = await pool.execute(
        `SELECT d.*, dp.device_uid
         FROM tuu_devices d
         LEFT JOIN tuu_device_pos dp ON d.id = dp.tuu_device_id AND dp.store_id = ?
         WHERE d.user_id = ?
         LIMIT 1`,
        [storeId, userId]
      );
      return rows[0] || null;
    }

    async function tuuCreatePayment(apiKey, amount, deviceSerial, description, dteType, orderNumber) {
      const idempotencyKey = crypto.randomUUID();
      const extraData = {
        sourceName: 'SRServi',
        sourceVersion: '1.1.0'
      };
      if (orderNumber) {
        extraData.customFields = [
          { name: 'ORDEN:', value: String(orderNumber), print: true }
        ];
      }
      const response = await fetch(`${TUU_API}/Create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          Amount: Math.round(amount),
          Device: deviceSerial,
          IdempotencyKey: idempotencyKey,
          Description: description || 'Pago SRServi',
          DteType: dteType || 0,
          extraData
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
      return { ...data, idempotencyKey: data.idempotencyKey || idempotencyKey };
    }

    async function tuuCheckStatus(apiKey, idempotencyKey) {
      const response = await fetch(`${TUU_API}/GetPaymentRequest/${idempotencyKey}`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Error ${response.status}`);
      }
      return response.json();
    }

    function tuuStartPolling(apiKey, idempotencyKey, storeId, orderId) {
      let attempts = 0;
      const intervalId = setInterval(async () => {
        attempts++;
        try {
          const data = await tuuCheckStatus(apiKey, idempotencyKey);
          if (data.status === 'Completed') {
            clearInterval(intervalId);
            tuuActivePolls.delete(idempotencyKey);
            await pool.execute(
              'UPDATE tuu_transactions SET status = ?, transaction_ref = ?, updated_at = NOW() WHERE idempotency_key = ?',
              ['Completed', data.transactionReference || null, idempotencyKey]
            );
            let orderNumber = null;
            if (orderId) {
              await pool.execute(
                "UPDATE orders SET status = 'preparing', payment_process = 1, cash_approved = TRUE, sequence_id = ?, reference_id = ? WHERE id = ?",
                [data.sequenceNumber || null, data.transactionReference || null, orderId]
              ).catch(() => {});
              const [orRows] = await pool.execute('SELECT order_number FROM orders WHERE id = ?', [orderId]).catch(() => [[]]);
              orderNumber = orRows[0]?.order_number || null;
            }
            const socketId = userSockets.get(parseInt(storeId));
            if (socketId) io.to(socketId).emit('tuu_payment_update', { idempotencyKey, orderId, order_number: orderNumber, status: 'Completed', transactionRef: data.transactionReference, sequenceNumber: data.sequenceNumber });
          } else if (data.status === 'Canceled' || data.status === 'Failed') {
            clearInterval(intervalId);
            tuuActivePolls.delete(idempotencyKey);
            await pool.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', [data.status, idempotencyKey]);
            if (orderId) {
              await pool.execute("UPDATE orders SET status = 'canceled' WHERE id = ?", [orderId]).catch(() => {});
            }
            const socketId = userSockets.get(parseInt(storeId));
            if (socketId) io.to(socketId).emit('tuu_payment_update', { idempotencyKey, orderId, status: data.status });
          }
        } catch (err) {
          console.error('Tuu poll error:', err.message);
        }
        if (attempts >= 60) {
          clearInterval(intervalId);
          tuuActivePolls.delete(idempotencyKey);
          await pool.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Timeout', idempotencyKey]);
          const socketId = userSockets.get(parseInt(storeId));
          if (socketId) io.to(socketId).emit('tuu_payment_update', { idempotencyKey, orderId, status: 'Timeout' });
        }
      }, 5000);
      tuuActivePolls.set(idempotencyKey, intervalId);
    }

    app.get('/api/tuu/config', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const userId = await tuuGetUserIdFromStore(storeId);
        const config = await tuuGetConfig(userId);
        res.json(config ? { api_key: config.api_key, dte_type: config.dte_type } : { api_key: '', dte_type: 0 });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/tuu/config', async (req, res) => {
      try {
        const { store_id, api_key, dte_type } = req.body;
        const userId = await tuuGetUserIdFromStore(parseInt(store_id));
        await pool.execute(
          'INSERT INTO tuu_config (user_id, api_key, dte_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE api_key = ?, dte_type = ?',
          [userId, api_key, dte_type || 0, api_key, dte_type || 0]
        );
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/tuu/devices', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const userId = await tuuGetUserIdFromStore(storeId);
        const [posDevices] = await pool.execute('SELECT * FROM tuu_devices WHERE user_id = ? ORDER BY name', [userId]);
        let storeDevices = [];
        try {
          const [rows] = await pool.execute('SELECT * FROM store_devices WHERE store_id = ? ORDER BY last_seen DESC', [storeId]);
          storeDevices = rows;
        } catch { /* table might not exist */ }
        let assignments = [];
        try {
          const [rows] = await pool.execute('SELECT * FROM tuu_device_pos WHERE store_id = ?', [storeId]);
          assignments = rows;
        } catch { /* table might not exist */ }
        res.json({ posDevices, storeDevices, assignments });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/tuu/devices', async (req, res) => {
      try {
        const { store_id, name, serial, device_id, api_key } = req.body;
        if (!name || !serial) return res.status(400).json({ error: 'Nombre y serial requeridos' });
        const userId = await tuuGetUserIdFromStore(parseInt(store_id));
        if (api_key) {
          await pool.execute(
            'INSERT INTO tuu_config (user_id, api_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE api_key = ?',
            [userId, api_key, api_key]
          );
        }
        let result;
        try {
          [result] = await pool.execute('INSERT INTO tuu_devices (user_id, name, serial, device_id) VALUES (?, ?, ?, ?)', [userId, name, serial, device_id || '']);
        } catch {
          [result] = await pool.execute('INSERT INTO tuu_devices (user_id, name, serial) VALUES (?, ?, ?)', [userId, name, serial]);
        }
        const deviceUid = 'tuu-' + result.insertId + '-' + Date.now();
        try {
          await pool.execute(
            'INSERT INTO tuu_device_pos (device_uid, tuu_device_id, store_id) VALUES (?, ?, ?)',
            [deviceUid, result.insertId, parseInt(store_id)]
          );
        } catch { }
        res.json({ id: result.insertId, name, serial, device_id: device_id || '' });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/tuu/devices/:id', async (req, res) => {
      try {
        await pool.execute('DELETE FROM tuu_device_pos WHERE tuu_device_id = ?', [req.params.id]);
        await pool.execute('DELETE FROM tuu_devices WHERE id = ?', [req.params.id]);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/tuu/devices/assign', async (req, res) => {
      try {
        const { store_id, device_uid, tuu_device_id } = req.body;
        if (!device_uid || !tuu_device_id) return res.status(400).json({ error: 'device_uid y tuu_device_id requeridos' });
        await pool.execute(
          'INSERT INTO tuu_device_pos (device_uid, tuu_device_id, store_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tuu_device_id = ?',
          [device_uid, parseInt(tuu_device_id), parseInt(store_id), parseInt(tuu_device_id)]
        );
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/tuu/available', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const deviceUid = req.query.device_uid;
        const userId = await tuuGetUserIdFromStore(storeId);
        const config = await tuuGetConfig(userId);
        if (!config?.api_key) return res.json({ available: false });
        const device = deviceUid ? await tuuGetDeviceForUid(deviceUid, storeId) : await tuuGetAnyDeviceForStore(storeId);
        res.json({ available: !!device?.serial, deviceName: device?.name || null });
      } catch (e) { res.json({ available: false }); }
    });

    // ── NATIVE TUU ENDPOINTS (no plugin system) ──────────────────────────

    app.get('/api/tuu/provider', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const deviceUid = req.query.device_uid;
        const terminalId = parseInt(req.query.terminal_id) || null;
        if (!storeId) return res.json({ available: false });
        const userId = await tuuGetUserIdFromStore(storeId);
        const config = await tuuGetConfig(userId);
        if (!config?.api_key) return res.json({ available: false, reason: 'No API Key TUU' });
        let device = null;
        if (terminalId) {
          const [rows] = await pool.execute('SELECT * FROM tuu_devices WHERE id = ? AND user_id = ?', [terminalId, userId]);
          device = rows[0] || null;
        }
        if (!device && deviceUid) device = await tuuGetDeviceForUid(deviceUid, storeId);
        if (!device) device = await tuuGetAnyDeviceForStore(storeId);
        if (!device) return res.json({ available: false, reason: 'No hay dispositivo TUU' });
        res.json({ available: true, provider: 'tuu', deviceName: device.name, deviceSerial: device.serial, deviceId: device.id });
      } catch (e) { res.json({ available: false, reason: e.message }); }
    });

    app.post('/api/tuu/charge', async (req, res) => {
      try {
        const { store_id, order_id, amount, description, device_uid, terminal_id } = req.body;
        if (!store_id || !amount) return res.status(400).json({ error: 'store_id y amount requeridos' });
        const userId = await tuuGetUserIdFromStore(parseInt(store_id));
        const config = await tuuGetConfig(userId);
        if (!config?.api_key) return res.status(400).json({ error: 'API Key de TUU no configurada. Ve al admin > Vincular POS > TUU.' });
        let device = null;
        if (terminal_id) {
          const [rows] = await pool.execute('SELECT * FROM tuu_devices WHERE id = ? AND user_id = ?', [parseInt(terminal_id), userId]);
          device = rows[0] || null;
        }
        if (!device && device_uid) device = await tuuGetDeviceForUid(device_uid, parseInt(store_id));
        if (!device) device = await tuuGetAnyDeviceForStore(parseInt(store_id));
        if (!device) return res.status(400).json({ error: 'No hay POS TUU configurado. Ve al admin > Vincular POS.' });
        let orderNumber = null;
        if (order_id) {
          const [orRows] = await pool.execute('SELECT order_number, store_id FROM orders WHERE id = ?', [order_id]).catch(() => [[]]);
          orderNumber = orRows[0]?.order_number || null;
          // Si la orden aún no tiene order_number, generarlo y asignarlo ahora
          // para que quede impreso en la boleta TUU
          if (orRows[0] && !orderNumber) {
            const orderStoreId = orRows[0].store_id || store_id;
            const [usedRows] = await pool.execute(
              'SELECT order_number FROM orders WHERE store_id = ? AND DATE(created_at) = CURDATE() AND order_number IS NOT NULL',
              [orderStoreId]
            );
            const used = new Set(usedRows.map(r => r.order_number));
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let orderNum = null;
            for (let i = 0; i < 200 && !orderNum; i++) {
              const c = letters[Math.floor(Math.random() * 26)] + String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
              if (!used.has(c)) orderNum = c;
            }
            if (!orderNum) orderNum = String(used.size + 1);
            await pool.execute('UPDATE orders SET order_number = ? WHERE id = ?', [orderNum, order_id]);
            orderNumber = orderNum;
          }
        }
        const payment = await tuuCreatePayment(config.api_key, amount, device.serial, description || '', config.dte_type, orderNumber);
        await pool.execute(
          'INSERT INTO tuu_transactions (store_id, order_id, idempotency_key, amount, status, device_serial) VALUES (?, ?, ?, ?, ?, ?)',
          [parseInt(store_id), order_id || null, payment.idempotencyKey, Math.round(amount), 'Pending', device.serial]
        );
        tuuStartPolling(config.api_key, payment.idempotencyKey, parseInt(store_id), order_id);
        res.json({ success: true, paymentKey: payment.idempotencyKey, status: payment.status, deviceName: device.name });
      } catch (e) {
        console.error('[tuu/charge]', e.message);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/tuu/status/:key', async (req, res) => {
      try {
        const [rows] = await pool.execute(
          'SELECT t.*, o.order_number FROM tuu_transactions t LEFT JOIN orders o ON o.id = t.order_id WHERE t.idempotency_key = ?',
          [req.params.key]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(rows[0]);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/tuu/cancel/:key', async (req, res) => {
      try {
        const key = req.params.key;
        const intervalId = tuuActivePolls.get(key);
        if (intervalId) { clearInterval(intervalId); tuuActivePolls.delete(key); }
        await pool.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Canceled', key]);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── END NATIVE TUU ENDPOINTS ──────────────────────────────────────────

    app.get('/api/plugins/payments/provider', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const deviceUid = req.query.device_uid;
        const terminalId = parseInt(req.query.terminal_id);
        const terminalProvider = req.query.terminal_provider || '';
        console.log('[provider] store_id:', storeId, 'device_uid:', deviceUid, 'terminal_id:', terminalId, 'terminal_provider:', terminalProvider);
        if (!storeId) { console.log('[provider] FAIL: no storeId'); return res.json({ available: false, reason: 'no storeId' }); }
        let userId;
        try {
          userId = await tuuGetUserIdFromStore(storeId);
          console.log('[provider] userId:', userId);
        } catch (e) { console.log('[provider] tuuGetUserIdFromStore error:', e.message); return res.json({ available: false, reason: 'userId error: ' + e.message }); }
        let config;
        try {
          config = await tuuGetConfig(userId);
          console.log('[provider] config:', config ? JSON.stringify(config) : 'null');
          console.log('[provider] config.api_key exists:', !!config?.api_key);
        } catch (e) { console.log('[provider] tuuGetConfig error:', e.message); return res.json({ available: false, reason: 'config error: ' + e.message }); }
        if (!config?.api_key) { console.log('[provider] FAIL: no api_key'); return res.json({ available: false, reason: 'No hay API Key de Tuu configurada para esta cuenta. Ve al admin > Tuu POS > Configuración.' }); }
        // FIX: Si el usuario eligió explícitamente un terminal que NO es Tuu (ej: MercadoPago),
        // no debemos activar el proveedor Tuu aunque existan dispositivos Tuu en la tienda.
        if (terminalProvider && terminalProvider !== 'tuu') {
          console.log('[provider] SKIP: terminal_provider is', terminalProvider, '- not Tuu, deferring to MercadoPago handler');
          return res.json({ available: false, reason: 'Terminal seleccionado no es Tuu' });
        }
        let device = null;
        if (terminalId && terminalProvider === 'tuu') {
          console.log('[provider] Looking for tuu device by terminal_id:', terminalId);
          const [rows] = await pool.execute('SELECT * FROM tuu_devices WHERE id = ? AND user_id = ?', [terminalId, userId]);
          console.log('[provider] tuu_devices by id result:', rows.length, rows[0]?.name);
          device = rows[0] || null;
        }
        if (!device && deviceUid) {
          console.log('[provider] Looking for tuu device by device_uid:', deviceUid);
          device = await tuuGetDeviceForUid(deviceUid, storeId);
          console.log('[provider] tuuGetDeviceForUid result:', device?.name);
        }
        if (!device) {
          console.log('[provider] Looking for any tuu device for store');
          device = await tuuGetAnyDeviceForStore(storeId);
          console.log('[provider] tuuGetAnyDeviceForStore result:', device?.name);
        }
        if (!device) { console.log('[provider] FAIL: no device found'); return res.json({ available: false, reason: 'No hay POS Tuu configurado para esta tienda. Ve al admin > Tuu POS > Vincular POS.' }); }
        console.log('[provider] SUCCESS - device:', device.name);
        res.json({
          available: true,
          provider: 'tuu',
          deviceUid: device.device_uid || deviceUid,
          deviceName: device.name,
          deviceSerial: device.serial
        });
      } catch (e) { console.error('[provider] error:', e.message); res.json({ available: false, reason: 'error: ' + e.message }); }
    });

    // Square provider — native handler (called when PluginManager passes via next())
    app.get('/api/plugins/payments/provider', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const terminalId = parseInt(req.query.terminal_id);
        const terminalProvider = req.query.terminal_provider || '';
        if (!storeId) return res.json({ available: false });
        if (terminalProvider && terminalProvider !== 'square') return res.json({ available: false });
        // Get userId from store
        const [storeRows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
        if (!storeRows[0]) return res.json({ available: false });
        const userId = storeRows[0].user_id;
        const [cfgRows] = await pool.execute('SELECT * FROM square_config WHERE user_id = ?', [userId]);
        if (!cfgRows[0]?.access_token) return res.json({ available: false, reason: 'No Square config' });
        let device = null;
        if (terminalId) {
          const [rows] = await pool.execute('SELECT * FROM square_devices WHERE id = ? AND user_id = ?', [terminalId, userId]);
          device = rows[0] || null;
        }
        if (!device) {
          const [rows] = await pool.execute('SELECT * FROM square_devices WHERE user_id = ? AND store_id = ? LIMIT 1', [userId, storeId]);
          device = rows[0] || null;
        }
        if (!device) return res.json({ available: false, reason: 'No Square device found' });
        res.json({ available: true, provider: 'square', deviceId: device.device_id, deviceName: device.name });
      } catch (e) { res.json({ available: false, reason: e.message }); }
    });

    app.post('/api/plugins/payments/charge', async (req, res) => {
      try {
        const { store_id, order_id, amount, description, device_uid, terminal_id, terminal_provider } = req.body;
        console.log('[charge] store_id:', store_id, 'terminal_id:', terminal_id, 'terminal_provider:', terminal_provider, 'device_uid:', device_uid);
        if (!store_id || !amount) return res.status(400).json({ error: 'store_id y amount requeridos' });
        let userId;
        try {
          userId = await tuuGetUserIdFromStore(parseInt(store_id));
          console.log('[charge] userId:', userId);
        } catch (e) { console.error('[charge] userId error:', e.message); return res.status(500).json({ error: 'Error al obtener usuario de tienda' }); }
        let config;
        try {
          config = await tuuGetConfig(userId);
          console.log('[charge] config:', config ? JSON.stringify({api_key: config.api_key ? '***' : 'null'}) : 'null');
        } catch (e) { console.error('[charge] config error:', e.message); return res.status(500).json({ error: 'Error al obtener config Tuu' }); }
        if (!config?.api_key) {
          console.log('[charge] FAIL: no api_key for userId:', userId);
          return res.status(400).json({ error: 'API Key de Tuu no configurada. Ve al admin > Tuu POS > Configuración y guarda tu API Key.' });
        }
        // Si el terminal es Square, lo maneja el bloque Square de abajo.
        // Si es otro proveedor no-Tuu (ej: MercadoPago), rechazar aquí.
        if (terminal_provider && terminal_provider === 'square') {
          // ── SQUARE TERMINAL CHARGE ──────────────────────────────────────
          console.log('[charge-square] starting - store_id:', store_id, 'terminal_id:', terminal_id, 'amount:', amount);
          try {
            // Ensure sq_checkouts table exists
            await pool.execute(`CREATE TABLE IF NOT EXISTS sq_checkouts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              checkout_id VARCHAR(255) NOT NULL UNIQUE,
              store_id INT NOT NULL,
              order_id INT DEFAULT NULL,
              amount INT NOT NULL,
              currency VARCHAR(3) DEFAULT 'USD',
              status VARCHAR(50) DEFAULT 'PENDING',
              device_id VARCHAR(255) DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`);

            // Get Square config for this store
            const [storeRows2] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [parseInt(store_id)]);
            if (!storeRows2[0]) return res.status(400).json({ error: 'Tienda no encontrada' });
            const sqUserId = storeRows2[0].user_id;
            const [sqCfgRows] = await pool.execute('SELECT * FROM square_config WHERE user_id = ?', [sqUserId]);
            const sqCfg = sqCfgRows[0];
            if (!sqCfg?.access_token) return res.status(400).json({ error: 'Square no configurado. Ve al admin > Vincular POS > Square.' });

            // Find device
            let sqDevice = null;
            if (terminal_id) {
              const [sqDevRows] = await pool.execute('SELECT * FROM square_devices WHERE id = ? AND user_id = ?', [parseInt(terminal_id), sqUserId]);
              sqDevice = sqDevRows[0] || null;
            }
            if (!sqDevice) {
              const [sqDevRows] = await pool.execute('SELECT * FROM square_devices WHERE user_id = ? AND store_id = ? ORDER BY created_at DESC LIMIT 1', [sqUserId, parseInt(store_id)]);
              sqDevice = sqDevRows[0] || null;
            }
            if (!sqDevice) return res.status(400).json({ error: 'No hay terminal Square vinculado. Ve al admin > Vincular POS > Square.' });

            // Strip device: prefix if present (legacy)
            const sqDeviceId = sqDevice.device_id.startsWith('device:') ? sqDevice.device_id.slice(7) : sqDevice.device_id;

            // Square amounts are always in cents USD
            const sqAmount = Math.round(Number(amount));

            const sqPayload = {
              idempotency_key: 'sq_' + Date.now() + '_' + Math.random().toString(36).slice(2),
              checkout: {
                amount_money: { amount: sqAmount, currency: 'USD' },
                device_options: { device_id: sqDeviceId },
                reference_id: String(order_id || ''),
                note: description || ('Orden #' + (order_id || '')),
              }
            };

            console.log('[charge-square] POST /v2/terminals/checkouts payload:', JSON.stringify(sqPayload));

            const sqRes = await fetch('https://connect.squareup.com/v2/terminals/checkouts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sqCfg.access_token,
                'Square-Version': '2026-01-22'
              },
              body: JSON.stringify(sqPayload)
            });

            const sqData = await sqRes.json();
            console.log('[charge-square] Square response status:', sqRes.status, 'checkout id:', sqData?.checkout?.id);

            if (!sqRes.ok || !sqData?.checkout?.id) {
              const sqErr = sqData?.errors?.[0]?.detail || 'Error desconocido Square';
              console.error('[charge-square] Square API error:', sqErr);
              return res.status(400).json({ error: sqErr });
            }

            const checkoutId = sqData.checkout.id;

            // Persist to DB
            await pool.execute(
              'INSERT INTO sq_checkouts (checkout_id, store_id, order_id, amount, currency, status, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [checkoutId, parseInt(store_id), order_id || null, sqAmount, 'USD', 'PENDING', sqDeviceId]
            );

            // Start server-side polling (every 5s, max 60 attempts = 5 min)
            let sqAttempts = 0;
            const sqPollId = setInterval(async () => {
              sqAttempts++;
              try {
                const pollRes = await fetch('https://connect.squareup.com/v2/terminals/checkouts/' + encodeURIComponent(checkoutId), {
                  headers: { 'Authorization': 'Bearer ' + sqCfg.access_token, 'Square-Version': '2026-01-22' }
                });
                const pollData = await pollRes.json();
                const sqStatus = pollData?.checkout?.status || 'UNKNOWN';
                console.log('[charge-square] poll attempt', sqAttempts, 'status:', sqStatus, 'checkout:', checkoutId);

                if (sqStatus === 'COMPLETED') {
                  clearInterval(sqPollId); squareActivePolls.delete(checkoutId);
                  await pool.execute('UPDATE sq_checkouts SET status = ? WHERE checkout_id = ?', ['Completed', checkoutId]);
                  if (order_id) {
                    await pool.execute("UPDATE orders SET status = 'preparing', payment_process = 1, cash_approved = TRUE WHERE id = ?", [order_id]).catch(() => {});
                  }
                  const socketId = userSockets.get(parseInt(store_id));
                  if (socketId) io.to(socketId).emit('square_payment_update', { checkoutId, orderId: order_id, status: 'Completed' });
                } else if (sqStatus === 'CANCELED' || sqStatus === 'CANCEL_REQUESTED') {
                  clearInterval(sqPollId); squareActivePolls.delete(checkoutId);
                  await pool.execute('UPDATE sq_checkouts SET status = ? WHERE checkout_id = ?', ['Canceled', checkoutId]);
                  if (order_id) {
                    await pool.execute("UPDATE orders SET status = 'canceled' WHERE id = ?", [order_id]).catch(() => {});
                  }
                  const socketId = userSockets.get(parseInt(store_id));
                  if (socketId) io.to(socketId).emit('square_payment_update', { checkoutId, orderId: order_id, status: 'Canceled' });
                }
              } catch (pollErr) { console.error('[charge-square] poll error:', pollErr.message); }

              if (sqAttempts >= 60) {
                clearInterval(sqPollId); squareActivePolls.delete(checkoutId);
                // Auto-cancel on timeout
                fetch('https://connect.squareup.com/v2/terminals/checkouts/' + encodeURIComponent(checkoutId) + '/cancel', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sqCfg.access_token, 'Square-Version': '2026-01-22' },
                  body: '{}'
                }).catch(() => {});
                await pool.execute('UPDATE sq_checkouts SET status = ? WHERE checkout_id = ?', ['Timeout', checkoutId]);
                const socketId = userSockets.get(parseInt(store_id));
                if (socketId) io.to(socketId).emit('square_payment_update', { checkoutId, orderId: order_id, status: 'Timeout' });
              }
            }, 5000);
            squareActivePolls.set(checkoutId, sqPollId);

            return res.json({ success: true, paymentKey: checkoutId, status: 'PENDING', deviceName: sqDevice.name, provider: 'square' });

          } catch (sqErr) {
            console.error('[charge-square] error:', sqErr.message);
            return res.status(500).json({ error: sqErr.message });
          }
          // ── END SQUARE TERMINAL CHARGE ──────────────────────────────────
        }

        if (terminal_provider && terminal_provider !== 'tuu') {
          console.log('[charge] SKIP: terminal_provider is', terminal_provider, '- not Tuu');
          return res.status(400).json({ error: 'Terminal seleccionado no es Tuu. Usa el flujo de MercadoPago.' });
        }
        let device = null;
        if (terminal_id && terminal_provider === 'tuu') {
          console.log('[charge] Looking for device by terminal_id:', terminal_id, 'userId:', userId);
          const [rows] = await pool.execute('SELECT * FROM tuu_devices WHERE id = ? AND user_id = ?', [parseInt(terminal_id), userId]);
          console.log('[charge] tuu_devices result:', rows.length, rows[0]?.name);
          device = rows[0] || null;
        }
        if (!device && device_uid) {
          device = await tuuGetDeviceForUid(device_uid, parseInt(store_id));
          console.log('[charge] tuuGetDeviceForUid result:', device?.name);
        }
        if (!device) {
          device = await tuuGetAnyDeviceForStore(parseInt(store_id));
          console.log('[charge] tuuGetAnyDeviceForStore result:', device?.name);
        }
        if (!device) {
          console.log('[charge] FAIL: no device found');
          return res.status(400).json({ error: 'No hay POS Tuu configurado. Ve al admin > Tuu POS > Vincular POS.' });
        }
        console.log('[charge] SUCCESS - using device:', device.name, 'serial:', device.serial);
        const payment = await tuuCreatePayment(config.api_key, amount, device.serial, description || '', config.dte_type);
        await pool.execute(
          'INSERT INTO tuu_transactions (store_id, order_id, idempotency_key, amount, status, device_serial) VALUES (?, ?, ?, ?, ?, ?)',
          [parseInt(store_id), order_id || null, payment.idempotencyKey, Math.round(amount), 'Pending', device.serial]
        );
        tuuStartPolling(config.api_key, payment.idempotencyKey, parseInt(store_id), order_id);
        res.json({ success: true, paymentKey: payment.idempotencyKey, status: payment.status, deviceName: device.name });
      } catch (e) {
        console.error('Tuu plugin charge error:', e.message);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/plugins/payments/status/:key', async (req, res) => {
      try {
        const key = req.params.key;

        // 1. Check Square checkouts first (checkout IDs look like random strings, not idempotency keys)
        const [sqRows] = await pool.execute('SELECT * FROM sq_checkouts WHERE checkout_id = ?', [key]);
        if (sqRows.length > 0) {
          const sq = sqRows[0];
          // If still pending, query Square API for fresh status
          if (sq.status === 'PENDING') {
            try {
              const storeId = sq.store_id;
              const [storeRows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
              const userId = storeRows[0]?.user_id;
              if (userId) {
                const [cfgRows] = await pool.execute('SELECT access_token FROM square_config WHERE user_id = ?', [userId]);
                if (cfgRows[0]?.access_token) {
                  const pollRes = await fetch('https://connect.squareup.com/v2/terminals/checkouts/' + encodeURIComponent(key), {
                    headers: { 'Authorization': 'Bearer ' + cfgRows[0].access_token, 'Square-Version': '2026-01-22' }
                  });
                  const pollData = await pollRes.json();
                  const freshStatus = pollData?.checkout?.status || 'UNKNOWN';
                  if (freshStatus !== 'PENDING' && freshStatus !== 'IN_PROGRESS') {
                    // Normalize Square status → Store.jsx expected values
                    const normalized = freshStatus === 'COMPLETED' ? 'Completed' : freshStatus === 'CANCELED' || freshStatus === 'CANCEL_REQUESTED' ? 'Canceled' : freshStatus;
                    await pool.execute('UPDATE sq_checkouts SET status = ? WHERE checkout_id = ?', [normalized, key]);
                    sq.status = normalized;
                  }
                }
              }
            } catch (pollErr) { console.error('[status-square] poll error:', pollErr.message); }
          }
          // Normalize stored status for Store.jsx polling
          const normalized = sq.status === 'COMPLETED' ? 'Completed' : sq.status === 'CANCELED' ? 'Canceled' : sq.status;
          return res.json({ status: normalized, provider: 'square', checkout_id: key });
        }

        // 2. Fall through to Tuu transactions
        const [rows] = await pool.execute('SELECT * FROM tuu_transactions WHERE idempotency_key = ?', [key]);
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(rows[0]);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/plugins/payments/cancel/:key', async (req, res) => {
      const key = req.params.key;

      // Check if it's a Square checkout
      const [sqRows] = await pool.execute('SELECT * FROM sq_checkouts WHERE checkout_id = ?', [key]).catch(() => [[]]);
      if (sqRows.length > 0) {
        // Stop polling
        const sqPollId = squareActivePolls.get(key);
        if (sqPollId) { clearInterval(sqPollId); squareActivePolls.delete(key); }
        // Cancel on Square API
        try {
          const storeId = sqRows[0].store_id;
          const [storeRows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
          const userId = storeRows[0]?.user_id;
          if (userId) {
            const [cfgRows] = await pool.execute('SELECT access_token FROM square_config WHERE user_id = ?', [userId]);
            if (cfgRows[0]?.access_token) {
              await fetch('https://connect.squareup.com/v2/terminals/checkouts/' + encodeURIComponent(key) + '/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfgRows[0].access_token, 'Square-Version': '2026-01-22' },
                body: '{}'
              });
            }
          }
        } catch (e) { console.error('[cancel-square] error:', e.message); }
        await pool.execute('UPDATE sq_checkouts SET status = ? WHERE checkout_id = ?', ['Canceled', key]).catch(() => {});
        return res.json({ success: true, provider: 'square' });
      }

      // Tuu cancel
      const intervalId = tuuActivePolls.get(key);
      if (intervalId) { clearInterval(intervalId); tuuActivePolls.delete(key); }
      await pool.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Canceled', key]);
      res.json({ success: true });
    });

    app.post('/api/tuu/pay', async (req, res) => {
      try {
        const { store_id, order_id, amount, description, device_uid } = req.body;
        if (!store_id || !amount) return res.status(400).json({ error: 'store_id y amount requeridos' });
        const userId = await tuuGetUserIdFromStore(parseInt(store_id));
        const config = await tuuGetConfig(userId);
        if (!config?.api_key) return res.status(400).json({ error: 'API Key de Tuu no configurada' });
        let device = device_uid ? await tuuGetDeviceForUid(device_uid, parseInt(store_id)) : null;
        if (!device) device = await tuuGetAnyDeviceForStore(parseInt(store_id));
        if (!device) return res.status(400).json({ error: 'No hay POS asignado. Configura un POS en Tuu POS del admin.' });
        const payment = await tuuCreatePayment(config.api_key, amount, device.serial, description, config.dte_type);
        await pool.execute(
          'INSERT INTO tuu_transactions (store_id, order_id, idempotency_key, amount, status, device_serial) VALUES (?, ?, ?, ?, ?, ?)',
          [parseInt(store_id), order_id || null, payment.idempotencyKey, Math.round(amount), 'Pending', device.serial]
        );
        tuuStartPolling(config.api_key, payment.idempotencyKey, parseInt(store_id), order_id);
        res.json({ success: true, idempotencyKey: payment.idempotencyKey, status: payment.status, deviceName: device.name });
      } catch (e) {
        console.error('Tuu pay error:', e.message);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/tuu/status/:key', async (req, res) => {
      try {
        const [rows] = await pool.execute('SELECT * FROM tuu_transactions WHERE idempotency_key = ?', [req.params.key]);
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(rows[0]);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/tuu/cancel/:key', async (req, res) => {
      const intervalId = tuuActivePolls.get(req.params.key);
      if (intervalId) { clearInterval(intervalId); tuuActivePolls.delete(req.params.key); }
      await pool.execute('UPDATE tuu_transactions SET status = ?, updated_at = NOW() WHERE idempotency_key = ?', ['Canceled', req.params.key]);
      res.json({ success: true });
    });

    app.get('/api/tuu/transactions', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const [rows] = await pool.execute('SELECT * FROM tuu_transactions WHERE store_id = ? ORDER BY created_at DESC LIMIT 50', [storeId]);
        res.json(rows);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/tuu/test', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const userId = await tuuGetUserIdFromStore(storeId);
        const config = await tuuGetConfig(userId);
        if (!config?.api_key) return res.json({ success: false, error: 'API Key no configurada' });
        const device = await tuuGetAnyDeviceForStore(storeId);
        res.json({ success: true, device: device?.name || 'Sin POS asignado' });
      } catch (e) { res.json({ success: false, error: e.message }); }
    });


    // =====================================================================
    // SQUARE TERMINAL — device code pairing + payments
    // =====================================================================
    (async () => {
      // Ensure tables exist
      try {
        await pool.execute(`CREATE TABLE IF NOT EXISTS square_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          access_token TEXT NOT NULL,
          location_id VARCHAR(255) NOT NULL DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS square_devices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          store_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          device_code_id VARCHAR(255) DEFAULT NULL,
          location_id VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      } catch (e) { console.error('[Square] Table init error:', e.message); }
    })();

    // Helper: get userId from JWT token
    async function squareGetUserId(req) {
      const auth = req.headers['authorization'] || '';
      const tok = auth.replace('Bearer ', '').trim();
      if (!tok) throw new Error('No token');
      const decoded = jwt.verify(tok, JWT_SECRET);
      return decoded.id;
    }

    // Helper: get Square config for user
    async function squareGetConfig(userId) {
      const [rows] = await pool.execute('SELECT * FROM square_config WHERE user_id = ?', [userId]);
      return rows[0] || null;
    }

    // GET /api/square/config
    app.get('/api/square/config', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const cfg = await squareGetConfig(userId);
        res.json(cfg ? { access_token: cfg.access_token ? '***' : '', location_id: cfg.location_id, hasToken: !!cfg.access_token } : { access_token: '', location_id: '', hasToken: false });
      } catch (e) { res.status(401).json({ error: e.message }); }
    });

    // POST /api/square/config — save access_token + location_id
    app.post('/api/square/config', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const { access_token, location_id } = req.body;
        if (!access_token) return res.status(400).json({ error: 'access_token requerido' });
        await pool.execute(
          'INSERT INTO square_config (user_id, access_token, location_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE access_token = ?, location_id = ?',
          [userId, access_token, location_id || '', access_token, location_id || '']
        );
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/square/locations — fetch locations from Square API
    app.get('/api/square/locations', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const cfg = await squareGetConfig(userId);
        if (!cfg?.access_token) return res.status(400).json({ error: 'Configura el Access Token primero' });
        const sqRes = await fetch('https://connect.squareup.com/v2/locations', {
          headers: { 'Authorization': 'Bearer ' + cfg.access_token, 'Square-Version': '2026-01-22' }
        });
        const data = await sqRes.json();
        if (!sqRes.ok) return res.status(sqRes.status).json({ error: data?.errors?.[0]?.detail || 'Error Square API' });
        res.json(data.locations || []);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /api/square/device-code — generate login code
    app.post('/api/square/device-code', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const cfg = await squareGetConfig(userId);
        if (!cfg?.access_token) return res.status(400).json({ error: 'Configura el Access Token primero' });
        const locationId = req.body.location_id || cfg.location_id;
        if (!locationId) return res.status(400).json({ error: 'Se requiere Location ID' });
        const deviceName = req.body.device_name || 'Square Terminal';
        const idempotencyKey = 'sq_code_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const sqRes = await fetch('https://connect.squareup.com/v2/devices/codes', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + cfg.access_token, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotency_key: idempotencyKey, device_code: { name: deviceName, product_type: 'TERMINAL_API', location_id: locationId } })
        });
        const data = await sqRes.json();
        if (!sqRes.ok) return res.status(sqRes.status).json({ error: data?.errors?.[0]?.detail || 'Error Square API', errors: data?.errors });
        res.json(data.device_code);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/square/device-code/:id — poll pairing status
    app.get('/api/square/device-code/:id', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const cfg = await squareGetConfig(userId);
        if (!cfg?.access_token) return res.status(400).json({ error: 'No config' });
        const sqRes = await fetch('https://connect.squareup.com/v2/devices/codes/' + encodeURIComponent(req.params.id), {
          headers: { 'Authorization': 'Bearer ' + cfg.access_token, 'Square-Version': '2026-01-22' }
        });
        const data = await sqRes.json();
        if (!sqRes.ok) return res.status(sqRes.status).json({ error: data?.errors?.[0]?.detail || 'Error' });
        res.json(data.device_code);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /api/square/devices — save paired device
    app.post('/api/square/devices', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const { store_id, name, device_id, device_code_id, location_id } = req.body;
        if (!store_id || !device_id) return res.status(400).json({ error: 'store_id y device_id requeridos' });
        const [result] = await pool.execute(
          'INSERT INTO square_devices (user_id, store_id, name, device_id, device_code_id, location_id) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, store_id, name || 'Square Terminal', device_id, device_code_id || null, location_id || null]
        );
        res.json({ success: true, id: result.insertId });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/square/devices — list devices for store
    app.get('/api/square/devices', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const storeId = parseInt(req.query.store_id);
        const [rows] = await pool.execute('SELECT * FROM square_devices WHERE user_id = ? AND store_id = ? ORDER BY created_at DESC', [userId, storeId]);
        res.json(rows);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /api/square/devices/:id
    app.delete('/api/square/devices/:id', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        await pool.execute('DELETE FROM square_devices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/plugins/payments/provider — Square native (fallthrough from PluginManager)
    // Already handled above for Tuu — Square check is added here as an additional fallthrough
    app.get('/api/square/provider', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const storeId = parseInt(req.query.store_id);
        const terminalId = parseInt(req.query.terminal_id);
        const terminalProvider = req.query.terminal_provider || '';
        if (terminalProvider && terminalProvider !== 'square') return res.json({ available: false });
        const cfg = await squareGetConfig(userId);
        if (!cfg?.access_token) return res.json({ available: false, reason: 'No Square config' });
        let device = null;
        if (terminalId) {
          const [rows] = await pool.execute('SELECT * FROM square_devices WHERE id = ? AND user_id = ?', [terminalId, userId]);
          device = rows[0] || null;
        }
        if (!device) {
          const [rows] = await pool.execute('SELECT * FROM square_devices WHERE user_id = ? AND store_id = ? LIMIT 1', [userId, storeId]);
          device = rows[0] || null;
        }
        if (!device) return res.json({ available: false, reason: 'No Square device found' });
        res.json({ available: true, provider: 'square', deviceId: device.device_id, deviceName: device.name });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // =====================================================================
    // HAULMER QR — integración nativa (sin plugin)
    // =====================================================================
    const HAULMER_NATIVE_API = 'https://core.payment.haulmer.com/api/v1/payment';

    (async () => {
      try {
        await pool.execute(`CREATE TABLE IF NOT EXISTS haulmer_native_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          account_id VARCHAR(255) NOT NULL,
          secret_key VARCHAR(500) NOT NULL,
          commerce_name VARCHAR(255) DEFAULT 'Mi Tienda',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        await pool.execute(`CREATE TABLE IF NOT EXISTS haulmer_native_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          store_id INT NOT NULL,
          order_id INT DEFAULT NULL,
          reference VARCHAR(120) NOT NULL UNIQUE,
          amount INT NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      } catch (e) { console.error('[Haulmer] Table init error:', e.message); }
    })();

    function haulmerSign(data, secret) {
      const keys = Object.keys(data).filter(k => k.startsWith('x_')).sort();
      const str = keys.filter(k => data[k] != null && data[k] !== '').map(k => k + data[k]).join('');
      return crypto.createHmac('sha256', secret).update(str).digest('hex');
    }

    // GET /api/haulmer/config
    app.get('/api/haulmer/config', authenticateToken, async (req, res) => {
      try {
        const [rows] = await pool.execute(
          'SELECT account_id, commerce_name FROM haulmer_native_config WHERE user_id = ?', [req.user.id]
        );
        res.json(rows[0] || {});
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /api/haulmer/config
    app.post('/api/haulmer/config', authenticateToken, async (req, res) => {
      try {
        const { account_id, secret_key, commerce_name } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id requerido' });
        await pool.execute(`
          INSERT INTO haulmer_native_config (user_id, account_id, secret_key, commerce_name)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE account_id = VALUES(account_id), secret_key = VALUES(secret_key),
            commerce_name = VALUES(commerce_name), updated_at = NOW()
        `, [req.user.id, account_id.trim(), (secret_key || '').trim(), (commerce_name || 'Mi Tienda').trim()]);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/haulmer/available?store_id=X
    app.get('/api/haulmer/available', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const [storeRows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
        if (!storeRows[0]) return res.json({ available: false });
        const [rows] = await pool.execute(
          'SELECT account_id, secret_key FROM haulmer_native_config WHERE user_id = ?', [storeRows[0].user_id]
        );
        const cfg = rows[0];
        res.json({ available: !!(cfg?.account_id && cfg?.secret_key) });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /api/haulmer/payment — crea pago y devuelve URL
    app.post('/api/haulmer/payment', async (req, res) => {
      try {
        const { store_id, order_id, amount, description } = req.body;
        const [storeRows] = await pool.execute('SELECT user_id, code FROM stores WHERE id = ?', [store_id]);
        if (!storeRows[0]) return res.status(404).json({ error: 'Tienda no encontrada' });
        const [cfgRows] = await pool.execute(
          'SELECT * FROM haulmer_native_config WHERE user_id = ?', [storeRows[0].user_id]
        );
        const config = cfgRows[0];
        if (!config?.account_id || !config?.secret_key) return res.status(400).json({ error: 'Haulmer no configurado' });

        const storeCode = storeRows[0].code;
        const reference = `SRSN-${store_id}-${order_id || 0}-${Date.now()}`;
        const serverUrl = 'https://srservi2.srautomatic.com';

        const payload = {
          x_account_id: config.account_id,
          x_amount: Math.round(amount),
          x_currency: 'CLP',
          x_customer_email: 'cliente@srservi.com',
          x_customer_first_name: 'Cliente',
          x_customer_last_name: 'SRServi',
          x_customer_phone: '+56900000000',
          x_description: description || 'Pago SRServi',
          x_reference: reference,
          x_shop_name: config.commerce_name || 'SRServi',
          x_url_callback: `${serverUrl}/api/haulmer/webhook`,
          x_url_cancel:   `${serverUrl}/store/${storeCode}`,
          x_url_complete: `${serverUrl}/store/${storeCode}`
        };
        payload.x_signature = haulmerSign(payload, config.secret_key);

        const hRes = await fetch(HAULMER_NATIVE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-REDIRECT': 'false' },
          body: JSON.stringify(payload)
        });
        if (!hRes.ok) throw new Error(`Haulmer ${hRes.status}: ${await hRes.text()}`);

        const raw = await hRes.text();
        let paymentUrl = null;
        try { const d = JSON.parse(raw); paymentUrl = d.url || d.redirectUrl || d.x_redirect_url || d.processUrl || d.payment_url; } catch {}
        if (!paymentUrl && raw.startsWith('http')) paymentUrl = raw.trim();
        if (!paymentUrl) throw new Error('No se obtuvo URL de pago de Haulmer');

        await pool.execute(
          'INSERT INTO haulmer_native_transactions (store_id, order_id, reference, amount, status) VALUES (?, ?, ?, ?, ?)',
          [store_id, order_id || null, reference, Math.round(amount), 'pending']
        );
        if (order_id) {
          await pool.execute('UPDATE orders SET external_reference = ? WHERE id = ?', [reference, order_id]).catch(() => {});
        }

        res.json({ success: true, paymentUrl, reference });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/haulmer/payment/:reference/status — poll desde frontend
    app.get('/api/haulmer/payment/:reference/status', async (req, res) => {
      try {
        const [rows] = await pool.execute(
          'SELECT t.status, t.order_id, t.reference, t.amount, o.order_number FROM haulmer_native_transactions t LEFT JOIN orders o ON o.id = t.order_id WHERE t.reference = ?',
          [req.params.reference]
        );
        if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
        res.json(rows[0]);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Shared helper: confirm a Haulmer payment, update order, assign order_number
    async function haulmerConfirmOrder(tx, reference, authCode) {
      await pool.execute(
        'UPDATE haulmer_native_transactions SET status = ?, updated_at = NOW() WHERE reference = ?',
        ['completed', reference]
      );
      if (!tx.order_id) return null;
      await pool.execute(
        "UPDATE orders SET payment_process = 1, cash_approved = TRUE, status = 'preparing', reference_id = ?, sequence_id = ? WHERE id = ?",
        [authCode || reference, reference, tx.order_id]
      ).catch(() => {});
      // Assign order_number if missing
      const [existing] = await pool.execute('SELECT order_number FROM orders WHERE id = ?', [tx.order_id]);
      let finalOrderNumber = existing[0]?.order_number || null;
      if (existing[0] && !existing[0].order_number) {
        const [usedRows] = await pool.execute(
          'SELECT order_number FROM orders WHERE store_id = ? AND DATE(created_at) = CURDATE() AND order_number IS NOT NULL',
          [tx.store_id]
        );
        const used = new Set(usedRows.map(r => r.order_number));
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let orderNum = null;
        for (let i = 0; i < 200 && !orderNum; i++) {
          const c = letters[Math.floor(Math.random() * 26)] + String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
          if (!used.has(c)) orderNum = c;
        }
        if (!orderNum) orderNum = String(used.size + 1);
        await pool.execute('UPDATE orders SET order_number = ? WHERE id = ?', [orderNum, tx.order_id]);
        finalOrderNumber = orderNum;
      }
      return finalOrderNumber;
    }

    // POST /api/haulmer/webhook — Haulmer llama aquí al completar el pago
    app.post('/api/haulmer/webhook', async (req, res) => {
      try {
        const params = { ...req.query, ...req.body };
        const reference = params.x_reference;
        const result    = params.x_result;
        if (!reference) return res.status(400).json({ error: 'Missing reference' });

        const [txs] = await pool.execute('SELECT * FROM haulmer_native_transactions WHERE reference = ?', [reference]);
        if (!txs[0]) return res.status(404).json({ error: 'Transacción no encontrada' });
        const tx = txs[0];

        // Verificar firma
        const [cfgRows] = await pool.execute(
          `SELECT hnc.* FROM haulmer_native_config hnc
           JOIN stores s ON s.user_id = hnc.user_id WHERE s.id = ?`, [tx.store_id]
        );
        const config = cfgRows[0];
        if (config && params.x_signature) {
          const checkData = { ...params }; delete checkData.x_signature;
          if (haulmerSign(checkData, config.secret_key) !== params.x_signature) {
            return res.status(400).json({ error: 'Firma inválida' });
          }
        }

        if (result === 'completed' && tx.status !== 'completed') {
          const orderNumber = await haulmerConfirmOrder(tx, reference, params.x_authorization_code || null);
          if (tx.order_id) {
            io.to(`store_${tx.store_id}`).emit('qr_payment_completed', { order_id: tx.order_id, reference, order_number: orderNumber });
            // Also emit payment_confirmed so WorkerPanel picks it up in real-time
            const [orderRows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [tx.order_id]);
            if (orderRows[0]) {
              const [itemRows] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [tx.order_id]);
              io.to(`store_${tx.store_id}`).emit('payment_confirmed', { ...orderRows[0], items: itemRows });
            }
          }
        } else if (result === 'failed' || result === 'cancelled') {
          await pool.execute(
            'UPDATE haulmer_native_transactions SET status = ?, updated_at = NOW() WHERE reference = ?',
            [result, reference]
          );
        }
        res.json({ success: true });
      } catch (e) { console.error('[Haulmer webhook]', e); res.status(500).json({ error: e.message }); }
    });

    // POST /api/haulmer/confirm — frontend llama esto al volver de pago con x_result=completed
    app.post('/api/haulmer/confirm', async (req, res) => {
      try {
        const params = req.body;
        const reference = params.x_reference;
        if (!reference || !reference.startsWith('SRSN-')) return res.status(400).json({ error: 'Referencia inválida' });

        const [txs] = await pool.execute('SELECT * FROM haulmer_native_transactions WHERE reference = ?', [reference]);
        if (!txs[0]) return res.status(404).json({ error: 'Transacción no encontrada' });
        const tx = txs[0];

        if (tx.status === 'completed') {
          // Already confirmed — just return the order_number
          const [orRows] = await pool.execute('SELECT order_number FROM orders WHERE id = ?', [tx.order_id]);
          return res.json({ success: true, order_number: orRows[0]?.order_number || null, already_confirmed: true });
        }

        const orderNumber = await haulmerConfirmOrder(tx, reference, params.x_authorization_code || null);
        if (tx.order_id) {
          io.to(`store_${tx.store_id}`).emit('qr_payment_completed', { order_id: tx.order_id, reference, order_number: orderNumber });
          const [orderRows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [tx.order_id]);
          if (orderRows[0]) {
            const [itemRows] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [tx.order_id]);
            io.to(`store_${tx.store_id}`).emit('payment_confirmed', { ...orderRows[0], items: itemRows });
          }
        }
        res.json({ success: true, order_number: orderNumber });
      } catch (e) { console.error('[Haulmer confirm]', e); res.status(500).json({ error: e.message }); }
    });

    server.listen(PORT, HOST, () => {
      console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();