import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4500,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4501',
        changeOrigin: true,
      }
    }
  }
})
