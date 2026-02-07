
import { defineConfig } from 'vite';

export default defineConfig({
  // هذا السطر هو الأهم لعمل الموقع على GitHub Pages في مجلد ilovee
  base: '/ilovee/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
  },
});
