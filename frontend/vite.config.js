import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em dev, o Vite repassa /api para o backend Python na porta 8000.
// No GitHub Pages o site fica em /belong/.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
