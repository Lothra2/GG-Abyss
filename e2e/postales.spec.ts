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

/** F4: la pelea con un aviso en el piso, la victoria con el portal abierto y la pantalla de Continuará */
test('captura la pelea, la victoria y la bajada a la Catedral', async ({ browser }) => {
  test.setTimeout(400_000)
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
    await gancho(page, 'ponerNivel', 10)
    await gancho(page, 'entrarArena')
    await gancho(page, 'avanzar', 0.3)
    await gancho(page, 'danarJefe', 650 * 0.41)
    // se avanza hasta que haya un aviso en el piso (círculo o frente) con el reloj a la mitad
    for (let t = 0; t < 120; t += 0.1) {
      await gancho(page, 'curarTodo')
      await gancho(page, 'avanzar', 0.1)
      const j = await gancho<{ avisos: { forma: string; resta: number; total: number; ataque: string }[] }>(page, 'jefe')
      if (j.avisos.some((a) => a.forma !== 'otro' && a.ataque !== 'grito' && a.resta < a.total * 0.5 && a.resta > 0.2)) break
    }
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(carpeta, `jefe_pelea${v.sufijo}.png`) })
    await gancho(page, 'danarJefe', 9999)
    await page.waitForTimeout(9000)
    await page.screenshot({ path: join(carpeta, `victoria${v.sufijo}.png`) })
    // F8: el portal ya no lleva a Continuará, baja a la Catedral
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Bajada')
    await page.waitForTimeout(700)
    await page.screenshot({ path: join(carpeta, `bajada${v.sufijo}.png`) })
    await sinErrores(errores)
    await ctx.close()
  }
})

/** F6: lo nuevo. La tienda, las huellas de Thor, el álbum, la flecha guía y el cine del jefe */
test('captura la tienda, el olfato de Thor, el álbum, la flecha guía y el cine del jefe', async ({ browser }) => {
  test.setTimeout(400_000)
  mkdirSync(carpeta, { recursive: true })
  const vistas = [
    { sufijo: '', ctx: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
    { sufijo: '_tablet', ctx: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
  ]
  for (const v of vistas) {
    const ctx = await browser.newContext(v.ctx)
    const page = await ctx.newPage()
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    await page.waitForTimeout(3500)
    // Thor olfatea: huellas doradas hacia un cofre
    await gancho(page, 'olfatear')
    await gancho(page, 'avanzar', 1.6)
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(carpeta, `olfato${v.sufijo}.png`) })
    // la tienda de la fogata con oro para comprar algo
    await gancho(page, 'darOro', 60)
    const f = (await gancho<{ tipo: string; llave: string; parada: { x: number; y: number } }[]>(page, 'objetivos')).find((o) => o.tipo === 'fogata')!
    await gancho(page, 'teleport', f.parada.x, f.parada.y + 10)
    await gancho(page, 'usarObjetivo', f.llave)
    await gancho(page, 'avanzar', 1)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(carpeta, `tienda${v.sufijo}.png`) })
    await gancho(page, 'cerrarTienda')
    // Phaser cierra la escena en el cuadro siguiente
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Tienda'), { timeout: 5_000 }).toBe(false)
    // el álbum con algunas postales pegadas
    for (const n of ['cascada_y_vado', 'puente_del_trol', 'abuelo_roble', 'lago_espejo']) {
      await gancho(page, 'irAPostal', n)
      await gancho(page, 'avanzar', 0.5)
    }
    await gancho(page, 'abrirAlbum')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Album'), { timeout: 10_000 }).toBe(true)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: join(carpeta, `album${v.sufijo}.png`) })
    await gancho(page, 'albumTocar', 'cascada_y_vado')
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(carpeta, `album_postal${v.sufijo}.png`) })
    await gancho(page, 'cerrarAlbum')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Album'), { timeout: 5_000 }).toBe(false)
    // la flecha guía desde una punta del mapa
    await gancho(page, 'irAPostal', 'claro_escondido')
    await gancho(page, 'avanzar', 1)
    await page.waitForTimeout(4000)
    await gancho(page, 'forzarGuia')
    await gancho(page, 'avanzar', 0.2)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: join(carpeta, `flecha_guia${v.sufijo}.png`) })
    await sinErrores(errores)
    await ctx.close()

    // el cine del jefe: la entrada, el enojo y la victoria
    const ctx2 = await browser.newContext(v.ctx)
    const p2 = await ctx2.newPage()
    const err2 = vigilarErrores(p2)
    await abrirMundo(p2, 'rick')
    await gancho(p2, 'ponerNivel', 10)
    await gancho(p2, 'entrarArena')
    await gancho(p2, 'avanzar', 1)
    await p2.waitForTimeout(400)
    await p2.screenshot({ path: join(carpeta, `jefe_entrada${v.sufijo}.png`) })
    await gancho(p2, 'avanzar', 2.5)
    await gancho(p2, 'danarJefe', 650 * 0.42)
    await gancho(p2, 'avanzar', 0.6)
    await p2.waitForTimeout(500)
    await p2.screenshot({ path: join(carpeta, `jefe_enojo${v.sufijo}.png`) })
    await gancho(p2, 'avanzar', 2)
    await gancho(p2, 'danarJefe', 9999)
    await gancho(p2, 'avanzar', 2.4)
    await p2.waitForTimeout(1200)
    await p2.screenshot({ path: join(carpeta, `jefe_victoria${v.sufijo}.png`) })
    await sinErrores(err2)
    await ctx2.close()
  }
})

