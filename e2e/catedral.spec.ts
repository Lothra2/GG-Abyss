import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, puntoPropioDeZona, sinErrores, vigilarErrores, type MapaInfo } from './util'

// F8, la rebanada del Mundo 2: la Catedral de las Raíces. La escalera hundida, el atrio de las luciérnagas y la entrada
// de los claustros con el primer guardián de cobre.

interface Mundo { id: string; nombre: string; partida: string; otros: string[]; zonas: string[]; jefe: boolean; portalVolver: { x: number; y: number } | null; peligroAgua: { x: number; y: number }[]; caidasAgua: number }
interface En { id: number; tipo: string; x: number; y: number; vida: number; vivo: boolean; estado: string; distraida?: boolean }

const mundo = (p: Page) => gancho<Mundo>(p, 'mundoActual')
const info = (p: Page) => gancho<MapaInfo>(p, 'mapa')
const avanzar = (p: Page, s: number, parar = false) => gancho(p, 'avanzar', s, parar)
const pos = (p: Page) => gancho<{ x: number; y: number }>(p, 'pos')

async function listo(page: Page): Promise<void> {
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.mundoActual === 'function' }, null, { timeout: 120_000 })
}

/** Abre una partida y baja a la Catedral */
export async function bajarALaCatedral(page: Page, heroe = 'rick', extra = ''): Promise<void> {
  await abrirMundo(page, heroe, extra)
  await gancho(page, 'irAMundo', 'mundo2')
  await esperarEscena(page, 'Bajada')
  await listo(page)
  await expect.poll(async () => (await mundo(page)).id, { timeout: 30_000 }).toBe('mundo2')
}

