import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  const host = env.VITE_CLIENT_HOST || 'localhost';
  const port = parseInt(env.VITE_CLIENT_PORT || '5173');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_SOCKET_URL': JSON.stringify(env.VITE_SOCKET_URL || apiUrl),
      'import.meta.env.VITE_UPLOAD_URL': JSON.stringify(env.VITE_UPLOAD_URL || apiUrl)
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
  }
})