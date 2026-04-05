import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const host = process.env.VITE_CLIENT_HOST || 'localhost';
const port = parseInt(process.env.VITE_CLIENT_PORT || '5173');
const apiUrl = process.env.VITE_API_URL || 'http://localhost:8080';
const socketUrl = process.env.VITE_SOCKET_URL || apiUrl;
const uploadUrl = process.env.VITE_UPLOAD_URL || apiUrl;

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    'import.meta.env.VITE_SOCKET_URL': JSON.stringify(socketUrl),
    'import.meta.env.VITE_UPLOAD_URL': JSON.stringify(uploadUrl)
  },
  server: {
    host,
    port,
    allowedHosts: ['srservi2.srautomatic.com'],
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true
      },
      '/uploads': {
        target: apiUrl,
        changeOrigin: true
      }
    }
  },
  preview: {
    allowedHosts: ['srservi2.srautomatic.com']
  }
})