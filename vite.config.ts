import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，保证部署到 GitHub Pages 的 /<repo>/ 子路径下也能正常加载
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
