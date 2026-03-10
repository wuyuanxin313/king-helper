import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './src/renderer', // 指定 Vite 的根目录
  plugins: [react()],
  base: './',
  build: {
    outDir: '../../dist/renderer', // 相对于 root 的输出目录
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  server: {
    port: 5174,
    host: '0.0.0.0', // 监听所有网络接口，包括 IPv4 和 IPv6
    strictPort: true,
  },
});

