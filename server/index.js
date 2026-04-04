import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
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
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'srservi-secret-key-2024';

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, false);
    }
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'));
  }
});

app.use('/uploads', express.static('uploads'));

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
    
    const products = await getPublicProducts(store.id);
    
    res.json({
      store: {
        id: store.id,
        code: store.code,
        name: store.name,
        primary_color: store.primary_color || '#000000',
        secondary_color: store.secondary_color || '#FFFFFF',
        accent_color: store.accent_color || '#D4AF37',
        header_color: store.header_color || '#000000',
        currency_code: store.currency_code || 'USD',
        currency_symbol: store.currency_symbol || '$',
        currency_name: store.currency_name || 'Dólar Estadounidense'
      },
      products
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

app.get('/api/stores', async (req, res) => {
  try {
    const stores = await getStores();
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching store:', id);
    const stores = await getStores();
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

app.post('/api/stores', authenticateToken, async (req, res) => {
  try {
    const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const store = await createStore(req.user.id, { 
      name, 
      primary_color, 
      secondary_color, 
      accent_color, 
      header_color, 
      currency_code, 
      currency_symbol, 
      currency_name 
    });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const store = await updateStore(req.params.id, req.user.id, { 
      name, 
      primary_color, 
      secondary_color, 
      accent_color, 
      header_color, 
      currency_code, 
      currency_symbol, 
      currency_name 
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

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
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
    const { store_id, name, price, category_id } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const ingredient = await updateIngredient(parseInt(req.params.id), parseInt(store_id), { name, price, category_id, image: imageUrl });
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
    const { store_id, name, price, category_id } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const extra = await updateExtra(parseInt(req.params.id), parseInt(store_id), { name, price, category_id, image: imageUrl });
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
    const configurations = await getStoreConfigurations(parseInt(storeId));
    res.json(configurations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/store-configurations', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const configuration = await createStoreConfiguration(parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default });
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/store-configurations/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const configuration = await updateStoreConfiguration(parseInt(req.params.id), parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default });
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
    const configId = req.params.id;
    await deleteStoreConfiguration(parseInt(configId), parseInt(store_id));
    res.json({ success: true });
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

app.get('/api/coupons', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'store_id es requerido' });
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
    const products = await searchProducts(query, parseInt(storeId));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
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
    const updated = await updateInventory(parseInt(productId), parseInt(adjustment), parseInt(store_id));
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
    const updated = await setInventoryStock(parseInt(productId), parseInt(stock));
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
      amount: amount
    });
  } catch (error) {
    console.error('Error procesando pago Market:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, barcode, description, price, category_id } = req.body;
    
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
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
    const productId = req.params.id;
    await deleteProduct(parseInt(productId), parseInt(store_id));
    emitProductUpdate(parseInt(store_id), 'product_deleted', { id: productId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { store_id, items, order_type, payment_method, coupon_code } = req.body;
    
    if (!store_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos del pedido incompletos' });
    }
    
    console.log('Creating order:', { store_id, order_type, payment_method, items });
    const order = await createOrder(parseInt(store_id), { order_type, payment_method, items, coupon_code });
    
    const socketId = userSockets.get(parseInt(store_id));
    if (socketId) {
      io.to(socketId).emit('new_order', order);
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

async function startServer() {
  try {
    await initDatabase();
    console.log('Base de datos inicializada');
    
    app.set('io', io);
    
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();