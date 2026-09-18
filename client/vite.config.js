import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function localApiTarget() {
  const fallback = 'http://localhost:3001'
  const raw = process.env.API_PROXY_TARGET || fallback
  try {
    const { hostname } = new URL(raw)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return raw
  } catch {
    /* ignore invalid override */
  }
  console.warn(`[vite] Ignoring non-local API_PROXY_TARGET; proxying to ${fallback}`)
  return fallback
}

/* eslint-env node */
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: localApiTarget(),
        changeOrigin: true,
      },
      '/e': {
        target: localApiTarget(),
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
