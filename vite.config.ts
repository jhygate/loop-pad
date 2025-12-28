import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/looppad/', // Base path for deployment to jhygate.github.io/looppad/
  root: 'src', // Serve from src directory
  publicDir: resolve(__dirname, 'public'), // Serve static assets from public
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
