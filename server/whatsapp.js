import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { handleBotMessage } from './whatsapp-bot.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');

const AUTH_BASE = path.join(__dirname, 'whatsapp_auth');
const MAX_RECONNECT = 5;
const BOT_CONFIG_FILE = path.join(__dirname, 'whatsapp_auth', 'bot_config.json');

function loadBotConfig() {
  try {
    if (fs.existsSync(BOT_CONFIG_FILE)) return JSON.parse(fs.readFileSync(BOT_CONFIG_FILE, 'utf8'));
  } catch {}
  return {};
}
function saveBotConfig(cfg) {
  fs.mkdirSync(AUTH_BASE, { recursive: true });
  fs.writeFileSync(BOT_CONFIG_FILE, JSON.stringify(cfg), 'utf8');
}
let botConfig = loadBotConfig();

export function setBotEnabled(storeId, enabled) {
  botConfig[String(storeId)] = !!enabled;
  saveBotConfig(botConfig);
}
export function getBotEnabled(storeId) {
  return !!botConfig[String(storeId)];
}
export function getBotPhone(storeId) {
  const conn = getConn(storeId);
  if (!conn.isConnected || !conn.sock?.user?.id) return null;
  return conn.sock.user.id.split(':')[0].split('@')[0];
}

const silentLogger = {
  level: 'silent',
  trace: () => {}, debug: () => {}, info: () => {},
  warn: () => {}, error: () => {}, fatal: () => {},
  child: () => silentLogger
};

// Map<storeId, ConnectionState>
const connections = new Map();

function getConn(storeId) {
  const key = String(storeId);
  if (!connections.has(key)) {
    connections.set(key, {
      sock: null,
      currentQR: null,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      ignoreClose: false,   // set before closing intentionally to skip auto-reconnect
    });
  }
  return connections.get(key);
}

export async function initWhatsApp(storeId) {
  const conn = getConn(storeId);
  if (conn.isConnecting) return;
  conn.isConnecting = true;

  const authDir = path.join(AUTH_BASE, `store_${storeId}`);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['SRServi', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 500,
    logger: silentLogger
  });

  conn.sock = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !getBotEnabled(storeId)) return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid?.endsWith('@g.us')) continue; // skip group messages
      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || '';
      if (!text) continue;
      try {
        await handleBotMessage(storeId, msg.key.remoteJid, text, sock);
      } catch (err) {
        console.error(`[Bot:${storeId}] Error:`, err.message);
      }
    }
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      conn.currentQR = await QRCode.toDataURL(qr);
      conn.isConnected = false;
      console.log(`[WhatsApp:${storeId}] QR listo`);
    }

    if (connection === 'open') {
      conn.isConnected = true;
      conn.isConnecting = false;
      conn.currentQR = null;
      conn.reconnectAttempts = 0;
      console.log(`[WhatsApp:${storeId}] Conectado`);
    }

    if (connection === 'close') {
      conn.isConnected = false;
      conn.isConnecting = false;

      // Si el cierre fue iniciado intencionalmente (reconnect manual), ignorar
      if (conn.ignoreClose) {
        conn.ignoreClose = false;
        console.log(`[WhatsApp:${storeId}] Cierre intencional — omitiendo auto-reconexión`);
        return;
      }

      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log(`[WhatsApp:${storeId}] Sesión cerrada — limpiando`);
        if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
        conn.currentQR = null;
        conn.reconnectAttempts = 0;
        setTimeout(() => initWhatsApp(storeId), 2000);
      } else if (conn.reconnectAttempts < MAX_RECONNECT) {
        conn.reconnectAttempts++;
        const delay = Math.min(conn.reconnectAttempts * 5000, 30000);
        console.log(`[WhatsApp:${storeId}] Desconectado (${reason}), reintentando en ${delay / 1000}s`);
        setTimeout(() => initWhatsApp(storeId), delay);
      } else {
        console.log(`[WhatsApp:${storeId}] Máximo de reintentos alcanzado`);
      }
    }
  });
}

export function getWhatsAppStatus(storeId) {
  const conn = getConn(storeId);
  return {
    connected: conn.isConnected,
    connecting: conn.isConnecting && !conn.currentQR,
    hasQR: !!conn.currentQR,
    qr: conn.currentQR
  };
}

export async function sendWhatsAppMessage(storeId, to, message) {
  const conn = getConn(storeId);
  if (!conn.isConnected || !conn.sock) throw new Error('WhatsApp no conectado');
  // Si ya es un JID completo (grupo @g.us o individual @s.whatsapp.net), usarlo directo
  const jid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  await conn.sock.sendMessage(jid, { text: message });
  console.log(`[WhatsApp:${storeId}] Enviado a ${jid}`);
  return true;
}

export async function getWhatsAppGroups(storeId) {
  const conn = getConn(storeId);
  if (!conn.isConnected || !conn.sock) throw new Error('WhatsApp no conectado');
  const groups = await conn.sock.groupFetchAllParticipating();
  return Object.values(groups).map(g => ({
    jid: g.id,
    name: g.subject,
    participants: g.participants?.length || 0,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function disconnectWhatsApp(storeId) {
  const conn = getConn(storeId);
  conn.ignoreClose = true;
  if (conn.sock) {
    await conn.sock.logout().catch(() => {});
    conn.sock = null;
  }
  conn.isConnected = false;
  conn.isConnecting = false;
  conn.currentQR = null;
  conn.reconnectAttempts = 0;
  const authDir = path.join(AUTH_BASE, `store_${storeId}`);
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
  console.log(`[WhatsApp:${storeId}] Desconectado y sesión eliminada`);
}

// Genera un QR nuevo sin borrar la sesión guardada
export async function reconnectWhatsApp(storeId) {
  const conn = getConn(storeId);

  // Marcar ANTES de cerrar para que el evento 'close' no programe otro reconect
  conn.ignoreClose = true;

  if (conn.sock) {
    conn.sock.end().catch(() => {});
    conn.sock = null;
  }
  conn.isConnected = false;
  conn.isConnecting = false;
  conn.currentQR = null;
  conn.reconnectAttempts = 0;

  // Pequeña pausa para que el evento 'close' se procese antes de iniciar nuevo socket
  await new Promise(r => setTimeout(r, 300));

  console.log(`[WhatsApp:${storeId}] Generando nuevo QR`);
  await initWhatsApp(storeId);
}

// Returns list of store IDs that have saved auth sessions
export function getAutoStartStoreIds() {
  if (!fs.existsSync(AUTH_BASE)) return [];
  return fs.readdirSync(AUTH_BASE)
    .filter(d => /^store_\d+$/.test(d))
    .map(d => parseInt(d.replace('store_', '')))
    .filter(id => !isNaN(id));
}
