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
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getPublicProducts,
  createOrder,
  getOrders,
  updateUserSettings
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
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
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
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
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
    const categories = await getCategories(parseInt(storeId));
    res.json(categories);
  } catch (error) {
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

app.post('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, price } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const ingredient = await createIngredient(parseInt(store_id), { name, price });
    emitProductUpdate(parseInt(store_id), 'ingredient_created', ingredient);
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ingredients/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, price } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const ingredient = await updateIngredient(parseInt(req.params.id), parseInt(store_id), { name, price });
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

app.post('/api/extras', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, price } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const extra = await createExtra(parseInt(store_id), { name, price });
    emitProductUpdate(parseInt(store_id), 'extra_created', extra);
    res.json(extra);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/extras/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, price } = req.body;
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }
    const extra = await updateExtra(parseInt(req.params.id), parseInt(store_id), { name, price });
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

app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, description, price, category_id, ingredients, extras } = req.body;
    
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }
    
    let parsedIngredients = [];
    let parsedExtras = [];
    
    try {
      parsedIngredients = ingredients ? JSON.parse(ingredients) : [];
      parsedExtras = extras ? JSON.parse(extras) : [];
    } catch (e) {
      console.error('Error parsing ingredients/extras:', e);
    }
    
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    const product = await createProduct(parseInt(store_id), {
      name,
      description,
      price,
      category_id,
      image: imageUrl,
      ingredients: parsedIngredients,
      extras: parsedExtras
    });
    
    emitProductUpdate(parseInt(store_id), 'product_created', product);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, description, price, category_id, ingredients, extras } = req.body;
    
    if (!store_id) {
      return res.status(400).json({ error: 'store_id es requerido' });
    }
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }
    
    let parsedIngredients = [];
    let parsedExtras = [];
    
    try {
      parsedIngredients = ingredients ? JSON.parse(ingredients) : [];
      parsedExtras = extras ? JSON.parse(extras) : [];
    } catch (e) {
      console.error('Error parsing ingredients/extras:', e);
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
      description,
      price,
      category_id,
      image: imageUrl,
      ingredients: parsedIngredients,
      extras: parsedExtras
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
    const { store_id, customer_name, items } = req.body;
    
    if (!store_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos del pedido incompletos' });
    }
    
    const order = await createOrder(parseInt(store_id), { customer_name, items });
    res.json(order);
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

async function startServer() {
  try {
    await initDatabase();
    console.log('Base de datos inicializada');
    
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
