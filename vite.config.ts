import { defineConfig } from 'vite'

// base './' para que el juego abra igual en Netlify, en una subcarpeta o desde la PWA instalada
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
