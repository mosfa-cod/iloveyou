
import { defineConfig } from 'vite';

export default defineConfig({
  // تحديد المسار الأساسي للمشروع ليتوافق مع رابط GitHub Pages (https://username.github.io/ilovee/)
  base: '/ilovee/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
