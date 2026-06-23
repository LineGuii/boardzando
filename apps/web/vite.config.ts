import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['localhost', 'boardzando.rpgzando.com'],
    port: 5173,
    hmr: {
      // Se acessar via remote host, usa HTTPS + wss://
      // Para local, deixa undefined (usa localhost:port padrão)
      host: process.env.VITE_HMR_HOST || 'localhost',
      protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
      ...(process.env.VITE_HMR_PORT && { port: parseInt(process.env.VITE_HMR_PORT, 10) }),
    },
    proxy: {
      // encaminha REST e WS para o NestJS em dev
      '/rooms': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});

