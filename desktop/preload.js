// Preload: expone el host de la API local y un puente (window.srserviDesktop)
// hacia el proceso principal para tareas que necesitan FS/red/cifrado:
// credenciales, descarga de imágenes y licencia offline.
// contextIsolation:false → podemos escribir directamente en window.
const { ipcRenderer } = require('electron');

const PORT = process.env.SRSERVI_PORT || '8888';
const REMOTE = process.env.SRSERVI_REMOTE || 'https://srservi2.srautomatic.com';

try {
  window.__SRSERVI_API__ = `http://localhost:${PORT}`;
  window.__SRSERVI_DESKTOP__ = true;

  window.srserviDesktop = {
    isDesktop: true,
    localHost: `http://localhost:${PORT}`,
    remoteHost: REMOTE,
    // Credenciales cifradas (Electron safeStorage)
    saveCreds: (email, password) => ipcRenderer.invoke('creds:save', { email, password }),
    loadCreds: () => ipcRenderer.invoke('creds:load'),
    clearCreds: () => ipcRenderer.invoke('creds:clear'),
    // Licencia offline (userData/offline-license.json)
    getLicense: () => ipcRenderer.invoke('license:get'),
    setLicense: (data) => ipcRenderer.invoke('license:set', data),
    // Descarga de imágenes remotas → userData/uploads
    downloadImages: (paths) => ipcRenderer.invoke('images:download', { paths }),
  };
} catch (e) {
  // ignore
}
