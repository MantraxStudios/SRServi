import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_CLIENT_HOST || 'localhost',
    port: parseInt(process.env.VITE_CLIENT_PORT || '5173'),
    allowedHosts: ['mantraxtools.store', 'www.mantraxtools.store', 'srservi3.srautomatic.com']
  },
  preview: {
    allowedHosts: ['mantraxtools.store', 'www.mantraxtools.store', 'srservi3.srautomatic.com']
  }
})