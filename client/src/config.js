const API_URL = 'https://srservi2.srautomatic.com';
const SOCKET_URL = 'https://srservi2.srautomatic.com';
const UPLOAD_URL = 'https://srservi2.srautomatic.com';

export { API_URL, SOCKET_URL, UPLOAD_URL };
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  return UPLOAD_URL + imagePath;
};