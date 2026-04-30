import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  optimizeDeps: {
    include: ['cesium']
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.url?.includes('/api/events')) {
              proxyReq.setHeader('Accept', 'text/event-stream');
            }
          });
          // Suppress "backend not ready yet" connection errors during startup
          proxy.on('error', (err, _req, res) => {
            const msg = err.message ?? '';
            if (msg.includes('ECONNREFUSED') || err.constructor?.name === 'AggregateError') {
              // Backend still starting — send a clean 503 instead of crashing the proxy
              if (res && 'writeHead' in res && typeof (res as any).writeHead === 'function') {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({ error: 'Backend starting up, please wait…' }));
              }
            } else {
              console.error('[vite proxy]', err.message);
            }
          });
        }
      }
    }
  }
})