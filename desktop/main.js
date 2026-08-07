// SRServi POS — App de escritorio (Electron) offline
// Orquesta el ciclo de vida: 1) MariaDB embebida  2) servidor Express local
// 3) ventana que carga la SPA. Todos los datos escribibles (BD, uploads) viven
// en app.getPath('userData'); el código y binarios van en recursos read-only.

const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require('electron');
const { spawn, fork, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');

const REMOTE_HOST = process.env.SRSERVI_REMOTE || 'https://srservi2.srautomatic.com';

// ─────────────────────────── Configuración ────────────────────────────────
const SERVER_PORT = process.env.SRSERVI_PORT || '8888';
const DB_PORT = process.env.SRSERVI_DB_PORT || '3307';
const DB_NAME = 'srservi';
const DB_USER = 'root';
const DB_PASSWORD = ''; // MariaDB portable arranca con root sin contraseña
// Permite en desarrollo apuntar a un MySQL/MariaDB ya instalado y saltar el
// arranque de la BD embebida:  SRSERVI_DB_EXTERNAL=1
const DB_EXTERNAL = process.env.SRSERVI_DB_EXTERNAL === '1';

const isPackaged = app.isPackaged;
// Raíz de recursos: en producción es process.resourcesPath (extraResources);
// en desarrollo es la raíz del repo (un nivel arriba de desktop/).
const RES = isPackaged ? process.resourcesPath : path.join(__dirname, '..');

const SERVER_ENTRY = path.join(RES, 'server', 'index.js');
const CLIENT_DIST = path.join(RES, 'client', 'dist');
const MARIADB_DIR = isPackaged
  ? path.join(RES, 'mariadb')
  : path.join(__dirname, 'resources', 'mariadb');

const DATA_DIR = app.getPath('userData');
const DB_DATA = path.join(DATA_DIR, 'db-data');
const UPLOADS = path.join(DATA_DIR, 'uploads');

let mariadbProc = null;
let serverProc = null;
let mainWindow = null;

function log(...a) { console.log('[SRServi]', ...a); }
function bin(name) { return path.join(MARIADB_DIR, 'bin', process.platform === 'win32' ? name + '.exe' : name); }

// ─────────────────────────── Utilidades ───────────────────────────────────
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function waitPort(port, host, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      const sock = net.connect(port, host);
      sock.on('connect', () => { sock.destroy(); resolve(); });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() > deadline) reject(new Error(`Timeout esperando ${host}:${port}`));
        else setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function waitHttp(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() > deadline) reject(new Error(`Timeout esperando ${url}`));
      else setTimeout(tryOnce, 400);
    };
    tryOnce();
  });
}

function fatal(title, err) {
  console.error(title, err);
  dialog.showErrorBox(title, String(err && err.stack ? err.stack : err));
  app.quit();
}

