import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Middleware: redirige /AlPelo-CRM → /AlPelo-CRM/
function redirectBasePlugin() {
  return {
    name: 'redirect-base-no-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/AlPelo-CRM') {
          res.writeHead(301, { Location: '/AlPelo-CRM/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), redirectBasePlugin()],
  base: '/AlPelo-CRM/',
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: true,
      interval: 1000, // Reducir frecuencia de polling (menos I/O en Docker)
    },
    // Pre-compilar SCSS al arrancar (no esperar al primer request)
    warmup: {
      clientFiles: [
        './src/styles/landing-entry.scss',
        './src/styles/main.scss',
        './src/App.jsx',
        './src/routes/LandingRouter.jsx',
        './src/components/landing/layout/Layout.jsx',
      ],
    },
  },
  appType: 'spa',

  // ── Optimización de build ──
  build: {
    // esbuild (built-in) — elimina console.log en producción
    minify: 'esbuild',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run')) {
            return 'vendor-react';
          }
          // Recharts + D3 — solo CRM
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
        },
      },
    },
  },

  // ── Eliminar console.log solo en producción ──
  esbuild: process.env.NODE_ENV === 'production'
    ? { drop: ['console', 'debugger'] }
    : {},

  // ── CSS ──
  css: {
    devSourcemap: false, // Desactivar para acelerar compilación SCSS en Docker
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'global-builtin', 'color-functions'],
      },
    },
  },
})
