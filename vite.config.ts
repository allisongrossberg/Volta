import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env vars
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/huggingface': {
          // Use the new router endpoint as specified in the error message
          target: 'https://router.huggingface.co',
          changeOrigin: true,
          rewrite: (path) => {
            // Convert /api/huggingface/models/{model} to /hf-inference/models/{model}
            const newPath = path.replace(/^\/api\/huggingface/, '/hf-inference')
            console.log('Proxy rewrite:', path, '->', newPath)
            return newPath
          },
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Inject the API key from environment variable on the server side
              // This keeps the key secure and avoids CORS issues
              const apiKey = env.VITE_HUGGINGFACE_API_KEY
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
                console.log('Proxy: Setting Authorization header (key prefix:', apiKey.substring(0, 10) + '...)')
              } else {
                console.warn('Proxy: VITE_HUGGINGFACE_API_KEY not found in environment')
              }
            })
          },
        },
      },
    },
  }
})

