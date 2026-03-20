import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/vendors': 'http://localhost:5000',
      '/devices': 'http://localhost:5000',
      '/children': 'http://localhost:5000',
      '/messages': 'http://localhost:5000',
      '/schedules': 'http://localhost:5000',
      '/wake': 'http://localhost:5000',
      '/alerts': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
