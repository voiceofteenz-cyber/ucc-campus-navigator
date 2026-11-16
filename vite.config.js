import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS=1 (npm run dev:https) serves the dev site over HTTPS so phones on the same
// Wi-Fi can use GPS — browsers only allow geolocation on https:// or localhost.
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  server: {
    port: 5173,
    proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 5174}`, changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 5174}`, changeOrigin: true } },
  },
});
