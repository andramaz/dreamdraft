import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev, the frontend calls relative /api/* and Vite forwards to Nest.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
