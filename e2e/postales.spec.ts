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

/** F2: cada clase usando su primera habilidad contra enemigos reales, con la interfaz de combate puesta */
test('captura el combate de cada clase', async ({ browser }) => {
  test.setTimeout(400_000)
  mkdirSync(carpeta, { recursive: true })
  for (const [heroe, clase] of [['sophie', 'amazona'], ['alana', 'druida'], ['rick', 'paladin'], ['steph', 'hechicera']] as const) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const errores = vigilarErrores(page)
    await abrirMundo(page, heroe)
    const c = await gancho<{ x: number; y: number; enemigo: number }>(page, 'cercaDeEnemigo', 'calabaza', 0)
    await gancho(page, 'teleport', c.x, c.y)
    await gancho(page, 'tocarEnemigo', c.enemigo)
    // rick necesita estar al lado para que el torbellino pegue
    if (clase === 'paladin') await gancho(page, 'teleport', c.x + 25, c.y + 4)
    await gancho(page, 'habilidad', 0)
    // se avanza hasta el momento del efecto y se deja que Phaser lo dibuje
    await gancho(page, 'avanzar', clase === 'druida' ? 0.9 : 0.6)
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(carpeta, `combate_${clase}.png`) })
    await sinErrores(errores)
    await ctx.close()
  }
})

/** F3: el botín en el piso (con sus haces de luz) y el inventario con Thor ya armado */
test('captura el botín en el piso y el inventario', async ({ browser }) => {
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
    await abrirMundo(page, 'rick')
    for (const id of ['m_espada_cruel', 'm_jubon_robusto', 'm_casco_robusto', 'pet_armor_1', 'm_anillo_vida', 'shield_heater_1', 'r_muralla_del_alba', 'r_juramento_de_hierro', 'pluma_de_cuervo', 'potion_health_minor']) await gancho(page, 'darObjeto', id)
    for (let i = 0; i < 6; i++) await gancho(page, 'equipar', i)
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'soltarObjeto', 'r_aguijon_de_cuervo', 70)
    await gancho(page, 'soltarObjeto', 'pluma_de_cuervo', -70)
    await gancho(page, 'soltarObjeto', 'm_botas_viento', 120)
    await gancho(page, 'soltarOro', 30, 30)
    await gancho(page, 'avanzar', 0.4)
    // el banner de nivel (por la XP de los enemigos) se va en unos 3 s
    await page.waitForTimeout(4500)
    await page.screenshot({ path: join(carpeta, `botin_en_el_piso${v.sufijo}.png`) })
    await gancho(page, 'abrirInventario')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: join(carpeta, `inventario${v.sufijo}.png`) })
    await sinErrores(errores)
    await ctx.close()
  }
})
