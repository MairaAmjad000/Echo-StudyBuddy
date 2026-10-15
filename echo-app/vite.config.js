import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    proxy: {
      // Dev: serve the API from the Express backend on :4000.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
