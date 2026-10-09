import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// F5: PWA, sin red, aviso de girar, audio de iOS, pantalla completa e instalar. Usa el build de producción (npm run build).

interface Pwa { registrado: boolean; controlado: boolean; precache: { archivos: number; hechos: number } | null; error: string; soporta: boolean; manifest: boolean }

const pwa = (p: Page) => gancho<Pwa>(p, 'pwa')

test.describe('PWA', () => {
  test('el manifest de la app es válido: pantalla completa, horizontal, íconos del kit que existen', async ({ page }) => {
    await page.goto('/?test=1')
    await esperarEscena(page, 'Titulo')
    expect((await pwa(page)).manifest).toBe(true)
    const m = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json())
    expect(m.name).toBe('GG Abyss')
    expect(m.display).toBe('fullscreen')
    expect(m.orientation).toBe('landscape')
    expect(m.start_url).toBe('./')
    expect(m.icons.length).toBeGreaterThanOrEqual(3)
    expect(m.icons.some((i: { purpose: string; sizes: string }) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true)
    for (const i of m.icons as { src: string }[]) {
      const r = await page.evaluate(async (src) => (await fetch(src)).status, i.src)
      expect(r, i.src).toBe(200)
    }
    // ícono para el iPad y el favicon, todos del kit
    const links = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => (l as HTMLLinkElement).getAttribute('href')))
    expect(links.every((h) => h?.includes('assets/kit/app/'))).toBe(true)
    expect(links.length).toBeGreaterThanOrEqual(2)
  })

  test('el service worker guarda el juego y sin red abre igual: título y mundo', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el guardado completo se prueba una vez, en escritorio')
    test.setTimeout(300_000)
    const errores = vigilarErrores(page)
    await page.goto('/?test=1&sw=1')
    await esperarEscena(page, 'Titulo')
    await expect.poll(async () => (await pwa(page)).registrado, { timeout: 30_000 }).toBe(true)
    await expect.poll(async () => (await pwa(page)).precache?.hechos ?? 0, { timeout: 180_000, intervals: [1000] }).toBeGreaterThan(300)
    const p = (await pwa(page)).precache!
    expect(p.hechos).toBe(p.archivos)
    await page.evaluate(() => navigator.serviceWorker.ready)
    // el que controla la página es ya el worker
    await page.reload()
    await esperarEscena(page, 'Titulo')
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

    // sin red: recarga bien y se entra al mundo
    await context.setOffline(true)
    await page.goto('/?test=1&sw=1')
    await esperarEscena(page, 'Titulo')
    await page.goto('/?test=1&sw=1&heroe=sophie')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown> | undefined; return !!a && a.escena!() === 'Mundo' && typeof a.noEsperar === 'function' && a.noEsperar() === true }, null, { timeout: 120_000 })
    await context.setOffline(false)
    await sinErrores(errores.filter((e) => !/Failed to load resource|net::ERR/i.test(e)))
  })

  test('sin ?sw=1 y en modo prueba el service worker no se mete', async ({ page }) => {
    await page.goto('/?test=1')
    await esperarEscena(page, 'Titulo')
    await page.waitForTimeout(500)
    expect((await pwa(page)).registrado).toBe(false)
  })
})

test.describe('Girar la tablet', () => {
  test('en vertical sale el ícono y el juego se pausa; en horizontal vuelve', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await page.goto('/?test=1')
    await page.waitForFunction(() => !!window.__ABYSS__ && typeof (window.__ABYSS__ as unknown as Record<string, unknown>).giro === 'function', null, { timeout: 60_000 })
    const g = await gancho<{ vertical: boolean; pausado: boolean; visible: boolean }>(page, 'giro')
    expect(g).toEqual({ vertical: true, pausado: true, visible: true })
    // el ícono es el del kit
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#girar .ico')!).backgroundImage)).toContain('girar_tablet.png')
    await page.setViewportSize({ width: 1180, height: 820 })
    await expect.poll(async () => (await gancho<{ pausado: boolean; visible: boolean }>(page, 'giro')).pausado, { timeout: 10_000 }).toBe(false)
    expect((await gancho<{ visible: boolean }>(page, 'giro')).visible).toBe(false)
    await esperarEscena(page, 'Titulo')
    await ctx.close()
  })

  test('en horizontal no sale ningún aviso', async ({ page }) => {
    await page.goto('/?test=1')
    await esperarEscena(page, 'Titulo')
    expect((await gancho<{ visible: boolean }>(page, 'giro')).visible).toBe(false)
  })
})

test.describe('Audio de iOS', () => {
  test('el audio vuelve a sonar cuando la tablet regresa de otra app', async ({ page }) => {
    await page.goto('/?test=1')
    await esperarEscena(page, 'Titulo')
    await page.mouse.click(30, 30)
    await expect.poll(async () => (await gancho<{ estado: string }>(page, 'audio')).estado, { timeout: 10_000 }).toBe('running')
    // la página queda suspendida (como hace iOS) y al volver a verse se despierta sola
    await page.evaluate(() => (window as unknown as { __JUEGO__: { sound: { context: AudioContext } } }).__JUEGO__.sound.context.suspend())
    await expect.poll(async () => (await gancho<{ estado: string }>(page, 'audio')).estado, { timeout: 5000 }).not.toBe('running')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect.poll(async () => (await gancho<{ estado: string }>(page, 'audio')).estado, { timeout: 10_000 }).toBe('running')
  })
})

test.describe('Pantalla completa e instalar', () => {
  test('en PC y Android la pausa trae el botón de pantalla completa', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'abrirPausa')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 20_000 }).toBe(true)
    await page.waitForFunction(() => typeof (window.__ABYSS__ as unknown as Record<string, unknown>).pausa === 'function', null, { timeout: 10_000 })
    const p = await gancho<{ pantalla: { x: number; y: number; width: number; height: number } | null }>(page, 'pausa')
    expect(p.pantalla).not.toBeNull()
  })

  test('en el iPad no hay pantalla completa: el botón dice Instalar y explica los 3 pasos', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    const page = await ctx.newPage()
    await abrirMundo(page, 'alana')
    await gancho(page, 'abrirPausa')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 20_000 }).toBe(true)
    await page.waitForFunction(() => typeof (window.__ABYSS__ as unknown as Record<string, unknown>).pausa === 'function', null, { timeout: 10_000 })
    const b = (await gancho<{ pantalla: { x: number; y: number; width: number; height: number } | null }>(page, 'pausa')).pantalla!
    expect(b).not.toBeNull()
    const z = await gancho<{ cssZoom: number }>(page, 'escala')
    await page.touchscreen.tap((b.x + b.width / 2) * z.cssZoom, (b.y + b.height / 2) * z.cssZoom)
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Instalar'), { timeout: 15_000 }).toBe(true)
    expect((await gancho<{ pasos: string[] }>(page, 'instalar')).pasos).toHaveLength(3)
    await gancho(page, 'cerrarInstalar')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Instalar'), { timeout: 10_000 }).toBe(false)
    await ctx.close()
  })
})
