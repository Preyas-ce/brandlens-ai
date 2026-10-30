import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    host: true,
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)
          ) {
            return 'vendor-react';
          }

          if (
            /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run[\\/]router)[\\/]/.test(id)
          ) {
            return 'vendor-router';
          }

          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) {
            return 'vendor-icons';
          }

          return undefined;
        },
      },
    },
  },
});