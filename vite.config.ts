import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const buildNumber = execSync('git rev-list --count HEAD').toString().trim();
const version = `1.0.${buildNumber}`;
const buildTime = new Date().toISOString();

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify({ version, commitHash, buildTime }),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:4002',
        ws: true,
      },
      '/colyseus': {
        target: 'ws://localhost:4002',
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ''),
      }
    },
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
  },
});