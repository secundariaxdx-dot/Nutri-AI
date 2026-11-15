/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// En GitHub Pages la app vive en /<repo>/. El workflow define VITE_BASE.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          db: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'splash/*.png'],
      manifest: {
        id: base,
        name: 'Nutri AI — Diario nutricional inteligente',
        short_name: 'Nutri AI',
        description: 'Fotografía tus comidas y calcula calorías y nutrientes con IA local, gratis y privada.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f8f5',
        theme_color: '#13412e',
        categories: ['health', 'food', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Fotografiar comida', short_name: 'Foto', url: `${base}#/foto`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Diario', short_name: 'Diario', url: `${base}#/diario`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json,webmanifest}'],
        globIgnores: ['**/splash/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Runtime de ONNX (WebAssembly) servido desde la propia app
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'nutri-ai-wasm', expiration: { maxEntries: 4 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Runtime de ONNX (WebAssembly) que usa Transformers.js
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'nutri-ai-runtime',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imágenes de productos de Open Food Facts
            urlPattern: ({ url }) => url.hostname.endsWith('openfoodfacts.org') && url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nutri-ai-off-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
