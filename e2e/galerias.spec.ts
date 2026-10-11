import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// F11, el Mundo 3: Las Galerías del Eco. La luz es el progreso: los cristales se prenden al pegarles y quedan
// prendidos, la polilla de ceniza los apaga, la sombra solo se ve en la luz y la Polilla Reina solo cae con los
// cuatro cristales grandes prendidos. Se lee todo del mapa: cuántos cristales y dónde lo decide el taller.

interface Gal {
  cristales: number
  prendidos: number
  avance: number
  grandes: { id: string; x: number; y: number; prendido: boolean }[]
  reinaVulnerable: boolean
  figura: string | null
  carrito: { x: number; y: number; rodando: boolean; enFin: boolean } | null
  mural: boolean | null
  viajando: boolean
  sombras: { x: number; y: number; oculta: boolean }[]
}
interface En { id: number; tipo: string; x: number; y: number; vivo: boolean; estado: string }
interface Obj { tipo: string; x: number; y: number; llave: string }

const gal = (p: Page) => gancho<Gal>(p, 'galerias')
const avanzar = (p: Page, s: number, parar = false) => gancho(p, 'avanzar', s, parar)

async function listo(page: Page): Promise<void> {
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.galerias === 'function' }, null, { timeout: 120_000 })
}

async function bajarALasGalerias(page: Page, heroe = 'rick'): Promise<void> {
  await abrirMundo(page, heroe)
  await gancho(page, 'irAMundo', 'mundo3')
  await esperarEscena(page, 'Bajada')
  await listo(page)
  await expect.poll(async () => (await gancho<{ id: string }>(page, 'mundoActual')).id, { timeout: 30_000 }).toBe('mundo3')
}

/** Los cristales apagados del mapa, del más cercano al más lejano de (x, y) */
async function cristalesCerca(page: Page, x: number, y: number): Promise<Obj[]> {
  const os = (await gancho<Obj[]>(page, 'objetivos')).filter((o) => o.tipo === 'cristal')
  return os.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
}

