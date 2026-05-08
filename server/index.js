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
import { execFile } from 'child_process';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import PluginManager from './plugins/PluginManager.js';
import { generatePromoImage, postToInstagram } from './instagram-service.js';
import { getInstagramConfig, saveInstagramConfig, getActiveInstagramConfigs, updateInstagramPosted } from './database.js';
import cron from 'node-cron';

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
  duplicateStore,
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
  updateIngredientsOrder,
  updateExtrasOrder,
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
  getMercadoPagoTerminalByPin,
  getMercadoPagoTerminalForStore,
  updateMercadoPagoTerminal,
  deleteMercadoPagoTerminal,
  createPosTerminal,
  getPosTerminals,
  getPosTerminalsByStore,
  getPosTerminalById,
  getPosTerminalByPin,
  getPosTerminalForStore,
  updatePosTerminal,
  deletePosTerminal,
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
  setTotpSecret,
  enableTotp,
  disableTotp,
  updateUserPassword,
  getUserByEmail,
  setVerificationCode,
  markEmailVerified,
  updateUserHeartbeat,
  getChatGptKey,
  saveChatGptKey,
  openCashRegister,
  closeCashRegister,
  getOpenCashRegister,
  getAllOpenCashRegisters,
  getTodayOrdersForStore,
  generateUniqueOrderNumber,
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
const BASE_URL = process.env.BASE_URL || 'https://srservi2.srautomatic.com';

const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || '163.227.179.59',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

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

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)'));
  }
});

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