// ─────────────────────────── MariaDB embebida ─────────────────────────────
function findInstaller() {
  // Distintos builds usan mariadb-install-db o mysql_install_db
  for (const n of ['mariadb-install-db', 'mysql_install_db']) {
    const p = bin(n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function initMariaDbDataDir() {
  ensureDir(DB_DATA);
  // Si ya está inicializado (existe carpeta mysql/) no hacemos nada.
  if (fs.existsSync(path.join(DB_DATA, 'mysql'))) return;
  log('Inicializando base de datos por primera vez…');
  const installer = findInstaller();
  if (!installer) throw new Error('No se encontró el instalador de MariaDB (mariadb-install-db).');
  // El instalador de Windows (mysql_install_db.exe) usa flags propios; root
  // queda sin contraseña (--default-user crea el usuario root@localhost).
  const args = ['--datadir=' + DB_DATA, '--default-user', '--silent'];
  const r = spawnSync(installer, args, { cwd: MARIADB_DIR });
  if (r.status !== 0) {
    throw new Error('mariadb-install-db falló: ' + (r.stderr ? r.stderr.toString() : r.status));
  }
}

async function startMariaDb() {
  const mysqld = bin('mysqld');
  if (!fs.existsSync(mysqld)) throw new Error('No se encontró mysqld en ' + mysqld);
  await initMariaDbDataDir();
  log('Arrancando MariaDB en el puerto', DB_PORT);
  mariadbProc = spawn(mysqld, [
    '--no-defaults',
    '--datadir=' + DB_DATA,
    '--port=' + DB_PORT,
    '--bind-address=127.0.0.1',
    '--skip-name-resolve',
  ], { cwd: MARIADB_DIR });
  mariadbProc.stdout.on('data', d => process.stdout.write('[mariadb] ' + d));
  mariadbProc.stderr.on('data', d => process.stdout.write('[mariadb] ' + d));
  mariadbProc.on('exit', (code) => log('MariaDB terminó con código', code));

  await waitPort(parseInt(DB_PORT), '127.0.0.1', 40000);
  // Asegurar que existe la base srservi (el esquema lo crea database.js).
  const mysql = bin('mysql');
  const r = spawnSync(mysql, [
    '-u', DB_USER, '--protocol=tcp', '--port=' + DB_PORT,
    '-e', `CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  ], { cwd: MARIADB_DIR });
  if (r.status !== 0) throw new Error('No se pudo crear la base ' + DB_NAME + ': ' + (r.stderr ? r.stderr.toString() : r.status));
  log('MariaDB lista, base', DB_NAME, 'disponible');
}

// ─────────────────────────── Servidor Express ─────────────────────────────
function startServer() {
  ensureDir(UPLOADS);
  log('Arrancando servidor Express local…');
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    OFFLINE: '1',
    SERVER_PORT,
    SERVER_HOST: '127.0.0.1',
    CLIENT_DIST,
    DB_HOST: '127.0.0.1',
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
  };
  serverProc = fork(SERVER_ENTRY, [], {
    cwd: DATA_DIR, // uploads/ (relativo) y estáticos escribibles caen aquí
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let lastLog = '';
  const onOut = d => { lastLog = String(d).slice(-500); process.stdout.write('[server] ' + d); };
  serverProc.stdout.on('data', onOut);
  serverProc.stderr.on('data', onOut);
  // El primer arranque construye todo el esquema de la BD (puede tardar 1-2 min).
  // Si el proceso del servidor muere antes de responder, fallamos rápido con su
  // último log en vez de esperar los 3 min del timeout.
  const health = waitHttp(`http://127.0.0.1:${SERVER_PORT}/api/health`, 180000);
  const earlyExit = new Promise((_, rej) => {
    serverProc.on('exit', (code) => {
      log('Servidor terminó con código', code);
      rej(new Error(`El servidor local se cerró (código ${code}).\n\n${lastLog}`));
    });
  });
  return Promise.race([health, earlyExit]);
}

// ─────────────────────────── Ventana ──────────────────────────────────────
const LOADING_HTML = 'data:text/html;charset=utf-8,' + encodeURIComponent(`
<!doctype html><html><head><meta charset="utf-8"><title>SRServi POS</title>
<style>html,body{margin:0;height:100%;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:22px}
.s{width:54px;height:54px;border:5px solid #333;border-top-color:#D4AF37;border-radius:50%;animation:r 1s linear infinite}
@keyframes r{to{transform:rotate(360deg)}} .t{font-size:15px;color:#aaa} .b{font-size:22px;font-weight:800;color:#D4AF37}</style>
</head><body><div class="b">SRServi POS</div><div class="s"></div>
<div class="t">Iniciando servicios locales… (el primer arranque puede tardar 1-2 min)</div></body></html>`);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false, // el preload comparte window.__SRSERVI_API__
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(LOADING_HTML);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function loadApp() {
  // Landing = launcher con el menú (Store / Admin / Worker) y la sincronización.
  if (mainWindow) mainWindow.loadURL(`http://localhost:${SERVER_PORT}/desktop`);
}

// ─────────────────────────── IPC (FS / red / cifrado) ─────────────────────────
const CREDS_FILE = path.join(DATA_DIR, 'creds.bin');
const LICENSE_FILE = path.join(DATA_DIR, 'offline-license.json');

ipcMain.handle('creds:save', (_e, { email, password }) => {
  try {
    const payload = JSON.stringify({ email, password });
    const buf = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(payload)
      : Buffer.from(payload, 'utf8');
    fs.writeFileSync(CREDS_FILE, buf);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('creds:load', () => {
  try {
    if (!fs.existsSync(CREDS_FILE)) return null;
    const buf = fs.readFileSync(CREDS_FILE);
    const str = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8');
    return JSON.parse(str);
  } catch (e) { return null; }
});

ipcMain.handle('creds:clear', () => {
  try { if (fs.existsSync(CREDS_FILE)) fs.unlinkSync(CREDS_FILE); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('license:get', () => {
  try { return fs.existsSync(LICENSE_FILE) ? JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8')) : null; }
  catch (e) { return null; }
});

ipcMain.handle('license:set', (_e, data) => {
  try { fs.writeFileSync(LICENSE_FILE, JSON.stringify(data || {})); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = mod.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(destPath, () => {}); return resolve(false); }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
    });
    req.on('error', () => { file.close(); fs.unlink(destPath, () => {}); resolve(false); });
    req.setTimeout(30000, () => { req.destroy(); resolve(false); });
  });
}

// Descarga las imágenes remotas (/uploads/*) hacia userData/uploads conservando
// el mismo path relativo, para que la BD siga válida y el server local las sirva.
ipcMain.handle('images:download', async (_e, { paths }) => {
  ensureDir(UPLOADS);
  let ok = 0, failed = 0;
  for (const p of (paths || [])) {
    if (typeof p !== 'string' || !p.startsWith('/uploads/')) continue;
    const rel = p.replace(/^\/uploads\//, '');
    const dest = path.join(UPLOADS, rel);
    ensureDir(path.dirname(dest));
    if (fs.existsSync(dest)) { ok++; continue; }
    const done = await downloadFile(REMOTE_HOST + p, dest);
    done ? ok++ : failed++;
  }
  return { ok, failed, total: (paths || []).length };
});

// ─────────────────────────── Ciclo de vida ────────────────────────────────
async function boot() {
  try {
    ensureDir(DATA_DIR);
    createWindow(); // muestra pantalla de carga de inmediato
    if (!DB_EXTERNAL) await startMariaDb();
    await startServer();
    loadApp(); // navega a la SPA cuando el servidor está listo
  } catch (err) {
    fatal('No se pudo iniciar SRServi POS', err);
  }
}

function shutdown() {
  try { if (serverProc && !serverProc.killed) serverProc.kill(); } catch (e) {}
  try {
    if (mariadbProc && !mariadbProc.killed) {
      // Apagado ordenado de MariaDB
      const admin = bin('mysqladmin');
      if (fs.existsSync(admin)) {
        spawnSync(admin, ['-u', DB_USER, '--protocol=tcp', '--port=' + DB_PORT, 'shutdown'], { cwd: MARIADB_DIR });
      }
      if (!mariadbProc.killed) mariadbProc.kill();
    }
  } catch (e) {}
}

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  shutdown();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', shutdown);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
process.on('exit', shutdown);
