import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

// vite-plugin-pwa 1.3.0 probes a global `__dirname` before import.meta.url.
// Node 24 exposes `__dirname` as "." while loading the bundled Vite config,
// which makes createRequire('.') throw and leaves the build waiting forever.
// Load the plugin without that misleading global so it resolves its own file.
const inheritedDirname = globalThis.__dirname
delete globalThis.__dirname
const { VitePWA } = await import('vite-plugin-pwa')
if (inheritedDirname !== undefined) globalThis.__dirname = inheritedDirname

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
      // Local verification can skip Workbox with SKIP_PWA=1. This avoids a
      // macOS file-provider stall while keeping normal production builds intact.
      disable: process.env.SKIP_PWA === '1',
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
        share_target: {
          action: '/',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: { title: 'share_title', text: 'share_text', url: 'share_url' },
        },
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
    include: ['chrono-node'],
  },

  // NOTE: Do NOT externalize `@tauri-apps/*`. In Tauri v2 the JS API packages
  // are ordinary npm modules that must be BUNDLED into the frontend — they are
  // not provided as resolvable bare modules at runtime. Marking them external
  // left specifiers like `@tauri-apps/api/core` in the built bundle, which the
  // webview cannot resolve ("Failed to resolve module specifier …"), breaking
  // the updater, tray, and external-link opener. Bundling them fixes all three.

  server: {
    // Honor an injected PORT (e.g. the Claude preview harness assigns a free
    // port this way); Vite otherwise ignores PORT and scans from 5173 upward,
    // which leaves the harness proxying a port nothing is listening on. Plain
    // `npm run dev` has no PORT set and keeps the default 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: !!process.env.PORT,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
