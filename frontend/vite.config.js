import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
 preview: {
    port: 4173,
    host: true, // Allow external connections
    allowedHosts: [
      'livestream.arohafresh.com',
      'localhost',
      '.arohafresh.com' // Allow all subdomains
    ]
  }
});