test.describe('Las Galerías del Eco', () => {
  test('baja sin errores: el mapa, los cristales apagados, la reina y suena la mina', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALasGalerias(page)
    const m = await gancho<{ nombre: string; zonas: string[]; jefe: boolean; jefeTipo: string }>(page, 'mundoActual')
    expect(m.nombre).toBe('Las Galerías del Eco')
    expect(m.jefe).toBe(true)
    expect(m.jefeTipo).toBe('polilla_reina')
    expect(m.zonas.length).toBeGreaterThanOrEqual(7)
    const g = await gal(page)
    expect(g.cristales).toBeGreaterThanOrEqual(10)
    expect(g.prendidos).toBe(0)
    expect(g.grandes.length).toBeGreaterThanOrEqual(4)
    expect(g.reinaVulnerable).toBe(false)
    // piso 3: más oscuro que lo de arriba y Thor brilla
    expect((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad).toBeGreaterThan(0.6)
    await avanzar(page, 3)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toMatch(/musica_galerias|ambiente_galerias|ambiente_eco/)
    await sinErrores(errores)
  })

  test('tocar un cristal lo prende con un golpe, alumbra y queda prendido en la partida', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALasGalerias(page, 'alana')
    await gancho(page, 'matarEnemigos')
    const ini = await gancho<{ x: number; y: number }>(page, 'pos')
    const c = (await cristalesCerca(page, ini.x, ini.y))[0]!
    const luces0 = (await gancho<{ luces: number }>(page, 'atmosfera')).luces
    await gancho(page, 'usarObjetivo', c.llave)
    await expect.poll(async () => (await gal(page)).prendidos, { timeout: 30_000 }).toBe(1)
    await avanzar(page, 0.5)
    expect((await gancho<{ luces: number }>(page, 'atmosfera')).luces).toBeGreaterThan(luces0)
    await gancho(page, 'guardarAhora')
    const est = await gancho<{ cristales: string[] }>(page, 'estado')
    expect(est.cristales).toHaveLength(1)
    // ya prendido no se vuelve a ofrecer para usar
    expect((await gancho<Obj[]>(page, 'objetivos')).some((o) => o.llave === c.llave)).toBe(false)
    await sinErrores(errores)
  })

  test('la polilla de ceniza va a apagar el cristal prendido que ve', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALasGalerias(page)
    // cada polilla con su cristal más cercano: alguna lo ve sin roca en el medio (el taller decide dónde van)
    const polillas = (await gancho<En[]>(page, 'enemigos')).filter((e) => e.tipo === 'polilla_ceniza' && e.vivo)
    test.skip(polillas.length === 0, 'el mapa no trae polillas')
    const pares = await Promise.all(polillas.map(async (p) => ({ p, c: (await cristalesCerca(page, p.x, p.y))[0]! })))
    pares.sort((a, b) => Math.hypot(a.c.x - a.p.x, a.c.y - a.p.y) - Math.hypot(b.c.x - b.p.x, b.c.y - b.p.y))
    let apago = 0
    for (const { p, c } of pares) {
      const id = c.llave.replace('cristal:', '')
      await gancho(page, 'prenderCristal', id)
      expect((await gal(page)).prendidos).toBe(1)
      // la heroína lejos, para que la polilla no se distraiga peleando
      await gancho(page, 'teleport', p.x - 600, p.y)
      for (let s = 0; s < 6 && (await gal(page)).prendidos > 0; s++) await avanzar(page, 1)
      if ((await gal(page)).prendidos === 0) apago++
      else await gancho(page, 'apagarCristal', id)
    }
    expect(apago).toBeGreaterThanOrEqual(1)
    await sinErrores(errores)
  })

  test('la sombra a oscuras no se ve ni se le pega; con un cristal prendido al lado aparece', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALasGalerias(page)
    const g = await gal(page)
    test.skip(g.sombras.length === 0, 'el mapa no trae sombras')
    const s = g.sombras[0]!
    expect(s.oculta).toBe(true)
    // lejos de Thor: su brillo también la alumbraría
    await gancho(page, 'teleport', s.x - 500, s.y)
    await avanzar(page, 0.3)
    expect((await gal(page)).sombras[0]!.oculta).toBe(true)
    const c = (await cristalesCerca(page, s.x, s.y))[0]!
    expect(Math.hypot(c.x - s.x, c.y - s.y)).toBeLessThan(400)
    await gancho(page, 'prenderCristal', c.llave.replace('cristal:', ''))
    // la sombra camina; se la deja quieta llevándola a la luz: se la busca donde está y se le prende el más cercano
    await expect.poll(async () => {
      const gg = await gal(page)
      const ss = gg.sombras[0]!
      if (ss.oculta) {
        const cc = (await cristalesCerca(page, ss.x, ss.y))[0]
        if (cc) await gancho(page, 'prenderCristal', cc.llave.replace('cristal:', ''))
      }
      await avanzar(page, 0.4)
      return (await gal(page)).sombras.some((q) => !q.oculta)
    }, { timeout: 60_000 }).toBe(true)
    await sinErrores(errores)
  })

  test('el carrito lleva a la heroína por la vía y Thor llega con ella', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALasGalerias(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    const g = await gal(page)
    test.skip(!g.carrito, 'el mapa no trae carrito')
    const c0 = g.carrito!
    await gancho(page, 'teleport', c0.x + 40, c0.y + 20)
    await avanzar(page, 0.3)
    await gancho(page, 'usarObjetivo', 'carrito')
    await expect.poll(async () => (await gal(page)).viajando, { timeout: 20_000 }).toBe(true)
    await expect.poll(async () => (await gal(page)).viajando, { timeout: 60_000 }).toBe(false)
    const c1 = (await gal(page)).carrito!
    expect(c1.enFin).toBe(true)
    expect(Math.hypot(c1.x - c0.x, c1.y - c0.y)).toBeGreaterThan(200)
    const pos = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(pos.x - c1.x, pos.y - c1.y)).toBeLessThan(120)
    const thor = await gancho<{ x: number; y: number }>(page, 'thor')
    expect(Math.hypot(thor.x - pos.x, thor.y - pos.y)).toBeLessThan(160)
    await sinErrores(errores)
  })

  test('la Polilla Reina: con los cristales grandes apagados el golpe rebota; prenderlos la tumba y se le pega', async ({ page }) => {
    test.setTimeout(180_000)
    const errores = vigilarErrores(page)
    await bajarALasGalerias(page)
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'ponerNivel', 12)
    await gancho(page, 'curarTodo')
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await gancho<{ peleando: boolean }>(page, 'jefe')).peleando, { timeout: 30_000 }).toBe(true)
    await avanzar(page, 3)
    const j0 = await gancho<{ vida: number; vidaMax: number }>(page, 'jefe')
    await gancho(page, 'danarJefe', 50)
    expect((await gancho<{ vida: number }>(page, 'jefe')).vida).toBe(j0.vida)
    for (const gr of (await gal(page)).grandes) await gancho(page, 'prenderCristal', gr.id)
    expect(await gancho<boolean>(page, 'jefeVulnerable')).toBe(true)
    await gancho(page, 'curarTodo')
    await avanzar(page, 0.3)
    expect((await gancho<{ estado: string }>(page, 'jefe')).estado).toBe('aturdido')
    await gancho(page, 'danarJefe', 50)
    expect((await gancho<{ vida: number }>(page, 'jefe')).vida).toBe(j0.vida - 50)
    // vencida, su portal baja más hondo: el kit todavía no trae el Mundo 4, así que Continuará
    await gancho(page, 'danarJefe', 9999)
    await expect.poll(async () => (await gancho<{ vencido: boolean }>(page, 'jefe')).vencido, { timeout: 10_000 }).toBe(true)
    await expect.poll(async () => (await gancho<{ portal: boolean }>(page, 'jefe')).portal, { timeout: 60_000 }).toBe(true)
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Continuara')
    await sinErrores(errores)
  })
})
