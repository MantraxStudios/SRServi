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
    console.log(`Socket ${socket.id} registrado para tienda ${storeId}`);
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

app.use('/uploads', express.static('uploads'));
app.use('/api/plugins/static', express.static(path.join(__serverDir, 'plugins', 'installed')));

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
    
    const userPlan = await getUserPlan(store.user_id);
    const isPremium = userPlan && userPlan.plan_name && userPlan.plan_name !== 'Gratis';
    
    const products = await getPublicProducts(store.id);
    const categories = await getCategories(store.id);

    res.json({
      store: {
        id: store.id,
        code: store.code,
        name: store.name,
        primary_color: store.primary_color || '#000000',
        secondary_color: store.secondary_color || '#FFFFFF',
        accent_color: store.accent_color || '#D4AF37',
        header_color: store.header_color || '#000000',
        logo_url: isPremium ? (store.logo_url || null) : null,
        currency_code: store.currency_code || 'USD',
        currency_symbol: store.currency_symbol || '$',
        currency_name: store.currency_name || 'Dólar Estadounidense',
        is_premium: isPremium
      },
      products,
      categories
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
    const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, remove_logo, worker_accept_cash, worker_accept_card } = req.body;
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
      worker_accept_card
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
    const { code } = req.params;
    const { pin, products } = req.body;
    const store = await getStoreByCode(code.toUpperCase());
    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }
    const valid = await verifyStoreEditPin(store.id, pin);
    if (!valid) {
      return res.status(403).json({ error: 'PIN incorrecto' });
    }
    if (!products) {
      return res.status(400).json({ error: 'products es requerido' });
    }
    await updateProductsOrder(store.id, products);
    emitProductUpdate(store.id, 'products_reordered', { products });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public product management with PIN
