import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/AlPelo-CRM/',
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: true,
    },
    // Fix: redirect /AlPelo-CRM (no trailing slash) to /AlPelo-CRM/
    proxy: {},
  },
  // Ensure all SPA routes under base return index.html
  appType: 'spa',
})
