import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__:    JSON.stringify(pkg.name),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' means we control when the new SW activates (via UpdatePrompt)
      registerType: 'prompt',

      // Which static assets to include in the precache manifest
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],

      // Web App Manifest — replaces public/manifest.json
      manifest: {
        name: 'PLS Calendar',
        short_name: 'PLS Cal',
        description: 'Plan your time, track your life, see the difference.',
        theme_color: '#863bff',
        background_color: '#0f172a',   // dark splash screen matches dark mode
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },

      workbox: {
        // Precache all JS/CSS/HTML/font/image assets produced by Vite
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Inject push notification handlers into the generated SW
        additionalManifestEntries: [],
        importScripts: ['/sw-push.js'],

        // Runtime caching rules
        runtimeCaching: [
          {
            // API calls: try network first, fall back to cache (10s timeout)
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
            },
          },
          {
            // Google Fonts (if ever added)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],

        // Serve the app shell for any navigation request when offline
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],

  optimizeDeps: {
    exclude: ['jspdf', 'jspdf-autotable'],
  },

  // Tauri packages are provided by the Tauri runtime — never bundle them
  build: {
    rollupOptions: {
      external: [
        /^@tauri-apps\/.*/,
      ],
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
