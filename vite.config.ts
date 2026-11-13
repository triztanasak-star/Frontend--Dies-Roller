import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), {
    name: 'local-qr-address',
    configureServer(server) {
      server.middlewares.use('/__qr-address', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ origin: server.resolvedUrls?.network.find(url => !url.includes('['))?.replace(/\/$/, '') ?? '' }));
      });
    },
  }],
  build: {
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  },
})
