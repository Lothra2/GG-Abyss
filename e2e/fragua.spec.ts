import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, esperarEscenaSaltandoCine, gancho, manifest, sinErrores, vigilarErrores } from './util'

// F12, el Mundo 6: La Fragua de las Luces. La luz quema: cerca del fuego la heroína junta calor. Las grietas respiran
// con los fuelles, cada jaula liberada deja luz fría, Thor se moja y se sacude, los hollines se pegan y la Dragona de
// Brasa encendida no siente los golpes hasta que el chorro de un surtidor la apaga. Todo se lee del mapa.

interface Jl { id: string; x: number; y: number; luz: string; zona: string; abierta: boolean; carcel: boolean; farolero: boolean }
interface Fg {
  jaulas: Jl[]
  libres: number
  total: number
  grietas: { x: number; y: number; w: number; h: number; fase: number; estado: string }[]
  surtidores: { id: string; x: number; y: number; px: number; py: number; recarga: number }[]
  charcos: { x: number; y: number }[]
  fuentes: { x: number; y: number }[]
  calor: number
  acalorada: boolean
  alrededor: Record<string, unknown>
  agua: number
  hollines: number
  fuegos: number
  rastros: number
  orillas: number
  apagada: boolean
  t: number
  periodo: number
  halo: number
  velocidad: number
}
interface En { id: number; tipo: string; x: number; y: number; vida: number; vivo: boolean; estado: string; elite: boolean; nombre: string }
interface Jefe { blindado: boolean; estado: string; fase: number; vida: number; vidaMax: number; peleando: boolean; vencido: boolean; portal: boolean; x: number; y: number; avisos: { ataque: string; forma: string }[] }

const fg = (p: Page) => gancho<Fg>(p, 'fragua')
const avanzar = (p: Page, s: number, parar = false) => gancho(p, 'avanzar', s, parar)
const enemigos = (p: Page) => gancho<En[]>(p, 'enemigos')

async function listo(page: Page): Promise<void> {
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.fragua === 'function' && !!a.fragua() }, null, { timeout: 120_000 })
}

async function bajarALaFragua(page: Page, heroe = 'rick'): Promise<void> {
  await abrirMundo(page, heroe)
  await gancho(page, 'irAMundo', 'mundo6')
  await esperarEscena(page, 'Bajada')
  await listo(page)
  await expect.poll(async () => (await gancho<{ id: string }>(page, 'mundoActual')).id, { timeout: 30_000 }).toBe('mundo6')
}

/** El momento del reloj de los fuelles en que una grieta está al rojo */
const alRojo = (g: { fase: number }, periodo: number) => (g.fase + 1.5 / periodo + 0.4 / periodo) * periodo

