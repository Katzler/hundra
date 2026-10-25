/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Versionen syns i Profil, så att man kan se på telefonen om en publicering har kommit fram.
function gitVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  // GitHub Pages serverar sajten under /hundra/
  base: process.env.GITHUB_PAGES ? '/hundra/' : '/',
  plugins: [
    react(),
    VitePWA({
      // Vi bestämmer själva när en ny version tas i bruk (se main.tsx).
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // Matikonerna (ca 2 MB WebP) följer med i offline-cachen så att de syns utan nät.
      // Appikonerna i full storlek behövs inte offline – bara vid installation.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'],
        globIgnores: ['icon-512.png', 'icon-maskable-512.png'],
      },
      manifest: {
        name: 'Hundra',
        short_name: 'Hundra',
        description: 'Logga mat snabbt. 100 poäng är din dag.',
        lang: 'sv',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F1E7',
        theme_color: '#F6F1E7',
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
    setupFiles: ['src/test/setup.ts'],
  },
})
