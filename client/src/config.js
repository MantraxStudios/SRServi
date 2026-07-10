const API_URL = 'https://srservi3.srautomatic.com';
const SOCKET_URL = 'https://srservi3.srautomatic.com';
const UPLOAD_URL = 'https://srservi3.srautomatic.com';

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