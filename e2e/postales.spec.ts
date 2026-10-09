import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { abrirMundo, esperarEscena, gancho, vigilarErrores, sinErrores } from './util'

/**
 * Captura todas las postales de la capa `postales` del mapa en el juego, ya con luces, partículas y personajes.
 * Vista 960 x 540 con dpr 1: el mismo encuadre de las postales del kit (docs/capturas/<fase>/<postal>.png),
 * y la misma postal en la vista tablet (<postal>_tablet.png) para ver cómo se ve en el iPad.
 * La fase sale de FASE_CAPTURAS (por defecto f1a).
 */
const fase = process.env.FASE_CAPTURAS ?? 'f1a'
const carpeta = join('docs', 'capturas', fase)

test('captura todas las postales del mapa y respeta los límites de rendimiento', async ({ page, browser }) => {
  test.setTimeout(600_000)
  mkdirSync(carpeta, { recursive: true })
  const errores = vigilarErrores(page)
  await abrirMundo(page, 'sophie', '&postal=1')
  const nombres = await gancho<string[]>(page, 'postales')
  expect(nombres.length).toBeGreaterThanOrEqual(8)

  // la vista tablet va en otro contexto, con su dpr y su toque
  const ctxTablet = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const tablet = await ctxTablet.newPage()
  await abrirMundo(tablet, 'sophie', '&postal=1')

  for (const n of nombres) {
    for (const [p, sufijo] of [[page, ''], [tablet, '_tablet']] as const) {
      expect(await gancho<boolean>(p, 'irAPostal', n)).toBe(true)
      // deja que las partículas, la bruma y la oscuridad se asienten
      await gancho(p, 'avanzar', 3)
      await p.waitForTimeout(1200)
      const c = await gancho<{ decos: number; particulas: number; luces: number }>(p, 'conteos')
      const a = await gancho<{ topeParticulas: number }>(p, 'atmosfera')
      expect(c.decos, `${n}${sufijo}: decorados activos`).toBeLessThan(450)
      expect(c.particulas, `${n}${sufijo}: partículas`).toBeLessThanOrEqual(a.topeParticulas)
      expect(c.luces, `${n}${sufijo}: luces`).toBeLessThanOrEqual(40)
      await p.screenshot({ path: join(carpeta, `${n}${sufijo}.png`) })
    }
  }
  await ctxTablet.close()
  await sinErrores(errores)
})

/** Título, selección de jugadora, pausa y créditos, en escritorio (960 x 540) y en tablet, para docs/capturas/<fase>/ */
test('captura el título, la selección, la pausa y los créditos', async ({ browser }) => {
  test.setTimeout(300_000)
  mkdirSync(carpeta, { recursive: true })
  const vistas = [
    { sufijo: '', ctx: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
    { sufijo: '_tablet', ctx: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
  ]
  for (const v of vistas) {
    const ctx = await browser.newContext(v.ctx)
    const page = await ctx.newPage()
    const errores = vigilarErrores(page)
    await page.goto('/?test=1&seed=1')
    await esperarEscena(page, 'Titulo')
    await page.waitForTimeout(2500)
    await page.screenshot({ path: join(carpeta, `titulo${v.sufijo}.png`) })
    await gancho(page, 'empezar')
    await esperarEscena(page, 'SeleccionJugador')
    await page.waitForTimeout(2500)
    await page.screenshot({ path: join(carpeta, `seleccion${v.sufijo}.png`) })
    await gancho(page, 'elegirTarjeta', 'sophie')
    await esperarEscena(page, 'Mundo')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true }, null, { timeout: 120_000 })
    await gancho(page, 'saltarPresentacion')
    await gancho(page, 'abrirPausa')
    await page.waitForTimeout(2500)
    await page.screenshot({ path: join(carpeta, `pausa${v.sufijo}.png`) })
    await sinErrores(errores)
    await ctx.close()
  }
})
