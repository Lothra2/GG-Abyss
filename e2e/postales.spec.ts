import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { abrirMundo, gancho, vigilarErrores, sinErrores } from './util'

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