app.post('/api/public/:code/products', upload.single('image'), async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const valid = await verifyStoreEditPin(store.id, req.body.pin);
    if (!valid) return res.status(403).json({ error: 'PIN incorrecto' });
    if (!req.body.name || !req.body.price) return res.status(400).json({ error: 'Nombre y precio requeridos' });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const product = await createProduct(store.id, {
      name: req.body.name,
      description: req.body.description || '',
      price: parseFloat(req.body.price) || 0,
      category_id: req.body.category_id || null,
      image: imageUrl
    });

    // Create inventory entry
    await pool.execute(
      'INSERT INTO inventory (product_id, stock, unlimited_stock) VALUES (?, 0, TRUE) ON DUPLICATE KEY UPDATE unlimited_stock = TRUE',
      [product.id]
    );

    emitProductUpdate(store.id, 'product_created', product);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/public/:code/products/:id', upload.single('image'), async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const valid = await verifyStoreEditPin(store.id, req.body.pin);
    if (!valid) return res.status(403).json({ error: 'PIN incorrecto' });
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

    const product = await updateProduct(parseInt(req.params.id), store.id, {
      name: req.body.name,
      description: req.body.description || '',
      price: parseFloat(req.body.price) || 0,
      category_id: req.body.category_id || null,
      image: imageUrl
    });
    emitProductUpdate(store.id, 'product_updated', product);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/public/:code/products/:id', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const valid = await verifyStoreEditPin(store.id, req.body.pin);
    if (!valid) return res.status(403).json({ error: 'PIN incorrecto' });
    await deleteProduct(parseInt(req.params.id), store.id);
    emitProductUpdate(store.id, 'product_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public category management with PIN
app.post('/api/public/:code/categories', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const valid = await verifyStoreEditPin(store.id, req.body.pin);
    if (!valid) return res.status(403).json({ error: 'PIN incorrecto' });
    if (!req.body.name) return res.status(400).json({ error: 'Nombre es requerido' });
    const category = await createCategory(store.id, { name: req.body.name, description: req.body.description || '' });
    emitProductUpdate(store.id, 'category_created', category);
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/public/:code/categories/:id', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const valid = await verifyStoreEditPin(store.id, req.body.pin);
    if (!valid) return res.status(403).json({ error: 'PIN incorrecto' });
    if (!req.body.name) return res.status(400).json({ error: 'Nombre es requerido' });
    const category = await updateCategory(parseInt(req.params.id), store.id, { name: req.body.name, description: req.body.description || '' });
    emitProductUpdate(store.id, 'category_updated', category);
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/public/:code/categories/:id', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const valid = await verifyStoreEditPin(store.id, req.body.pin);
    if (!valid) return res.status(403).json({ error: 'PIN incorrecto' });
    await deleteCategory(parseInt(req.params.id), store.id);
    emitProductUpdate(store.id, 'category_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    const token = jwt.sign({ id: superadmin.id, isSuperadmin: true }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, superadmin: { id: superadmin.id, email: superadmin.email } });
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
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout } = req.body;
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
    const configuration = await createStoreConfiguration(parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout });
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/store-configurations/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout } = req.body;
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
    const configuration = await updateStoreConfiguration(parseInt(req.params.id), parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout });
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
    const { store_id, name, barcode, description, price, category_id } = req.body;
    
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
      image: imageUrl
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
    const { store_id, name, barcode, description, price, category_id } = req.body;
    
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
      image: imageUrl
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
    const { store_id, items, order_type, payment_method, coupon_code, from_worker } = req.body;

    if (!store_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos del pedido incompletos' });
    }

    console.log('Creating order:', { store_id, order_type, payment_method, items, from_worker });
    const order = await createOrder(parseInt(store_id), { order_type, payment_method, items, coupon_code, from_worker });

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
    const orders = await getOrders(parseInt(storeId));
    if (orders.length > 0) {
      console.log('First order items:', orders[0].items);
    }
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
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
    const terminals = await getMercadoPagoTerminals(req.user.id);
    res.json(terminals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mercado-pago-terminals', authenticateToken, async (req, res) => {
  try {
    const { name, mercadopago_access_token, mercadopago_terminal_id } = req.body;
    
    if (!name || !mercadopago_access_token || !mercadopago_terminal_id) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    const terminal = await createMercadoPagoTerminal(req.user.id, {
      name,
      mercadopago_access_token,
      mercadopago_terminal_id
    });
    
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

app.get('/api/admin/plugins', authenticateToken, requirePremium, async (req, res) => {
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

app.post('/api/admin/plugins/upload', authenticateToken, requirePremium, pluginUpload.single('plugin'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    const result = await pluginManager.install(req.file.buffer);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/plugins/:id/activate', authenticateToken, requirePremium, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.activate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/plugins/:id/deactivate', authenticateToken, requirePremium, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.deactivate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/plugins/:id', authenticateToken, requirePremium, async (req, res) => {
  try {
    if (!pluginManager) return res.status(500).json({ error: 'Plugin system not initialized' });
    await pluginManager.uninstall(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/plugins/:id/settings/:storeId', authenticateToken, requirePremium, async (req, res) => {
  try {
    if (!pluginManager) return res.json({});
    const settings = await pluginManager.getPluginSettings(req.params.id, parseInt(req.params.storeId));
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/plugins/:id/settings/:storeId', authenticateToken, requirePremium, async (req, res) => {
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

    // Check premium if token provided (admin mode)
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const plan = await getUserPlan(decoded.id);
        const isPremium = plan && plan.plan_name && plan.plan_name !== 'Gratis';
        if (!isPremium) return res.json([]);
      } catch {
        return res.json([]);
      }
    }

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
    // Solo premium puede publicar
    const userPlan = await getUserPlan(req.user.id);
    const isPremium = userPlan && userPlan.plan_name && userPlan.plan_name !== 'Gratis';
    if (!isPremium) {
      return res.status(403).json({ error: 'Necesitas un plan Premium para publicar plugins en el Workshop' });
    }

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
        `INSERT INTO plugin_workshop (plugin_id, user_id, name, latest_version, description, author, contact_email, logo, downloads, hooks, admin_slots, store_slots)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [pluginJson.id, req.user.id, pluginJson.name, pluginJson.version,
         description || pluginJson.description || '', author, contact_email,
         logoPath, JSON.stringify(pluginJson.hooks || []),
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
app.post('/api/workshop/install/:pluginId', authenticateToken, requirePremium, async (req, res) => {
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
app.get('/api/workshop/installed-ids', authenticateToken, requirePremium, async (req, res) => {
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

let pluginManager = null;

async function startServer() {
  try {
    await initDatabase();
    console.log('Base de datos inicializada');

    app.set('io', io);

    // Initialize plugin system
    pluginManager = new PluginManager(app, pool, io);
    await pluginManager.loadAllActive();

    server.listen(PORT, HOST, () => {
      console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();