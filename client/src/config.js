// Host de la API. En la app de escritorio (Electron offline) el preload inyecta
// window.__SRSERVI_API__ = 'http://localhost:8888'. En la web queda el remoto.
const HOST = (typeof window !== 'undefined' && window.__SRSERVI_API__)
  || 'https://srservi2.srautomatic.com';
const API_URL = HOST;
const SOCKET_URL = HOST;
const UPLOAD_URL = HOST;

export { API_URL, SOCKET_URL, UPLOAD_URL };
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  return UPLOAD_URL + imagePath;
};

// Imagen obligatoria por defecto para productos, extras y complementos sin imagen propia.
export const DEFAULT_PRODUCT_IMAGE = '/iconolbigatorio.png';

// Igual que getImageUrl, pero nunca devuelve null: si no hay imagen usa la obligatoria.
export const getProductImageUrl = (imagePath) => getImageUrl(imagePath) || DEFAULT_PRODUCT_IMAGE;