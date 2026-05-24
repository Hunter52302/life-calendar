import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['jspdf', 'jspdf-autotable'],
  },
  server: {
    proxy: {
      // Forward /api/* from the Vite dev server (port 5173) to the
      // Express server (port 3001) so the frontend never has to think
      // about two different ports during development.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
