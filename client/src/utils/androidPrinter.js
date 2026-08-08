// Puente con la impresora Bluetooth nativa de la app offline (Capacitor).
// El nativo expone window.SRPrinter (ver android/app/.../BtPrinter.java).
// En web/otros entornos, window.SRPrinter no existe y todo es no-op.

export const hasAndroidPrinter = () =>
  typeof window !== 'undefined' && !!window.SRPrinter;

export function listAndroidPrinters() {
  if (!hasAndroidPrinter()) return [];
  try { return JSON.parse(window.SRPrinter.listPrinters() || '[]'); }
  catch { return []; }
}

export function getSavedPrinter() {
  if (!hasAndroidPrinter()) return '';
  try { return window.SRPrinter.getSaved() || ''; } catch { return ''; }
}

export function savePrinter(mac) {
  if (hasAndroidPrinter()) { try { window.SRPrinter.save(mac); } catch { /* noop */ } }
}

export function connectPrinter(mac) {
  if (!hasAndroidPrinter()) return false;
  try { return window.SRPrinter.connect(mac); } catch { return false; }
}

export function isPrinterReady() {
  if (!hasAndroidPrinter()) return false;
  try { return window.SRPrinter.isReady(); } catch { return false; }
}

export function requestPrinterPermission() {
  if (hasAndroidPrinter()) { try { window.SRPrinter.requestPermission(); } catch { /* noop */ } }
}

export function setPaperChars(n) {
  if (hasAndroidPrinter()) { try { window.SRPrinter.setPaperChars(n); } catch { /* noop */ } }
}

export function printTest() {
  if (!hasAndroidPrinter()) return false;
  try { return window.SRPrinter.printTest(); } catch { return false; }
}

// Conecta a la impresora guardada al iniciar (si hay una).
export function autoConnectPrinter() {
  if (!hasAndroidPrinter()) return;
  const mac = getSavedPrinter();
  if (mac) { try { window.SRPrinter.connect(mac); } catch { /* noop */ } }
}

// Imprime un pedido. `order` = objeto con la forma que espera BtPrinter:
// { orderNumber, items:[{quantity,name,price,ingredients,extras,complements}],
//   subtotal, discount, total, paymentMethod, serviceType, tableNumber, couponCode, currency }
export function printOrderAndroid(order) {
  if (!hasAndroidPrinter()) return false;
  try { return window.SRPrinter.printReceipt(JSON.stringify(order)); }
  catch { return false; }
}
