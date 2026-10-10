import { defineConfig } from '@playwright/test'

// En la nube el Chromium ya viene instalado (PLAYWRIGHT_BROWSERS_PATH). Nunca se corre `playwright install` ahí.
// Si la revisión no cuadra con la de Playwright, se puede forzar con PW_CHROMIUM=/opt/pw-browsers/chromium/chrome-linux/chrome
const executablePath = process.env.PW_CHROMIUM || undefined

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
  use: { baseURL: 'http://localhost:4173', launchOptions, trace: 'off' },
  projects: [
    { name: 'escritorio', testIgnore: /postales|tablet/, use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
    { name: 'tablet', testMatch: /(humo|flujo|mundo|tutorial)\.spec\.ts|\.tablet\.spec\.ts/, use: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
    { name: 'postales', testMatch: /postales\.spec\.ts/, use: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
  ],
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
})
