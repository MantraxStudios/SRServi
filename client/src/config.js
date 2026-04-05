const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:8080';

export { API_URL, SOCKET_URL, UPLOAD_URL };
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  return `${UPLOAD_URL}${imagePath}`;
};
