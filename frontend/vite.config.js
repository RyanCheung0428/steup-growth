import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'EPIPE') return
            console.error('[vite] proxy error:', err.message)
          })
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return
              console.error('[vite] ws proxy socket error:', err.message)
            })
          })
        },
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/chat/': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/conversations': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/messages': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/forgot_password': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/serve_file': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/view_rag_document': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/pose_detection': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