/**
 * F7 antes y después en la sección de referencia (la Llegada y el puente del trol): la misma escena con el
 * interruptor "Mejoras F7" apagado (antes) y prendido (después). Lo que suena no sale en una foto: eso se compara
 * jugando con el mismo interruptor en la pausa.
 */
test('captura F7 antes y después en la sección de referencia', async ({ browser }) => {
  test.setTimeout(400_000)
  const dir = join('docs', 'capturas', 'f7')
  mkdirSync(dir, { recursive: true })
  const vistas = [
    { sufijo: '', ctx: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
    { sufijo: '_tablet', ctx: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
  ]
  type En = { id: number; tipo: string; vivo: boolean; anticipa: boolean }
  for (const v of vistas) {
    for (const [etapa, mejoras] of [['antes', false], ['despues', true]] as const) {
      const ctx = await browser.newContext(v.ctx)
      const page = await ctx.newPage()
      const errores = vigilarErrores(page)
      await abrirMundo(page, 'alana', '&tutorial=1')
      if (!mejoras) {
        await gancho(page, 'abrirPausa')
        await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(true)
        await gancho(page, 'pausaAlternar', 'mejorasF7')
        await gancho(page, 'pausaContinuar')
        await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(false)
      }
      // la llegada: lo primero que ve Alana
      await gancho(page, 'avanzar', 0.3)
      await page.waitForTimeout(2500)
      await page.screenshot({ path: join(dir, `llegada_${etapa}${v.sufijo}.png`) })
      // el trol del puente prepara su golpe
      await gancho(page, 'saltarTutorial')
      const c = await gancho<{ x: number; y: number; enemigo: number } | null>(page, 'cercaDeEnemigo', 'trol', 0)
      expect(c, 'el trol está en el mapa').not.toBeNull()
      await gancho(page, 'teleport', c!.x + 30, c!.y)
      let vio = false
      for (let i = 0; i < 80 && !vio; i++) {
        await gancho(page, 'curarTodo')
        await gancho(page, 'avanzar', 0.05)
        const e = (await gancho<En[]>(page, 'enemigos')).find((q) => q.id === c!.enemigo)!
        // el aviso se cuenta igual en los dos modos: lo que cambia es si se ve
        vio = e.anticipa
      }
      expect(vio, 'el trol llegó a preparar el golpe').toBe(true)
      await page.waitForTimeout(150)
      await page.screenshot({ path: join(dir, `trol_avisa_${etapa}${v.sufijo}.png`) })
      await sinErrores(errores)
      await ctx.close()
    }
  }
})

/** F8: la rebanada de la Catedral de las Raíces, cada zona en escritorio y en tablet, y la calidad baja */
test('captura la Catedral: la bajada, la escalera, el atrio, los claustros con el guardián y la calidad baja', async ({ browser }) => {
  test.setTimeout(400_000)
  const dir = join('docs', 'capturas', 'f8')
  mkdirSync(dir, { recursive: true })
  const vistas = [
    { sufijo: '', ctx: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
    { sufijo: '_tablet', ctx: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
  ]
  for (const v of vistas) {
    const ctx = await browser.newContext(v.ctx)
    const page = await ctx.newPage()
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'irAMundo', 'mundo2')
    await esperarEscena(page, 'Bajada')
    await page.waitForTimeout(700)
    await page.screenshot({ path: join(dir, `bajada${v.sufijo}.png`) })
    await esperarEscena(page, 'Mundo')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.mundoActual === 'function' }, null, { timeout: 120_000 })
    for (const n of ['escalera_hundida', 'atrio_luciernagas', 'claustros_quebrados', 'capilla_escondida', 'nave_inundada', 'forja_apagada']) {
      await gancho(page, 'irAPostal', n)
      await gancho(page, 'avanzar', 1.5)
      await page.waitForTimeout(3500)
      await page.screenshot({ path: join(dir, `${n}${v.sufijo}.png`) })
    }
    // con las tres brasas: la forja encendida y el atrio con sus braseros y el pedestal
    await gancho(page, 'darBrasas', 3)
    for (const [n, archivo] of [['forja_apagada', 'forja_encendida'], ['atrio_luciernagas', 'atrio_con_brasas']] as const) {
      await gancho(page, 'irAPostal', n)
      await gancho(page, 'avanzar', 1.5)
      await page.waitForTimeout(3500)
      await page.screenshot({ path: join(dir, `${archivo}${v.sufijo}.png`) })
    }
    // el guardián preparando su golpe grande
    const g = (await gancho<{ id: number; tipo: string; x: number; y: number }[]>(page, 'enemigos')).find((e) => e.tipo === 'guardian_cobre')!
    await gancho(page, 'teleport', g.x - 50, g.y + 10)
    for (let i = 0; i < 200; i++) {
      await gancho(page, 'curarTodo')
      await gancho(page, 'avanzar', 0.05)
      const e = (await gancho<{ id: number; estado: string }[]>(page, 'enemigos')).find((q) => q.id === g.id)!
      if (e.estado === 'aviso') break
    }
    await gancho(page, 'avanzar', 0.6)
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(dir, `guardian_aviso${v.sufijo}.png`) })
    // calidad baja: los caminos y los avisos se tienen que seguir leyendo
    if (!v.sufijo) {
      await abrirMundo(page, 'sophie', '&calidad=baja')
      await gancho(page, 'irAMundo', 'mundo2')
      await esperarEscena(page, 'Bajada')
      await esperarEscena(page, 'Mundo')
      await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.mundoActual === 'function' }, null, { timeout: 120_000 })
      await gancho(page, 'irAPostal', 'atrio_luciernagas')
      await gancho(page, 'avanzar', 1.5)
      await page.waitForTimeout(3000)
      await page.screenshot({ path: join(dir, `atrio_calidad_baja.png`) })
    }
    await sinErrores(errores)
    await ctx.close()
  }
})

