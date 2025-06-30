// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react", "pdfjs-dist"]
  },
  define: {
    // Fix for PDF.js worker
    global: "globalThis",
    // Fix for Google APIs
    "process.env": {}
  },
  resolve: {
    alias: {
      // Polyfills for Node.js modules in browser
      stream: "stream-browserify",
      events: "events",
      querystring: "querystring-es3",
      util: "util",
      buffer: "buffer"
    }
  },
  worker: {
    format: "es"
  },
  server: {
    // Fix service worker navigation issues
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin"
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
          vendor: ["react", "react-dom"],
          pdf: ["pdfjs-dist"],
          gemini: ["@google/generative-ai", "@google/genai"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0JywgJ3BkZmpzLWRpc3QnXSxcbiAgfSxcbiAgZGVmaW5lOiB7XG4gICAgLy8gRml4IGZvciBQREYuanMgd29ya2VyXG4gICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcycsXG4gICAgLy8gRml4IGZvciBHb29nbGUgQVBJc1xuICAgICdwcm9jZXNzLmVudic6IHt9LFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIC8vIFBvbHlmaWxscyBmb3IgTm9kZS5qcyBtb2R1bGVzIGluIGJyb3dzZXJcbiAgICAgIHN0cmVhbTogJ3N0cmVhbS1icm93c2VyaWZ5JyxcbiAgICAgIGV2ZW50czogJ2V2ZW50cycsXG4gICAgICBxdWVyeXN0cmluZzogJ3F1ZXJ5c3RyaW5nLWVzMycsXG4gICAgICB1dGlsOiAndXRpbCcsXG4gICAgICBidWZmZXI6ICdidWZmZXInLFxuICAgIH0sXG4gIH0sXG4gIHdvcmtlcjoge1xuICAgIGZvcm1hdDogJ2VzJ1xuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICAvLyBGaXggc2VydmljZSB3b3JrZXIgbmF2aWdhdGlvbiBpc3N1ZXNcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnQ3Jvc3MtT3JpZ2luLUVtYmVkZGVyLVBvbGljeSc6ICdjcmVkZW50aWFsbGVzcycsXG4gICAgICAnQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3knOiAnc2FtZS1vcmlnaW4nXG4gICAgfSxcbiAgICAvLyBEaXNhYmxlIHNlcnZpY2Ugd29ya2VyIGluIGRldmVsb3BtZW50XG4gICAgbWlkZGxld2FyZU1vZGU6IGZhbHNlLFxuICAgIGZzOiB7XG4gICAgICBzdHJpY3Q6IGZhbHNlXG4gICAgfVxuICB9LFxuICBidWlsZDoge1xuICAgIC8vIEVuc3VyZSBwcm9wZXIgY2h1bmtpbmcgdG8gYXZvaWQgc2VydmljZSB3b3JrZXIgY29uZmxpY3RzXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIHZlbmRvcjogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcbiAgICAgICAgICBwZGY6IFsncGRmanMtZGlzdCddLFxuICAgICAgICAgIGdlbWluaTogWydAZ29vZ2xlL2dlbmVyYXRpdmUtYWknLCAnQGdvb2dsZS9nZW5haSddXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBR2xCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsZ0JBQWdCLFlBQVk7QUFBQSxFQUN4QztBQUFBLEVBQ0EsUUFBUTtBQUFBO0FBQUEsSUFFTixRQUFRO0FBQUE7QUFBQSxJQUVSLGVBQWUsQ0FBQztBQUFBLEVBQ2xCO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUE7QUFBQSxNQUVMLFFBQVE7QUFBQSxNQUNSLFFBQVE7QUFBQSxNQUNSLGFBQWE7QUFBQSxNQUNiLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLFFBQVE7QUFBQTtBQUFBLElBRU4sU0FBUztBQUFBLE1BQ1AsZ0NBQWdDO0FBQUEsTUFDaEMsOEJBQThCO0FBQUEsSUFDaEM7QUFBQTtBQUFBLElBRUEsZ0JBQWdCO0FBQUEsSUFDaEIsSUFBSTtBQUFBLE1BQ0YsUUFBUTtBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUE7QUFBQSxJQUVMLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFBQSxVQUM3QixLQUFLLENBQUMsWUFBWTtBQUFBLFVBQ2xCLFFBQVEsQ0FBQyx5QkFBeUIsZUFBZTtBQUFBLFFBQ25EO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