async function sendCashRegisterReport(storeId, closedBy = 'manual') {
  try {
    const [storeRows] = await pool.execute(
      'SELECT s.*, u.email as owner_email, u.username as owner_username FROM stores s JOIN users u ON s.user_id = u.id WHERE s.id = ?',
      [storeId]
    );
    if (!storeRows.length) return;
    const store = storeRows[0];
    const ownerEmail = store.owner_email;
    if (!ownerEmail) return;

    const orders = await getTodayOrdersForStore(storeId);
    const currSym = store.currency_symbol || '$';
    const fmt = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
    const tl = t => ({ serve: 'Aquí', takeout: 'Para llevar', delivery: 'Delivery', pedidosya: 'PedidosYa', rappi: 'Rappi', mostrador: 'Mostrador' })[t] || t || 'Aquí';
    const sl = s => ({ pending: 'Pendiente', preparing: 'En preparación', ready: 'Listo', completed: 'Completado' })[s] || s || '';
    const ds = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const wsData = [
      ['#', 'Tipo', 'Entrada', 'Salida', 'Estado', 'Atendido por', 'Productos', 'Total']
    ];
    for (const o of orders) {
      wsData.push([
        o.order_number || String(o.id),
        tl(o.order_type),
        fmt(o.created_at),
        fmt(o.completed_at),
        sl(o.status),
        o.completed_by_name || '—',
        o.items_text || '—',
        `${currSym}${Number(o.total || 0).toFixed(2)}`
      ]);
    }

    const totalVendido = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const completados = orders.filter(o => o.status === 'completed').length;
    wsData.push([]);
    wsData.push(['Total pedidos', orders.length, '', '', '', '', '', '']);
    wsData.push(['Completados', completados, '', '', '', '', '', '']);
    wsData.push(['Total vendido', '', '', '', '', '', '', `${currSym}${totalVendido.toFixed(2)}`]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 50 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const subject = closedBy === 'auto'
      ? `[SRServi] Cierre automático de caja — ${store.name} — ${ds}`
      : `[SRServi] Cierre de caja — ${store.name} — ${ds}`;

    await mailer.sendMail({
      from: `"SRServi" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#000;padding:20px;text-align:center">
            <h1 style="color:#D4AF37;margin:0;font-size:24px">SRServi</h1>
          </div>
          <div style="padding:24px;background:#f9f9f9">
            <h2 style="color:#111;margin-top:0">Informe de Caja — ${store.name}</h2>
            <p style="color:#444">${ds}</p>
            ${closedBy === 'auto' ? '<p style="color:#e55;font-weight:bold">La caja fue cerrada automáticamente a medianoche.</p>' : ''}
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#D4AF37"><td style="padding:8px;font-weight:700">Total pedidos</td><td style="padding:8px;text-align:right;font-weight:700">${orders.length}</td></tr>
              <tr style="background:#f0f0f0"><td style="padding:8px">Completados</td><td style="padding:8px;text-align:right">${completados}</td></tr>
              <tr style="background:#fff"><td style="padding:8px;font-weight:700">Total vendido</td><td style="padding:8px;text-align:right;font-weight:700;color:#16a34a">${currSym}${totalVendido.toFixed(2)}</td></tr>
            </table>
            <p style="color:#666;font-size:13px">Encontrarás el detalle completo en el archivo Excel adjunto.</p>
          </div>
          <div style="background:#111;padding:12px;text-align:center;font-size:11px;color:#666">SRServi &mdash; ${store.name}</div>
        </div>
      `,
      attachments: [{
        filename: `caja_${store.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        content: xlsxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });
    console.log(`[Caja] Email enviado a ${ownerEmail} para tienda ${store.name}`);
  } catch (e) {
    console.error('[Caja] Error enviando email:', e.message);
  }
}

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
    const { username, password, business_name, country } = req.body;
    const email = (req.body.email || '').toLowerCase().trim();

    if (!username || !email || !password || !country) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const [existingEmail] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    }

    const [existingUsername] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
    }

    const user = await createUser(username, email, password, business_name, country);

    const storeName = business_name || username;
    const newStore = await createStore(user.id, {
      name: storeName,
      primary_color: '#000000',
      secondary_color: '#FFFFFF',
      accent_color: '#D4AF37',
      header_color: '#000000',
      currency_code: 'USD',
      currency_symbol: '$',
      currency_name: 'Dólar Estadounidense'
    });
    await createStoreConfiguration(newStore.id, {
      name: 'Default Config',
      accept_cash: true,
      accept_card: true,
      is_active: true,
      is_default: true,
      allow_serve: true,
      allow_takeout: true
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await setVerificationCode(user.id, code, expires);

    await mailer.sendMail({
      from: `"SRServi" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Activa tu cuenta SRServi',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#D4AF37">Bienvenido a SRServi</h2>
        <p>Tu código de activación es:</p>
        <div style="font-size:36px;font-weight:900;letter-spacing:10px;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px">${code}</div>
        <p style="color:#888;font-size:12px">Expira en 15 minutos. Si no creaste esta cuenta, ignora este correo.</p>
      </div>`
    });

    res.json({ requiresVerification: true, email });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const password = req.body.password;
    const email = (req.body.email || '').toLowerCase().trim();

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

    if (!user.email_verified) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await setVerificationCode(user.id, code, expires);
      try {
        await mailer.sendMail({
          from: `"SRServi" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Activa tu cuenta SRServi',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#D4AF37">Activa tu cuenta</h2>
            <p>Tu código de activación es:</p>
            <div style="font-size:36px;font-weight:900;letter-spacing:10px;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px">${code}</div>
            <p style="color:#888;font-size:12px">Expira en 15 minutos.</p>
          </div>`
        });
      } catch (mailErr) {
        console.error('Error enviando correo de verificación:', mailErr.message);
      }
      return res.json({ requiresVerification: true, email });
    }

    if (user.totp_enabled && user.totp_secret) {
      const tempToken = jwt.sign({ id: user.id, type: '2fa_pending' }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requiresTwoFactor: true, tempToken });
    }

    const token = jwt.sign({ id: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    const { totp_secret, totp_enabled, email_verified, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const { code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Datos incompletos' });

    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.email_verified) return res.status(400).json({ error: 'La cuenta ya está verificada' });

    if (!user.verification_code || user.verification_code !== String(code).trim()) {
      return res.status(401).json({ error: 'Código incorrecto' });
    }
    if (!user.verification_expires || new Date() > new Date(user.verification_expires)) {
      return res.status(401).json({ error: 'El código expiró. Solicita uno nuevo.' });
    }

    await markEmailVerified(user.id);

    const fullUser = await getUserById(user.id);
    const token = jwt.sign({ id: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    const { totp_secret, totp_enabled, ...safeUser } = fullUser;
    res.json({ user: safeUser, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.email_verified) return res.status(400).json({ error: 'La cuenta ya está verificada' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await setVerificationCode(user.id, code, expires);

    await mailer.sendMail({
      from: `"SRServi" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Activa tu cuenta SRServi',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#D4AF37">Activa tu cuenta</h2>
        <p>Tu nuevo código de activación es:</p>
        <div style="font-size:36px;font-weight:900;letter-spacing:10px;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px">${code}</div>
        <p style="color:#888;font-size:12px">Expira en 15 minutos.</p>
      </div>`
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/verify', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'Datos incompletos' });

    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token expirado o inválido' });
    }
    if (payload.type !== '2fa_pending') return res.status(401).json({ error: 'Token inválido' });

    const user = await getUserById(payload.id);
    if (!user || !user.totp_secret) return res.status(401).json({ error: 'Usuario no encontrado' });

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: String(code).replace(/\s/g, ''),
      window: 1
    });

    if (!valid) return res.status(401).json({ error: 'Código incorrecto' });

    const token = jwt.sign({ id: user.id, email: user.email, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    const { totp_secret, totp_enabled, password, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/2fa/status', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    res.json({ enabled: Boolean(user?.totp_enabled) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const secret = speakeasy.generateSecret({
      name: `SRServi (${user.email})`,
      issuer: 'SRServi',
      length: 20
    });

    await setTotpSecret(req.user.id, secret.base32);

    res.json({
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/enable', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código requerido' });

    const user = await getUserById(req.user.id);
    if (!user || !user.totp_secret) return res.status(400).json({ error: 'Primero genera el QR de configuración' });

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: String(code).replace(/\s/g, ''),
      window: 1
    });

    if (!valid) return res.status(401).json({ error: 'Código incorrecto. Asegúrate de haber escaneado el QR.' });

    await enableTotp(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código requerido' });

    const user = await getUserById(req.user.id);
    if (!user || !user.totp_secret) return res.status(400).json({ error: '2FA no está configurado' });

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: String(code).replace(/\s/g, ''),
      window: 1
    });

    if (!valid) return res.status(401).json({ error: 'Código incorrecto' });

    await disableTotp(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/recover', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email y código son requeridos' });

    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'No existe una cuenta con ese email' });
    if (!user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: 'Esta cuenta no tiene verificación en 2 pasos activada' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: String(code).replace(/\s/g, ''),
      window: 1
    });

    if (!valid) return res.status(401).json({ error: 'Código incorrecto' });

    const recoveryToken = jwt.sign({ id: user.id, type: 'password_recovery' }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ recoveryToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/2fa/reset-password', async (req, res) => {
  try {
    const { recoveryToken, newPassword } = req.body;
    if (!recoveryToken || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    let payload;
    try {
      payload = jwt.verify(recoveryToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token expirado. Vuelve a verificar con tu app.' });
    }
    if (payload.type !== 'password_recovery') return res.status(401).json({ error: 'Token inválido' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(payload.id, hashed);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await getUserByEmail(email);
    // Always respond OK to avoid user enumeration
    if (!user) return res.json({ success: true });

    const resetToken = jwt.sign({ id: user.id, type: 'email_reset' }, JWT_SECRET, { expiresIn: '15m' });
    const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;

    await mailer.sendMail({
      from: `"SRServi" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Restablecer contraseña — SRServi',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e0e0e0">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#000;margin-bottom:12px">
              <span style="color:#D4AF37;font-weight:900;font-size:20px">SR</span>
            </div>
            <h2 style="margin:0;font-size:22px;color:#111">Restablecer contraseña</h2>
          </div>
          <p style="color:#444;font-size:15px;line-height:1.6">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta <strong>${email}</strong>.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#D4AF37;color:#000;font-weight:800;font-size:16px;padding:14px 32px;border-radius:10px;text-decoration:none">
              Restablecer contraseña
            </a>
          </div>
          <p style="color:#888;font-size:13px">Este enlace expira en <strong>15 minutos</strong>. Si no solicitaste esto, ignora este correo.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#bbb;font-size:12px;text-align:center">SRServi · support@srautomatic.com</p>
        </div>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error enviando email de reset:', error.message);
    res.status(500).json({ error: 'No se pudo enviar el correo. Intenta de nuevo.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'El enlace expiró o es inválido. Solicita uno nuevo.' });
    }
    if (payload.type !== 'email_reset') return res.status(401).json({ error: 'Token inválido' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(payload.id, hashed);
    res.json({ success: true });
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

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/heartbeat', authenticateToken, async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    let country = null;
    if (ip && ip !== '::1' && ip !== '127.0.0.1') {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo.country) country = geo.country;
        }
      } catch {}
    }
    await updateUserHeartbeat(req.user.id, country);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const openRegister = await getOpenCashRegister(store.id);

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
      cash_register_open: !!openRegister,
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

    const terminals = await getPosTerminalsByStore(store.id);
    const formatted = terminals.map(t => ({
      id: t.id,
      name: t.name,
      provider: t.provider,
      device_id: t.device_id,
      serial: t.device_id,
      pos_pin: t.pos_pin
    }));

    res.json(formatted);
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

app.get('/api/user/chatgpt-key', authenticateToken, async (req, res) => {
  try {
    const key = await getChatGptKey(req.user.id);
    res.json({ has_key: !!key, key_preview: key ? `sk-...${key.slice(-4)}` : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/chatgpt-key', authenticateToken, async (req, res) => {
  try {
    const { api_key } = req.body;
    await saveChatGptKey(req.user.id, api_key || null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const storeId = parseInt(id);
    if (req.user.type === 'worker') {
      if (req.user.store_id !== storeId) return res.status(403).json({ error: 'Sin acceso' });
      const store = await getStoreById(storeId);
      if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
      return res.json(store);
    }
    const stores = await getStores(req.user.id);
    const store = stores.find(s => s.id === storeId);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
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
    await createStoreConfiguration(store.id, {
      name: 'Default Config',
      accept_cash: true,
      accept_card: true,
      is_active: true,
      is_default: true,
      allow_serve: true,
      allow_takeout: true
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

app.post('/api/stores/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });
    const store = await duplicateStore(req.params.id, req.user.id, name);
    res.json(store);
  } catch (error) {
    if (error.code === 'STORE_LIMIT_REACHED') {
      return res.status(403).json({ error: error.message, code: 'STORE_LIMIT_REACHED', maxStores: error.maxStores, currentPlan: error.currentPlan });
    }
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
      `SELECT e.*, c.name as category_name FROM extras e LEFT JOIN categories c ON e.category_id = c.id WHERE e.store_id = ? ORDER BY e.sort_order, e.name`,
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
      `SELECT i.*, c.name as category_name FROM ingredients i LEFT JOIN categories c ON i.category_id = c.id WHERE i.store_id = ? ORDER BY i.sort_order, i.name`,
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

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
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
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
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

// ==================== LEÓN IA ====================

const LEON_GREETINGS = [
  '¡Hola! Soy **León IA** 🦁, tu asistente de negocios.\n\nHablame de forma natural y te ayudo. Por ejemplo:\n\n• "¿Qué días vendo más?" 📅\n• "¿Qué productos se venden más?" 📈\n• "¿Qué hago con lo que no se mueve?" 📉\n• "¿Cuánto hice este mes?" 💰\n• "¿A qué hora tengo más clientes?" ⏰\n• "¿Tengo algo agotado?" 📦\n• "Dame recomendaciones" 🎯',
  '¡Buenas! Soy **León IA** 🦁. Listo para analizar tu negocio.\n\nPregúntame lo que necesites — entiendo lenguaje natural. Por ejemplo: "¿qué días vendo más?", "¿cómo van las ventas?", "¿qué no se está vendiendo?"',
  'Hola de nuevo 👋. Soy **León IA**, tu asesor de ventas inteligente.\n\nDime qué quieres saber y te respondo al instante. Puedo analizar días, horarios, productos, ingresos, stock y más.',
];

function leonDetectIntent(text, history = []) {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const has = (...words) => words.some(w => t.includes(w));

  // Detectar follow-ups con contexto del historial
  const lastLeonMsg = [...history].reverse().find(m => m.role === 'leon');
  const lastIntent = lastLeonMsg?.intent || null;

  const words = t.trim().split(/\s+/);
  const isShort = words.length <= 6;

  // Plan de acción: detectar afirmativa después de worst_products, o solicitud explícita
  const isAffirmative = isShort && has('si', 'dale', 'claro', 'adelante', 'bueno', 'ok dale', 'va', 'hazlo', 'hacelo');
  if (has('plan de accion', 'plan detallado', 'plan de mejora', 'estrategia detallada', 'como lo mejoro paso a paso', 'que pasos sigo'))
    return 'action_plan';
  if (isAffirmative && (lastIntent === 'worst_products' || lastIntent === 'action_plan'))
    return 'action_plan';

  // Follow-up de contexto: frases explícitas o muy cortas con marcadores
  const hasFollowUpMarker = has('y ese mes', 'y este mes', 'y ayer', 'dime mas', 'mas detalles', 'ampliame', 'profundiza');
  const isVagueShort = isShort && has('y eso', 'y esos', 'que mas', 'algo mas');
  if ((hasFollowUpMarker || isVagueShort) && lastIntent && lastIntent !== 'greeting' && lastIntent !== 'unknown' && lastIntent !== 'action_plan')
    return lastIntent;

  if (has('hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'como estas', 'quien eres', 'que eres', 'que puedes hacer', 'que sabes hacer', 'ayuda', 'para que sirves', 'que haces', 'presentate'))
    return 'greeting';

  // Extras e ingredientes — van ANTES que top_products para evitar colisión con "más vendidos"
  if (has('extra') && has('mas vendido', 'mas pedido', 'mas solicitado', 'popular', 'top', 'mas elegido', 'mas piden', 'eligen', 'solicitado', 'mas elegido', 'mas comprado'))
    return 'extras_analysis';
  if (has('extras mas pedidos', 'extras mas solicitados', 'que extras piden', 'extras populares', 'extra mas elegido', 'que extra eligen', 'extras top', 'extras mas vendidos', 'extras favoritos', 'que extra piden'))
    return 'extras_analysis';
  if ((has('complemento') || has('ingrediente')) && has('mas vendido', 'mas pedido', 'mas solicitado', 'popular', 'top', 'mas elegido', 'mas piden', 'eligen', 'solicitado', 'mas comprado'))
    return 'ingredients_analysis';
  if (has('complementos mas pedidos', 'complementos mas solicitados', 'que complementos piden', 'complementos populares', 'complemento mas elegido', 'que complemento eligen', 'ingredientes mas pedidos', 'ingredientes populares', 'complementos mas vendidos', 'ingredientes mas vendidos', 'complementos favoritos'))
    return 'ingredients_analysis';
  if (has('que extras tengo', 'lista de extras', 'mis extras', 'ver extras', 'cuales son mis extras', 'extras de mi tienda', 'extras disponibles', 'extras configurados', 'tengo extras'))
    return 'extras_catalog';
  if (has('que complementos tengo', 'lista de complementos', 'mis complementos', 'ver complementos', 'cuales son mis complementos', 'complementos de mi tienda', 'complementos disponibles', 'que ingredientes tengo', 'lista de ingredientes', 'mis ingredientes', 'complementos configurados'))
    return 'ingredients_catalog';

  if (has('menos vendido', 'poco vendido', 'no se vende', 'bajo rendimiento', 'peor', 'que hago con', 'descontinuar', 'eliminar producto', 'mal vendido', 'baja rotacion', 'no vendo', 'no se mueve', 'que falla', 'que no funciona', 'los peores', 'minimo vendido', 'casi no vendo'))
    return 'worst_products';
  if (has('mas vendido', 'top producto', 'mejor vendido', 'estrella', 'popular', 'cuales vendo mas', 'productos top', 'mas exitoso', 'que se vende mas', 'lider', 'numero uno', 'cuales son los mas', 'que producto vendo mas', 'que productos salen mas', 'que se pide mas', 'los que mas', 'favorito de los clientes', 'el mas pedido', 'ranking de producto'))
    return 'top_products';
  if (has('ingreso', 'ganancia', 'cuanto vendi', 'cuanto gane', 'dinero', 'venta total', 'facturacion', 'revenue', 'recaude', 'cuanto saque', 'cuanto hice', 'cuanto llevo', 'plata', 'cuanto genere', 'total de ventas', 'que tal las ventas', 'numeros de venta', 'cuanta plata', 'cuanto cobre'))
    return 'revenue';

  // Días de la semana — va ANTES que peak_hours para no confundir "día" con "hora"
  if (has('que dia vendo mas', 'que dias vendo mas', 'mejor dia de la semana', 'mejores dias', 'dias mas activos', 'dia mas activo', 'dias con mas ventas', 'dias de mayor venta', 'que dia es el mejor', 'cuales son los mejores dias', 'en que dia vendo', 'dia de la semana', 'dias de la semana', 'por dia de la semana', 'rendimiento por dia', 'ventas por dia de semana', 'que dia hay mas gente', 'dia mas concurrido', 'dias top', 'cuando vendo mas los dias'))
    return 'best_days';
  if (has('dia', 'dias') && has('mejor', 'mas venta', 'mas activo', 'mas pedido', 'mas movimiento', 'mayor', 'top'))
    return 'best_days';

  if (has('hora', 'pico', 'momento del dia', 'horario', 'mejor hora', 'hora punta', 'a que hora', 'horario pico', 'rush', 'cuando vendo mas en el dia', 'horas de mayor'))
    return 'peak_hours';
  // "cuando vendo" sin contexto de día → peak_hours
  if (has('cuando vendo') && !has('dia', 'dias', 'semana', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'))
    return 'peak_hours';

  if (has('stock', 'inventario', 'agotado', 'por acabarse', 'sin stock', 'quedan pocos', 'me queda', 'sin existencia', 'que reponer', 'que comprar', 'necesito reponer', 'queda poco', 'critico de stock', 'falta stock'))
    return 'stock_alert';
  if (has('categoria', 'categorias', 'que categoria', 'por categoria', 'seccion', 'secciones', 'por seccion', 'rubros', 'rubro'))
    return 'category_analysis';
  if (has('resumen', 'como voy', 'como estoy', 'estado', 'balance', 'panorama', 'reporte', 'resumen general', 'dashboard', 'pantallazo', 'overview', 'dame un resumen', 'informe', 'como van las cosas', 'como va todo'))
    return 'summary';
  if (has('recomienda', 'consejo', 'sugerencia', 'que puedo hacer', 'estrategia', 'que hago', 'como mejoro', 'ideas', 'ayudame a mejorar', 'que deberia', 'que me sugieres', 'tips', 'mejoras', 'puntos de mejora', 'que esta fallando', 'que esta mal', 'como optimizo', 'dame consejos'))
    return 'recommendations';
  if (has('pedido', 'orden', 'compra', 'cuantos pedidos', 'cuantas ordenes', 'ordenes del dia', 'pedidos de hoy', 'cuantas ventas', 'cuantos pedidos hubo'))
    return 'orders_summary';
  // Análisis de producto específico — debe ir antes del fallback
  if (has('analiza ', 'analiza el ', 'analiza la ', 'analiza los ', 'analiza las ',
          'como va ', 'como esta ', 'como va el ', 'como esta el ', 'como va la ', 'como esta la ',
          'dime sobre ', 'info de ', 'informacion de ', 'rendimiento de ',
          'cuanto vende ', 'cuanto se vende ', 'ventas de ', 'datos de ',
          'que tal el ', 'que tal la ', 'que tal los ', 'que pasa con ', 'profundiza en '))
    return 'product_analysis';
  // Si el contexto anterior pedía analizar un producto específico
  if (lastIntent === 'action_plan' && words.length >= 2 && !has('no', 'nada', 'no gracias'))
    return 'product_analysis';

  if (has('gracias', 'ok', 'perfecto', 'genial', 'excelente', 'entendido', 'listo'))
    return 'thanks';
  return 'unknown';
}

function leonExtractProductName(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const prefixes = [
    'analiza el producto ', 'analiza la producto ', 'analiza los productos ',
    'analiza el ', 'analiza la ', 'analiza los ', 'analiza las ', 'analiza ',
    'como va el producto ', 'como va la ', 'como va el ', 'como va ',
    'como esta el ', 'como esta la ', 'como esta ',
    'dime sobre el ', 'dime sobre la ', 'dime sobre ',
    'informacion de ', 'info de ', 'rendimiento de ',
    'cuanto vende el ', 'cuanto vende la ', 'cuanto vende ',
    'cuanto se vende el ', 'cuanto se vende la ', 'cuanto se vende ',
    'ventas de el ', 'ventas de la ', 'ventas de ',
    'datos de el ', 'datos de la ', 'datos de ',
    'que tal el ', 'que tal la ', 'que tal los ', 'que tal ',
    'que pasa con el ', 'que pasa con la ', 'que pasa con ',
    'profundiza en el ', 'profundiza en la ', 'profundiza en ',
  ];
  for (const p of prefixes) {
    if (t.startsWith(p)) return t.slice(p.length).trim();
  }
  // Quitar artículos sueltos al inicio
  return t.replace(/^(el|la|los|las|un|una)\s+/, '').trim();
}

function leonDetectRange(text) {
  const t = text.toLowerCase();
  if (t.includes('hoy') || t.includes('dia') || t.includes('today')) return 'today';
  if (t.includes('mes') || t.includes('month') || t.includes('30 dias')) return 'month';
  if (t.includes('año') || t.includes('year') || t.includes('365')) return 'year';
  return 'week';
}

function leonRangeLabel(range) {
  return { today: 'hoy', week: 'esta semana', month: 'este mes', year: 'este año' }[range] || 'esta semana';
}

async function leonGetAllProducts(storeId) {
  // inventory no tiene store_id — se une sólo por product_id
  const [rows] = await pool.execute(
    `SELECT p.id, p.name, p.price,
            COALESCE(i.stock, 0) AS stock,
            COALESCE(i.unlimited_stock, 0) AS unlimited_stock
     FROM products p
     LEFT JOIN inventory i ON p.id = i.product_id
     WHERE p.store_id = ?
     ORDER BY p.sort_order ASC`,
    [storeId]
  );
  return rows;
}

async function leonGetWorstProducts(storeId, range) {
  let interval = '7 DAY';
  if (range === 'today') interval = '1 DAY';
  else if (range === 'month') interval = '30 DAY';
  else if (range === 'year') interval = '365 DAY';

  // Subconsulta para ventas del periodo — evita ambigüedad de columnas
  const [sold] = await pool.execute(
    `SELECT p.id, p.name, p.price,
            COALESCE(SUM(oi.quantity), 0) AS total_sold
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON oi.order_id = o.id
       AND o.store_id = ?
       AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
     WHERE p.store_id = ?
     GROUP BY p.id, p.name, p.price
     ORDER BY total_sold ASC
     LIMIT 8`,
    [storeId, storeId]
  );
  return sold;
}

async function leonGetTopProductsWithRevenue(storeId, range, limit = 5) {
  let interval = '7 DAY';
  if (range === 'today') interval = '1 DAY';
  else if (range === 'month') interval = '30 DAY';
  else if (range === 'year') interval = '365 DAY';

  const [rows] = await pool.execute(
    `SELECT p.id, p.name,
            SUM(oi.quantity) AS total_sold,
            SUM(oi.quantity * oi.unit_price) AS revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id
     WHERE o.store_id = ?
       AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
     GROUP BY p.id, p.name
     ORDER BY total_sold DESC
     LIMIT ${parseInt(limit)}`,
    [storeId]
  );
  return rows;
}

async function leonGetCategoryRevenue(storeId, range) {
  let interval = '7 DAY';
  if (range === 'today') interval = '1 DAY';
  else if (range === 'month') interval = '30 DAY';
  else if (range === 'year') interval = '365 DAY';

  const [rows] = await pool.execute(
    `SELECT COALESCE(c.name,'Sin categoría') as category,
            COUNT(DISTINCT o.id) as orders,
            SUM(oi.quantity) as total_sold,
            SUM(oi.quantity*oi.unit_price) as revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id=o.id
     JOIN products p ON oi.product_id=p.id
     LEFT JOIN categories c ON p.category_id=c.id
     WHERE o.store_id=? AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at>=DATE_SUB(NOW(),INTERVAL ${interval})
     GROUP BY c.id, c.name
     ORDER BY revenue DESC`,
    [storeId]
  );
  return rows;
}

async function leonGetAllExtras(storeId) {
  const [rows] = await pool.execute(
    `SELECT id, name, price FROM extras WHERE store_id = ? ORDER BY sort_order ASC, name ASC`,
    [storeId]
  );
  return rows;
}

async function leonGetAllIngredients(storeId) {
  const [rows] = await pool.execute(
    `SELECT id, name, price FROM ingredients WHERE store_id = ? ORDER BY sort_order ASC, name ASC`,
    [storeId]
  );
  return rows;
}

async function leonGetTopExtras(storeId, range) {
  let interval = '7 DAY';
  if (range === 'today') interval = '1 DAY';
  else if (range === 'month') interval = '30 DAY';
  else if (range === 'year') interval = '365 DAY';

  const [items] = await pool.execute(
    `SELECT oi.selected_extras
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.store_id = ?
       AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
       AND oi.selected_extras IS NOT NULL AND oi.selected_extras != '[]'`,
    [storeId]
  );
  const counts = {};
  for (const row of items) {
    try {
      const arr = JSON.parse(row.selected_extras || '[]');
      for (const entry of arr) {
        const name = typeof entry === 'string' ? entry : (entry.name || '');
        if (name) counts[name] = (counts[name] || 0) + 1;
      }
    } catch {}
  }
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

async function leonGetSalesByDayOfWeek(storeId, range) {
  let interval = '30 DAY';
  if (range === 'week') interval = '7 DAY';
  else if (range === 'month') interval = '30 DAY';
  else if (range === 'year') interval = '365 DAY';

  const DAY_NAMES = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const [rows] = await pool.execute(
    `SELECT DAYOFWEEK(o.created_at) AS day_num,
            COUNT(*) AS orders,
            SUM(o.total) AS revenue
     FROM orders o
     WHERE o.store_id = ?
       AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
     GROUP BY DAYOFWEEK(o.created_at)
     ORDER BY orders DESC`,
    [storeId]
  );
  return rows.map(r => ({ ...r, day_name: DAY_NAMES[r.day_num] || 'Desconocido' }));
}

async function leonGetTopIngredients(storeId, range) {
  let interval = '7 DAY';
  if (range === 'today') interval = '1 DAY';
  else if (range === 'month') interval = '30 DAY';
  else if (range === 'year') interval = '365 DAY';

  const [items] = await pool.execute(
    `SELECT oi.selected_ingredients
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.store_id = ?
       AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
       AND oi.selected_ingredients IS NOT NULL AND oi.selected_ingredients != '[]'`,
    [storeId]
  );
  const counts = {};
  for (const row of items) {
    try {
      const arr = JSON.parse(row.selected_ingredients || '[]');
      for (const entry of arr) {
        const name = typeof entry === 'string' ? entry : (entry.name || '');
        if (name) counts[name] = (counts[name] || 0) + 1;
      }
    } catch {}
  }
  return Object.entries(counts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

async function leonGetProductAnalysis(storeId, productName) {
  // Buscar producto por nombre (fuzzy)
  const [prods] = await pool.execute(
    `SELECT p.id, p.name, p.price, p.description,
            COALESCE(i.stock, 0) AS stock,
            COALESCE(i.unlimited_stock, 0) AS unlimited_stock,
            c.name AS category_name
     FROM products p
     LEFT JOIN inventory i ON p.id = i.product_id
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.store_id = ? AND LOWER(p.name) LIKE ?
     LIMIT 5`,
    [storeId, `%${productName.toLowerCase()}%`]
  );
  if (!prods.length) return null;

  const prod = prods[0];

  // Ventas por período
  const periods = { week: '7 DAY', month: '30 DAY', year: '365 DAY' };
  const salesData = {};
  for (const [key, interval] of Object.entries(periods)) {
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS total_sold,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
              COUNT(DISTINCT o.id) AS orders
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_id = ? AND o.store_id = ?
         AND o.status IN ('paid','processed','completed','approved')
         AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})`,
      [prod.id, storeId]
    );
    salesData[key] = rows[0];
  }

  // Ranking entre todos los productos (semana)
  const [ranking] = await pool.execute(
    `SELECT p.id, SUM(oi.quantity) AS total_sold
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON oi.order_id = o.id
       AND o.store_id = ? AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     WHERE p.store_id = ?
     GROUP BY p.id
     ORDER BY total_sold DESC`,
    [storeId, storeId]
  );
  const rank = ranking.findIndex(r => r.id === prod.id) + 1;
  const total = ranking.length;

  // Ventas por día últimos 7 días
  const [byDay] = await pool.execute(
    `SELECT DATE(o.created_at) AS date, SUM(oi.quantity) AS qty
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.product_id = ? AND o.store_id = ?
       AND o.status IN ('paid','processed','completed','approved')
       AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(o.created_at)
     ORDER BY date ASC`,
    [prod.id, storeId]
  );

  return { prod, salesData, rank, total, byDay, allMatches: prods };
}

function r(text, chart = null) { return { text, chart }; }

function leonBuildResponse(intent, range, data, storeName) {
  const rl = leonRangeLabel(range);
  const fmt = (n) => Number(n || 0).toFixed(2);
  const store = storeName ? ` de **${storeName}**` : '';

  switch (intent) {
    case 'greeting':
      return r(LEON_GREETINGS[Math.floor(Math.random() * LEON_GREETINGS.length)]);

    case 'thanks':
      return r('¡De nada! 😊 Si necesitas analizar algo más, aquí estoy. Puedes preguntarme sobre ventas, stock, ingresos o cualquier cosa de tu negocio.');

    case 'top_products': {
      const { products } = data;
      if (!products || !products.length)
        return r(`No encontré ventas registradas ${rl}. ¿Tienes pedidos completados en ese período? Intenta con un rango mayor, por ejemplo "¿cuáles son los más vendidos este mes?".`);
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      const list = products.map((p, i) =>
        `${medals[i] || `${i+1}.`} **${p.name}** — ${p.total_sold} unidades · $${fmt(p.revenue)}`
      ).join('\n');
      const leader = products[0];
      const chart = {
        type: 'bar',
        title: `Top productos ${rl}`,
        labels: products.map(p => p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name),
        values: products.map(p => Number(p.total_sold)),
        unit: 'uds',
        color: '#D4AF37',
      };
      return r(`Ranking de productos ${rl}${store}:\n\n${list}\n\n📈 **${leader.name}** lidera con **${leader.total_sold} unidades** vendidas. ¿Quieres saber cuáles son los que peor van?`, chart);
    }

    case 'worst_products': {
      const { worst } = data;
      if (!worst || !worst.length)
        return r(`No hay productos registrados todavía. Agrega productos desde el **Editor Tótem** para empezar a analizar.`);
      const zeroes = worst.filter(p => Number(p.total_sold) === 0);
      const low = worst.filter(p => Number(p.total_sold) > 0 && Number(p.total_sold) <= 3);
      const rest = worst.filter(p => Number(p.total_sold) > 3);
      if (!zeroes.length && !low.length && rest.length)
        return r(`Buenas noticias 🎉 — todos tus productos se están vendiendo ${rl}. El de menor rotación es **${rest[0].name}** con ${rest[0].total_sold} unidades, pero sigue activo.\n\nSi quieres mejorar aún más, dime "dame recomendaciones".`);
      let resp = `Productos con bajo rendimiento ${rl}:\n\n`;
      if (zeroes.length) {
        resp += `🔴 **Sin ninguna venta (${zeroes.length}):**\n`;
        resp += zeroes.map(p => `• ${p.name} — $${fmt(p.price)}`).join('\n');
        resp += `\n\n`;
      }
      if (low.length) {
        resp += `🟡 **Ventas muy bajas — 1 a 3 unidades (${low.length}):**\n`;
        resp += low.map(p => `• ${p.name} — ${p.total_sold} unid.`).join('\n');
        resp += `\n\n`;
      }
      resp += `¿Quieres que te dé un plan de acción detallado para mejorarlos?`;
      const chart = {
        type: 'bar',
        title: `Ventas ${rl} (menores)`,
        labels: worst.map(p => p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name),
        values: worst.map(p => Number(p.total_sold)),
        unit: 'uds',
        color: '#ef4444',
      };
      return r(resp, chart);
    }

    case 'action_plan': {
      const { worst } = data;
      const zeroes = (worst || []).filter(p => Number(p.total_sold) === 0);
      const low = (worst || []).filter(p => Number(p.total_sold) > 0 && Number(p.total_sold) <= 3);
      let resp = `Plan de acción para tus productos con bajo rendimiento:\n\n`;

      if (zeroes.length) {
        resp += `**Para los productos sin ninguna venta:**\n\n`;
        resp += `**Semana 1 — Visibilidad:**\n`;
        resp += `• Mueve estos productos al inicio del tótem\n`;
        resp += `• Agrega una foto atractiva si no tienen imagen\n`;
        resp += `• Aplica un descuento del 25% con etiqueta "Oferta"\n\n`;
        resp += `**Semana 2 — Promoción activa:**\n`;
        resp += `• Crea un combo con tu producto estrella (ej: "Lleva X + Y con descuento")\n`;
        resp += `• Si tienes vendedores, pídeles que lo sugieran al cliente\n\n`;
        resp += `**Semana 3 — Evaluación:**\n`;
        resp += `• Si sigue sin venderse, bájale el precio definitivamente\n`;
        resp += `• Si después de 30 días no se mueve, considera eliminarlo del menú\n\n`;
      }
      if (low.length) {
        resp += `**Para los de ventas muy bajas:**\n\n`;
        resp += `• Prueba la promoción "2 x 1" o "segunda unidad al 50%"\n`;
        resp += `• Agrégalos como "sugerido" en el tótem junto a los más vendidos\n`;
        resp += `• Revisa si el precio es competitivo comparado con productos similares\n`;
        resp += `• Cambia el nombre o la descripción para hacerlos más atractivos\n\n`;
      }
      if (!zeroes.length && !low.length)
        resp += `No tengo datos recientes de productos con bajo rendimiento. Pregúntame primero "¿qué productos se venden menos?" para obtener el análisis.`;

      resp += `\n¿Quieres que analice algún producto específico en profundidad?`;
      return r(resp);
    }

    case 'revenue': {
      const { summary, salesByDay } = data;
      if (!summary) return r(`No pude obtener los ingresos. Intenta de nuevo.`);
      const bestDay = salesByDay && salesByDay.length
        ? salesByDay.reduce((a, b) => Number(a.revenue) > Number(b.revenue) ? a : b)
        : null;
      const trend = salesByDay && salesByDay.length >= 2
        ? Number(salesByDay[salesByDay.length-1].revenue) > Number(salesByDay[0].revenue) ? '📈 tendencia al alza' : '📉 tendencia a la baja'
        : null;
      let resp = `Ingresos ${rl}${store}:\n\n`;
      resp += `💰 **Total facturado:** $${fmt(summary.revenue)}\n`;
      resp += `📦 **Pedidos completados:** ${summary.completedOrders}\n`;
      resp += `🎯 **Ticket promedio:** $${fmt(summary.avgOrder)}\n`;
      if (bestDay) resp += `📅 **Mejor día:** ${bestDay.date} — $${fmt(bestDay.revenue)}\n`;
      if (trend) resp += `${trend}\n`;
      resp += summary.pendingOrders > 0
        ? `\n⚠️ Tienes **${summary.pendingOrders} pedidos pendientes** sin procesar.`
        : `\n✅ Sin pedidos pendientes. ¡Todo al día!`;
      resp += `\n\n¿Quieres ver qué productos generaron más ingresos o comparar con otro período?`;
      const chart = salesByDay && salesByDay.length ? {
        type: 'bar',
        title: `Ingresos por día ${rl}`,
        labels: salesByDay.map(d => {
          const dt = new Date(d.date);
          return `${dt.getDate()}/${dt.getMonth()+1}`;
        }),
        values: salesByDay.map(d => Number(d.revenue)),
        unit: '$',
        color: '#22c55e',
        highlight: salesByDay.indexOf(bestDay),
      } : null;
      return r(resp, chart);
    }

    case 'peak_hours': {
      const { byHour } = data;
      if (!byHour || !byHour.length)
        return r(`No hay datos de horarios ${rl}. Necesitas tener pedidos completados para ver este análisis.`);
      // Completar horas faltantes con 0
      const hourMap = {};
      byHour.forEach(h => { hourMap[Number(h.hour)] = Number(h.orders); });
      const allHours = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: hourMap[i] || 0 }));
      const sorted = [...byHour].sort((a, b) => Number(b.orders) - Number(a.orders));
      const peak = sorted[0];
      const quiet = sorted[sorted.length - 1];
      const top3 = sorted.slice(0, 3).map(h => `• **${h.hour}:00 hs** — ${h.orders} pedidos`).join('\n');
      const resp = `Distribución de ventas por hora ${rl}:\n\n⏰ **Horas pico:**\n${top3}\n\n🎯 Tu **hora pico es las ${peak.hour}:00 hs** con ${peak.orders} pedidos. Ten stock completo, personal disponible y sistema listo antes de esa hora.\n\n💤 La hora más tranquila: **${quiet.hour}:00 hs** — ideal para hacer inventario.`;
      const activoHours = allHours.filter(h => h.orders > 0);
      const chart = activoHours.length ? {
        type: 'bar',
        title: `Pedidos por hora ${rl}`,
        labels: activoHours.map(h => `${h.hour}h`),
        values: activoHours.map(h => h.orders),
        unit: 'pedidos',
        color: '#a78bfa',
        highlight: activoHours.findIndex(h => h.hour === Number(peak.hour)),
      } : null;
      return r(resp, chart);
    }

    case 'stock_alert': {
      const { allProducts } = data;
      if (!allProducts || !allProducts.length)
        return r(`No encontré productos en tu tienda. Agrega productos desde el **Editor Tótem** para ver el inventario.`);
      const outOfStock = allProducts.filter(p => !Number(p.unlimited_stock) && Number(p.stock) === 0);
      const lowStock = allProducts.filter(p => !Number(p.unlimited_stock) && Number(p.stock) > 0 && Number(p.stock) <= 3);
      const unlimited = allProducts.filter(p => Number(p.unlimited_stock));
      const ok = allProducts.filter(p => !Number(p.unlimited_stock) && Number(p.stock) > 3);
      let resp = `Estado del inventario${store}:\n\n`;
      if (!outOfStock.length && !lowStock.length) {
        resp += `✅ Todo en orden. Sin agotados ni stock crítico.\n`;
        if (unlimited.length) resp += `♾️ **${unlimited.length}** con stock ilimitado · `;
        if (ok.length) resp += `📦 **${ok.length}** con stock normal.`;
        resp += `\n\n¿Quieres analizar ventas para anticipar cuándo reponer?`;
        return r(resp);
      }
      if (outOfStock.length) {
        resp += `🔴 **Agotados (${outOfStock.length}):**\n` + outOfStock.map(p => `• ${p.name}`).join('\n') + `\n\n`;
      }
      if (lowStock.length) {
        resp += `🟡 **Stock crítico ≤ 3 uds (${lowStock.length}):**\n` + lowStock.map(p => `• ${p.name} — **${p.stock}** uds`).join('\n') + `\n\n`;
      }
      resp += `💡 Actualiza el stock desde **Productos** en el panel antes de que afecte tus ventas.`;
      return r(resp);
    }

    case 'category_analysis': {
      const { catRevenue } = data;
      if (!catRevenue || !catRevenue.length)
        return r(`No hay ventas por categoría ${rl}. Necesitas pedidos completados para ver este análisis.`);
      const total = catRevenue.reduce((s, c) => s + Number(c.revenue), 0);
      const list = catRevenue.map((c, i) => {
        const pct = total > 0 ? ((Number(c.revenue) / total) * 100).toFixed(0) : 0;
        return `${i+1}. **${c.category}** — $${fmt(c.revenue)} · ${pct}% · ${c.total_sold} uds`;
      }).join('\n');
      const top = catRevenue[0];
      const bottom = catRevenue[catRevenue.length - 1];
      let resp = `Análisis por categoría ${rl}:\n\n${list}\n\n`;
      resp += `🏆 **${top.category}** lidera con $${fmt(top.revenue)}.`;
      if (catRevenue.length > 1)
        resp += `\n💤 **${bottom.category}** tiene el menor rendimiento — refuérzala con nuevos productos o promociones.`;
      const chart = {
        type: 'bar',
        title: `Ingresos por categoría ${rl}`,
        labels: catRevenue.map(c => c.category.length > 12 ? c.category.slice(0, 11) + '…' : c.category),
        values: catRevenue.map(c => Number(c.revenue)),
        unit: '$',
        color: '#D4AF37',
      };
      return r(resp, chart);
    }

    case 'summary': {
      const { summary, salesByDay } = data;
      if (!summary) return r(`No pude generar el resumen. Intenta de nuevo.`);
      const convRate = summary.totalOrders > 0
        ? ((summary.completedOrders / summary.totalOrders) * 100).toFixed(0) : '0';
      const bestDay = salesByDay && salesByDay.length
        ? salesByDay.reduce((a, b) => Number(a.revenue) > Number(b.revenue) ? a : b)
        : null;
      let resp = `Resumen${store} ${rl}:\n\n`;
      resp += `📦 **${summary.completedOrders}** pedidos completados · **${convRate}%** conversión\n`;
      resp += `💰 **$${fmt(summary.revenue)}** ingresos · **$${fmt(summary.avgOrder)}** ticket promedio\n`;
      if (bestDay) resp += `📅 Mejor día: **${bestDay.date}** — $${fmt(bestDay.revenue)}\n`;
      resp += summary.pendingOrders > 0
        ? `\n⚠️ **${summary.pendingOrders} pedidos pendientes** sin procesar.`
        : `\n✅ Sin pedidos pendientes.`;
      resp += `\n\n¿Quieres profundizar en ventas, stock, horarios o recomendaciones?`;
      const chart = salesByDay && salesByDay.length ? {
        type: 'bar',
        title: `Ventas por día ${rl}`,
        labels: salesByDay.map(d => {
          const dt = new Date(d.date);
          return `${dt.getDate()}/${dt.getMonth()+1}`;
        }),
        values: salesByDay.map(d => Number(d.revenue)),
        unit: '$',
        color: '#22c55e',
        highlight: salesByDay.indexOf(bestDay),
      } : null;
      return r(resp, chart);
    }

    case 'orders_summary': {
      const { summary, recentOrders } = data;
      if (!summary) return r(`No pude obtener los pedidos. Intenta de nuevo.`);
      const statusMap = { paid:'pagado', processed:'procesado', completed:'completado', approved:'aprobado', pending:'pendiente', cancelled:'cancelado', waiting:'esperando' };
      let resp = `Pedidos ${rl}:\n\n`;
      resp += `✅ **Completados:** ${summary.completedOrders}\n`;
      resp += `⏳ **Pendientes:** ${summary.pendingOrders}\n`;
      resp += `❌ **Cancelados:** ${summary.cancelledOrders}\n`;
      resp += `📊 **Total:** ${summary.totalOrders}\n`;
      if (recentOrders && recentOrders.length) {
        resp += `\n**Últimos pedidos:**\n`;
        resp += recentOrders.slice(0, 5).map(o =>
          `• #${o.id} — $${fmt(o.total)} — ${statusMap[o.status] || o.status}`
        ).join('\n');
      }
      if (summary.pendingOrders > 0)
        resp += `\n\n⚠️ Tienes ${summary.pendingOrders} pedidos sin procesar. Ve a **Pedidos** para gestionarlos.`;
      return r(resp);
    }

    case 'recommendations': {
      const { summary, worst, topProds, allProducts } = data;
      if (!summary) return r(`No pude generar recomendaciones. Intenta de nuevo.`);
      const zeroSales = worst ? worst.filter(p => Number(p.total_sold) === 0) : [];
      const outOfStock = allProducts ? allProducts.filter(p => !Number(p.unlimited_stock) && Number(p.stock) === 0) : [];
      const convRate = summary.totalOrders > 0 ? (summary.completedOrders / summary.totalOrders) * 100 : 100;
      let tips = [];
      if (outOfStock.length > 0)
        tips.push(`🔴 **Urgente — ${outOfStock.length} productos agotados.** Estás perdiendo ventas ahora mismo. Recarga el inventario.`);
      if (zeroSales.length > 0)
        tips.push(`💤 **${zeroSales.length} productos sin ventas esta semana** (${zeroSales.slice(0, 2).map(p => p.name).join(', ')}${zeroSales.length > 2 ? '...' : ''}). Crea promociones o quítalos del tótem.`);
      if (topProds && topProds.length)
        tips.push(`⭐ **${topProds[0].name}** es tu producto estrella. Mantenlo visible y con stock siempre.`);
      if (convRate < 70)
        tips.push(`📉 Tu tasa de conversión es ${convRate.toFixed(0)}%. Revisa el proceso de pago o los precios.`);
      if (Number(summary.avgOrder) < 8)
        tips.push(`💡 Ticket promedio bajo ($${fmt(summary.avgOrder)}). Prueba combos o sugeridos en el tótem.`);
      if (!tips.length)
        tips.push(`✅ Tu negocio está funcionando bien esta semana. Considera expandir tu catálogo si la demanda lo permite.`);
      return r(`Recomendaciones para tu negocio esta semana:\n\n${tips.join('\n\n')}\n\n¿Quieres un plan de acción detallado para algún punto?`);
    }

    case 'product_analysis': {
      const { productAnalysis, productName } = data;
      if (!productAnalysis)
        return r(`No encontré ningún producto con el nombre "**${productName}**" en tu tienda. Verifica que el nombre esté bien escrito o usa parte del nombre, por ejemplo "coca" en lugar de "coca cola".`);
      const { prod, salesData, rank, total, byDay } = productAnalysis;
      const fmtP = (n) => Number(n||0).toFixed(2);
      let resp = `Análisis de **${prod.name}**:\n\n`;
      resp += `💰 **Precio:** $${fmtP(prod.price)}`;
      if (prod.category_name) resp += ` · 📂 **Categoría:** ${prod.category_name}`;
      resp += `\n`;
      resp += Number(prod.unlimited_stock) ? `♾️ Stock ilimitado\n` : `📦 **Stock actual:** ${prod.stock} unidades\n`;
      resp += `\n**Ventas:**\n`;
      resp += `• Esta semana: **${salesData.week.total_sold} uds** · $${fmtP(salesData.week.revenue)}\n`;
      resp += `• Este mes: **${salesData.month.total_sold} uds** · $${fmtP(salesData.month.revenue)}\n`;
      resp += `• Este año: **${salesData.year.total_sold} uds** · $${fmtP(salesData.year.revenue)}\n`;
      resp += `\n📊 **Ranking esta semana:** #${rank} de ${total} productos`;
      if (rank === 1) resp += ` 🥇 ¡Es tu producto estrella!`;
      else if (rank <= 3) resp += ` 🏆 Está en el top 3.`;
      else if (rank > total * 0.8) resp += ` ⚠️ Está en el grupo de menor rendimiento.`;
      const chartPA = byDay && byDay.length ? {
        type: 'bar', title: `${prod.name} — ventas por día`,
        labels: byDay.map(d => { const dt = new Date(d.date); return `${dt.getDate()}/${dt.getMonth()+1}`; }),
        values: byDay.map(d => Number(d.qty)),
        unit: 'uds', color: '#D4AF37',
        highlight: byDay.reduce((mi, d, i, a) => Number(d.qty) > Number(a[mi].qty) ? i : mi, 0),
      } : null;
      resp += `\n\n¿Quieres recomendaciones específicas para este producto?`;
      return r(resp, chartPA);
    }

    case 'extras_analysis': {
      const { topExtras } = data;
      if (!topExtras || !topExtras.length)
        return r(`No encontré extras solicitados ${rl}. Asegúrate de tener pedidos completados en ese período donde los clientes hayan elegido extras.`);
      const medals = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.', '8.', '9.', '10.'];
      const list = topExtras.map((e, i) => `${medals[i] || `${i+1}.`} **${e.name}** — pedido ${e.total} ${e.total === 1 ? 'vez' : 'veces'}`).join('\n');
      const chart = {
        type: 'bar',
        title: `Extras más pedidos ${rl}`,
        labels: topExtras.map(e => e.name.length > 14 ? e.name.slice(0, 13) + '…' : e.name),
        values: topExtras.map(e => e.total),
        unit: 'veces',
        color: '#D4AF37',
      };
      return r(`Extras más solicitados por tus clientes ${rl}:\n\n${list}\n\n💡 Asegúrate de tener siempre disponibles los más pedidos. ¿Quieres ver los complementos también?`, chart);
    }

    case 'ingredients_analysis': {
      const { topIngredients } = data;
      if (!topIngredients || !topIngredients.length)
        return r(`No encontré complementos solicitados ${rl}. Asegúrate de tener pedidos completados donde los clientes hayan elegido complementos.`);
      const medals = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.', '8.', '9.', '10.'];
      const list = topIngredients.map((i, idx) => `${medals[idx] || `${idx+1}.`} **${i.name}** — pedido ${i.total} ${i.total === 1 ? 'vez' : 'veces'}`).join('\n');
      const chart = {
        type: 'bar',
        title: `Complementos más pedidos ${rl}`,
        labels: topIngredients.map(i => i.name.length > 14 ? i.name.slice(0, 13) + '…' : i.name),
        values: topIngredients.map(i => i.total),
        unit: 'veces',
        color: '#a78bfa',
      };
      return r(`Complementos más solicitados por tus clientes ${rl}:\n\n${list}\n\n💡 Los más elegidos son los que no deben faltar. ¿Quieres ver los extras también?`, chart);
    }

    case 'extras_catalog': {
      const { allExtras } = data;
      if (!allExtras || !allExtras.length)
        return r(`Tu tienda no tiene extras configurados todavía. Puedes agregarlos desde el **Editor Tótem** en la sección de Extras.`);
      const list = allExtras.map(e => {
        const price = Number(e.price) > 0 ? ` — $${Number(e.price).toFixed(2)}` : ' — sin costo adicional';
        return `• **${e.name}**${price}`;
      }).join('\n');
      return r(`Extras disponibles en tu tienda (${allExtras.length}):\n\n${list}\n\n¿Quieres saber cuáles son los más pedidos por tus clientes?`);
    }

    case 'ingredients_catalog': {
      const { allIngredients } = data;
      if (!allIngredients || !allIngredients.length)
        return r(`Tu tienda no tiene complementos configurados todavía. Puedes agregarlos desde el **Editor Tótem** en la sección de Complementos.`);
      const list = allIngredients.map(i => {
        const price = Number(i.price) > 0 ? ` — $${Number(i.price).toFixed(2)}` : ' — sin costo adicional';
        return `• **${i.name}**${price}`;
      }).join('\n');
      return r(`Complementos disponibles en tu tienda (${allIngredients.length}):\n\n${list}\n\n¿Quieres saber cuáles son los más pedidos por tus clientes?`);
    }

    case 'best_days': {
      const { byDayOfWeek } = data;
      if (!byDayOfWeek || !byDayOfWeek.length)
        return r(`No hay suficientes datos de ventas para analizar los días de la semana. Necesitas pedidos completados en el período seleccionado.`);
      const sorted = [...byDayOfWeek].sort((a, b) => Number(b.orders) - Number(a.orders));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const medals = ['🥇','🥈','🥉','4.','5.','6.','7.'];
      const list = sorted.map((d, i) =>
        `${medals[i] || `${i+1}.`} **${d.day_name}** — ${d.orders} pedidos · $${Number(d.revenue || 0).toFixed(2)}`
      ).join('\n');
      const allDays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
      const presentDays = new Set(sorted.map(d => d.day_name));
      const missingDays = allDays.filter(d => !presentDays.has(d));
      let resp = `Rendimiento por día de la semana ${rl}${store}:\n\n${list}\n\n`;
      resp += `🏆 **${best.day_name}** es tu mejor día con **${best.orders} pedidos**.`;
      if (missingDays.length)
        resp += `\n💤 Sin ventas registradas: ${missingDays.join(', ')}.`;
      resp += `\n\n💡 Asegúrate de tener stock completo y personal suficiente los **${sorted.slice(0,2).map(d => d.day_name).join(' y ')}**.`;
      const chartDays = {
        type: 'bar',
        title: `Pedidos por día de la semana ${rl}`,
        labels: sorted.map(d => d.day_name.slice(0, 3)),
        values: sorted.map(d => Number(d.orders)),
        unit: 'pedidos',
        color: '#D4AF37',
        highlight: 0,
      };
      return r(resp, chartDays);
    }

    default:
      return r(`No entendí bien esa pregunta 🤔. Puedes preguntarme de forma natural, por ejemplo:\n\n• "¿Qué días vendo más?"\n• "¿Cuáles son los más vendidos esta semana?"\n• "¿Cuánto gané este mes?"\n• "¿A qué hora vendo más?"\n• "¿Tengo productos sin stock?"\n• "¿Qué extras piden más mis clientes?"\n• "Dame un resumen"\n• "¿Qué me recomiendas?"\n\nPrueba reformulando tu pregunta.`);
  }
}

app.post('/api/leon-ia/chat', authenticateToken, async (req, res) => {
  try {
    const { question, store_id, history = [] } = req.body;
    if (!question || !store_id) return res.status(400).json({ error: 'Faltan parámetros' });

    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Sin acceso' });

    const storeId = parseInt(store_id);
    const storeData = await getStoreById(storeId);
    const storeName = storeData?.name || null;

    const intent = leonDetectIntent(question, history);
    const detectedRange = leonDetectRange(question);
    const lastRange = history.slice().reverse().find(m => m.range && m.role === 'leon')?.range;
    const isExplicitRange = /\b(hoy|semana|mes|año|ayer)\b/i.test(question);
    const range = isExplicitRange ? detectedRange : (detectedRange !== 'week' ? detectedRange : 'week');

    let data = {};

    if (intent === 'greeting' || intent === 'thanks' || intent === 'unknown') {
      // sin BD
    } else if (intent === 'top_products') {
      data.products = await leonGetTopProductsWithRevenue(storeId, range, 5);
    } else if (intent === 'worst_products') {
      data.worst = await leonGetWorstProducts(storeId, range);
    } else if (intent === 'action_plan') {
      data.worst = await leonGetWorstProducts(storeId, range);
    } else if (intent === 'revenue') {
      data.summary = await getAnalytics(storeId, range);
      data.salesByDay = await getSalesByDay(storeId, range);
    } else if (intent === 'peak_hours') {
      data.byHour = await getOrdersByHour(storeId, range);
    } else if (intent === 'stock_alert') {
      data.allProducts = await leonGetAllProducts(storeId);
    } else if (intent === 'category_analysis') {
      data.catRevenue = await leonGetCategoryRevenue(storeId, range);
    } else if (intent === 'summary') {
      data.summary = await getAnalytics(storeId, range);
      data.salesByDay = await getSalesByDay(storeId, range);
    } else if (intent === 'orders_summary') {
      data.summary = await getAnalytics(storeId, range);
      data.recentOrders = await getRecentOrders(storeId, 5);
    } else if (intent === 'recommendations') {
      data.summary = await getAnalytics(storeId, 'week');
      data.worst = await leonGetWorstProducts(storeId, 'week');
      data.topProds = await leonGetTopProductsWithRevenue(storeId, 'week', 3);
      data.allProducts = await leonGetAllProducts(storeId);
    } else if (intent === 'product_analysis') {
      const productName = leonExtractProductName(question);
      data.productName = productName;
      data.productAnalysis = await leonGetProductAnalysis(storeId, productName);
    } else if (intent === 'extras_analysis') {
      data.topExtras = await leonGetTopExtras(storeId, range);
    } else if (intent === 'ingredients_analysis') {
      data.topIngredients = await leonGetTopIngredients(storeId, range);
    } else if (intent === 'extras_catalog') {
      data.allExtras = await leonGetAllExtras(storeId);
    } else if (intent === 'ingredients_catalog') {
      data.allIngredients = await leonGetAllIngredients(storeId);
    } else if (intent === 'best_days') {
      data.byDayOfWeek = await leonGetSalesByDayOfWeek(storeId, range === 'today' ? 'month' : range);
    } else {
      data.summary = await getAnalytics(storeId, range);
    }

    const leonAnswer = leonBuildResponse(intent, range, data, storeName);

    const chatgptKey = await getChatGptKey(req.user.id);
    if (chatgptKey) {
      try {
        const systemPrompt = `Eres León IA 🦁, el asistente de negocios inteligente de SRServi para la tienda "${storeName}".

PERSONALIDAD: Eres directo, amigable y útil. Hablas como un asesor de negocios experto pero accesible. Entiendes lenguaje natural coloquial en español latinoamericano (por ejemplo "plata" = dinero, "se mueve" = se vende, "no sale" = no se vende, "qué tal va" = cómo está el rendimiento).

REGLAS:
- Responde siempre en español
- Sé concreto y accionable (no filosófico)
- Usa los datos que tienes, no inventes números
- Si el usuario pregunta algo que no está en los datos, dilo honestamente y sugiere qué preguntar
- Usa emojis con moderación
- Máximo 5 oraciones salvo que el usuario pida detalle
- Si el usuario dice algo vago como "y eso?", "qué más?", "cuéntame más", expande sobre lo último que se habló

DATOS ACTUALES DE LA TIENDA (período: ${leonRangeLabel(range)}):
${JSON.stringify(data, null, 2)}

ANÁLISIS PREVIO DE LEÓN: ${leonAnswer.text}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map(m => ({ role: m.role === 'leon' ? 'assistant' : 'user', content: m.text })),
          { role: 'user', content: question },
        ];

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${chatgptKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 500, temperature: 0.7 }),
        });
        if (openaiRes.ok) {
          const openaiData = await openaiRes.json();
          const aiAnswer = openaiData.choices?.[0]?.message?.content;
          if (aiAnswer) {
            return res.json({ answer: aiAnswer, chart: leonAnswer.chart || null, intent, range, ai_powered: true });
          }
        }
      } catch (_) { /* fall through to León */ }
    }

    res.json({ answer: leonAnswer.text, chart: leonAnswer.chart || null, intent, range });
  } catch (error) {
    console.error('León IA error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FIN LEÓN IA ====================

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
    const { store_id, name, price, category_id, stock, unlimited_stock, stock_unit } = req.body;
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
    const ingredient = await createIngredient(parseInt(store_id), { name, price, category_id, image: imageUrl, stock: parseInt(stock) || 0, unlimited_stock: unlimited_stock === 'true' || unlimited_stock === true, stock_unit: stock_unit || 'unidades' });
    emitProductUpdate(parseInt(store_id), 'ingredient_created', ingredient);
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ingredients/reorder', authenticateToken, async (req, res) => {
  try {
    const { store_id, items } = req.body;
    if (!store_id || !items) return res.status(400).json({ error: 'store_id e items son requeridos' });
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    await updateIngredientsOrder(parseInt(store_id), items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ingredients/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, price, category_id, stock, unlimited_stock, stock_unit } = req.body;
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
      unlimited_stock: unlimited_stock === 'true' || unlimited_stock === true,
      stock_unit: stock_unit || 'unidades',
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
    const { store_id, name, price, category_id, stock, unlimited_stock, stock_unit } = req.body;
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
    const extra = await createExtra(parseInt(store_id), { name, price, category_id, image: imageUrl, stock: parseInt(stock) || 0, unlimited_stock: unlimited_stock === 'true' || unlimited_stock === true, stock_unit: stock_unit || 'unidades' });
    emitProductUpdate(parseInt(store_id), 'extra_created', extra);
    res.json(extra);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/extras/reorder', authenticateToken, async (req, res) => {
  try {
    const { store_id, items } = req.body;
    if (!store_id || !items) return res.status(400).json({ error: 'store_id e items son requeridos' });
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    await updateExtrasOrder(parseInt(store_id), items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/extras/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { store_id, name, price, category_id, stock, unlimited_stock, stock_unit } = req.body;
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
      unlimited_stock: unlimited_stock === 'true' || unlimited_stock === true,
      stock_unit: stock_unit || 'unidades',
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
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods } = req.body;
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
    const configuration = await createStoreConfiguration(parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods });
    res.json(configuration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/store-configurations/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods } = req.body;
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
    const configuration = await updateStoreConfiguration(parseInt(req.params.id), parseInt(store_id), { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods });
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

// Get all inventory for a store (products + ingredients + extras)
app.get('/api/inventory/store/:storeId', authenticateToken, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const isOwner = await verifyStoreOwnership(storeId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });

    const [products] = await pool.execute(`
      SELECT p.id, p.name, p.price, c.name AS category_name,
             COALESCE((SELECT stock        FROM inventory WHERE product_id = p.id LIMIT 1), 0)     AS stock,
             COALESCE((SELECT min_stock    FROM inventory WHERE product_id = p.id LIMIT 1), 0)     AS min_stock,
             COALESCE((SELECT unlimited_stock FROM inventory WHERE product_id = p.id LIMIT 1), 0)  AS unlimited_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.store_id = ?
      ORDER BY p.name ASC
    `, [storeId]);

    const ingredients = await getIngredients(storeId);
    const extras = await getExtras(storeId);

    res.json({ products, ingredients, extras });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update ingredient stock/unlimited
app.put('/api/inventory/ingredient/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { stock, unlimited_stock, store_id } = req.body;
    const ingId = parseInt(req.params.id);
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    const s = Math.max(0, parseInt(stock) || 0);
    const u = unlimited_stock ? 1 : 0;
    await pool.execute(
      'UPDATE ingredients SET stock = ?, unlimited_stock = ? WHERE id = ? AND store_id = ?',
      [s, u, ingId, parseInt(store_id)]
    );
    req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { ingredient_id: ingId, stock: s, unlimited_stock: !!unlimited_stock });
    res.json({ stock: s, unlimited_stock: !!unlimited_stock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update extra stock/unlimited
app.put('/api/inventory/extra/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { stock, unlimited_stock, store_id } = req.body;
    const extId = parseInt(req.params.id);
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    const s = Math.max(0, parseInt(stock) || 0);
    const u = unlimited_stock ? 1 : 0;
    await pool.execute(
      'UPDATE extras SET stock = ?, unlimited_stock = ? WHERE id = ? AND store_id = ?',
      [s, u, extId, parseInt(store_id)]
    );
    req.app.get('io').to(`store_${store_id}`).emit('inventory_updated', { extra_id: extId, stock: s, unlimited_stock: !!unlimited_stock });
    res.json({ stock: s, unlimited_stock: !!unlimited_stock });
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

// ─── RAW MATERIALS (Materias Primas) ─────────────────────────────────────────

app.get('/api/raw-materials/store/:storeId', authenticateToken, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const isOwner = await verifyStoreOwnership(storeId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    const [rows] = await pool.execute(
      'SELECT * FROM raw_materials WHERE store_id = ? ORDER BY name ASC',
      [storeId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/raw-materials/store/:storeId', authenticateToken, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const isOwner = await verifyStoreOwnership(storeId, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    const { name, quantity, unit, min_quantity, cost_per_unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const [result] = await pool.execute(
      'INSERT INTO raw_materials (store_id, name, quantity, unit, min_quantity, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?)',
      [storeId, name.trim(), parseFloat(quantity) || 0, unit || 'unidades', parseFloat(min_quantity) || 0, parseFloat(cost_per_unit) || 0]
    );
    const [rows] = await pool.execute('SELECT * FROM raw_materials WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/raw-materials/:id', authenticateToken, async (req, res) => {
  try {
    const { name, quantity, unit, min_quantity, cost_per_unit, store_id } = req.body;
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    await pool.execute(
      'UPDATE raw_materials SET name = ?, quantity = ?, unit = ?, min_quantity = ?, cost_per_unit = ? WHERE id = ? AND store_id = ?',
      [name.trim(), parseFloat(quantity) || 0, unit || 'unidades', parseFloat(min_quantity) || 0, parseFloat(cost_per_unit) || 0, parseInt(req.params.id), parseInt(store_id)]
    );
    const [rows] = await pool.execute('SELECT * FROM raw_materials WHERE id = ?', [parseInt(req.params.id)]);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/raw-materials/:id/restock', authenticateToken, async (req, res) => {
  try {
    const { amount, store_id } = req.body;
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    await pool.execute(
      'UPDATE raw_materials SET quantity = quantity + ? WHERE id = ? AND store_id = ?',
      [parseFloat(amount) || 0, parseInt(req.params.id), parseInt(store_id)]
    );
    const [rows] = await pool.execute('SELECT * FROM raw_materials WHERE id = ?', [parseInt(req.params.id)]);
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/raw-materials/:id', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.body;
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    await pool.execute('DELETE FROM product_recipes WHERE raw_material_id = ?', [parseInt(req.params.id)]);
    await pool.execute('DELETE FROM raw_materials WHERE id = ? AND store_id = ?', [parseInt(req.params.id), parseInt(store_id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── RECIPES (Recetas) ────────────────────────────────────────────────────────

app.get('/api/recipes/:itemType/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;
    const [rows] = await pool.execute(
      `SELECT pr.id, pr.raw_material_id, pr.quantity_used, rm.name, rm.unit, rm.quantity AS stock, rm.cost_per_unit
       FROM product_recipes pr
       JOIN raw_materials rm ON rm.id = pr.raw_material_id
       WHERE pr.item_type = ? AND pr.item_id = ?`,
      [itemType, parseInt(itemId)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/recipes/:itemType/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;
    const { items, store_id } = req.body; // items: [{raw_material_id, quantity_used}]
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No autorizado' });
    await pool.execute('DELETE FROM product_recipes WHERE item_type = ? AND item_id = ?', [itemType, parseInt(itemId)]);
    for (const it of (items || [])) {
      if (!it.raw_material_id || !it.quantity_used) continue;
      await pool.execute(
        'INSERT INTO product_recipes (item_type, item_id, raw_material_id, quantity_used) VALUES (?, ?, ?, ?)',
        [itemType, parseInt(itemId), parseInt(it.raw_material_id), parseFloat(it.quantity_used)]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── END RAW MATERIALS & RECIPES ─────────────────────────────────────────────

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

// --- Excel import endpoints ---

app.get('/api/products/excel-template', authenticateToken, (req, res) => {
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Nombre', 'Descripcion', 'Precio', 'Categoria', 'Codigo_Barras', 'Imagen_URL'],
    ['Ejemplo Pizza', 'Pizza napolitana grande', '10.99', 'Comidas', '', 'https://ejemplo.com/pizza.jpg'],
    ['Ejemplo Bebida', 'Gaseosa 500ml', '2.50', 'Bebidas', '7891234567890', '']
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_productos.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.post('/api/products/excel-preview', authenticateToken, excelUpload.single('file'), async (req, res) => {
  try {
    const { store_id } = req.body;
    if (!store_id) return res.status(400).json({ error: 'store_id es requerido' });
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (raw.length < 2) return res.status(400).json({ error: 'El archivo está vacío o solo tiene encabezados' });

    const header = raw[0].map(h => String(h).trim().toLowerCase());
    const colIdx = {
      nombre: header.findIndex(h => h === 'nombre'),
      descripcion: header.findIndex(h => h === 'descripcion' || h === 'descripción'),
      precio: header.findIndex(h => h === 'precio'),
      categoria: header.findIndex(h => h === 'categoria' || h === 'categoría'),
      barcode: header.findIndex(h => h === 'codigo_barras' || h === 'código_barras' || h === 'barcode' || h === 'codigo barras'),
      image_url: header.findIndex(h => h === 'imagen_url' || h === 'image_url' || h === 'imagen' || h === 'url_imagen')
    };

    if (colIdx.nombre === -1 || colIdx.precio === -1) {
      return res.status(400).json({ error: 'El archivo debe tener columnas "Nombre" y "Precio"' });
    }

    const rows = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      const name = String(row[colIdx.nombre] ?? '').trim();
      const price = parseFloat(String(row[colIdx.precio] ?? '').replace(',', '.'));
      if (!name) continue;
      rows.push({
        name,
        description: colIdx.descripcion >= 0 ? String(row[colIdx.descripcion] ?? '').trim() : '',
        price: isNaN(price) ? 0 : price,
        category: colIdx.categoria >= 0 ? String(row[colIdx.categoria] ?? '').trim() : '',
        barcode: colIdx.barcode >= 0 ? String(row[colIdx.barcode] ?? '').trim() : '',
        image_url: colIdx.image_url >= 0 ? String(row[colIdx.image_url] ?? '').trim() : ''
      });
    }

    res.json({ rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al leer el archivo: ' + error.message });
  }
});

app.post('/api/products/excel-import', authenticateToken, async (req, res) => {
  try {
    const { store_id, rows } = req.body;
    if (!store_id) return res.status(400).json({ error: 'store_id es requerido' });
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No hay productos para importar' });

    const [cats] = await pool.execute('SELECT id, name FROM categories WHERE store_id = ?', [parseInt(store_id)]);
    const catMap = {};
    cats.forEach(c => { catMap[c.name.trim().toLowerCase()] = c.id; });

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        if (!row.name || row.price === undefined) { results.skipped++; continue; }
        const catId = row.category ? (catMap[row.category.toLowerCase()] ?? null) : null;
        await createProduct(parseInt(store_id), {
          name: row.name,
          description: row.description || '',
          price: parseFloat(row.price) || 0,
          category_id: catId,
          barcode: row.barcode || null,
          image: row.image_url || null,
          has_extras: false,
          has_ingredients: false,
          max_extras: 0,
          max_ingredients: 0
        });
        results.created++;
      } catch (err) {
        results.errors.push({ name: row.name, error: err.message });
        results.skipped++;
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- end Excel import ---

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

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);

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
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
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
    const { store_id, items, order_type, payment_method, coupon_code, from_worker, delivery, table_number, custom_total, total, terminal_id } = req.body;

    if (!store_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos del pedido incompletos' });
    }

    // custom_total overrides computed total; fallback to `total` sent by client (includes tip)
    const resolvedTotal = custom_total ?? total ?? null;
    console.log('Creating order:', { store_id, order_type, payment_method, table_number, terminal_id, resolvedTotal });
    const order = await createOrder(parseInt(store_id), { order_type, payment_method, items, coupon_code, from_worker, delivery, table_number, custom_total: resolvedTotal, terminal_id: terminal_id ? parseInt(terminal_id) : null });

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
    const { store_id, items, order_type, payment_method, selected_terminal_id, coupon_code, table_number, custom_total } = req.body;

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
        terminal_id: selected_terminal_id ? parseInt(selected_terminal_id) : null,
        table_number,
        custom_total
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

app.post('/api/mercadopago/print-cash-receipt', async (req, res) => {
  try {
    const { store_id, terminal_db_id, content } = req.body;
    if (!store_id || !terminal_db_id || !content) {
      return res.status(400).json({ error: 'store_id, terminal_db_id y content requeridos' });
    }

    // Try unified pos_terminals first, then legacy table
    let apiKey, mpDeviceId;
    const posTerminal = await getPosTerminalForStore(parseInt(store_id), parseInt(terminal_db_id));
    if (posTerminal && posTerminal.provider === 'mercadopago') {
      apiKey = posTerminal.api_key;
      mpDeviceId = posTerminal.device_id;
    } else {
      const legacyTerminal = await getMercadoPagoTerminalForStore(parseInt(store_id), parseInt(terminal_db_id));
      if (!legacyTerminal) return res.status(404).json({ error: 'Terminal no encontrada para esta tienda' });
      apiKey = legacyTerminal.mercadopago_access_token;
      mpDeviceId = legacyTerminal.mercadopago_terminal_id;
    }

    const payload = {
      type: 'print',
      external_reference: `cash-${terminal_db_id}-${Date.now()}`,
      config: { point: { terminal_id: mpDeviceId, subtype: 'image' } },
      content
    };

    const mpRes = await fetch('https://api.mercadopago.com/terminals/v1/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `cash-print-${terminal_db_id}-${Date.now()}`,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP print-cash-receipt error:', mpData);
      return res.status(mpRes.status).json({ error: mpData.message || 'Error al imprimir en terminal', details: mpData });
    }

    return res.json({ success: true, data: mpData });
  } catch (err) {
    console.error('Error print-cash-receipt:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
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
        table_number: order.table_number ?? null,
        reprint_count: order.reprint_count || 0,
        service_type: order.order_type === 'takeout' ? 'llevar' : 'servir',
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

    const isWorker = req.user.type === 'worker';
    const hasAccess = isWorker
      ? req.user.store_id === parseInt(store_id)
      : await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!hasAccess) {
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

    const isWorker = req.user.type === 'worker';
    const hasAccess = isWorker
      ? req.user.store_id === parseInt(store_id)
      : await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!hasAccess) {
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

app.post('/api/orders/:id/reprint', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { store_id } = req.query;

    if (!store_id) return res.status(400).json({ error: 'store_id es requerido' });

    const isWorker = req.user.type === 'worker';
    const hasAccess = isWorker
      ? req.user.store_id === parseInt(store_id)
      : await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!hasAccess) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });

    try {
      await pool.execute('SHOW COLUMNS FROM orders LIKE ?', ['reprint_count']).then(async ([cols]) => {
        if (cols.length === 0) await pool.execute('ALTER TABLE orders ADD COLUMN reprint_count INT DEFAULT 0');
      });
    } catch {}

    await pool.execute(
      'UPDATE orders SET reprint_count = COALESCE(reprint_count, 0) + 1 WHERE id = ? AND store_id = ?',
      [parseInt(id), parseInt(store_id)]
    );

    const [[order]] = await pool.execute('SELECT reprint_count FROM orders WHERE id = ?', [parseInt(id)]);
    res.json({ reprint_count: order?.reprint_count || 1 });
  } catch (error) {
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

// Endpoint para que el admin pueda acceder como un worker específico
app.post('/api/admin/login-as-worker/:workerId', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') {
      return res.status(403).json({ error: 'Solo admins pueden usar esta función' });
    }

    const workerId = parseInt(req.params.workerId);
    const [workerRows] = await pool.execute('SELECT * FROM workers WHERE id = ?', [workerId]);
    
    if (!workerRows.length) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const worker = workerRows[0];

    // Verificar que el admin es dueño de la tienda del worker
    const isOwner = await verifyStoreOwnership(worker.store_id, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'No tienes acceso a este trabajador' });
    }

    // Obtener datos de la tienda
    const [storeRows] = await pool.execute('SELECT code, name FROM stores WHERE id = ?', [worker.store_id]);
    const store = storeRows[0];

    // Generar token para el worker
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
        store_name: store?.name,
        store_code: store?.code
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

// =================== TAREAS SEMANALES ===================

function getWeekStart() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') return res.status(403).json({ error: 'Acceso denegado' });
    const storeId = req.query.store_id;
    if (!storeId) return res.status(400).json({ error: 'store_id requerido' });
    const isOwner = await verifyStoreOwnership(parseInt(storeId), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    const weekStart = getWeekStart();
    const [tasks] = await pool.execute(`
      SELECT t.*, w.name as worker_name, w.username as worker_username,
             tc.completed_at, tc.completed_by_worker_id,
             cw.name as completed_by_name
      FROM tasks t
      JOIN workers w ON t.worker_id = w.id
      LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.week_start = ?
      LEFT JOIN workers cw ON tc.completed_by_worker_id = cw.id
      WHERE t.store_id = ?
      ORDER BY t.worker_id, t.day_of_week, t.due_time
    `, [weekStart, storeId]);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') return res.status(403).json({ error: 'Acceso denegado' });
    const { store_id, worker_id, name, description, day_of_week, due_time } = req.body;
    if (!store_id || !worker_id || !name || day_of_week === undefined || !due_time) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    const [result] = await pool.execute(
      'INSERT INTO tasks (store_id, worker_id, name, description, day_of_week, due_time) VALUES (?, ?, ?, ?, ?, ?)',
      [store_id, worker_id, name, description || null, day_of_week, due_time]
    );
    const [rows] = await pool.execute(
      'SELECT t.*, w.name as worker_name, w.username as worker_username FROM tasks t JOIN workers w ON t.worker_id = w.id WHERE t.id = ?',
      [result.insertId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') return res.status(403).json({ error: 'Acceso denegado' });
    const { name, description, day_of_week, due_time, worker_id } = req.body;
    const [existing] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    const isOwner = await verifyStoreOwnership(existing[0].store_id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    await pool.execute(
      'UPDATE tasks SET name = ?, description = ?, day_of_week = ?, due_time = ?, worker_id = ? WHERE id = ?',
      [name, description || null, day_of_week, due_time, worker_id, req.params.id]
    );
    const [rows] = await pool.execute(
      'SELECT t.*, w.name as worker_name, w.username as worker_username FROM tasks t JOIN workers w ON t.worker_id = w.id WHERE t.id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/duplicate-worker', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') return res.status(403).json({ error: 'Acceso denegado' });
    const { store_id, source_worker_id, target_worker_id } = req.body;
    if (!store_id || !source_worker_id || !target_worker_id) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    const [sourceTasks] = await pool.execute(
      'SELECT name, description, day_of_week, due_time FROM tasks WHERE store_id = ? AND worker_id = ?',
      [store_id, source_worker_id]
    );
    for (const t of sourceTasks) {
      await pool.execute(
        'INSERT INTO tasks (store_id, worker_id, name, description, day_of_week, due_time) VALUES (?, ?, ?, ?, ?, ?)',
        [store_id, target_worker_id, t.name, t.description, t.day_of_week, t.due_time]
      );
    }
    res.json({ success: true, count: sourceTasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') return res.status(403).json({ error: 'Acceso denegado' });
    const [existing] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    const isOwner = await verifyStoreOwnership(existing[0].store_id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    await pool.execute('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/worker-history', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'user') return res.status(403).json({ error: 'Acceso denegado' });
    const { store_id, worker_id } = req.query;
    if (!store_id || !worker_id) return res.status(400).json({ error: 'Faltan parámetros' });
    const isOwner = await verifyStoreOwnership(parseInt(store_id), req.user.id);
    if (!isOwner) return res.status(403).json({ error: 'Acceso denegado' });

    const [tasks] = await pool.execute(
      'SELECT id, name, description, day_of_week, due_time FROM tasks WHERE store_id = ? AND worker_id = ? ORDER BY day_of_week, due_time',
      [store_id, worker_id]
    );

    if (tasks.length === 0) return res.json({ tasks: [], weeks: [] });

    const taskIds = tasks.map(t => t.id);
    const [completions] = await pool.query(
      `SELECT tc.task_id, tc.week_start, tc.completed_at, tc.completed_by_worker_id,
              w.name as completed_by_name
       FROM task_completions tc
       LEFT JOIN workers w ON tc.completed_by_worker_id = w.id
       WHERE tc.task_id IN (?)
       ORDER BY tc.week_start DESC`,
      [taskIds]
    );

    const weekMap = {};
    for (const c of completions) {
      const ws = c.week_start instanceof Date
        ? c.week_start.toISOString().split('T')[0]
        : String(c.week_start).split('T')[0];
      if (!weekMap[ws]) weekMap[ws] = { week_start: ws, completions: {} };
      weekMap[ws].completions[c.task_id] = {
        completed_at: c.completed_at,
        completed_by_name: c.completed_by_name
      };
    }

    // Always include current week even with no completions yet
    const _now = new Date();
    _now.setDate(_now.getDate() - _now.getDay());
    const currentWS = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
    if (!weekMap[currentWS]) weekMap[currentWS] = { week_start: currentWS, completions: {} };

    const weeks = Object.values(weekMap).sort((a, b) => b.week_start.localeCompare(a.week_start));
    res.json({ tasks, weeks });
  } catch (err) {
    console.error('❌ worker-history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/worker-tasks', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'worker') return res.status(403).json({ error: 'Acceso denegado' });
    const weekStart = getWeekStart();
    const [tasks] = await pool.execute(`
      SELECT t.*, tc.completed_at, tc.completed_by_worker_id,
             cw.name as completed_by_name
      FROM tasks t
      LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.week_start = ?
      LEFT JOIN workers cw ON tc.completed_by_worker_id = cw.id
      WHERE t.worker_id = ?
      ORDER BY t.day_of_week, t.due_time
    `, [weekStart, req.user.id]);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/worker-tasks/:taskId/complete', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'worker') return res.status(403).json({ error: 'Acceso denegado' });
    const taskId = parseInt(req.params.taskId);
    const [tasks] = await pool.execute('SELECT * FROM tasks WHERE id = ? AND worker_id = ?', [taskId, req.user.id]);
    if (!tasks[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    const task = tasks[0];
    const now = new Date();
    const todayDow = now.getDay();
    if (todayDow !== task.day_of_week) {
      return res.status(400).json({ error: 'Esta tarea no corresponde al día de hoy' });
    }
    const [dueH, dueM] = task.due_time.split(':').map(Number);
    const dueDate = new Date();
    dueDate.setHours(dueH, dueM, 0, 0);
    const expireDate = new Date(dueDate.getTime() + 60 * 60 * 1000);
    if (now < dueDate) return res.status(400).json({ error: 'La tarea aún no está disponible' });
    if (now > expireDate) return res.status(400).json({ error: 'El plazo de 1 hora para marcar esta tarea ha expirado' });
    const weekStart = getWeekStart();
    await pool.execute(
      'INSERT IGNORE INTO task_completions (task_id, week_start, completed_by_worker_id) VALUES (?, ?, ?)',
      [taskId, weekStart, req.user.id]
    );
    io.to(`store_${task.store_id}`).emit('task_completed', {
      task_id: taskId, worker_id: req.user.id, week_start: weekStart, completed_at: now
    });
    res.json({ success: true, completed_at: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================== FIN TAREAS ===================

// Public endpoint: get cash orders by POS PIN (for Android apps)
app.get('/api/getCashOrders', async (req, res) => {
  try {
    const { pin } = req.query;
    if (!pin) return res.status(400).json({ error: 'PIN requerido' });

    // Try unified pos_terminals first, then legacy mercado_pago_terminals
    let terminal = await getPosTerminalByPin(String(pin).trim());
    let storeId;

    if (terminal) {
      storeId = terminal.store_id;
    } else {
      const legacyTerminal = await getMercadoPagoTerminalByPin(String(pin).trim());
      if (!legacyTerminal) return res.status(401).json({ error: 'PIN inválido' });
      terminal = legacyTerminal;
      const [storeRows] = await pool.execute(
        'SELECT id FROM stores WHERE user_id = ? LIMIT 1', [terminal.user_id]
      );
      if (!storeRows[0]) return res.status(404).json({ error: 'Tienda no encontrada' });
      storeId = storeRows[0].id;
    }

    const pinStr = String(pin).trim();
    const [orders] = await pool.execute(
      `SELECT o.id, o.order_number, o.order_type, o.total, o.status, o.cash_approved,
              o.table_number, o.terminal_id, o.pos_pin, o.created_at
       FROM orders o
       WHERE o.store_id = ? AND o.payment_method = 'cash'
         AND o.pos_pin = ?
         AND o.created_at >= NOW() - INTERVAL 24 HOUR
       ORDER BY o.created_at DESC`,
      [storeId, pinStr]
    );

    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.id, oi.quantity, oi.unit_price,
                oi.selected_extras, oi.selected_ingredients,
                COALESCE(p.name, 'Producto eliminado') AS product_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items.map(item => ({
        ...item,
        selected_extras: (() => { try { return JSON.parse(item.selected_extras || '[]'); } catch { return []; } })(),
        selected_ingredients: (() => { try { return JSON.parse(item.selected_ingredients || '[]'); } catch { return []; } })()
      }));
      order.display_number = order.order_number
        ? (order.table_number ? `${order.order_number} (Mesa: ${order.table_number})` : order.order_number)
        : (order.table_number ? `Mesa: ${order.table_number}` : `#${order.id}`);
    }

    res.json({ store_id: storeId, terminal_id: terminal.id, terminal_name: terminal.name, pos_pin: pinStr, orders });
  } catch (err) {
    console.error('Error getCashOrders:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =================== pos_terminals UNIFICADO ===================

app.get('/api/pos-terminals', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    const terminals = await getPosTerminals(req.user.id, storeId);
    res.json(terminals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pos-terminals', authenticateToken, async (req, res) => {
  try {
    const { store_id, provider, name, api_key, device_id } = req.body;
    if (!store_id || !provider || !name) {
      return res.status(400).json({ error: 'store_id, provider y name son requeridos' });
    }
    let pos_pin;
    let attempts = 0;
    do {
      pos_pin = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await getPosTerminalByPin(pos_pin);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    const terminal = await createPosTerminal({
      user_id: req.user.id, store_id: parseInt(store_id), provider,
      name: name.trim(), api_key: api_key || '', device_id: device_id || '', pos_pin
    });
    res.json(terminal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/pos-terminals/:id', authenticateToken, async (req, res) => {
  try {
    const { name, api_key, device_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const result = await updatePosTerminal(parseInt(req.params.id), req.user.id, { name, api_key, device_id });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pos-terminals/:id', authenticateToken, async (req, res) => {
  try {
    await deletePosTerminal(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/public/:code/pos-terminals', async (req, res) => {
  try {
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const terminals = await getPosTerminalsByStore(store.id);
    res.json(terminals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =================== FIN pos_terminals UNIFICADO ===================

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
          `SELECT m.id, m.name, m.mercadopago_terminal_id, m.mercadopago_access_token, m.user_id, m.created_at, m.pos_pin
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

    // Generate unique 6-digit PIN
    let pos_pin;
    let attempts = 0;
    do {
      pos_pin = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await getMercadoPagoTerminalByPin(pos_pin);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const terminal = await createMercadoPagoTerminal(req.user.id, {
      name,
      mercadopago_access_token,
      mercadopago_terminal_id,
      pos_pin
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

// Get MP terminal status (operating_mode) from MercadoPago API
app.get('/api/mercado-pago-terminals/:id/status', authenticateToken, async (req, res) => {
  try {
    const terminal = await getMercadoPagoTerminalById(parseInt(req.params.id));
    if (!terminal || terminal.user_id !== req.user.id) return res.status(404).json({ error: 'Terminal no encontrada' });
    const mpRes = await fetch('https://api.mercadopago.com/terminals/v1/list?limit=50', {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${terminal.mercadopago_access_token}` }
    });
    if (!mpRes.ok) return res.status(mpRes.status).json({ error: 'Error al consultar MercadoPago' });
    const data = await mpRes.json();
    const terminals = data.data?.terminals || [];
    const found = terminals.find(t => t.id === terminal.mercadopago_terminal_id);
    if (!found) return res.status(404).json({ error: 'Dispositivo no encontrado en MercadoPago' });
    res.json({ operating_mode: found.operating_mode || 'UNDEFINED', terminal: found });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==================== Screensaver API ====================

let _screensaverTableReady = false;
async function ensureScreensaverTable() {
  if (_screensaverTableReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS screensaver_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      store_id INT NOT NULL DEFAULT 0,
      enabled BOOLEAN DEFAULT FALSE,
      media_url VARCHAR(500) DEFAULT NULL,
      timeout_seconds INT DEFAULT 60,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_screensaver_store (user_id, store_id)
    )
  `);
  _screensaverTableReady = true;
}

// Get screensaver config (admin)
app.get('/api/screensaver/config', authenticateToken, async (req, res) => {
  try {
    await ensureScreensaverTable();
    const store_id = parseInt(req.query.store_id) || 0;
    const [rows] = await pool.execute('SELECT * FROM screensaver_config WHERE user_id = ? AND store_id = ?', [req.user.id, store_id]);
    res.json(rows[0] || { enabled: false, media_url: null, timeout_seconds: 60 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save screensaver config (admin, with optional image upload)
app.post('/api/screensaver/config', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    await ensureScreensaverTable();
    const enabled = req.body.enabled === 'true' || req.body.enabled === true;
    const timeout_seconds = parseInt(req.body.timeout_seconds) || 60;
    let media_url = req.body.media_url || null;
    if (req.file) media_url = '/uploads/' + req.file.filename;
    const store_id = parseInt(req.body.store_id) || 0;
    await pool.execute(
      `INSERT INTO screensaver_config (user_id, store_id, enabled, media_url, timeout_seconds)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), media_url = COALESCE(VALUES(media_url), media_url), timeout_seconds = VALUES(timeout_seconds), updated_at = NOW()`,
      [req.user.id, store_id, enabled, media_url, timeout_seconds]
    );
    const [rows] = await pool.execute('SELECT * FROM screensaver_config WHERE user_id = ? AND store_id = ?', [req.user.id, store_id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete screensaver media (admin)
app.delete('/api/screensaver/media', authenticateToken, async (req, res) => {
  try {
    await ensureScreensaverTable();
    const store_id = parseInt(req.query.store_id) || 0;
    await pool.execute('UPDATE screensaver_config SET media_url = NULL, updated_at = NOW() WHERE user_id = ? AND store_id = ?', [req.user.id, store_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public endpoint: get screensaver for a store code (checks premium)
app.get('/api/public/:code/screensaver', async (req, res) => {
  try {
    await ensureScreensaverTable();
    const store = await getStoreByCode(req.params.code.toUpperCase());
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    const plan = await getUserPlan(store.user_id);
    const isPremium = plan && plan.plan_name && plan.plan_name !== 'Gratis';
    if (!isPremium) return res.json({ enabled: false });
    const [rows] = await pool.execute('SELECT * FROM screensaver_config WHERE user_id = ?', [store.user_id]);
    const cfg = rows[0] || { enabled: false, media_url: null, timeout_seconds: 60 };
    res.json({ ...cfg, store_logo: store.logo_url || null, store_name: store.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// Helper: genera el HTML del email de notificación de tickets
function ticketEmailHtml({ badge, badgeColor = '#D4AF37', title, ticketId, user, extra = '', body }) {
  return `<div style="font-family:sans-serif;max-width:540px;margin:auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden">
    <div style="background:#000;padding:20px 28px">
      <span style="font-size:20px;font-weight:900;color:#D4AF37;letter-spacing:1px">SRServi</span>
      <span style="color:#666;font-size:13px;margin-left:8px">· Soporte</span>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 6px;font-size:11px;color:${badgeColor};text-transform:uppercase;letter-spacing:1px;font-weight:800">${badge}</p>
      <h2 style="margin:0 0 20px;font-size:18px;color:#111;line-height:1.4">${title}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#888;width:110px">Ticket</td>
          <td style="padding:7px 0;font-size:13px;font-weight:700;color:#111">#${ticketId}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#888">Usuario</td>
          <td style="padding:7px 0;font-size:13px;color:#111">${user}</td>
        </tr>
        ${extra}
      </table>
      ${body ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:24px;font-size:14px;color:#333;line-height:1.6;border-left:4px solid #D4AF37;word-break:break-word">${String(body).replace(/\n/g, '<br>')}</div>` : ''}
      <a href="${BASE_URL}/superadmin" style="display:inline-block;background:#D4AF37;color:#000;font-weight:900;font-size:13px;padding:11px 22px;border-radius:8px;text-decoration:none">
        Ver en el panel →
      </a>
    </div>
    <div style="padding:14px 28px;background:#fafafa;border-top:1px solid #e0e0e0;font-size:11px;color:#aaa">
      Enviado automáticamente · SRServi Soporte
    </div>
  </div>`;
}

// Helper: enviar email a todos los superadmins (fire-and-forget, sin bloquear el request)
function notifySuperadmins(subject, html) {
  setImmediate(async () => {
    try {
      const [admins] = await pool.execute('SELECT email FROM superadmin WHERE email IS NOT NULL');
      for (const sa of admins) {
        try {
          await mailer.sendMail({
            from: `"SRServi Soporte" <${process.env.EMAIL_USER}>`,
            to: sa.email,
            subject,
            html
          });
        } catch (err) {
          console.error(`Error enviando email a ${sa.email}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error consultando superadmins para email:', err.message);
    }
  });
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

    const prioridades = { low: 'Leve', normal: 'Normal', important: 'Importante', urgent: 'Urgente' };
    const prLabel = prioridades[priority || 'normal'] || priority || 'Normal';
    const prColor = priority === 'urgent' ? '#e74c3c' : priority === 'important' ? '#f39c12' : '#3498db';
    const senderName = req.user.business_name || req.user.username || req.user.email;
    notifySuperadmins(
      `[Ticket #${result.insertId}] ${subject}`,
      ticketEmailHtml({
        badge: 'Nuevo ticket de soporte',
        badgeColor: '#D4AF37',
        title: subject,
        ticketId: result.insertId,
        user: `${senderName} (${req.user.email})`,
        extra: `<tr><td style="padding:8px 0;font-size:13px;color:#888;width:110px">Prioridad</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:${prColor}">${prLabel}</td></tr>`,
        body: message,
      })
    );
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

    const senderName = req.user.business_name || req.user.username || req.user.email;
    notifySuperadmins(
      `[Ticket #${req.params.id}] Nuevo mensaje — ${ticket[0].subject}`,
      ticketEmailHtml({
        badge: 'Nuevo mensaje de usuario',
        badgeColor: '#3498db',
        title: ticket[0].subject,
        ticketId: req.params.id,
        user: `${senderName} (${req.user.email})`,
        body: msg || '(imagen adjunta)',
      })
    );
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

app.get('/api/download/windows', (req, res) => {
  const zipPath = path.join(__serverDir, '../client/public/SRServiWindowsClient.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="SRServiWindowsClient.zip"');
  res.sendFile(zipPath);
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

    async function tuuCreatePayment(apiKey, amount, deviceSerial, description, dteType, orderNumber, tableNumber, tipAmount, tipPercent) {
      const idempotencyKey = crypto.randomUUID();
      const extraData = {
        sourceName: 'SRServi',
        sourceVersion: '1.1.0'
      };
      const customFields = [];
      if (orderNumber) customFields.push({ name: 'ORDEN', value: String(orderNumber), print: true });
      if (tableNumber) customFields.push({ name: 'MESA', value: String(tableNumber), print: true });
      if (tipAmount > 0) customFields.push({ name: 'PROPINA', value: String(Math.round(tipAmount)), print: true });
      if (customFields.length > 0) extraData.customFields = customFields;
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
        const { store_id, order_id, amount, description, device_uid, terminal_id, tip_amount, tip_percent } = req.body;
        if (!store_id || !amount) return res.status(400).json({ error: 'store_id y amount requeridos' });
        const userId = await tuuGetUserIdFromStore(parseInt(store_id));

        let apiKey = null;
        let dteType = 0;
        let device = null;

        // 1. Buscar terminal por ID en pos_terminals (fuente principal)
        if (terminal_id) {
          const posTerm = await getPosTerminalById(parseInt(terminal_id)).catch(() => null);
          if (posTerm && posTerm.provider === 'tuu') {
            apiKey = posTerm.api_key || null;
            device = { serial: posTerm.device_id, name: posTerm.name };
            console.log(`[tuu/charge] pos_terminals → serial="${device.serial}" apiKey="${apiKey ? apiKey.slice(0,8) + '…' : 'VACÍO'}"`);
          } else {
            // fallback legacy: tuu_devices
            const [rows] = await pool.execute('SELECT * FROM tuu_devices WHERE id = ? AND user_id = ?', [parseInt(terminal_id), userId]);
            if (rows[0]) device = rows[0];
          }
        }

        // 2. Si no hay device aún, buscar por device_uid o cualquiera de la tienda
        if (!device && device_uid) device = await tuuGetDeviceForUid(device_uid, parseInt(store_id));
        if (!device) device = await tuuGetAnyDeviceForStore(parseInt(store_id));
        if (!device) return res.status(400).json({ error: 'No hay POS TUU configurado. Ve al admin > Vincular POS.' });

        // 3. Si no se obtuvo apiKey desde pos_terminals, usar tuu_config como fallback
        if (!apiKey) {
          const config = await tuuGetConfig(userId);
          apiKey = config?.api_key || null;
          dteType = config?.dte_type || 0;
          console.log(`[tuu/charge] tuu_config fallback → apiKey="${apiKey ? apiKey.slice(0,8) + '…' : 'VACÍO'}"`);
        } else {
          const config = await tuuGetConfig(userId);
          dteType = config?.dte_type || 0;
        }

        if (!apiKey) return res.status(400).json({ error: 'API Key de TUU no configurada. Ve al admin > Vincular POS > TUU.' });
        console.log(`[tuu/charge] enviando → serial="${device.serial}" amount=${amount}`);
        let orderNumber = null;
        let tableNumber = null;
        if (order_id) {
          const [orRows] = await pool.execute('SELECT order_number, store_id, table_number FROM orders WHERE id = ?', [order_id]).catch(() => [[]]);
          orderNumber = orRows[0]?.order_number || null;
          tableNumber = orRows[0]?.table_number || null;
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
        const payment = await tuuCreatePayment(apiKey, amount, device.serial, description || '', dteType, orderNumber, tableNumber, tip_amount || 0, tip_percent || 0);
        await pool.execute(
          'INSERT INTO tuu_transactions (store_id, order_id, idempotency_key, amount, status, device_serial) VALUES (?, ?, ?, ?, ?, ?)',
          [parseInt(store_id), order_id || null, payment.idempotencyKey, Math.round(amount), 'Pending', device.serial]
        );
        tuuStartPolling(apiKey, payment.idempotencyKey, parseInt(store_id), order_id);
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
        console.log('[charge] body:', JSON.stringify({ store_id, amount, terminal_id, terminal_provider, device_uid }));
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        if (amount === undefined || amount === null || amount === '') return res.status(400).json({ error: 'amount requerido' });
        if (Number(amount) === 0) return res.status(400).json({ error: 'El monto no puede ser cero' });
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
        // Si el terminal es Square, lo maneja el bloque Square de abajo.
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
            let sqCfg = await squareGetConfig(sqUserId, parseInt(store_id));
            if (!sqCfg?.access_token) return res.status(400).json({ error: 'Square no configurado. Ve al admin > Vincular POS > Square.' });

            // Find device
            let sqDevice = null;
            if (terminal_id) {
              const [sqDevRows] = await pool.execute('SELECT * FROM square_devices WHERE id = ? AND user_id = ?', [parseInt(terminal_id), sqUserId]);
              sqDevice = sqDevRows[0] || null;
              // Fallback: try pos_terminals (new unified table)
              if (!sqDevice) {
                const posTerm = await getPosTerminalById(parseInt(terminal_id)).catch(() => null);
                if (posTerm && posTerm.provider === 'square') {
                  sqDevice = { device_id: posTerm.device_id, name: posTerm.name };
                  if (posTerm.api_key) sqCfg = { ...sqCfg, access_token: posTerm.api_key };
                }
              }
            }
            if (!sqDevice) {
              const [sqDevRows] = await pool.execute('SELECT * FROM square_devices WHERE user_id = ? AND store_id = ? ORDER BY created_at DESC LIMIT 1', [sqUserId, parseInt(store_id)]);
              sqDevice = sqDevRows[0] || null;
            }
            if (!sqDevice) return res.status(400).json({ error: 'No hay terminal Square vinculado. Ve al admin > Vincular POS > Square.' });

            // Strip device: prefix if present (legacy)
            const sqDeviceId = sqDevice.device_id.startsWith('device:') ? sqDevice.device_id.slice(7) : sqDevice.device_id;

            // Read store currency to convert amount correctly
            // Square always needs the smallest currency unit (cents for USD/EUR/etc, whole units for JPY/CLP/etc)
            const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'CLP', 'GNF', 'ISK', 'KMF', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'BIF']);
            const [cfgRows] = await pool.execute('SELECT currency_code FROM store_configurations WHERE store_id = ? LIMIT 1', [parseInt(store_id)]).catch(() => [[]]);
            const storeCurrency = cfgRows[0]?.currency_code || 'USD';
            const sqAmount = ZERO_DECIMAL_CURRENCIES.has(storeCurrency)
              ? Math.round(Number(amount))
              : Math.round(Number(amount) * 100);

            const sqPayload = {
              idempotency_key: 'sq_' + Date.now() + '_' + Math.random().toString(36).slice(2),
              checkout: {
                amount_money: { amount: sqAmount, currency: storeCurrency },
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
                  console.log('[charge-square] COMPLETED - store_id:', store_id, 'socketId:', socketId || 'NOT FOUND');
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
        if (!config?.api_key) {
          console.log('[charge] FAIL: no api_key for userId:', userId);
          return res.status(400).json({ error: 'API Key de Tuu no configurada. Ve al admin > Tuu POS > Configuración y guarda tu API Key.' });
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
                const cfg = await squareGetConfig(userId, storeId);
                if (cfg?.access_token) {
                  const pollRes = await fetch('https://connect.squareup.com/v2/terminals/checkouts/' + encodeURIComponent(key), {
                    headers: { 'Authorization': 'Bearer ' + cfg.access_token, 'Square-Version': '2026-01-22' }
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
            const cfg = await squareGetConfig(userId, sqRows[0].store_id);
            if (cfg?.access_token) {
              await fetch('https://connect.squareup.com/v2/terminals/checkouts/' + encodeURIComponent(key) + '/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.access_token, 'Square-Version': '2026-01-22' },
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
          user_id INT NOT NULL,
          store_id INT DEFAULT NULL,
          access_token TEXT NOT NULL,
          location_id VARCHAR(255) NOT NULL DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        // Migration: add store_id if missing
        try {
          await pool.execute('ALTER TABLE square_config ADD COLUMN store_id INT DEFAULT NULL');
          console.log('✅ Columna store_id agregada a square_config');
        } catch (e) { if (!e.message.includes('Duplicate column')) console.error('[Square] migration:', e.message); }
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

    // Helper: get Square config by store_id first, fallback to user global
    async function squareGetConfig(userId, storeId = null) {
      if (storeId) {
        const [rows] = await pool.execute('SELECT * FROM square_config WHERE store_id = ? LIMIT 1', [storeId]);
        if (rows[0]) return rows[0];
      }
      const [rows] = await pool.execute('SELECT * FROM square_config WHERE user_id = ? AND store_id IS NULL LIMIT 1', [userId]);
      return rows[0] || null;
    }

    // GET /api/square/config
    app.get('/api/square/config', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
        const cfg = await squareGetConfig(userId, storeId);
        res.json(cfg ? { access_token: cfg.access_token ? '***' : '', location_id: cfg.location_id, hasToken: !!cfg.access_token } : { access_token: '', location_id: '', hasToken: false });
      } catch (e) { res.status(401).json({ error: e.message }); }
    });

    // POST /api/square/config — save access_token + location_id
    app.post('/api/square/config', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const { access_token, location_id, store_id } = req.body;
        if (!access_token) return res.status(400).json({ error: 'access_token requerido' });
        const sid = store_id ? parseInt(store_id) : null;
        const [existing] = await pool.execute(
          sid ? 'SELECT id FROM square_config WHERE store_id = ? LIMIT 1' : 'SELECT id FROM square_config WHERE user_id = ? AND store_id IS NULL LIMIT 1',
          [sid || userId]
        );
        if (existing[0]) {
          await pool.execute('UPDATE square_config SET access_token=?, location_id=?, updated_at=NOW() WHERE id=?',
            [access_token, location_id || '', existing[0].id]);
        } else {
          await pool.execute('INSERT INTO square_config (user_id, store_id, access_token, location_id) VALUES (?,?,?,?)',
            [userId, sid, access_token, location_id || '']);
        }
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/square/locations — fetch locations from Square API
    app.get('/api/square/locations', async (req, res) => {
      try {
        const userId = await squareGetUserId(req);
        const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
        const cfg = await squareGetConfig(userId, storeId);
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
        const storeId = req.body.store_id ? parseInt(req.body.store_id) : null;
        const cfg = await squareGetConfig(userId, storeId);
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
        const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
        const cfg = await squareGetConfig(userId, storeId);
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
        const cfg = await squareGetConfig(userId, storeId || null);
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
          user_id INT NOT NULL,
          store_id INT DEFAULT NULL,
          account_id VARCHAR(255) NOT NULL,
          secret_key VARCHAR(500) NOT NULL,
          commerce_name VARCHAR(255) DEFAULT 'Mi Tienda',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        // Migration: add store_id if missing
        try {
          await pool.execute('ALTER TABLE haulmer_native_config ADD COLUMN store_id INT DEFAULT NULL');
          console.log('✅ Columna store_id agregada a haulmer_native_config');
        } catch (e) { if (!e.message.includes('Duplicate column')) console.error('[Haulmer] migration:', e.message); }
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
        const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
        let rows;
        if (storeId) {
          [rows] = await pool.execute('SELECT account_id, commerce_name FROM haulmer_native_config WHERE store_id = ? LIMIT 1', [storeId]);
          if (!rows[0]) [rows] = await pool.execute('SELECT account_id, commerce_name FROM haulmer_native_config WHERE user_id = ? AND store_id IS NULL LIMIT 1', [req.user.id]);
        } else {
          [rows] = await pool.execute('SELECT account_id, commerce_name FROM haulmer_native_config WHERE user_id = ? AND store_id IS NULL LIMIT 1', [req.user.id]);
        }
        res.json(rows[0] || {});
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /api/haulmer/config
    app.post('/api/haulmer/config', authenticateToken, async (req, res) => {
      try {
        const { account_id, secret_key, commerce_name, store_id } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id requerido' });
        const sid = store_id ? parseInt(store_id) : null;
        const [existing] = await pool.execute(
          sid ? 'SELECT id FROM haulmer_native_config WHERE store_id = ? LIMIT 1' : 'SELECT id FROM haulmer_native_config WHERE user_id = ? AND store_id IS NULL LIMIT 1',
          [sid || req.user.id]
        );
        if (existing[0]) {
          await pool.execute('UPDATE haulmer_native_config SET account_id=?, secret_key=?, commerce_name=?, updated_at=NOW() WHERE id=?',
            [account_id.trim(), (secret_key || '').trim(), (commerce_name || 'Mi Tienda').trim(), existing[0].id]);
        } else {
          await pool.execute('INSERT INTO haulmer_native_config (user_id, store_id, account_id, secret_key, commerce_name) VALUES (?,?,?,?,?)',
            [req.user.id, sid, account_id.trim(), (secret_key || '').trim(), (commerce_name || 'Mi Tienda').trim()]);
        }
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/haulmer/available?store_id=X
    app.get('/api/haulmer/available', async (req, res) => {
      try {
        const storeId = parseInt(req.query.store_id);
        const [storeRows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
        if (!storeRows[0]) return res.json({ available: false });
        let [rows] = await pool.execute('SELECT account_id, secret_key FROM haulmer_native_config WHERE store_id = ? LIMIT 1', [storeId]);
        if (!rows[0]) [rows] = await pool.execute('SELECT account_id, secret_key FROM haulmer_native_config WHERE user_id = ? AND store_id IS NULL LIMIT 1', [storeRows[0].user_id]);
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
        let [cfgRows] = await pool.execute('SELECT * FROM haulmer_native_config WHERE store_id = ? LIMIT 1', [store_id]);
        if (!cfgRows[0]) [cfgRows] = await pool.execute('SELECT * FROM haulmer_native_config WHERE user_id = ? AND store_id IS NULL LIMIT 1', [storeRows[0].user_id]);
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

    // ── Ratings ─────────────────────────────────────────────────────────────
    // Public: submit a rating for a store
    app.post('/api/public/:code/ratings', async (req, res) => {
      try {
        const store = await getStoreByCode(req.params.code);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
        const { rating, comment, order_id, source } = req.body;
        const r = parseInt(rating);
        if (isNaN(r) || r < 0 || r > 10) return res.status(400).json({ error: 'La calificación debe ser entre 0 y 10' });
        await pool.execute(
          'INSERT INTO store_ratings (store_id, order_id, rating, comment, source) VALUES (?, ?, ?, ?, ?)',
          [store.id, order_id || null, r, comment?.trim() || null, source || 'qr']
        );
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Admin: get ratings for selected store
    app.get('/api/ratings', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        // Verify ownership
        const [storeRows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!storeRows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [ratings] = await pool.execute(
          'SELECT * FROM store_ratings WHERE store_id = ? ORDER BY created_at DESC LIMIT 200',
          [store_id]
        );
        const [summary] = await pool.execute(
          'SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM store_ratings WHERE store_id = ?',
          [store_id]
        );
        res.json({ ratings, summary: summary[0] });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Rappi Integration ────────────────────────────────────────────────────

    // Admin: get Rappi config
    app.get('/api/rappi/config', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [cfg] = await pool.execute('SELECT * FROM rappi_config WHERE store_id = ?', [store_id]);
        res.json({ config: cfg[0] || null });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Admin: save Rappi config
    app.post('/api/rappi/config', authenticateToken, async (req, res) => {
      try {
        const { store_id, is_enabled, webhook_secret } = req.body;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [existing] = await pool.execute('SELECT id FROM rappi_config WHERE store_id = ?', [store_id]);
        if (existing.length) {
          await pool.execute(
            'UPDATE rappi_config SET is_enabled = ?, webhook_secret = ? WHERE store_id = ?',
            [is_enabled ? 1 : 0, webhook_secret || null, store_id]
          );
        } else {
          await pool.execute(
            'INSERT INTO rappi_config (store_id, is_enabled, webhook_secret) VALUES (?, ?, ?)',
            [store_id, is_enabled ? 1 : 0, webhook_secret || null]
          );
        }
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Admin: get recent Rappi orders
    app.get('/api/rappi/orders', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [orders] = await pool.execute(
          `SELECT id, order_number, rappi_order_id, customer_name, customer_phone,
                  external_items, total, status, payment_method, created_at
           FROM orders WHERE store_id = ? AND order_type = 'rappi'
           ORDER BY created_at DESC LIMIT 100`,
          [store_id]
        );
        res.json({ orders });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Public: Rappi webhook — receives orders from Rappi platform
    app.post('/api/rappi/webhook/:store_code', async (req, res) => {
      try {
        const store = await getStoreByCode(req.params.store_code);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

        // Check config
        const [cfgRows] = await pool.execute('SELECT * FROM rappi_config WHERE store_id = ?', [store.id]);
        const cfg = cfgRows[0];
        if (!cfg || !cfg.is_enabled) return res.status(403).json({ error: 'Integración Rappi no habilitada' });

        // Verify webhook secret if configured
        if (cfg.webhook_secret) {
          const sig = req.headers['x-rappi-signature'] || req.headers['x-webhook-token'] || req.headers['authorization'];
          if (!sig || !sig.includes(cfg.webhook_secret)) {
            return res.status(401).json({ error: 'Firma inválida' });
          }
        }

        const payload = req.body;

        // Flexible Rappi payload parsing — handles multiple format versions
        const rappiId = payload.id || payload.order_id || payload.orderId || String(Date.now());
        const rappiState = (payload.state || payload.status || '').toUpperCase();

        // Ignore cancellations and non-confirmed states
        if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(rappiState)) {
          return res.json({ success: true, ignored: true });
        }

        // Avoid duplicate orders
        const [existing] = await pool.execute('SELECT id FROM orders WHERE rappi_order_id = ? AND store_id = ?', [rappiId, store.id]);
        if (existing.length) return res.json({ success: true, duplicate: true });

        // Parse items — Rappi sends items in various structures
        let rawItems = [];
        const orderBody = payload.order || payload;
        if (Array.isArray(orderBody.items_with_price)) rawItems = orderBody.items_with_price;
        else if (Array.isArray(orderBody.items)) rawItems = orderBody.items;
        else if (Array.isArray(payload.items)) rawItems = payload.items;
        else if (Array.isArray(payload.products)) rawItems = payload.products;

        const externalItems = rawItems.map(i => ({
          name: i.name || i.product_name || i.sku || 'Producto',
          quantity: Number(i.quantity || i.qty || 1),
          unit_price: Number(i.price || i.unit_price || i.unitPrice || 0),
          notes: i.comment || i.note || '',
        }));

        // Parse total
        const total = Number(
          payload.total_value || payload.totalValue || payload.total ||
          orderBody.total || orderBody.total_value ||
          externalItems.reduce((s, i) => s + i.unit_price * i.quantity, 0) || 0
        );

        // Parse customer
        const client = payload.client || payload.customer || payload.user || {};
        const customerName = [client.name, client.first_name, client.firstName].filter(Boolean).join(' ') || 'Cliente Rappi';
        const customerPhone = client.phone || client.cellphone || '';

        // Parse payment
        const payMethod = (payload.payment_method || (payload.payment && payload.payment.type) || 'online').toLowerCase();
        const isCash = payMethod.includes('cash') || payMethod.includes('efectivo');

        // Get store order_number
        const orderNumber = await generateUniqueOrderNumber(store.id);

        const [result] = await pool.execute(
          `INSERT INTO orders (store_id, user_id, order_type, subtotal, discount_total, total, payment_method,
           cash_approved, payment_process, status, external_items, customer_name, customer_phone,
           rappi_order_id, order_number)
           VALUES (?, ?, 'rappi', ?, 0, ?, ?, ?, 1, 'preparing', ?, ?, ?, ?, ?)`,
          [
            store.id, store.user_id,
            total, total,
            isCash ? 'cash' : 'online',
            isCash ? 0 : 1,
            JSON.stringify(externalItems),
            customerName, customerPhone,
            rappiId, orderNumber
          ]
        );
        const orderId = result.insertId;

        const newOrder = {
          id: orderId,
          order_number: orderNumber,
          store_id: store.id,
          order_type: 'rappi',
          total,
          status: 'preparing',
          payment_method: isCash ? 'cash' : 'online',
          cash_approved: isCash ? 0 : 1,
          payment_process: 1,
          external_items: externalItems,
          customer_name: customerName,
          customer_phone: customerPhone,
          rappi_order_id: rappiId,
          items: externalItems,
          created_at: new Date().toISOString(),
        };

        // Notify worker panel via socket
        const socketId = userSockets.get(store.id);
        if (socketId) {
          io.to(socketId).emit('new_order', newOrder);
        }

        res.json({ success: true, order_id: orderId, order_number: orderNumber });
      } catch (e) {
        console.error('Rappi webhook error:', e);
        res.status(500).json({ error: e.message });
      }
    });

    // ── System Updates / Changelog ───────────────────────────────────────────
    const { CHANGELOGS } = await import('./changelogs.js');

    // Get updates + unread count for current user
    app.get('/api/updates', authenticateToken, async (req, res) => {
      try {
        const [rows] = await pool.execute('SELECT last_seen_update_id FROM users WHERE id = ?', [req.user.id]);
        const lastSeen = rows[0]?.last_seen_update_id || 0;
        const unread = CHANGELOGS.filter(u => u.id > lastSeen).length;
        res.json({ updates: CHANGELOGS, unread, last_seen_id: lastSeen });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Mark all updates as seen
    app.post('/api/updates/mark-seen', authenticateToken, async (req, res) => {
      try {
        const latest = CHANGELOGS[0]?.id || 0;
        await pool.execute('UPDATE users SET last_seen_update_id = ? WHERE id = ?', [latest, req.user.id]);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── UberEats Integration ─────────────────────────────────────────────────

    app.get('/api/ubereats/config', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [cfg] = await pool.execute('SELECT * FROM ubereats_config WHERE store_id = ?', [store_id]);
        res.json({ config: cfg[0] || null });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/ubereats/config', authenticateToken, async (req, res) => {
      try {
        const { store_id, is_enabled, webhook_secret } = req.body;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [existing] = await pool.execute('SELECT id FROM ubereats_config WHERE store_id = ?', [store_id]);
        if (existing.length) {
          await pool.execute('UPDATE ubereats_config SET is_enabled = ?, webhook_secret = ? WHERE store_id = ?',
            [is_enabled ? 1 : 0, webhook_secret || null, store_id]);
        } else {
          await pool.execute('INSERT INTO ubereats_config (store_id, is_enabled, webhook_secret) VALUES (?, ?, ?)',
            [store_id, is_enabled ? 1 : 0, webhook_secret || null]);
        }
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/ubereats/orders', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [orders] = await pool.execute(
          `SELECT id, order_number, ubereats_order_id, customer_name, customer_phone,
                  external_items, total, status, payment_method, created_at
           FROM orders WHERE store_id = ? AND order_type = 'ubereats'
           ORDER BY created_at DESC LIMIT 100`,
          [store_id]
        );
        res.json({ orders });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Public: UberEats webhook
    app.post('/api/ubereats/webhook/:store_code', async (req, res) => {
      try {
        const store = await getStoreByCode(req.params.store_code);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

        const [cfgRows] = await pool.execute('SELECT * FROM ubereats_config WHERE store_id = ?', [store.id]);
        const cfg = cfgRows[0];
        if (!cfg || !cfg.is_enabled) return res.status(403).json({ error: 'Integración UberEats no habilitada' });

        if (cfg.webhook_secret) {
          const sig = req.headers['x-uber-signature'] || req.headers['x-webhook-token'] || req.headers['authorization'] || '';
          if (!sig.includes(cfg.webhook_secret)) return res.status(401).json({ error: 'Firma inválida' });
        }

        const payload = req.body;

        // Ignore non-order or cancelled events
        const eventType = payload.event_type || payload.type || '';
        const status = (payload.status || payload.current_state || '').toLowerCase();
        if (status === 'cancelled' || status === 'unfulfilled' || eventType === 'orders.cancel') {
          return res.json({ success: true, ignored: true });
        }

        // UberEats order ID
        const ueId = String(payload.order_id || payload.id || payload.orderId || Date.now());

        // Avoid duplicates
        const [existing] = await pool.execute('SELECT id FROM orders WHERE ubereats_order_id = ? AND store_id = ?', [ueId, store.id]);
        if (existing.length) return res.json({ success: true, duplicate: true });

        // Parse items — UberEats uses cart.items[] with nested price objects
        const externalItems = [];
        const cartItems = payload.cart?.items || payload.items || payload.orderItems || [];
        for (const item of cartItems) {
          // UberEats price can be nested: price.unit_price.amount or flat unit_price
          const unitPrice = Number(
            item.price?.unit_price?.amount || item.price?.base_unit_price?.amount ||
            item.unit_price || item.price || 0
          );
          // Modifiers / selected options
          const modGroups = item.selected_modifier_groups || item.customizations || item.modifiers || [];
          const mods = modGroups
            .flatMap(g => (g.selected_items || g.options || []).map(o => o.title || o.name || ''))
            .filter(Boolean).join(', ');
          externalItems.push({
            name: item.title || item.name || item.productName || 'Producto',
            quantity: Number(item.quantity || item.qty || 1),
            unit_price: unitPrice,
            notes: [item.special_instructions, mods].filter(Boolean).join(' · '),
          });
        }

        // Total — UberEats uses total.price or total_price.amount
        const total = Number(
          payload.total?.price || payload.total?.amount ||
          payload.total_price?.amount || payload.totalAmount || payload.total ||
          externalItems.reduce((s, i) => s + i.unit_price * i.quantity, 0) || 0
        );

        // Customer — UberEats uses eater object
        const eater = payload.eater || payload.customer || payload.user || {};
        const customerName = [eater.first_name, eater.last_name, eater.name].filter(Boolean).join(' ') || 'Cliente UberEats';
        const customerPhone = eater.phone || eater.phone_number || '';

        // Payment — UberEats orders are almost always prepaid online
        const rawPay = (payload.payment_info?.status || payload.payment_method || 'online').toLowerCase();
        const isCash = rawPay.includes('cash') || rawPay.includes('efectivo');

        const orderNumber = await generateUniqueOrderNumber(store.id);

        const [result] = await pool.execute(
          `INSERT INTO orders (store_id, user_id, order_type, subtotal, discount_total, total, payment_method,
           cash_approved, payment_process, status, external_items, customer_name, customer_phone,
           ubereats_order_id, order_number)
           VALUES (?, ?, 'ubereats', ?, 0, ?, ?, ?, 1, 'preparing', ?, ?, ?, ?, ?)`,
          [
            store.id, store.user_id, total, total,
            isCash ? 'cash' : 'online', isCash ? 0 : 1,
            JSON.stringify(externalItems),
            customerName, customerPhone, ueId, orderNumber,
          ]
        );
        const orderId = result.insertId;

        const newOrder = {
          id: orderId, order_number: orderNumber, store_id: store.id,
          order_type: 'ubereats', total, status: 'preparing',
          payment_method: isCash ? 'cash' : 'online',
          cash_approved: isCash ? 0 : 1, payment_process: 1,
          external_items: externalItems, customer_name: customerName,
          customer_phone: customerPhone, ubereats_order_id: ueId,
          items: externalItems, created_at: new Date().toISOString(),
        };

        const socketId = userSockets.get(store.id);
        if (socketId) io.to(socketId).emit('new_order', newOrder);

        res.json({ success: true, order_id: orderId, order_number: orderNumber });
      } catch (e) {
        console.error('UberEats webhook error:', e);
        res.status(500).json({ error: e.message });
      }
    });

    // ── PedidosYa Integration ────────────────────────────────────────────────

    app.get('/api/pedidosya/config', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [cfg] = await pool.execute('SELECT * FROM pedidosya_config WHERE store_id = ?', [store_id]);
        res.json({ config: cfg[0] || null });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/pedidosya/config', authenticateToken, async (req, res) => {
      try {
        const { store_id, is_enabled, webhook_secret } = req.body;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [existing] = await pool.execute('SELECT id FROM pedidosya_config WHERE store_id = ?', [store_id]);
        if (existing.length) {
          await pool.execute(
            'UPDATE pedidosya_config SET is_enabled = ?, webhook_secret = ? WHERE store_id = ?',
            [is_enabled ? 1 : 0, webhook_secret || null, store_id]
          );
        } else {
          await pool.execute(
            'INSERT INTO pedidosya_config (store_id, is_enabled, webhook_secret) VALUES (?, ?, ?)',
            [store_id, is_enabled ? 1 : 0, webhook_secret || null]
          );
        }
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/pedidosya/orders', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [rows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [orders] = await pool.execute(
          `SELECT id, order_number, pedidosya_order_id, customer_name, customer_phone,
                  external_items, total, status, payment_method, created_at
           FROM orders WHERE store_id = ? AND order_type = 'pedidosya'
           ORDER BY created_at DESC LIMIT 100`,
          [store_id]
        );
        res.json({ orders });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Public: PedidosYa webhook
    app.post('/api/pedidosya/webhook/:store_code', async (req, res) => {
      try {
        const store = await getStoreByCode(req.params.store_code);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

        const [cfgRows] = await pool.execute('SELECT * FROM pedidosya_config WHERE store_id = ?', [store.id]);
        const cfg = cfgRows[0];
        if (!cfg || !cfg.is_enabled) return res.status(403).json({ error: 'Integración PedidosYa no habilitada' });

        if (cfg.webhook_secret) {
          const sig = req.headers['x-pedidosya-signature'] || req.headers['x-webhook-token'] || req.headers['authorization'] || '';
          if (!sig.includes(cfg.webhook_secret)) return res.status(401).json({ error: 'Firma inválida' });
        }

        const payload = req.body;

        // Ignore non-confirmed states
        const state = (payload.state || payload.status || payload.orderState || '').toUpperCase();
        if (['CANCELLED', 'REJECTED', 'EXPIRED', 'CLOSED_REJECTED'].includes(state)) {
          return res.json({ success: true, ignored: true });
        }

        // PedidosYa order ID
        const pyId = String(payload.orderId || payload.id || payload.order_id || Date.now());

        // Avoid duplicates
        const [existing] = await pool.execute('SELECT id FROM orders WHERE pedidosya_order_id = ? AND store_id = ?', [pyId, store.id]);
        if (existing.length) return res.json({ success: true, duplicate: true });

        // Parse items — PedidosYa groups items in sections[]
        const externalItems = [];
        const sections = payload.sections || payload.products || payload.items || [];
        if (Array.isArray(sections) && sections.length) {
          // PedidosYa format: sections[].items[]
          for (const section of sections) {
            const sectionItems = section.items || (section.integrationCode ? [section] : []);
            for (const item of sectionItems) {
              const options = (item.optionGroups || item.options || [])
                .flatMap(g => (g.options || [g]).map(o => o.name || ''))
                .filter(Boolean)
                .join(', ');
              externalItems.push({
                name: item.name || item.productName || item.integrationCode || 'Producto',
                quantity: Number(item.amount || item.quantity || item.qty || 1),
                unit_price: Number(item.price || item.unitPrice || item.unit_price || 0),
                notes: [item.comment, options].filter(Boolean).join(' · '),
              });
            }
          }
        } else if (Array.isArray(payload.orderItems)) {
          // Alternative flat format
          for (const item of payload.orderItems) {
            externalItems.push({
              name: item.name || item.productName || 'Producto',
              quantity: Number(item.quantity || item.amount || 1),
              unit_price: Number(item.price || item.unitPrice || 0),
              notes: item.comment || '',
            });
          }
        }

        // Parse total — PedidosYa uses totalAmount or totalValue
        const total = Number(
          payload.totalAmount || payload.totalValue || payload.total || payload.subTotal ||
          externalItems.reduce((s, i) => s + i.unit_price * i.quantity, 0) || 0
        );

        // Parse customer
        const user = payload.user || payload.customer || payload.client || {};
        const customerName = [user.name, user.firstName, user.lastName].filter(Boolean).join(' ') || 'Cliente PedidosYa';
        const customerPhone = user.phone || user.cellphone || '';

        // Payment
        const rawPay = (payload.paymentMethod || payload.payment_method || 'online').toString().toLowerCase();
        const isCash = rawPay.includes('cash') || rawPay.includes('efectivo') || rawPay.includes('money');

        const orderNumber = await generateUniqueOrderNumber(store.id);

        const [result] = await pool.execute(
          `INSERT INTO orders (store_id, user_id, order_type, subtotal, discount_total, total, payment_method,
           cash_approved, payment_process, status, external_items, customer_name, customer_phone,
           pedidosya_order_id, order_number)
           VALUES (?, ?, 'pedidosya', ?, 0, ?, ?, ?, 1, 'preparing', ?, ?, ?, ?, ?)`,
          [
            store.id, store.user_id,
            total, total,
            isCash ? 'cash' : 'online',
            isCash ? 0 : 1,
            JSON.stringify(externalItems),
            customerName, customerPhone,
            pyId, orderNumber,
          ]
        );
        const orderId = result.insertId;

        const newOrder = {
          id: orderId,
          order_number: orderNumber,
          store_id: store.id,
          order_type: 'pedidosya',
          total,
          status: 'preparing',
          payment_method: isCash ? 'cash' : 'online',
          cash_approved: isCash ? 0 : 1,
          payment_process: 1,
          external_items: externalItems,
          customer_name: customerName,
          customer_phone: customerPhone,
          pedidosya_order_id: pyId,
          items: externalItems,
          created_at: new Date().toISOString(),
        };

        const socketId = userSockets.get(store.id);
        if (socketId) io.to(socketId).emit('new_order', newOrder);

        res.json({ success: true, order_id: orderId, order_number: orderNumber });
      } catch (e) {
        console.error('PedidosYa webhook error:', e);
        res.status(500).json({ error: e.message });
      }
    });

    const DEFAULT_SURVEY_QUESTIONS = [
      { key: 'frequency',       text: '¿Con qué frecuencia nos visitas?',          options: ['Primera vez', 'A veces', 'Seguido', 'Siempre'] },
      { key: 'how_found',       text: '¿Cómo nos conociste?',                       options: ['Redes sociales', 'Recomendación', 'Google', 'Pasando por aquí'] },
      { key: 'age_range',       text: '¿Cuál es tu rango de edad?',                 options: ['Menos de 25', '25–35', '36–50', 'Más de 50'] },
      { key: 'product_quality', text: '¿Cómo calificarías la calidad del producto?', options: ['Excelente', 'Buena', 'Regular', 'Mala'] },
      { key: 'disliked',        text: '¿Qué no te gustó de tu visita?',             options: ['El producto', 'La atención', 'El tiempo de espera', 'El precio'] },
      { key: 'wait_time',       text: '¿Cómo fue el tiempo de espera?',             options: ['Muy rápido', 'Aceptable', 'Un poco largo', 'Demasiado largo'] },
      { key: 'staff',           text: '¿Cómo fue la atención del personal?',        options: ['Excelente', 'Buena', 'Regular', 'Mala'] },
      { key: 'price_fair',      text: '¿El precio te parece justo?',                options: ['Muy justo', 'Justo', 'Un poco caro', 'Caro'] },
      { key: 'return',          text: '¿Volverías a visitarnos?',                   options: ['Sí, seguro', 'Probablemente', 'Tal vez', 'No'] },
      { key: 'recommend',       text: '¿Recomendarías este lugar a alguien?',       options: ['Sí, definitivamente', 'Probablemente', 'Tal vez', 'No'] },
    ];

    // Public: get survey questions (custom or defaults)
    app.get('/api/public/:code/survey-questions', async (req, res) => {
      try {
        const store = await getStoreByCode(req.params.code);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
        const [rows] = await pool.execute('SELECT survey_questions FROM stores WHERE id = ?', [store.id]);
        const custom = rows[0]?.survey_questions;
        const questions = custom ? (typeof custom === 'string' ? JSON.parse(custom) : custom) : DEFAULT_SURVEY_QUESTIONS;
        res.json({ questions, is_custom: !!custom });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Admin: get survey config
    app.get('/api/survey-config', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [storeRows] = await pool.execute('SELECT id, survey_questions FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!storeRows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const custom = storeRows[0].survey_questions;
        const questions = custom ? (typeof custom === 'string' ? JSON.parse(custom) : custom) : null;
        res.json({ questions, defaults: DEFAULT_SURVEY_QUESTIONS });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Admin: save survey config
    app.put('/api/survey-config', authenticateToken, async (req, res) => {
      try {
        const { store_id, questions } = req.body;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [storeRows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!storeRows.length) return res.status(403).json({ error: 'Acceso denegado' });
        // null = reset to defaults
        const value = questions === null ? null : JSON.stringify(questions);
        await pool.execute('UPDATE stores SET survey_questions = ? WHERE id = ?', [value, store_id]);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Public: submit client survey
    app.post('/api/public/:code/client-survey', async (req, res) => {
      try {
        const store = await getStoreByCode(req.params.code);
        if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
        const { answers } = req.body;
        if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'Respuestas inválidas' });
        await pool.execute(
          'INSERT INTO client_surveys (store_id, answers) VALUES (?, ?)',
          [store.id, JSON.stringify(answers)]
        );
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Admin: get client surveys for selected store
    app.get('/api/client-surveys', authenticateToken, async (req, res) => {
      try {
        const { store_id } = req.query;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [storeRows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!storeRows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const [surveys] = await pool.execute(
          'SELECT * FROM client_surveys WHERE store_id = ? ORDER BY created_at DESC LIMIT 500',
          [store_id]
        );
        res.json({ surveys });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Background Removal ───────────────────────────────────────────────────
    const VENV_DIR  = path.join(__serverDir, 'BGRemover', 'venv');
    const VENV_PY   = path.join(VENV_DIR, 'bin', 'python3');
    const VENV_PIP  = path.join(VENV_DIR, 'bin', 'pip');
    let _bgReady = false; // true once venv+rembg confirmed

    const runCmd = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout: 60000, ...opts }, (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stdout, stderr }));
        else resolve({ stdout, stderr });
      });
    });

    // Find a system python3 to bootstrap the venv
    async function findSystemPython() {
      for (const cmd of ['python3', 'python3.12', 'python3.11', 'python3.10', 'python3.9', 'python']) {
        try { await runCmd(cmd, ['--version']); return cmd; } catch {}
      }
      return null;
    }

    async function ensureBgEnv() {
      if (_bgReady) return true;
      try {
        // 1 — If venv already exists and rembg importable, we're done
        if (fs.existsSync(VENV_PY)) {
          try {
            await runCmd(VENV_PY, ['-c', 'import rembg']);
            _bgReady = true;
            console.log('[bg_remover] Entorno listo (venv existente)');
            return true;
          } catch {}
        }

        // 2 — Create venv if needed
        if (!fs.existsSync(VENV_DIR)) {
          const sysPy = await findSystemPython();
          if (!sysPy) throw new Error('Python3 no encontrado en el sistema');
          console.log(`[bg_remover] Creando venv con ${sysPy}...`);
          await runCmd(sysPy, ['-m', 'venv', VENV_DIR], { timeout: 60000 });
          console.log('[bg_remover] Venv creado');
        }

        // 3 — Install rembg[cpu] inside the venv
        console.log('[bg_remover] Instalando rembg[cpu] en el venv...');
        await runCmd(VENV_PIP, [
          'install', 'rembg[cpu]', 'pillow', 'onnxruntime',
          '--quiet', '--no-warn-script-location'
        ], { timeout: 600000 }); // 10 min max

        // 4 — Verify
        await runCmd(VENV_PY, ['-c', 'import rembg']);
        _bgReady = true;
        console.log('[bg_remover] rembg[cpu] instalado correctamente en venv');
        return true;
      } catch (e) {
        console.error('[bg_remover] Error preparando entorno:', e.message || e.stderr || e);
        return false;
      }
    }

    // Start setup in background so first request isn't cold
    ensureBgEnv().catch(() => {});

    app.post('/api/remove-background', upload.single('image'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

        const ready = await ensureBgEnv();
        if (!ready) return res.status(500).json({ error: 'El entorno de remoción de fondo no está disponible' });

        const inputPath  = path.resolve(req.file.path);
        const outputFilename = req.file.filename.replace(/\.[^.]+$/, '') + '_sin_fondo.png';
        const outputPath = path.resolve('uploads', outputFilename);
        const scriptPath = path.join(__serverDir, 'BGRemover', 'bg_remover.py');

        const childEnv = {
          ...process.env,
          ONNXRUNTIME_EXECUTION_PROVIDERS: 'CPUExecutionProvider',
          ORT_LOGGING_LEVEL_FATAL: '3',
          U2NET_HOME: path.join(__serverDir, 'BGRemover', 'models'),
        };

        await runCmd(VENV_PY, [scriptPath, inputPath, outputPath], {
          env: childEnv,
          timeout: 120000,
        });

        res.json({ url: `/uploads/${outputFilename}` });
      } catch (e) {
        console.error('[remove-background]', e.message);
        res.status(500).json({ error: 'Error al remover el fondo' });
      }
    });

    // ─── Instagram Auto-Post ────────────────────────────────────────────────

    app.get('/api/instagram/:storeId', authenticateToken, async (req, res) => {
      try {
        const store = await getStoreById(req.params.storeId);
        if (!store || store.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
        const cfg = await getInstagramConfig(req.params.storeId);
        const safe = cfg ? { ...cfg, ig_password: cfg.ig_password ? '••••••' : '' } : { ig_username: '', ig_password: '', caption_template: '', enabled: false, last_posted_at: null, last_error: null, template_counter: 0 };
        res.json(safe);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/instagram/:storeId', authenticateToken, async (req, res) => {
      try {
        const store = await getStoreById(req.params.storeId);
        if (!store || store.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
        const { ig_username, ig_password, caption_template, enabled } = req.body;
        const existing = await getInstagramConfig(req.params.storeId);
        const finalPass = ig_password === '••••••' ? (existing?.ig_password || '') : ig_password;
        await saveInstagramConfig(req.params.storeId, { ig_username, ig_password: finalPass, caption_template, enabled });
        res.json({ ok: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/instagram/:storeId/preview', authenticateToken, async (req, res) => {
      try {
        const store = await getStoreById(req.params.storeId);
        if (!store || store.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
        const cfg = await getInstagramConfig(req.params.storeId);
        const [topProds] = await pool.execute(
          `SELECT p.id,p.name,p.description,p.price,p.image,COUNT(oi.id) AS sales
           FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id
           WHERE p.store_id=? GROUP BY p.id ORDER BY sales DESC LIMIT 5`,
          [req.params.storeId]
        );
        const [coupons] = await pool.execute(
          'SELECT * FROM coupons WHERE store_id=? AND is_active=TRUE ORDER BY discount_value DESC LIMIT 3',
          [req.params.storeId]
        );
        const tplOverride = req.query.tpl !== undefined ? parseInt(req.query.tpl) : null;
        const tplCounter  = tplOverride !== null ? tplOverride : (cfg?.template_counter || 0);
        const buf = await generatePromoImage({ store, topProducts: topProds, coupons, templateCounter: tplCounter, currencySymbol: store.currency_symbol || '$' });
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(buf);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/instagram/:storeId/post-now', authenticateToken, async (req, res) => {
      try {
        const store = await getStoreById(req.params.storeId);
        if (!store || store.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
        const cfg = await getInstagramConfig(req.params.storeId);
        if (!cfg?.ig_username || !cfg?.ig_password) return res.status(400).json({ error: 'Configura usuario y contraseña primero' });
        const [topProds] = await pool.execute(
          `SELECT p.id,p.name,p.description,p.price,p.image,COUNT(oi.id) AS sales
           FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id
           WHERE p.store_id=? GROUP BY p.id ORDER BY sales DESC LIMIT 5`,
          [req.params.storeId]
        );
        const [coupons] = await pool.execute(
          'SELECT * FROM coupons WHERE store_id=? AND is_active=TRUE ORDER BY discount_value DESC LIMIT 3',
          [req.params.storeId]
        );
        const buf = await generatePromoImage({ store, topProducts: topProds, coupons, templateCounter: cfg.template_counter || 0, currencySymbol: store.currency_symbol || '$' });
        const caption = cfg.caption_template || `✨ ${store.name} ✨\n\n🔥 Mirá nuestras ofertas y los más pedidos de la semana.\n\n📲 Pedí en: ${BASE_URL}/store/${store.code}\n\n#${store.name.replace(/\s+/g,'')} #SRServi`;
        await postToInstagram({ username: cfg.ig_username, password: cfg.ig_password, imageBuffer: buf, caption });
        await updateInstagramPosted(req.params.storeId, null);
        res.json({ ok: true });
      } catch (e) {
        await updateInstagramPosted(req.params.storeId, e.message).catch(() => {});
        res.status(500).json({ error: e.message });
      }
    });

    // ============================================================
    // CAJA (CASH REGISTER) ENDPOINTS
    // ============================================================

    // Admin: open cash register for selected store
    app.post('/api/admin/cash-register/open', authenticateToken, async (req, res) => {
      try {
        if (req.user.type === 'worker') return res.status(403).json({ error: 'Usar /api/cash-register/open para trabajadores' });
        const { store_id } = req.body;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [storeRows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!storeRows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const register = await openCashRegister(store_id, 0, 'Administrador');
        io.to(`store_${store_id}`).emit('cash_register_changed', { open: true, register });
        res.json(register);
      } catch (err) { res.status(400).json({ error: err.message }); }
    });

    // Admin: close cash register for selected store
    app.post('/api/admin/cash-register/close', authenticateToken, async (req, res) => {
      try {
        if (req.user.type === 'worker') return res.status(403).json({ error: 'Usar /api/cash-register/close para trabajadores' });
        const { store_id } = req.body;
        if (!store_id) return res.status(400).json({ error: 'store_id requerido' });
        const [storeRows] = await pool.execute('SELECT id FROM stores WHERE id = ? AND user_id = ?', [store_id, req.user.id]);
        if (!storeRows.length) return res.status(403).json({ error: 'Acceso denegado' });
        const open = await getOpenCashRegister(store_id);
        if (!open) return res.status(400).json({ error: 'No hay caja abierta' });
        await closeCashRegister(store_id, 'admin');
        io.to(`store_${store_id}`).emit('cash_register_changed', { open: false });
        await sendCashRegisterReport(store_id, 'admin');
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/cash-register/open', authenticateToken, async (req, res) => {
      try {
        if (req.user.type !== 'worker') return res.status(403).json({ error: 'Solo trabajadores pueden abrir la caja' });
        const storeId = req.user.store_id;
        const [workerRows] = await pool.execute('SELECT * FROM workers WHERE id = ?', [req.user.id]);
        const worker = workerRows[0];
        if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });
        const register = await openCashRegister(storeId, worker.id, worker.name || worker.username);
        io.to(`store_${storeId}`).emit('cash_register_changed', { open: true, register });
        res.json(register);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post('/api/cash-register/close', authenticateToken, async (req, res) => {
      try {
        if (req.user.type !== 'worker') return res.status(403).json({ error: 'Solo trabajadores pueden cerrar la caja' });
        const storeId = req.user.store_id;
        const open = await getOpenCashRegister(storeId);
        if (!open) return res.status(400).json({ error: 'No hay caja abierta' });
        await closeCashRegister(storeId, 'manual');
        io.to(`store_${storeId}`).emit('cash_register_changed', { open: false });
        await sendCashRegisterReport(storeId, 'manual');
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/cash-register/status/:storeId', async (req, res) => {
      try {
        const open = await getOpenCashRegister(req.params.storeId);
        res.json({ open: !!open, register: open || null });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Cron cada día a medianoche — cerrar cajas abiertas y enviar email
    cron.schedule('0 0 * * *', async () => {
      console.log('[Caja] Cierre automático de cajas...');
      try {
        const openRegisters = await getAllOpenCashRegisters();
        for (const reg of openRegisters) {
          try {
            await closeCashRegister(reg.store_id, 'auto');
            io.to(`store_${reg.store_id}`).emit('cash_register_changed', { open: false });
            await sendCashRegisterReport(reg.store_id, 'auto');
            console.log(`[Caja] ✅ Cerrada caja tienda ${reg.store_name}`);
          } catch (e) {
            console.error(`[Caja] ❌ Error tienda ${reg.store_name}:`, e.message);
          }
        }
      } catch (e) { console.error('[Caja] Cron error:', e.message); }
    });

    // Cron cada domingo a las 10:00
    cron.schedule('0 10 * * 0', async () => {
      console.log('[Instagram] Publicaciones automáticas semanales...');
      try {
        const configs = await getActiveInstagramConfigs();
        for (const cfg of configs) {
          try {
            const [topProds] = await pool.execute(
              `SELECT p.id,p.name,p.description,p.price,p.image,COUNT(oi.id) AS sales
               FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id
               WHERE p.store_id=? GROUP BY p.id ORDER BY sales DESC LIMIT 5`,
              [cfg.store_id]
            );
            const [coupons] = await pool.execute(
              'SELECT * FROM coupons WHERE store_id=? AND is_active=TRUE ORDER BY discount_value DESC LIMIT 3',
              [cfg.store_id]
            );
            const buf = await generatePromoImage({ store: cfg, topProducts: topProds, coupons, templateCounter: cfg.template_counter || 0, currencySymbol: cfg.currency_symbol || '$' });
            const caption = cfg.caption_template || `✨ ${cfg.store_name} ✨\n\n🔥 Lo mejor de la semana!\n\n📲 ${BASE_URL}/store/${cfg.store_code}\n\n#${(cfg.store_name||'').replace(/\s+/g,'')} #SRServi`;
            await postToInstagram({ username: cfg.ig_username, password: cfg.ig_password, imageBuffer: buf, caption });
            await updateInstagramPosted(cfg.store_id, null);
            console.log(`[Instagram] ✅ ${cfg.store_name}`);
          } catch (e) {
            await updateInstagramPosted(cfg.store_id, e.message).catch(() => {});
            console.error(`[Instagram] ❌ ${cfg.store_name}:`, e.message);
          }
        }
      } catch (e) { console.error('[Instagram] Cron error:', e.message); }
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