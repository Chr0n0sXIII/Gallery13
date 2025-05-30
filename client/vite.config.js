import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    host: true,
    allowedHosts: [".trycloudflare.com"],
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
})
