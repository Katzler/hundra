/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages serverar sajten under /hundra/
  base: process.env.GITHUB_PAGES ? '/hundra/' : '/',
  plugins: [
    react(),
    VitePWA({
      // Vi bestämmer själva när en ny version tas i bruk (se main.tsx).
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // Matikonerna (ca 2 MB WebP) följer med i offline-cachen så att de syns utan nät.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'] },
      manifest: {
        name: 'Hundra',
        short_name: 'Hundra',
        description: 'Logga mat snabbt. 100 poäng är din dag.',
        lang: 'sv',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
