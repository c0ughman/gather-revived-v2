import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react', 'pdfjs-dist'],
  },
  define: {
    // Fix for PDF.js worker
    global: 'globalThis',
    // Fix for Google APIs
    'process.env': {},
  },
  resolve: {
    alias: {
      // Polyfills for Node.js modules in browser
      stream: 'stream-browserify',
      events: 'events',
      querystring: 'querystring-es3',
      util: 'util',
      buffer: 'buffer',
    },
  },
  worker: {
    format: 'es'
  },
  server: {
    // Fix service worker navigation issues
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    // Disable service worker in development
    middlewareMode: false,
    fs: {
      strict: false
    },
    // Proxy API requests to Python backend
    proxy: {
      '/api/python': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/python/, '/api/v1'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Python backend proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying request:', req.method, req.url);
          });
        },
      },
    },
  },
  build: {
    // Ensure proper chunking to avoid service worker conflicts
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdf: ['pdfjs-dist'],
          gemini: ['@google/genai']
        }
      }
    }
  }
});