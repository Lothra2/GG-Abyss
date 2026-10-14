import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// F12, el Mundo 5: La Ciudad Dormida. La luz te la roban: el farol de plaza aclara su barrio, la Ladrona le chupa la
// luz (si llegas antes se va), la luz robada se rompe en chispas que Thor rastrea, los sonámbulos solo se mueven a
// oscuras y el Rey de Piedra se blinda a oscuras hasta que las chispas de su corona vuelven a prender las lámparas.
// Todo se lee del mapa: cuántos faroles y dónde lo decide el taller.

interface Farol { id: string; x: number; y: number; barrio: string | null; estado: string; chispas: { x: number; y: number }[]; oscuridad: number | null }
interface Cdd {
  faroles: Farol[]
  ladrona: { x: number; y: number; barrio: string; resta: number; yendo: boolean } | null
  lamparas: { id: string; x: number; y: number; prendida: boolean }[]
  chispasJefe: { x: number; y: number }[]
  despierta: boolean
  robos: number
}
interface En { id: number; tipo: string; x: number; y: number; vida: number; vivo: boolean; estado: string; elite: boolean; nombre: string }
interface Jefe { blindado: boolean; estado: string; fase: number; vida: number; vidaMax: number; peleando: boolean; vencido: boolean; portal: boolean; x: number; y: number; avisos: { ataque: string; forma: string }[] }

const cdd = (p: Page) => gancho<Cdd>(p, 'ciudad')
const avanzar = (p: Page, s: number, parar = false) => gancho(p, 'avanzar', s, parar)
const enemigos = (p: Page) => gancho<En[]>(p, 'enemigos')

async function listo(page: Page): Promise<void> {
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.ciudad === 'function' && !!a.ciudad() }, null, { timeout: 120_000 })
}

async function bajarALaCiudad(page: Page, heroe = 'rick'): Promise<void> {
  await abrirMundo(page, heroe)
  await gancho(page, 'irAMundo', 'mundo5')
  await esperarEscena(page, 'Bajada')
  await listo(page)
  await expect.poll(async () => (await gancho<{ id: string }>(page, 'mundoActual')).id, { timeout: 30_000 }).toBe('mundo5')
}

/** Prende el farol de plaza que se le pida pasando al lado */
async function prenderFarol(page: Page, f: Farol): Promise<void> {
  await gancho(page, 'teleport', f.x + 24, f.y + 30)
  await expect.poll(async () => { await avanzar(page, 0.3); return (await cdd(page)).faroles.find((q) => q.id === f.id)!.estado }, { timeout: 20_000 }).toBe('prendido')
}

