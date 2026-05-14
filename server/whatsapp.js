import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

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

const AUTH_DIR = path.join(__dirname, 'whatsapp_auth');

let sock = null;
let currentQR = null;
let isConnected = false;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

const silentLogger = {
  level: 'silent',
  trace: () => {}, debug: () => {}, info: () => {},
  warn: () => {}, error: () => {}, fatal: () => {},
  child: () => silentLogger
};

export async function initWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: ['SRServi', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 500,
    logger: silentLogger
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = await QRCode.toDataURL(qr);
      isConnected = false;
      console.log('[WhatsApp] QR code ready — scan with your phone');
    }

    if (connection === 'open') {
      isConnected = true;
      isConnecting = false;
      currentQR = null;
      reconnectAttempts = 0;
      console.log('[WhatsApp] Connected successfully');
    }

    if (connection === 'close') {
      isConnected = false;
      isConnecting = false;
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log('[WhatsApp] Logged out — clearing session');
        if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        currentQR = null;
        reconnectAttempts = 0;
        setTimeout(initWhatsApp, 2000);
      } else if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        const delay = Math.min(reconnectAttempts * 5000, 30000);
        console.log(`[WhatsApp] Disconnected (${reason}), reconnecting in ${delay / 1000}s`);
        setTimeout(initWhatsApp, delay);
      } else {
        console.log('[WhatsApp] Max reconnect attempts reached');
      }
    }
  });
}

export function getWhatsAppStatus() {
  return {
    connected: isConnected,
    connecting: isConnecting && !currentQR,
    hasQR: !!currentQR,
    qr: currentQR
  };
}

export async function sendWhatsAppMessage(to, message) {
  if (!isConnected || !sock) {
    throw new Error('WhatsApp no conectado');
  }

  const number = to.replace(/[^0-9]/g, '');
  const jid = `${number}@s.whatsapp.net`;

  await sock.sendMessage(jid, { text: message });
  console.log(`[WhatsApp] Sent to ${number}`);
  return true;
}

export async function disconnectWhatsApp() {
  reconnectAttempts = MAX_RECONNECT; // prevent auto-reconnect
  if (sock) {
    await sock.logout().catch(() => {});
    sock = null;
  }
  isConnected = false;
  isConnecting = false;
  currentQR = null;
  if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  console.log('[WhatsApp] Disconnected and session cleared');
}
