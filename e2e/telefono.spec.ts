import { expect, test } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// Teléfono acostado (iPhone y Galaxy S23, este con la barra de Chrome): el mundo y el HUD se ven del tamaño de la
// tablet, no el doble de mundo a la mitad. Y nada del HUD se pisa con lo de al lado.

type Caja = { x: number; y: number; width: number; height: number }
const seTocan = (a: Caja, b: Caja) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const adentro = (c: Caja, w: number, h: number) => c.x >= 0 && c.y >= 0 && c.x + c.width <= w + 1 && c.y + c.height <= h + 1

test.describe('En el teléfono', () => {
  test('el mundo se ve como en la tablet y el HUD entra sin pisarse', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page)
    const l = await gancho<{ vista: { w: number; h: number }; pausa: Caja; bolsa: Caja; panel: { x: number; y: number; w: number; h: number } }>(page, 'hudLayout')
    // la vista lógica mide lo mismo que en la tablet (unos 300 a 410 de alto), no 585 como antes
    expect(l.vista.h).toBeGreaterThanOrEqual(300)
    expect(l.vista.h).toBeLessThan(500)
    const cam = await gancho<{ alto: number }>(page, 'camara')
    expect(cam.alto).toBeLessThan(500)
    const c = await gancho<{ orbeVida: Caja; orbeMana: Caja; cinturon: Caja; xp: Caja; botones: { x: number; y: number; lado: number }[] }>(page, 'hudCombate')
    for (const k of [c.orbeVida, c.orbeMana, c.cinturon, c.xp]) expect(adentro(k, l.vista.w, l.vista.h)).toBe(true)
    expect(seTocan(c.orbeVida, c.cinturon)).toBe(false)
    expect(seTocan(c.orbeMana, c.cinturon)).toBe(false)
    // los botones de habilidad no se meten en el cinturón ni en el orbe de maná
    for (const b of c.botones) {
      const caja = { x: b.x - b.lado / 2, y: b.y - b.lado / 2, width: b.lado, height: b.lado }
      expect(seTocan(caja, c.cinturon)).toBe(false)
      expect(seTocan(caja, c.orbeMana)).toBe(false)
    }
    // arriba: el panel de contadores y la pausa no se tocan
    expect(seTocan({ x: l.panel.x, y: l.panel.y, width: l.panel.w, height: l.panel.h }, l.pausa)).toBe(false)
    await sinErrores(errores)
  })

  test('si la barra del navegador se esconde y la pantalla crece, el juego la llena entera (sin franja negra)', async ({ page }) => {
    await abrirMundo(page)
    const v = page.viewportSize()!
    await page.setViewportSize({ width: v.width, height: v.height + 56 })
    await expect.poll(async () => page.evaluate(() => {
      const c = document.querySelector('canvas')!.getBoundingClientRect()
      return Math.round(window.innerHeight - c.height)
    }), { timeout: 5_000 }).toBeLessThanOrEqual(1)
    await page.setViewportSize(v)
  })

  test('en la Catedral no queda ninguna columna de primer plano cortada a media pantalla', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page)
    await gancho(page, 'irAMundo', 'mundo2')
    await esperarEscena(page, 'Bajada')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return a.escena!() === 'Mundo' && typeof a.noEsperar === 'function' && a.noEsperar() === true && (a.mundoActual!() as { id: string }).id === 'mundo2' }, null, { timeout: 120_000 })
    await gancho(page, 'teleport', 560, 860)
    await gancho(page, 'avanzar', 1)
    const f = await gancho<{ frente: string[]; frenteMedidas: { y: number; alto: number }[]; altoVista: number }>(page, 'luzMundo')
    expect(f.frente).not.toContain('frente_columna')
    // lo que quede (raíces que cuelgan) parte del borde de arriba
    for (const m of f.frenteMedidas) expect(m.y).toBeLessThanOrEqual(1)
    await sinErrores(errores)
  })
})
