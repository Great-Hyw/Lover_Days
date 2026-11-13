import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { cspPlugin } from '@magicdima/vite-plugin-csp'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(),
    cspPlugin({
      directives: {
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
        'style-src': "'self' 'unsafe-inline'",
        'connect-src': "'self' https://api.brith.cc:8443 https://*.challenges.cloudflare.com"
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: true,
    // 后端开发好后，可在此配置代理转发到后端服务
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 后端路由无 /api 前缀，剥掉 /api 后转发（规范 3.4.0）
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
