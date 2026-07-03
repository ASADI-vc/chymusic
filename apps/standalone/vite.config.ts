import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'img/default-cover.svg'],
      manifest: {
        name: 'CHYMUSIC',
        short_name: 'CHYMusic',
        description: 'Your music, podcasts, and Madahi — cached locally, played everywhere.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'en',
        dir: 'auto',
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Home', url: '/', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Search', url: '/search', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Library', url: '/library', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json,wasm}'],
        // Do NOT precache audio files — they are huge and we have a custom caching layer.
        globIgnores: ['**/audio/**', '**/data/catalog/**'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024, // 25MB for sql-wasm.wasm
        runtimeCaching: [
          {
            // Cache catalog JSON pages with a stale-while-revalidate strategy.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/catalog/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'chymusic-catalog',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Cache cover images.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'chymusic-covers',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@chymusic/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