/** F8: el Guardián de la Campana: la entrada, la onda (el anillo con el centro seguro), las raíces y la liberación */
test('captura al Guardián de la Campana y la Catedral liberada', async ({ browser }) => {
  test.setTimeout(400_000)
  const dir = join('docs', 'capturas', 'f8')
  mkdirSync(dir, { recursive: true })
  const vistas = [
    { sufijo: '', ctx: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
    { sufijo: '_tablet', ctx: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
  ]
  type J = { fase: number; vida: number; vidaMax: number; avisos: { ataque: string; resta: number; total: number }[] }
  for (const v of vistas) {
    const ctx = await browser.newContext(v.ctx)
    const page = await ctx.newPage()
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'irAMundo', 'mundo2')
    await esperarEscena(page, 'Bajada')
    await esperarEscena(page, 'Mundo')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.mundoActual === 'function' }, null, { timeout: 120_000 })
    await gancho(page, 'darBrasas', 3)
    await gancho(page, 'ponerNivel', 10)
    await gancho(page, 'avanzar', 0.5)
    await gancho(page, 'irAPostal', 'campanario_invertido')
    await gancho(page, 'avanzar', 1)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: join(dir, `campanario${v.sufijo}.png`) })
    await gancho(page, 'entrarArena')
    await gancho(page, 'avanzar', 1)
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(dir, `campana_entrada${v.sufijo}.png`) })
    await gancho(page, 'avanzar', 3)
    // se espera un aviso a la mitad para cada patrón
    const capturar = async (ataque: string, archivo: string) => {
      for (let t = 0; t < 30; t += 0.1) {
        await gancho(page, 'curarTodo')
        await gancho(page, 'avanzar', 0.1)
        const a = (await gancho<J>(page, 'jefe')).avisos.find((q) => q.ataque === ataque)
        if (a && a.resta < a.total * 0.55) break
      }
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(dir, `${archivo}${v.sufijo}.png`) })
    }
    await capturar('golpe_fuerte', 'campana_golpe')
    const j = await gancho<J>(page, 'jefe')
    await gancho(page, 'danarJefe', j.vida - j.vidaMax * 0.5)
    await capturar('onda', 'campana_onda')
    const j2 = await gancho<J>(page, 'jefe')
    await gancho(page, 'danarJefe', j2.vida - j2.vidaMax * 0.3)
    await capturar('raices', 'campana_raices')
    await gancho(page, 'danarJefe', 9999)
    for (let i = 0; i < 8; i++) await gancho(page, 'avanzar', 1)
    await page.waitForTimeout(8000)
    await page.screenshot({ path: join(dir, `campana_libre${v.sufijo}.png`) })
    await sinErrores(errores)
    await ctx.close()
  }
})
