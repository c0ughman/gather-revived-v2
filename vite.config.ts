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
    }
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