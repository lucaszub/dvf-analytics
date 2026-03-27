import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/communes': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/departements': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/bretagne': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/sections': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/parcelles': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/mutations': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/code-postaux': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
      '/h3': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
