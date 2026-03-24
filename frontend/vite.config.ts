import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/communes': 'http://api:8000',
      '/departements': 'http://api:8000',
      '/bretagne': 'http://api:8000',
      '/h3': 'http://api:8000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
