// Quita del bundle de la app Android (Capacitor) los instaladores de OTRAS apps
// que viven en client/public/ (se sirven en la web, pero dentro del APK son ~120MB
// de peso muerto). Sin esto el APK supera los 100MB de límite de GitHub.
import { rmSync } from 'fs';

const base = 'android/app/src/main/assets/public';
const heavy = [
  'SRServiWindowsClient.zip',
  'CCTV.apk',
  'SRServiLauncherClient.apk',
  'SRServiTVOrder.apk',
];

let removed = 0;
for (const f of heavy) {
  try { rmSync(`${base}/${f}`, { force: true }); removed++; } catch { /* noop */ }
}
console.log(`[trim-apk-assets] listo (${removed} archivos pesados excluidos del APK)`);
