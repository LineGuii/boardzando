import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @boardzando/contracts e CJS (workspace package). Sem pre-bundling, o Vite
  // tenta inferir named exports estaticamente do dist/index.js e nao acha as
  // reexports feitas via TS `__exportStar` em runtime — quebra com erros do
  // tipo "does not provide an export named 'X'" quando um novo arquivo e
  // adicionado e o cache esta stale. Forcando o esbuild a empacotar o dep,
  // a interop CJS/ESM funciona corretamente.
  optimizeDeps: {
    include: ['@boardzando/contracts'],
  },
  server: {
    allowedHosts: ['localhost', 'boardzando.rpgzando.com'],
    port: 5173,
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
      // encaminha REST e WS para o NestJS em dev
      '/rooms': 'http://localhost:3000',
      '/games': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});


