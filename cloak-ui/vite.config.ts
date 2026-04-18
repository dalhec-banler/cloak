import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const SHIP = process.env.SHIP_URL || 'http://localhost';

export default defineConfig({
  base: '/apps/cloak/',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../cloak/web'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/~': SHIP,
      '/apps/cloak/~': SHIP,
    },
  },
});
