import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*', 'textures/*'],
      manifest: {
        name: 'Atheneum',
        short_name: 'Atheneum',
        description: 'Your learning notebook',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /\/content\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'content-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
            },
          },
          {
            // Pyodide's ~10 MB wasm/stdlib streams from jsDelivr on the first Python
            // Run. CacheFirst so it's a one-time cost (cheap on a phone over Tailscale
            // thereafter). NOT precached — bundling it would blow the Workbox 2 MiB cap.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-runtime',
              expiration: { maxEntries: 60, maxAgeSeconds: 2592000 }, // 30d
              cacheableResponse: { statuses: [0, 200] }, // 0 = opaque cross-origin
            },
          },
        ],
        navigateFallbackDenylist: [/^\/ws/, /^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5200,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3100',
      '/ws': { target: 'http://localhost:3100', ws: true },
      '/content': 'http://localhost:3100',
    },
    watch: {
      // Don't let Vite watch content/ or server/ — those are backend concerns.
      // Without this, git commits (which modify .git/) and content JSON writes
      // trigger Vite full-page reloads during development.
      ignored: ['**/content/**', '**/server/**', '**/.git/**', '**/mcp/**'],
    },
  },
})
