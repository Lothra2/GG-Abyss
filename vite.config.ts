import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

/** La versión que se ve en el título: el commit (Netlify lo da en COMMIT_REF; en la compu, git) */
function versionJuego(): string {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// base './' para que el juego abra igual en Netlify, en una subcarpeta o desde la PWA instalada
export default defineConfig({
  base: './',
  define: { __VERSION_JUEGO__: JSON.stringify(versionJuego()) },
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
