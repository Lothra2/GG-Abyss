import { defineConfig } from '@playwright/test'

// En la nube el Chromium ya viene instalado (PLAYWRIGHT_BROWSERS_PATH). Nunca se corre `playwright install` ahí.
// Si la revisión no cuadra con la de Playwright, se puede forzar con PW_CHROMIUM=/opt/pw-browsers/chromium/chrome-linux/chrome
const executablePath = process.env.PW_CHROMIUM || undefined
// PW_BASE_URL corre las pruebas contra otro build servido aparte (sin tocar el de la suite que esté corriendo)
const baseURL = process.env.PW_BASE_URL || 'http://localhost:4173'

// Chromium sin GPU: WebGL por software para que Phaser corra igual que en un aparato.
const launchOptions = {
  executablePath,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, launchOptions, trace: 'off' },
  projects: [
    { name: 'escritorio', testIgnore: /postales|tablet|telefono/, use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
    { name: 'tablet', testMatch: /(humo|flujo|mundo|tutorial|catedral|entrada|ataque|minimapa|intro)\.spec\.ts|\.tablet\.spec\.ts/, use: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
    // teléfonos acostados: el iPhone a pantalla completa y el Galaxy S23 con la barra de Chrome (el caso más justo)
    { name: 'iphone', testMatch: /(humo|flujo|entrada|ataque|minimapa|intro|telefono|thor)\.spec\.ts/, use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } },
    { name: 'galaxy', testMatch: /(humo|flujo|entrada|ataque|minimapa|intro|telefono|thor)\.spec\.ts/, use: { viewport: { width: 780, height: 304 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } },
    { name: 'postales', testMatch: /postales\.spec\.ts/, use: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
  ],
  webServer: process.env.PW_BASE_URL ? undefined : { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
})
