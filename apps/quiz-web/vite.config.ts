import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@boardzando/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    allowedHosts: ['localhost', 'quiz.rpgzando.com'],
    port: 5174,
    hmr: process.env.VITE_DISABLE_HMR
      ? false
      : {
          host: process.env.VITE_HMR_HOST || 'localhost',
          protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
          ...(process.env.VITE_HMR_PORT && {
            port: parseInt(process.env.VITE_HMR_PORT, 10),
          }),
        },
    proxy: {
      '/quiz': 'http://localhost:3000',
      '/rooms': 'http://localhost:3000',
      '/games': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
