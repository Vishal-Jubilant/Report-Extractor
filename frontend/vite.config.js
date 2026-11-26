import fs from 'fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendHost = env.VITE_BACKEND_HOST || '127.0.0.1'
  const backendPort = env.VITE_BACKEND_PORT || '4501'
  const frontendPort = parseInt(env.VITE_FRONTEND_PORT || '4500')

  const defaultCert = path.resolve(process.cwd(), '..', 'certs', 'cert.pem')
  const defaultKey = path.resolve(process.cwd(), '..', 'certs', 'key.pem')
  const certFile = env.VITE_SSL_CERT || defaultCert
  const keyFile = env.VITE_SSL_KEY || defaultKey
  const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile)
  const useHttps = env.VITE_USE_HTTPS !== 'false' && hasCerts

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',      // listen on all interfaces → accessible via LAN IP
      port: frontendPort,
      strictPort: true,
      ...(useHttps
        ? {
            https: {
              key: fs.readFileSync(keyFile),
              cert: fs.readFileSync(certFile),
            },
          }
        : {}),
      proxy: {
        '/api': {
          target: `${useHttps ? 'https' : 'http'}://${backendHost}:${backendPort}`,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
