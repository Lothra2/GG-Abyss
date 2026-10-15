import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, esperarEscenaSaltandoCine, gancho, manifest, sinErrores, vigilarErrores } from './util'

// F13, el Mundo 7: El Corazón Helado. El frío sube a oscuras y baja en la hoguera, la ventisca avisa y empuja (detrás
// de una columna o un gigante no llega), las sombras se comen las luces compañeras, la arena se abre al vencer al
// Guardián de la Puerta y el Diablo pasa por sus cinco fases. Todo se lee del mapa. Si el kit todavía no trae al Diablo,
// el mundo no se juega y estas pruebas se saltan.

interface Cz {
  frio: number
  congelada: boolean
  ventisca: { fase: string; dx: number; dy: number }
  alcanzada: boolean
  refugios: { x: number; y: number }[]
  hogueras: { x: number; y: number }[]
  hielos: { x: number; y: number; w: number; h: number; estado: string }[]
  companeras: { max: number; vivas: number }
  braseros: { x: number; y: number; estado: string }[]
  halo: number
}
interface Jefe { estado: string; fase: number; vida: number; vidaMax: number; peleando: boolean; vencido: boolean; portal: boolean; blindado: boolean; x: number; y: number; avisos: { ataque: string }[] }

const cz = (p: Page) => gancho<Cz>(p, 'corazon')
const avanzar = (p: Page, s: number) => gancho(p, 'avanzar', s)
const jefe = (p: Page) => gancho<Jefe>(p, 'jefe')

async function bajarAlCorazon(page: Page): Promise<boolean> {
  await abrirMundo(page, 'sophie')
  const m = await manifest(page)
  if (!(m.mundos ?? []).some((q) => q.id === 'mundo7') || !m.personajes.diablo) return false
  await gancho(page, 'irAMundo', 'mundo7')
  // la primera vez pasa por la cinemática de la bajada (si el kit la trae), se salta y sigue
  await esperarEscenaSaltandoCine(page, 'Bajada')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return a.escena!() === 'Mundo' && typeof a.noEsperar === 'function' && a.noEsperar() === true && !!a.corazon?.() }, null, { timeout: 180_000 })
  await gancho(page, 'saltarPresentacion')
  return true
}

