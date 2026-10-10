import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, puntoPropioDeZona, sinErrores, vigilarErrores, type MapaInfo } from './util'

// F8, la rebanada del Mundo 2: la Catedral de las Raíces. La escalera hundida, el atrio de las luciérnagas y la entrada
// de los claustros con el primer guardián de cobre.

interface Mundo { id: string; nombre: string; partida: string; otros: string[]; zonas: string[]; jefe: boolean; portalVolver: { x: number; y: number } | null }
interface En { id: number; tipo: string; x: number; y: number; vida: number; vivo: boolean; estado: string }

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
  test('baja sin errores: su mapa, sus zonas, sin jefe todavía, y suena la catedral', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCatedral(page)
    const m = await mundo(page)
    expect(m.nombre).toBe('La Catedral de las Raíces')
    expect(m.jefe).toBe(false)
    for (const z of ['La Escalera Hundida', 'El Atrio de las Luciérnagas', 'Los Claustros Quebrados']) expect(m.zonas).toContain(z)
    // llega arriba de la escalera
    expect(await gancho<string | null>(page, 'zona')).toBe('La Escalera Hundida')
    await avanzar(page, 3)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toMatch(/musica_catedral|ambiente_catedral/)
    // el chip no manda a vencer a un jefe que no está
    await gancho(page, 'ponerNivel', 8)
    await expect.poll(async () => (await gancho<{ clave: string }>(page, 'hudObjetivo')).clave, { timeout: 10_000 }).toBe('explorar')
    await sinErrores(errores)
  })

  test('se baja la escalera y se llega caminando a cada zona; el refugio del atrio guarda y al volver sigue ahí', async ({ page }) => {
    test.setTimeout(240_000)
    await bajarALaCatedral(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    const mapa = await info(page)
    const ini = await pos(page)
    const usables = await gancho<{ tipo: string; x: number; y: number }[]>(page, 'objetivos')
    for (const z of mapa.zonas) {
      let objetivo = puntoPropioDeZona(mapa, z.nombre)
      // tocar al lado del brasero lo usa (abre la tienda) en vez de caminar: el punto se corre
      if (usables.some((o) => Math.hypot(o.x - objetivo.x, o.y - objetivo.y) < 120)) objetivo = { x: objetivo.x - 200, y: objetivo.y + 40 }
      const meta = (await gancho<{ x: number; y: number } | null>(page, 'puntoCerca', objetivo.x, objetivo.y)) ?? objetivo
      await gancho(page, 'curarTodo')
      await gancho(page, 'tocar', meta.x, meta.y)
      await avanzar(page, 90, true)
      const p = await pos(page)
      expect(Math.hypot(p.x - meta.x, p.y - meta.y), `no llegó a ${z.nombre}`).toBeLessThan(12)
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
})