test.describe('La Ciudad Dormida', () => {
  test('baja sin errores: el mapa, los faroles de plaza apagados, el portal plata y casi sin música', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    const m = await gancho<{ nombre: string; zonas: string[]; jefe: boolean; jefeTipo: string }>(page, 'mundoActual')
    expect(m.nombre).toBe('La Ciudad Dormida')
    expect(m.jefeTipo).toBe('rey_de_piedra')
    expect(m.zonas.length).toBeGreaterThanOrEqual(8)
    const c = await cdd(page)
    expect(c.faroles.length).toBeGreaterThanOrEqual(5)
    expect(c.faroles.every((f) => f.estado === 'apagado')).toBe(true)
    expect(c.lamparas.length).toBeGreaterThanOrEqual(4)
    expect(c.despierta).toBe(false)
    // piso 5: más oscuro que el 4
    expect((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad).toBeGreaterThan(0.65)
    await avanzar(page, 3)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toMatch(/ambiente_ciudad|ambiente_cajita|ambiente_jardin/)
    await sinErrores(errores)
  })

  test('el farol de plaza se prende al pasar, aclara su barrio y queda guardado', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page, 'alana')
    await gancho(page, 'matarEnemigos')
    const f = (await cdd(page)).faroles[0]!
    const base = f.oscuridad!
    await prenderFarol(page, f)
    const g = (await cdd(page)).faroles.find((q) => q.id === f.id)!
    expect(g.oscuridad!).toBeLessThan(base)
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ faroles: string[] }>(page, 'estado')).faroles).toContain(f.id)
    await sinErrores(errores)
  })

  test('la Ladrona: si llegas antes se va y la luz vuelve; si no, la luz se rompe en chispas que la devuelven', async ({ page }) => {
    test.setTimeout(180_000)
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    await gancho(page, 'matarEnemigos')
    const f = (await cdd(page)).faroles[0]!
    await prenderFarol(page, f)
    // lejos, para que no la espante sin querer
    await gancho(page, 'teleport', f.x + 900, f.y)
    expect(await gancho<boolean>(page, 'robarYa')).toBe(true)
    let l = (await cdd(page)).ladrona!
    expect(l.barrio).toBe(f.id)
    // llegar a tiempo: se va y el farol sigue prendido
    await gancho(page, 'ponerHeroina', l.x + 20, l.y + 10)
    await expect.poll(async () => { await avanzar(page, 0.2); return (await cdd(page)).faroles.find((q) => q.id === f.id)!.estado }, { timeout: 15_000 }).toBe('prendido')
    await expect.poll(async () => { await avanzar(page, 0.3); return (await cdd(page)).ladrona }, { timeout: 15_000 }).toBeNull()
    // ahora no llega: el barrio queda robado y caen tres chispas
    await gancho(page, 'teleport', f.x + 900, f.y)
    expect(await gancho<boolean>(page, 'robarYa')).toBe(true)
    await expect.poll(async () => { await avanzar(page, 0.5); return (await cdd(page)).faroles.find((q) => q.id === f.id)!.estado }, { timeout: 30_000 }).toBe('robado')
    const robado = (await cdd(page)).faroles.find((q) => q.id === f.id)!
    expect(robado.chispas).toHaveLength(3)
    // Thor huele las chispas
    expect(await gancho<string | null>(page, 'olfatear')).toMatch(/^chispa:/)
    for (const c of robado.chispas) {
      await gancho(page, 'ponerHeroina', c.x, c.y)
      await avanzar(page, 0.3)
    }
    await expect.poll(async () => (await cdd(page)).faroles.find((q) => q.id === f.id)!.estado, { timeout: 10_000 }).toBe('prendido')
    await sinErrores(errores)
  })

  test('el sonámbulo de piedra se queda quieto en la luz de un barrio prendido', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    const son = (await enemigos(page)).filter((e) => e.tipo === 'sonambulo_piedra' && e.vivo)
    expect(son.length).toBeGreaterThanOrEqual(3)
    // prende el farol del barrio de un sonámbulo y se para al lado: queda de piedra
    const c = await cdd(page)
    const s = son.map((e) => ({ e, f: c.faroles.slice().sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0]! })).sort((a, b) => Math.hypot(a.f.x - a.e.x, a.f.y - a.e.y) - Math.hypot(b.f.x - b.e.x, b.f.y - b.e.y))[0]!
    await prenderFarol(page, s.f)
    await gancho(page, 'teleport', s.e.x + 40, s.e.y + 10)
    await gancho(page, 'curarTodo')
    // en la luz no persigue ni pega (Thor lo puede morder y empujar: de piedra se le pega tranquilo)
    const estados = new Set<string>()
    for (let i = 0; i < 8; i++) {
      await avanzar(page, 0.4)
      const e = (await enemigos(page)).find((q) => q.id === s.e.id)!
      expect(await gancho<boolean>(page, 'enLuzFija', e.x, e.y)).toBe(true)
      estados.add(e.estado)
    }
    expect([...estados].filter((x) => x === 'perseguir' || x === 'atacando')).toEqual([])
    await sinErrores(errores)
  })

  test('la gárgola duerme posada hasta que te acercas y su picada avisa con la sombra', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    await gancho(page, 'ponerNivel', 10)
    const ga = (await enemigos(page)).find((e) => e.tipo === 'gargola_dormida' && e.vivo)!
    expect(ga).toBeDefined()
    const ini = (await gancho<{ posada: boolean }[]>(page, 'gargolas'))[0]!
    expect(ini.posada).toBe(true)
    await gancho(page, 'teleport', ga.x + 60, ga.y + 20)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.3); return (await gancho<{ posada: boolean; picada: boolean }[]>(page, 'gargolas')).some((g) => !g.posada && g.picada) }, { timeout: 30_000 }).toBe(true)
    await sinErrores(errores)
  })

  test('la arena del duende hace bostezar a la heroína (en modo peque no)', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    await gancho(page, 'ponerNivel', 10)
    const du = (await enemigos(page)).find((e) => e.tipo === 'duende_sueno' && e.vivo)!
    expect(du).toBeDefined()
    await gancho(page, 'teleport', du.x + 120, du.y)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.3, true); return await gancho<boolean>(page, 'bostezando') }, { timeout: 40_000 }).toBe(true)
    await sinErrores(errores)
  })

  test('el Relojero: la aguja barre girando alrededor de él', async ({ page }) => {
    test.setTimeout(150_000)
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    await gancho(page, 'ponerNivel', 12)
    const r = (await enemigos(page)).find((e) => e.tipo === 'relojero')!
    expect(r.elite).toBe(true)
    expect(r.nombre).toBe('El Relojero')
    await gancho(page, 'teleport', r.x + 60, r.y + 10)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.25); return (await gancho<{ agujas: number }>(page, 'relojero')).agujas }, { timeout: 40_000 }).toBeGreaterThan(0)
    await sinErrores(errores)
  })

  test('el Rey de Piedra: la canción apaga las lámparas, las chispas de su corona las prenden y al vencerlo la ciudad despierta', async ({ page }) => {
    test.setTimeout(300_000)
    const errores = vigilarErrores(page)
    await bajarALaCiudad(page)
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'ponerNivel', 16)
    await gancho(page, 'curarTodo')
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).peleando, { timeout: 30_000 }).toBe(true)
    await avanzar(page, 3)
    // el salón se prende al empezar, y en la fase 1 se le pega
    expect((await cdd(page)).lamparas.every((l) => l.prendida)).toBe(true)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toContain('musica_jefe_rey')
    const j0 = await gancho<Jefe>(page, 'jefe')
    await gancho(page, 'danarJefe', 40)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j0.vida - 40)
    // fase 2: la canción de cuna apaga las lámparas y a oscuras la piedra no siente
    await gancho(page, 'danarJefe', j0.vidaMax * 0.42)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.1); return (await cdd(page)).lamparas.every((l) => !l.prendida) }, { timeout: 30_000 }).toBe(true)
    const j1 = await gancho<Jefe>(page, 'jefe')
    expect(j1.blindado).toBe(true)
    await gancho(page, 'danarJefe', 40)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j1.vida)
    // los golpes al piso sueltan chispas: juntarlas prende las lámparas, y con las cuatro cae de rodillas
    for (let k = 0; k < 120 && (await cdd(page)).lamparas.some((l) => !l.prendida); k++) {
      const cc = (await cdd(page)).chispasJefe
      await gancho(page, 'curarTodo')
      if (cc.length) await gancho(page, 'ponerHeroina', cc[0]!.x, cc[0]!.y)
      await avanzar(page, 0.3)
    }
    expect((await cdd(page)).lamparas.every((l) => l.prendida)).toBe(true)
    await avanzar(page, 0.3)
    const j2 = await gancho<Jefe>(page, 'jefe')
    expect(j2.estado).toBe('aturdido')
    await gancho(page, 'danarJefe', 40)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j2.vida - 40)
    // se libera: la luz de la corona sube y la ciudad despierta con todos sus faroles
    await gancho(page, 'danarJefe', 9999)
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).vencido, { timeout: 10_000 }).toBe(true)
    await expect.poll(async () => (await cdd(page)).despierta, { timeout: 60_000 }).toBe(true)
    expect((await cdd(page)).faroles.every((f) => f.estado === 'prendido')).toBe(true)
    expect(await gancho<number>(page, 'decosDespiertos')).toBeGreaterThan(10)
    expect(Object.keys(await gancho<Record<string, number>>(page, 'sonido'))).toContain('musica_despertar')
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ jefeVencido: boolean }>(page, 'estado')).jefeVencido).toBe(true)
    // el portal plata baja más hondo: el kit todavía no trae el Mundo 6, así que Continuará
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).portal, { timeout: 60_000 }).toBe(true)
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Continuara')
    await sinErrores(errores)
  })
})