test.describe('El Corazón Helado', () => {
  test('baja sin errores: frío, refugios, hogueras, hielo fino, cinco compañeras y la llave en el Guardián', async ({ page }) => {
    const errores = vigilarErrores(page)
    test.skip(!(await bajarAlCorazon(page)), 'el kit todavía no trae el Mundo 7 con el Diablo')
    const c = await cz(page)
    expect(c.refugios.length).toBeGreaterThanOrEqual(8)
    expect(c.hogueras.length).toBeGreaterThanOrEqual(3)
    expect(c.hielos.length).toBeGreaterThanOrEqual(1)
    expect(c.braseros.length).toBe(4)
    expect(c.companeras.vivas).toBe(c.companeras.max)
    expect((await gancho<{ llave: { nombre: string } | null; sellada: boolean }>(page, 'llave')).sellada).toBe(true)
    await sinErrores(errores)
  })

  test('a oscuras se enfría, congelada pierde vida, y la hoguera la calienta y le devuelve las compañeras', async ({ page }) => {
    const errores = vigilarErrores(page)
    test.skip(!(await bajarAlCorazon(page)), 'el kit todavía no trae el Mundo 7 con el Diablo')
    await gancho(page, 'ponerNivel', 12)
    await gancho(page, 'matarEnemigos')
    expect(await gancho<boolean>(page, 'devorarLuz')).toBe(true)
    expect((await cz(page)).companeras.vivas).toBe((await cz(page)).companeras.max - 1)
    // las compañeras la abrigan: sin ninguna y lejos de las hogueras, el frío sube
    while (await gancho<boolean>(page, 'devorarLuz'));
    expect((await cz(page)).companeras.vivas).toBe(0)
    const c = await cz(page)
    const lejos = c.refugios.map((r) => ({ ...r, d: Math.min(...c.hogueras.map((h) => Math.hypot(h.x - r.x, h.y - r.y))) })).sort((a, b) => b.d - a.d)[0]!
    await gancho(page, 'ponerHeroina', lejos.x, lejos.y + 50)
    await gancho(page, 'frioA', 99)
    await avanzar(page, 3)
    expect((await cz(page)).congelada).toBe(true)
    const v0 = (await gancho<{ vida: number }>(page, 'combate')).vida
    await avanzar(page, 4.5)
    expect((await gancho<{ vida: number }>(page, 'combate')).vida).toBeLessThan(v0)
    const h = (await cz(page)).hogueras[0]!
    await gancho(page, 'teleport', h.x + 40, h.y + 30)
    await expect.poll(async () => { await avanzar(page, 0.5); return (await cz(page)).congelada }, { timeout: 30_000 }).toBe(false)
    // al guardar en la hoguera vuelven todas
    const fogatas = (await gancho<{ tipo: string; llave: string; parada: { x: number; y: number } }[]>(page, 'objetivos')).filter((o) => o.tipo === 'fogata')
    const f = fogatas.sort((a, b) => Math.hypot(a.parada.x - h.x, a.parada.y - h.y) - Math.hypot(b.parada.x - h.x, b.parada.y - h.y))[0]!
    // se para al lado de la fogata (la que queda más cerca de la hoguera puede estar lejos y la caminata no es lo que se prueba)
    await gancho(page, 'teleport', f.parada.x, f.parada.y)
    await gancho(page, 'usarObjetivo', f.llave)
    await expect.poll(async () => { await avanzar(page, 0.3); return (await cz(page)).companeras.vivas }, { timeout: 40_000 }).toBe(c.companeras.max)
    await sinErrores(errores)
  })

  test('la ventisca avisa, sopla y achica la luz; detrás de un refugio no llega', async ({ page }) => {
    const errores = vigilarErrores(page)
    test.skip(!(await bajarAlCorazon(page)), 'el kit todavía no trae el Mundo 7 con el Diablo')
    await gancho(page, 'matarEnemigos')
    const r = (await cz(page)).refugios[0]!
    // a barlovento (del lado de donde viene el viento) le llega
    await gancho(page, 'ponerHeroina', r.x - 80, r.y + 4)
    await gancho(page, 'ventisca', 'sopla', 1, 0)
    await avanzar(page, 0.2)
    const a = await cz(page)
    expect(a.ventisca.fase).toBe('sopla')
    expect(a.alcanzada).toBe(true)
    // a sotavento (detrás del refugio) no
    await gancho(page, 'ponerHeroina', r.x + 40, r.y + 4)
    await gancho(page, 'ventisca', 'sopla', 1, 0)
    await avanzar(page, 0.1)
    expect((await cz(page)).alcanzada).toBe(false)
    await sinErrores(errores)
  })

  test('el Diablo: sellado hasta el Guardián, cinco fases (rayo, braseros, jaula) y al caer se abre el final', async ({ page }) => {
    test.setTimeout(400_000)
    const errores = vigilarErrores(page)
    test.skip(!(await bajarAlCorazon(page)), 'el kit todavía no trae el Mundo 7 con el Diablo')
    await gancho(page, 'ponerNivel', 20)
    await gancho(page, 'matarEnemigos')
    expect((await gancho<{ sellada: boolean }>(page, 'llave')).sellada).toBe(false)
    await gancho(page, 'curarTodo')
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await jefe(page)).peleando, { timeout: 30_000 }).toBe(true)
    const j0 = await jefe(page)
    // fase 2: el rayo que gira
    await gancho(page, 'danarJefe', j0.vidaMax * 0.27)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.2); return (await jefe(page)).fase }, { timeout: 20_000 }).toBe(2)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.2); return (await jefe(page)).avisos.map((x) => x.ataque).join(',') }, { timeout: 60_000 }).toContain('rayo')
    // fase 3: la oscuridad, blindado hasta prender los cuatro braseros
    await gancho(page, 'danarJefe', j0.vidaMax * 0.26)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.2); return (await jefe(page)).fase }, { timeout: 20_000 }).toBe(3)
    await expect.poll(async () => { await avanzar(page, 0.2); return (await jefe(page)).blindado }, { timeout: 20_000 }).toBe(true)
    for (let i = 0; i < 4; i++) await gancho(page, 'prenderBrasero', i)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.2); return (await jefe(page)).estado }, { timeout: 30_000 }).toBe('aturdido')
    // fase 4 y 5, y cae
    await gancho(page, 'danarJefe', j0.vidaMax * 0.25)
    await avanzar(page, 0.5)
    expect((await jefe(page)).fase).toBeGreaterThanOrEqual(4)
    for (let k = 0; k < 120 && !(await jefe(page)).vencido; k++) {
      const j = await jefe(page)
      if (j.blindado) for (let i = 0; i < 4; i++) await gancho(page, 'prenderBrasero', i)
      else await gancho(page, 'danarJefe', 99999)
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.3)
    }
    expect((await jefe(page)).vencido).toBe(true)
    await expect.poll(async () => (await jefe(page)).portal, { timeout: 60_000 }).toBe(true)
    // el portal del Diablo lleva al final (la cinemática del cierre si el kit la trae, y la pantalla de las alas)
    await gancho(page, 'irAlPortal')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => string>; return a.escena!() === 'Cine' || a.escena!() === 'Continuara' }, null, { timeout: 60_000 })
    if ((await page.evaluate(() => (window.__ABYSS__ as unknown as Record<string, () => string>).escena!())) === 'Cine') await gancho(page, 'saltarCine')
    await esperarEscena(page, 'Continuara')
    expect((await gancho<{ final: boolean }>(page, 'continuara')).final).toBe(true)
    await sinErrores(errores)
  })
})