test.describe('La Catedral de las Raíces', () => {
  test('baja sin errores: su mapa, sus zonas, su jefe, y suena la catedral', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCatedral(page)
    const m = await mundo(page)
    expect(m.nombre).toBe('La Catedral de las Raíces')
    // el Guardián de la Campana espera en el campanario
    expect(m.jefe).toBe(true)
    for (const z of ['La Escalera Hundida', 'El Atrio de las Luciérnagas', 'Los Claustros Quebrados']) expect(m.zonas).toContain(z)
    // llega arriba de la escalera
    expect(await gancho<string | null>(page, 'zona')).toBe('La Escalera Hundida')
    await avanzar(page, 3)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toMatch(/musica_catedral|ambiente_catedral/)
    // el objetivo de la Catedral son las brasas, aunque tenga nivel para el jefe
    await gancho(page, 'ponerNivel', 8)
    await expect.poll(async () => (await gancho<{ clave: string }>(page, 'hudObjetivo')).clave, { timeout: 10_000 }).toBe('brasas')
    await sinErrores(errores)
  })

  test('se baja la escalera y se llega caminando a cada zona; el refugio del atrio guarda y al volver sigue ahí', async ({ page }) => {
    test.setTimeout(240_000)
    await bajarALaCatedral(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    // con las tres brasas están abiertas todas las compuertas (que se llegue sin ellas se prueba en la de las brasas)
    await gancho(page, 'darBrasas', 3)
    await gancho(page, 'ponerNivel', 10)
    await avanzar(page, 0.5)
    const mapa = await info(page)
    const ini = await pos(page)
    const usables = await gancho<{ tipo: string; x: number; y: number }[]>(page, 'objetivos')
    for (const z of mapa.zonas) {
      // tocar al lado de algo que se usa (brasero, cofre) lo usa en vez de caminar: se busca un punto libre de eso
      const base = puntoPropioDeZona(mapa, z.nombre)
      const zr = mapa.zonas.find((q) => q.nombre === z.nombre)!
      const candidatos = [[0, 0], [0, 64], [64, 0], [-64, 0], [0, -64], [-200, 40], [96, 96], [-96, 96], [0, -160], [0, 160]].map(([dx, dy]) => ({ x: base.x + dx!, y: base.y + dy! }))
      let objetivo = base
      for (const c of candidatos) {
        if (c.x < zr.x + 16 || c.y < zr.y + 16 || c.x > zr.x + zr.w - 16 || c.y > zr.y + zr.h - 16) continue
        // ni al lado de algo que se usa ni en el agua (en la nave el centro es el río)
        if (usables.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 80)) continue
        if ((await gancho<string | null>(page, 'superficieEn', c.x, c.y)) === 'agua') continue
        objetivo = c
        break
      }
      const meta = (await gancho<{ x: number; y: number } | null>(page, 'puntoCerca', objetivo.x, objetivo.y)) ?? objetivo
      await gancho(page, 'curarTodo')
      await gancho(page, 'tocar', meta.x, meta.y)
      await avanzar(page, 90, true)
      // entrar al campanario despierta al guardián y cierra la salida: se lo libera y se sigue
      if ((await gancho<{ peleando?: boolean }>(page, 'jefe')).peleando) {
        await gancho(page, 'danarJefe', 9999)
        await avanzar(page, 6, true)
        await gancho(page, 'tocar', meta.x, meta.y)
        await avanzar(page, 60, true)
      }
      const p = await pos(page)
      // en las orillas angostas de la nave el destino exacto puede no caberle: llega al centro del cuadro firme de al lado
      expect(Math.hypot(p.x - meta.x, p.y - meta.y), `no llegó a ${z.nombre}`).toBeLessThan(20)
      expect(await gancho<string | null>(page, 'zona')).toBe(z.nombre)
    }
    // bajó: el atrio está más abajo que la llegada
    const atrio = mapa.zonas.find((z) => z.nombre === 'El Atrio de las Luciérnagas')!
    expect(atrio.y).toBeGreaterThan(ini.y)
    // el brasero del atrio es fogata: guarda y abre la tienda
    const f = (await gancho<{ tipo: string; llave: string; parada: { x: number; y: number } }[]>(page, 'objetivos')).find((o) => o.tipo === 'fogata')!
    expect(f).toBeTruthy()
    await gancho(page, 'teleport', f.parada.x, f.parada.y + 10)
    await gancho(page, 'usarObjetivo', f.llave)
    await avanzar(page, 1)
    await expect.poll(async () => (await gancho<{ ultimaFogata: string }>(page, 'estado')).ultimaFogata, { timeout: 10_000 }).toBe('atrio')
    if ((await gancho<string[]>(page, 'escenasActivas')).includes('Tienda')) await gancho(page, 'cerrarTienda')
    await gancho(page, 'guardarAhora')
    // recargar: la partida sigue en la Catedral, con sus zonas
    await page.reload()
    await abrirMundo(page, 'sophie')
    await listo(page)
    const m = await mundo(page)
    expect(m.id).toBe('mundo2')
    expect((await gancho<{ zonas: string[] }>(page, 'estado')).zonas.length).toBeGreaterThanOrEqual(3)
  })

  test('el guardián de cobre avisa su golpe grande con tiempo y se esquiva saliéndose', async ({ page }) => {
    await bajarALaCatedral(page, 'sophie')
    const g = (await gancho<En[]>(page, 'enemigos')).find((e) => e.tipo === 'guardian_cobre')!
    expect(g).toBeTruthy()
    await gancho(page, 'teleport', g.x - 40, g.y)
    await gancho(page, 'curarTodo')
    let tAviso = 0
    let vio = false
    let salio = false
    const vida0 = (await gancho<{ vida: number }>(page, 'combate')).vida
    for (let i = 0; i < 400; i++) {
      await avanzar(page, 0.05)
      const e = (await gancho<En[]>(page, 'enemigos')).find((q) => q.id === g.id)!
      if (e.estado === 'aviso') {
        vio = true
        tAviso += 0.05
        if (tAviso >= 0.5 && !salio) {
          await gancho(page, 'teleport', e.x - 150, e.y)
          salio = true
        }
      } else if (vio) break
    }
    expect(vio, 'el guardián avisó').toBe(true)
    // avisa más que el trol (1.2 s): hay tiempo para mirarlo
    expect(tAviso).toBeGreaterThan(1.2)
    expect((await gancho<{ vida: number }>(page, 'combate')).vida).toBeGreaterThan(vida0 - 9)
  })

  test('el vado de la nave: salirse de las losas es caer al agua y vuelve a la losa sin perder vida; tocar la otra orilla no la manda por el agua', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCatedral(page, 'alana')
    await gancho(page, 'matarEnemigos')
    const m = await mundo(page)
    expect(m.peligroAgua.length).toBeGreaterThanOrEqual(6)
    // las losas están en la columna del medio entre el agua de los dos lados
    const xs = [...new Set(m.peligroAgua.map((p) => p.x))].sort((a, b) => a - b)
    const losaX = (xs[0]! + xs[xs.length - 1]!) / 2
    const ys = m.peligroAgua.map((p) => p.y)
    const arriba = Math.min(...ys) - 32
    const abajo = Math.max(...ys) + 32
    // tocar la orilla de enfrente: cruza por las losas sin caerse
    await gancho(page, 'ponerHeroina', losaX, arriba)
    await avanzar(page, 0.2)
    await gancho(page, 'tocar', losaX, abajo + 20)
    await avanzar(page, 8, true)
    expect((await mundo(page)).caidasAgua).toBe(0)
    expect((await pos(page)).y).toBeGreaterThan(abajo - 8)
    // a mano, con el teclado, salirse de la losa hacia el agua
    await gancho(page, 'ponerHeroina', losaX, (arriba + abajo) / 2)
    await avanzar(page, 0.2)
    const vida0 = (await gancho<{ vida: number }>(page, 'combate')).vida
    await gancho(page, 'tecla', 1, 0)
    await avanzar(page, 0.6)
    await gancho(page, 'tecla', 0, 0)
    await avanzar(page, 1.2)
    expect((await mundo(page)).caidasAgua).toBe(1)
    const p = await pos(page)
    expect(Math.abs(p.x - losaX)).toBeLessThan(20)
    expect((await gancho<{ vida: number }>(page, 'combate')).vida).toBe(vida0)
    await sinErrores(errores)
  })

  test('la raicita persigue a Thor si anda cerca y a la heroína no le pega', async ({ page }) => {
    await bajarALaCatedral(page, 'sophie')
    const r = (await gancho<En[]>(page, 'enemigos')).find((e) => e.tipo === 'raicita')!
    expect(r).toBeTruthy()
    // la heroína a un costado y Thor justo al lado de la raicita
    await gancho(page, 'teleport', r.x - 120, r.y)
    await gancho(page, 'curarTodo')
    const vida0 = (await gancho<{ vida: number }>(page, 'combate')).vida
    let distraida = false
    for (let i = 0; i < 40 && !distraida; i++) {
      await page.evaluate(([x, y]) => (window as unknown as { __JUEGO__: { scene: { getScene: (k: string) => { thor: { teleport: (a: number, b: number) => void } } } } }).__JUEGO__.scene.getScene('Mundo').thor.teleport(x!, y!), [r.x + 20, r.y + 4] as const)
      await avanzar(page, 0.1)
      distraida = !!(await gancho<En[]>(page, 'enemigos')).find((e) => e.id === r.id)!.distraida
    }
    expect(distraida, 'la raicita se distrajo con Thor').toBe(true)
    expect((await gancho<{ vida: number }>(page, 'combate')).vida).toBe(vida0)
  })

  test('el vigía de las raíces tira su bola violeta desde lejos', async ({ page }) => {
    await bajarALaCatedral(page, 'rick')
    const v = (await gancho<En[]>(page, 'enemigos')).find((e) => e.tipo === 'vigia_raices')!
    expect(v).toBeTruthy()
    await gancho(page, 'teleport', v.x - 170, v.y)
    let tiro = false
    for (let i = 0; i < 80 && !tiro; i++) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.1)
      tiro = (await gancho<number>(page, 'proyectilesActivos')) > 0
    }
    expect(tiro).toBe(true)
  })

  test('las tres brasas: cada una prende braseros, abre una compuerta de raíces y la forja se enciende con la tercera; queda guardado', async ({ page }) => {
    test.setTimeout(240_000)
    const errores = vigilarErrores(page)
    await bajarALaCatedral(page, 'alana')
    await gancho(page, 'matarEnemigos')
    type Mec = { brasas: number; total: number; pedestal: string; forja: string; braseros: { requiere: number; encendido: boolean }[]; compuertas: { id: string; abierta: boolean }[]; piezas: { id: string; x: number; y: number; recogida: boolean }[] }
    const mec = () => gancho<Mec>(page, 'mecanismos')
    const m0 = await mec()
    expect(m0.total).toBe(3)
    expect(m0.forja).toBe('forja_0')
    expect(m0.compuertas.every((c) => !c.abierta)).toBe(true)
    expect(m0.braseros.every((b) => !b.encendido)).toBe(true)
    await expect.poll(async () => (await gancho<{ clave: string; texto: string }>(page, 'hudObjetivo')).texto, { timeout: 10_000 }).toBe('Brasas 0/3')
    const pieza = (id: string) => m0.piezas.find((b) => b.id === id)!
    // con todo cerrado no se llega caminando a la brasa de la forja
    await gancho(page, 'ponerHeroina', pieza('nave').x - 40, pieza('nave').y)
    await avanzar(page, 0.2)
    await gancho(page, 'tocar', pieza('forja').x, pieza('forja').y + 30)
    await avanzar(page, 40, true)
    expect(Math.hypot((await pos(page)).x - pieza('forja').x, (await pos(page)).y - pieza('forja').y)).toBeGreaterThan(200)
    // la brasa de la nave: el pedestal y los braseros del atrio se prenden y se abre la compuerta de la forja
    await gancho(page, 'ponerHeroina', pieza('nave').x, pieza('nave').y)
    await avanzar(page, 0.3)
    let m = await mec()
    expect(m.brasas).toBe(1)
    expect(m.pedestal).toBe('pedestal_brasas_1')
    expect(m.forja).toBe('forja_1')
    expect(m.compuertas.find((c) => c.id === 'nave_forja')!.abierta).toBe(true)
    expect(m.compuertas.find((c) => c.id === 'atajo')!.abierta).toBe(false)
    expect(m.braseros.filter((b) => b.requiere === 1).every((b) => b.encendido)).toBe(true)
    // ahora sí se llega caminando a la forja
    await gancho(page, 'tocar', pieza('forja').x, pieza('forja').y)
    await avanzar(page, 60, true)
    m = await mec()
    expect(m.brasas, 'llegó caminando a la brasa de la forja').toBe(2)
    expect(m.compuertas.find((c) => c.id === 'atajo')!.abierta).toBe(true)
    // la del claustro: la tercera enciende la forja y abre el camino al campanario
    await gancho(page, 'ponerHeroina', pieza('claustro').x, pieza('claustro').y)
    await avanzar(page, 0.3)
    m = await mec()
    expect(m.brasas).toBe(3)
    expect(m.forja).toBe('forja_3')
    expect(m.compuertas.every((c) => c.abierta)).toBe(true)
    expect(m.braseros.every((b) => b.encendido)).toBe(true)
    // con las tres se llega caminando al campanario y el guardián despierta
    const arena = (await gancho<{ arena: { x: number; y: number } }>(page, 'jefe')).arena
    await gancho(page, 'ponerNivel', 8)
    await gancho(page, 'tocar', arena.x, arena.y)
    await avanzar(page, 60, true)
    await expect.poll(async () => (await gancho<{ peleando: boolean }>(page, 'jefe')).peleando, { timeout: 20_000 }).toBe(true)
    await gancho(page, 'danarJefe', 9999)
    await avanzar(page, 1)
    // guardado: al volver sigue todo encendido y abierto
    await gancho(page, 'guardarAhora')
    await page.reload()
    await abrirMundo(page, 'alana')
    await listo(page)
    m = await mec()
    expect(m.brasas).toBe(3)
    expect(m.forja).toBe('forja_3')
    expect(m.compuertas.every((c) => c.abierta)).toBe(true)
    await sinErrores(errores)
  })

  test('el Guardián de la Campana: enseña sus tres patrones de a uno, se libera, la catedral se aclara y la bajada sigue', async ({ page }) => {
    test.setTimeout(240_000)
    const errores = vigilarErrores(page)
    await bajarALaCatedral(page, 'rick')
    await gancho(page, 'darBrasas', 3)
    await gancho(page, 'ponerNivel', 10)
    await avanzar(page, 0.5)
    expect((await gancho<{ jefeTipo: string | null }>(page, 'mundoActual')).jefeTipo).toBe('guardian_campana')
    type J = { peleando: boolean; vencido: boolean; fase: number; vida: number; vidaMax: number; avisos: { ataque: string; forma: string }[] }
    const jefe = () => gancho<J>(page, 'jefe')
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await jefe()).peleando, { timeout: 20_000 }).toBe(true)
    const vistos = async (seg: number) => {
      const s = new Set<string>()
      for (let t = 0; t < seg; t += 0.1) {
        await gancho(page, 'curarTodo')
        await avanzar(page, 0.1)
        for (const a of (await jefe()).avisos) s.add(a.ataque)
      }
      return s
    }
    // fase 1: solo el golpe frontal anunciado
    const f1 = await vistos(14)
    expect(f1.has('golpe_fuerte'), 'en la fase 1 usa el golpe frontal').toBe(true)
    expect(f1.has('onda') || f1.has('raices')).toBe(false)
    // fase 2: lo primero que hace es la onda (sola), con el anillo en el piso
    const j1 = await jefe()
    await gancho(page, 'danarJefe', j1.vida - j1.vidaMax * 0.5)
    await expect.poll(async () => (await jefe()).fase, { timeout: 5_000 }).toBe(2)
    let primero = ''
    for (let t = 0; t < 12 && !primero; t += 0.1) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.1)
      primero = (await jefe()).avisos[0]?.ataque ?? ''
    }
    expect(primero).toBe('onda')
    expect((await jefe()).avisos[0]!.forma).toBe('anillo')
    // con poca vida, la llamada de raíces se enseña sola
    await vistos(3)
    const j2 = await jefe()
    await gancho(page, 'danarJefe', j2.vida - j2.vidaMax * 0.3)
    primero = ''
    for (let t = 0; t < 14 && !primero; t += 0.1) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.1)
      const a = (await jefe()).avisos[0]?.ataque ?? ''
      if (a && a !== 'onda' && a !== 'golpe_fuerte') primero = a
    }
    expect(primero).toBe('raices')
    // se libera: la campana turquesa y la catedral más clara
    await gancho(page, 'danarJefe', 9999)
    await expect.poll(async () => (await jefe()).vencido, { timeout: 10_000 }).toBe(true)
    await expect.poll(async () => (await gancho<{ campana: string }>(page, 'mecanismos')).campana, { timeout: 10_000 }).toBe('campana_libre')
    for (let i = 0; i < 8; i++) await avanzar(page, 1)
    expect((await gancho<{ aclarado: number }>(page, 'mundoActual')).aclarado).toBeLessThan(0.6)
    // la bajada más honda: el kit no trae el mundo 3, el portal lleva a Continuará
    // el portal se abre después de la cámara lenta de la victoria (en tiempo real: en el Chromium sin GPU tarda)
    await expect.poll(async () => (await gancho<{ portal: boolean }>(page, 'jefe')).portal, { timeout: 60_000 }).toBe(true)
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Continuara')
    await sinErrores(errores)
  })
})