test.describe('La Fragua de las Luces', () => {
  test('baja sin errores: el mapa, las jaulas cerradas, las grietas, los surtidores y casi sin música', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaFragua(page)
    const m = await gancho<{ nombre: string; zonas: string[]; jefe: boolean; jefeTipo: string }>(page, 'mundoActual')
    expect(m.nombre).toBe('La Fragua de las Luces')
    expect(m.jefeTipo).toBe('dragona_brasa')
    expect(m.zonas.length).toBeGreaterThanOrEqual(8)
    const f = await fg(page)
    expect(f.total).toBeGreaterThanOrEqual(40)
    expect(f.libres).toBe(0)
    expect(f.grietas.length).toBeGreaterThanOrEqual(10)
    expect(f.surtidores.length).toBeGreaterThanOrEqual(4)
    expect(f.charcos.length).toBeGreaterThanOrEqual(8)
    expect(f.orillas).toBeGreaterThan(20)
    expect(f.apagada).toBe(false)
    // las jaulas de la cárcel y las de los faroleros también cuentan
    expect(f.jaulas.filter((j) => j.carcel).length).toBeGreaterThanOrEqual(8)
    expect(f.jaulas.some((j) => j.farolero)).toBe(true)
    // piso 6: más oscuro todavía
    expect((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad).toBeGreaterThan(0.65)
    await avanzar(page, 3)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toMatch(/ambiente_(fragua|lava|jaulas|fuelles)/)
    await sinErrores(errores)
  })

  test('las grietas respiran con los fuelles: aviso, al rojo y apagadas, y al rojo calientan', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaFragua(page)
    await gancho(page, 'matarEnemigos')
    const f = await fg(page)
    const g = f.grietas[0]!
    const vistos = new Set<string>()
    for (let k = 0; k < Math.ceil(f.periodo / 0.25) + 4; k++) {
      await avanzar(page, 0.25)
      vistos.add((await fg(page)).grietas[0]!.estado)
    }
    expect([...vistos].sort()).toEqual(['apagada', 'aviso', 'caliente'])
    // parada en la grieta al rojo junta calor; con el calor lleno queda acalorada y camina más lento
    await gancho(page, 'teleport', g.x + g.w / 2, g.y + g.h / 2)
    for (let k = 0; k < 60 && !(await fg(page)).acalorada; k++) {
      await gancho(page, 'relojFragua', alRojo(g, f.periodo))
      await gancho(page, 'ponerHeroina', g.x + g.w / 2, g.y + g.h / 2)
      await avanzar(page, 0.25)
    }
    const c = await fg(page)
    expect(c.acalorada).toBe(true)
    expect(c.calor).toBeGreaterThan(90)
    expect(c.velocidad).toBeLessThan(1)
    // la fuente fría la deja fresca del todo
    const pf = c.fuentes[0]!
    await gancho(page, 'teleport', pf.x + 20, pf.y + 40)
    await expect.poll(async () => { await avanzar(page, 0.3); return (await fg(page)).calor }, { timeout: 20_000 }).toBe(0)
    expect((await fg(page)).acalorada).toBe(false)
    await sinErrores(errores)
  })

  test('una jaula liberada deja luz fría: alumbra sin calentar y queda guardada', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaFragua(page, 'alana')
    await gancho(page, 'matarEnemigos')
    // los faroleros y el Carcelero sueltan sus luces de a poco (en tiempo real)
    await avanzar(page, 1)
    await page.waitForTimeout(3000)
    const f = await fg(page)
    const j = f.jaulas.find((q) => !q.farolero && !q.carcel && !q.abierta)!
    await gancho(page, 'teleport', j.x, j.y + 20)
    expect(await gancho(page, 'abrirJaula', j.id)).toBe(true)
    await avanzar(page, 1.5)
    const f2 = await fg(page)
    expect(f2.libres).toBe(f.libres + 1)
    expect(f2.jaulas.find((q) => q.id === j.id)!.abierta).toBe(true)
    expect(f2.alrededor.luzFria).toBe(true)
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ faroles: string[] }>(page, 'estado')).faroles).toContain(`jaula:${j.id}`)
    // otra vez abrirla no hace nada
    expect(await gancho(page, 'abrirJaula', j.id)).toBe(false)
    await sinErrores(errores)
  })

  test('Thor se moja en el agua fría y se sacude: la heroína se enfría, se le sueltan los hollines y gasta una gota', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarALaFragua(page)
    await gancho(page, 'matarEnemigos')
    // seco no se sacude
    expect(await gancho(page, 'sacudirThor')).toBe(false)
    // Thor se moja al pasar por un charco frío
    const ch = (await fg(page)).charcos[0]!
    await gancho(page, 'teleport', ch.x + 30, ch.y)
    for (let k = 0; k < 40 && (await fg(page)).agua === 0; k++) {
      await gancho(page, 'ponerHeroina', ch.x + 24, ch.y + 4)
      await avanzar(page, 0.3)
    }
    expect((await fg(page)).agua).toBe(3)
    // los hollines pegados le achican el farol
    const h0 = (await fg(page)).halo
    expect(await gancho(page, 'pegarHollin')).toBe(true)
    await avanzar(page, 0.2)
    const f1 = await fg(page)
    expect(f1.hollines).toBe(1)
    expect(f1.halo).toBeLessThan(h0)
    // la sacudida los suelta y gasta una gota (lejos del charco, si no se vuelve a mojar)
    const lejos = (await fg(page)).fuentes.length ? { x: ch.x + 260, y: ch.y } : { x: ch.x + 260, y: ch.y }
    await gancho(page, 'teleport', lejos.x, lejos.y)
    await avanzar(page, 0.3)
    expect((await fg(page)).agua).toBe(3)
    expect(await gancho(page, 'sacudirThor')).toBe(true)
    await avanzar(page, 0.3)
    const f2 = await fg(page)
    expect(f2.hollines).toBe(0)
    expect(f2.agua).toBe(2)
    expect(f2.calor).toBe(0)
    await sinErrores(errores)
  })

  test('el hollín se pega de verdad y la salamandra deja rastro caliente', async ({ page }) => {
    test.setTimeout(150_000)
    const errores = vigilarErrores(page)
    await bajarALaFragua(page)
    await gancho(page, 'ponerNivel', 12)
    const ho = (await enemigos(page)).find((e) => e.tipo === 'hollin' && e.vivo)!
    await gancho(page, 'teleport', ho.x + 40, ho.y)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.3); return (await fg(page)).hollines }, { timeout: 40_000 }).toBeGreaterThan(0)
    const sa = (await enemigos(page)).find((e) => e.tipo === 'salamandra_brasa' && e.vivo)!
    await gancho(page, 'teleport', sa.x + 120, sa.y)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.3); return (await fg(page)).rastros }, { timeout: 40_000 }).toBeGreaterThan(0)
    await sinErrores(errores)
  })

  test('el farolero suelta su luz al caer y el Carcelero abre su cárcel entera', async ({ page }) => {
    test.setTimeout(150_000)
    const errores = vigilarErrores(page)
    await bajarALaFragua(page)
    await gancho(page, 'ponerNivel', 16)
    const far = (await gancho<{ id: number; x: number; y: number; jaula: string | null }[]>(page, 'faroleros')).find((q) => q.jaula)!
    await gancho(page, 'teleport', far.x + 60, far.y)
    await gancho(page, 'danarEnemigo', far.id, 9999)
    await avanzar(page, 1)
    expect((await fg(page)).jaulas.find((j) => j.id === `farolero_${far.id}`)!.abierta).toBe(true)
    const car = (await enemigos(page)).find((e) => e.tipo === 'carcelero' && e.vivo)!
    expect(car.elite).toBe(true)
    await gancho(page, 'teleport', car.x + 60, car.y)
    await gancho(page, 'danarEnemigo', car.id, 9999)
    await expect.poll(async () => { await avanzar(page, 0.4); return (await fg(page)).jaulas.filter((j) => j.carcel).every((j) => j.abierta) }, { timeout: 20_000 }).toBe(true)
    await sinErrores(errores)
  })

  test('la Dragona de Brasa: encendida no siente, el chorro la apaga y al liberarla todas las luces vuelven', async ({ page }) => {
    test.setTimeout(300_000)
    const errores = vigilarErrores(page)
    await bajarALaFragua(page)
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'ponerNivel', 16)
    await gancho(page, 'curarTodo')
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).peleando, { timeout: 30_000 }).toBe(true)
    await avanzar(page, 3)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toContain('musica_jefe_dragona')
    // fase 1: se le pega
    const j0 = await gancho<Jefe>(page, 'jefe')
    expect(j0.blindado).toBe(false)
    await gancho(page, 'danarJefe', 40)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j0.vida - 40)
    // fase 2: se cubre de fuego, enseña el aliento y los golpes no le hacen nada
    await gancho(page, 'danarJefe', j0.vidaMax * 0.42)
    await avanzar(page, 0.2)
    const j1 = await gancho<Jefe>(page, 'jefe')
    expect(j1.fase).toBe(2)
    expect(j1.blindado).toBe(true)
    await gancho(page, 'danarJefe', 40)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j1.vida)
    await expect.poll(async () => { await gancho(page, 'curarTodo'); await avanzar(page, 0.2); return (await gancho<Jefe>(page, 'jefe')).avisos.map((a) => a.ataque).join(',') }, { timeout: 30_000 }).toContain('aliento')
    // la heroína se para en una palanca: cuando la Dragona pisa el surtidor, el chorro la apaga
    const ss = (await fg(page)).surtidores
    let apagada = false
    for (let k = 0; k < 160 && !apagada; k++) {
      const j = await gancho<Jefe>(page, 'jefe')
      const s = ss.reduce((a, b) => (Math.hypot(b.x - j.x, b.y - j.y) < Math.hypot(a.x - j.x, a.y - j.y) ? b : a))
      await gancho(page, 'curarTodo')
      await gancho(page, 'ponerHeroina', s.px, s.py + 10)
      if (Math.hypot(s.x - j.x, s.y - j.y) <= 90) await gancho(page, 'tirarPalanca', s.id)
      await avanzar(page, 0.25)
      const j2 = await gancho<Jefe>(page, 'jefe')
      apagada = j2.estado === 'aturdido' && !j2.blindado
    }
    expect(apagada).toBe(true)
    const j3 = await gancho<Jefe>(page, 'jefe')
    await gancho(page, 'danarJefe', 40)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j3.vida - 40)
    // fase 3: los fuelles soplan más seguido
    await gancho(page, 'danarJefe', j3.vida - j0.vidaMax * 0.25)
    await avanzar(page, 0.3)
    expect((await gancho<Jefe>(page, 'jefe')).fase).toBe(3)
    expect((await fg(page)).periodo).toBeLessThan(7)
    // se libera: todas las jaulas se abren, la lava se enfría y suena la liberación
    for (let k = 0; k < 160 && !(await gancho<Jefe>(page, 'jefe')).vencido; k++) {
      const j = await gancho<Jefe>(page, 'jefe')
      if (!j.blindado) await gancho(page, 'danarJefe', 9999)
      else {
        const s = ss.reduce((a, b) => (Math.hypot(b.x - j.x, b.y - j.y) < Math.hypot(a.x - j.x, a.y - j.y) ? b : a))
        await gancho(page, 'curarTodo')
        await gancho(page, 'ponerHeroina', s.px, s.py + 10)
        if (Math.hypot(s.x - j.x, s.y - j.y) <= 90) await gancho(page, 'tirarPalanca', s.id)
      }
      await avanzar(page, 0.25)
    }
    expect((await gancho<Jefe>(page, 'jefe')).vencido).toBe(true)
    await expect.poll(async () => { await avanzar(page, 0.5); return (await fg(page)).apagada }, { timeout: 30_000 }).toBe(true)
    // las jaulas se abren de a una con el reloj real (con la máquina cargada va más lento): hay que darle tiempo
    await expect.poll(async () => { await avanzar(page, 0.5); const f = await fg(page); return f.libres === f.total }, { timeout: 120_000 }).toBe(true)
    expect(await gancho<boolean>(page, 'lavaApagada')).toBe(true)
    expect(Object.keys(await gancho<Record<string, number>>(page, 'sonido'))).toContain('musica_liberacion')
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ jefeVencido: boolean }>(page, 'estado')).jefeVencido).toBe(true)
    // el portal brasa baja más hondo: si el kit trae el Mundo 7 va ahí, si no Continuará
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).portal, { timeout: 60_000 }).toBe(true)
    const hay7 = ((await manifest(page)).mundos ?? []).some((q) => q.id === 'mundo7')
    await gancho(page, 'irAlPortal')
    // al Mundo 7 se baja la primera vez con su cinemática, que se salta
    await esperarEscenaSaltandoCine(page, hay7 ? 'Bajada' : 'Continuara')
    await sinErrores(errores)
  })
})
