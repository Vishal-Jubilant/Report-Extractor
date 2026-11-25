import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendHost = env.VITE_BACKEND_HOST || '127.0.0.1'
  const backendPort = env.VITE_BACKEND_PORT || '4501'
  const frontendPort = parseInt(env.VITE_FRONTEND_PORT || '4500')

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',      // listen on all interfaces → accessible via LAN IP
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
        }
      }
    }
  }
})
