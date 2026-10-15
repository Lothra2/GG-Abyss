import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'
import { JEFE } from '../src/config/balance'
import { vidaDeJefe } from '../src/logic/dureza'

/** F13: la vida del minotauro con la dureza de los jefes */
const VIDA = vidaDeJefe(JEFE.vida)

// F4: el Minotauro del Bosque. Fases, avisos, rescate sin curar al jefe, victoria, portal y Continuará.

interface Jefe {
  existe: boolean; estado: string; fase: number; vida: number; vidaMax: number; peleando: boolean; vivo: boolean; x: number; y: number
  ratas: number; anillo: boolean; avisos: { ataque: string; forma: string; resta: number; total: number }[]; vencido: boolean; portal: boolean; cofreJefe: boolean
  piedras: number; arena: { x: number; y: number; radio: number }
}

const jefe = (p: Page) => gancho<Jefe>(p, 'jefe')
const avanzar = (p: Page, s: number) => gancho(p, 'avanzar', s)
const pos = (p: Page) => gancho<{ x: number; y: number }>(p, 'pos')
const combate = (p: Page) => gancho<{ vida: number; vidaMax: number; caido: boolean; rescates: number; nivel: number }>(p, 'combate')

/** Entra a la arena con la heroína fuerte (nivel 10) y espera a que el jefe empiece */
async function empezar(page: Page, heroe = 'rick'): Promise<void> {
  await abrirMundo(page, heroe)
  await gancho(page, 'ponerNivel', 10)
  await gancho(page, 'entrarArena')
  await avanzar(page, 0.2)
  expect((await jefe(page)).peleando).toBe(true)
}

/** Avanza el reloj manteniendo viva a la heroína, hasta que se cumpla la condición */
async function hasta(page: Page, cond: (j: Jefe) => boolean, max = 90, paso = 0.1): Promise<Jefe> {
  let j = await jefe(page)
  for (let t = 0; t < max && !cond(j); t += paso) {
    await gancho(page, 'curarTodo')
    await avanzar(page, paso)
    j = await jefe(page)
  }
  return j
}

test.describe('El minotauro', () => {
  test('al entrar a la arena despierta: barra, música de jefe, piedras encendidas y la salida cerrada', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    const antes = await jefe(page)
    expect(antes.existe).toBe(true)
    expect(antes.peleando).toBe(false)
    expect(antes.vida).toBe(VIDA)
    await gancho(page, 'entrarArena')
    await avanzar(page, 0.3)
    const j = await jefe(page)
    expect(j.peleando).toBe(true)
    expect(j.anillo).toBe(true)
    // las piedras se encienden una tras otra (en tiempo real)
    // en tiempo real: al final de la suite larga el Chromium sin GPU va lento, se le da el margen de las otras esperas reales
    await expect.poll(async () => (await jefe(page)).piedras, { timeout: 40_000 }).toBeGreaterThanOrEqual(6)
    // la barra del jefe aparece arriba
    await expect.poll(async () => (await gancho<{ jefe: { visible: boolean } }>(page, 'hudCombate')).jefe.visible, { timeout: 10_000 }).toBe(true)
    // suena la música del jefe
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).some((k) => k.includes('musica_jefe')), { timeout: 15_000 }).toBe(true)
    // la salida está cerrada: caminar hacia afuera no la saca de la arena
    const a = j.arena
    await gancho(page, 'tocar', a.x - a.radio - 120, a.y + 70)
    await gancho(page, 'curarTodo')
    await avanzar(page, 8)
    const p = await pos(page)
    expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeLessThanOrEqual(a.radio)
    await sinErrores(errores)
  })

  test('F14: la entrada del jefe corta a un primer plano pixel perfecto y vuelve a la pelea', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    type Plano = { momento: string | null; camara: { zoom: number; primerPlano: boolean } }
    const plano = () => gancho<Plano>(page, 'planoJefe')
    const base = (await plano()).camara.zoom
    await gancho(page, 'entrarArena')
    await avanzar(page, 0.6)
    const cerca = await plano()
    expect(cerca.momento).toBe('intro')
    expect(cerca.camara.primerPlano).toBe(true)
    expect(cerca.camara.zoom).toBe(base + 1)
    await gancho(page, 'curarTodo')
    await avanzar(page, 3)
    const lejos = await plano()
    expect(lejos.camara.primerPlano).toBe(false)
    expect(lejos.camara.zoom).toBe(base)
    await sinErrores(errores)
  })

  test('cambia a la fase 2 al 60 % de la vida y su vida nunca sube', async ({ page }) => {
    await empezar(page)
    expect((await jefe(page)).fase).toBe(1)
    await hasta(page, (j) => j.estado !== 'intro', 10)
    await gancho(page, 'danarJefe', VIDA * 0.41)
    const j = await jefe(page)
    expect(j.fase).toBe(2)
    let ultima = j.vida
    for (let i = 0; i < 400; i++) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.2)
      const v = (await jefe(page)).vida
      expect(v).toBeLessThanOrEqual(ultima)
      ultima = v
    }
  })

  test('los ataques grandes avisan 1.2 s antes en modo normal y 1.8 s en modo peque', async ({ page }) => {
    for (const [heroe, esperado] of [['rick', 1.2], ['alana', 1.8]] as const) {
      await empezar(page, heroe)
      await gancho(page, 'danarJefe', VIDA * 0.41)
      const totales = new Set<number>()
      for (let t = 0; t < 120; t += 0.1) {
        await gancho(page, 'curarTodo')
        await avanzar(page, 0.1)
        for (const a of (await jefe(page)).avisos) if (a.ataque !== 'grito') totales.add(Math.round(a.total * 100) / 100)
        if (totales.size > 0 && t > 40) break
      }
      expect(totales.size, `${heroe}: no vio avisos grandes`).toBeGreaterThan(0)
      for (const tt of totales) expect(tt).toBeCloseTo(esperado, 1)
    }
  })

  test('en la fase 2 grita y llama ratas, nunca más de 4', async ({ page }) => {
    await empezar(page)
    await gancho(page, 'danarJefe', VIDA * 0.41)
    let max = 0
    for (let t = 0; t < 200 && max < 2; t += 0.2) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.2)
      max = Math.max(max, (await jefe(page)).ratas)
    }
    expect(max).toBeGreaterThanOrEqual(2)
    for (let t = 0; t < 120; t += 0.2) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.2)
      max = Math.max(max, (await jefe(page)).ratas)
    }
    expect(max).toBeLessThanOrEqual(4)
  })

  test('la arena está sellada hasta vencer al Trol del Puente: rebota, la flecha lleva al trol y al vencerlo se abre', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'saltarPresentacion')
    await gancho(page, 'ponerNivel', 12)
    const l = await gancho<{ llave: { id: number; nombre: string } | null; sellada: boolean }>(page, 'llave')
    expect(l.llave?.nombre).toBe('Trol del Puente')
    expect(l.sellada).toBe(true)
    // se mete a la arena: rebota afuera y el jefe sigue dormido
    const j0 = await jefe(page)
    await gancho(page, 'teleport', j0.x - 60, j0.y + 30)
    await avanzar(page, 0.5)
    const p = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(p.x - j0.x, p.y - j0.y)).toBeGreaterThan(150)
    expect((await jefe(page)).peleando).toBe(false)
    // vence al trol: se abre y queda guardado
    const t = (await gancho<{ id: number; tipo: string; elite: boolean }[]>(page, 'enemigos')).find((e) => e.elite)!
    await gancho(page, 'danarEnemigo', t.id, 99999)
    await avanzar(page, 0.3)
    expect((await gancho<{ sellada: boolean }>(page, 'llave')).sellada).toBe(false)
    await gancho(page, 'guardarAhora')
    await page.reload()
    await abrirMundo(page, 'sophie')
    expect((await gancho<{ sellada: boolean }>(page, 'llave')).sellada).toBe(false)
    // y ahora sí se entra caminando
    await gancho(page, 'curarTodo')
    await gancho(page, 'teleport', j0.x - 60, j0.y + 30)
    await expect.poll(async () => { await avanzar(page, 0.2); return (await jefe(page)).peleando }, { timeout: 20_000 }).toBe(true)
    await sinErrores(errores)
  })

  test('si la heroína cae, Thor la rescata y el jefe se duerme: en modo normal vuelve al inicio de su fase, y lo ganado no se pierde', async ({ page }) => {
    await empezar(page)
    await hasta(page, (j) => j.estado !== 'intro', 10)
    // fase 1: cae y el jefe vuelve lleno
    await gancho(page, 'danarJefe', 300)
    await gancho(page, 'danar', 9999)
    await expect.poll(async () => (await combate(page)).rescates, { timeout: 40_000, intervals: [500] }).toBe(1)
    const j = await jefe(page)
    expect(j.peleando).toBe(false)
    expect(j.anillo).toBe(false)
    expect(j.vida).toBe(VIDA)
    expect(j.piedras).toBe(0)
    // fase 2: cae y vuelve al 60 %, no a la fase 1
    await gancho(page, 'curarTodo')
    await gancho(page, 'entrarArena')
    await avanzar(page, 0.3)
    expect((await jefe(page)).peleando).toBe(true)
    await gancho(page, 'danarJefe', VIDA * 0.5)
    await hasta(page, (q) => q.estado !== 'intro', 10)
    expect((await jefe(page)).fase).toBe(2)
    await gancho(page, 'danar', 9999)
    await expect.poll(async () => (await combate(page)).rescates, { timeout: 40_000, intervals: [500] }).toBe(2)
    const k = await jefe(page)
    expect(k.fase).toBe(2)
    expect(k.vida).toBe(Math.round(VIDA * 0.6))
    // y su vida quedó guardada
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ jefeVida?: number }>(page, 'estado')).jefeVida).toBe(k.vida)
  })

  test('en modo peque el jefe no se cura: al volver sigue donde quedó', async ({ page }) => {
    await empezar(page, 'alana')
    await hasta(page, (j) => j.estado !== 'intro', 10)
    await gancho(page, 'danarJefe', 300)
    const vida = (await jefe(page)).vida
    await gancho(page, 'danar', 9999)
    await expect.poll(async () => (await combate(page)).rescates, { timeout: 40_000, intervals: [500] }).toBe(1)
    // nunca sube (Thor o su invocación pueden haberle pegado un poco más antes de caer)
    const despues = (await jefe(page)).vida
    expect(despues).toBeLessThanOrEqual(vida)
    expect(despues).toBeGreaterThan(vida - 60)
    await gancho(page, 'entrarArena')
    await avanzar(page, 0.3)
    const k = await jefe(page)
    expect(k.peleando).toBe(true)
    expect(k.vida).toBeLessThanOrEqual(despues)
  })

  test('victoria: cae el jefe, llueve oro, se abre el portal y aparece el cofre legendario; el portal baja a la Catedral y se puede volver', async ({ page }) => {
    test.setTimeout(180_000)
    const errores = vigilarErrores(page)
    await empezar(page, 'sophie')
    await hasta(page, (j) => j.estado !== 'intro', 10)
    const nivelAntes = (await combate(page)).nivel
    await gancho(page, 'danarJefe', 9999)
    await expect.poll(async () => (await jefe(page)).vencido, { timeout: 10_000 }).toBe(true)
    const v = await jefe(page)
    expect(v.vivo).toBe(false)
    expect(v.anillo).toBe(false)
    expect(v.cofreJefe).toBe(true)
    // el portal se abre unos segundos después de la cámara lenta (tiempo real: en el Chromium sin GPU tarda), y suena la música de victoria
    await expect.poll(async () => (await jefe(page)).portal, { timeout: 60_000 }).toBe(true)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).some((k) => k.includes('musica_victoria')), { timeout: 20_000 }).toBe(true)
    // llueve oro
    await expect.poll(async () => (await gancho<{ monedas: unknown[] }>(page, 'botin')).monedas.length, { timeout: 20_000 }).toBeGreaterThan(0)
    expect((await combate(page)).nivel).toBeGreaterThanOrEqual(nivelAntes)
    // el cofre legendario da el arma personal de Sophie y la armadura 3 de Thor
    const cofre = (await gancho<{ tipo: string; llave: string; parada: { x: number; y: number } }[]>(page, 'objetivos')).filter((o) => o.tipo === 'cofre').find((o) => o.llave === 'cofre:3376:304')!
    expect(cofre).toBeTruthy()
    await gancho(page, 'teleport', cofre.parada.x, cofre.parada.y)
    await gancho(page, 'usarObjetivo', cofre.llave)
    await expect.poll(async () => (await gancho<{ drops: { id: string }[] }>(page, 'botin')).drops.map((d) => d.id), { timeout: 20_000 }).toEqual(expect.arrayContaining(['arco_de_sophie', 'pet_armor_3']))
    // F8: el portal baja a la Catedral de las Raíces (antes llevaba a Continuará)
    const oroAntes = (await gancho<{ oro: number }>(page, 'estado')).oro
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Bajada')
    const baj = await gancho<{ titulo: string; subir: boolean; piso: number; columna: string[] }>(page, 'bajada')
    expect(baj.titulo).toBe('La Catedral de las Raíces')
    // F11: la columna del abismo con el piso 2 brillando y los de abajo a oscuras
    expect(baj.piso).toBe(2)
    expect(baj.columna.slice(0, 3)).toEqual(['pasado', 'actual', 'oculto'])
    await esperarEscena(page, 'Mundo')
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true }, null, { timeout: 120_000 })
    const m2 = await gancho<{ id: string; partida: string; otros: string[]; zonas: string[]; jefe: boolean; portalVolver: { x: number; y: number } | null }>(page, 'mundoActual')
    expect(m2.id).toBe('mundo2')
    expect(m2.partida).toBe('mundo2')
    expect(m2.otros).toContain('mundo1')
    expect(m2.zonas).toContain('La Escalera Hundida')
    // abajo espera el Guardián de la Campana
    expect(m2.jefe).toBe(true)
    // lo de la heroína viaja con ella: el oro y el nivel
    expect((await gancho<{ oro: number }>(page, 'estado')).oro).toBe(oroAntes)
    expect((await combate(page)).nivel).toBeGreaterThanOrEqual(10)
    // el portal azul de la escalera la sube de vuelta al Bosque, con el jefe vencido y el portal abierto
    await avanzar(page, 2)
    await gancho(page, 'ponerHeroina', m2.portalVolver!.x, m2.portalVolver!.y)
    await avanzar(page, 0.3)
    await esperarEscena(page, 'Bajada')
    expect((await gancho<{ subir: boolean }>(page, 'bajada')).subir).toBe(true)
    await esperarEscena(page, 'Mundo')
    await page.waitForFunction(() => typeof (window.__ABYSS__ as unknown as Record<string, unknown>).jefe === 'function', null, { timeout: 60_000 })
    await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true }, null, { timeout: 120_000 })
    expect((await gancho<{ id: string }>(page, 'mundoActual')).id).toBe('mundo1')
    await expect.poll(async () => (await jefe(page)).portal, { timeout: 20_000 }).toBe(true)
    const w = await jefe(page)
    expect(w.vencido).toBe(true)
    expect(w.peleando).toBe(false)
    await sinErrores(errores)
  })

  test('un guardado con el jefe vencido no vuelve a despertarlo', async ({ page }) => {
    await empezar(page, 'rick')
    await gancho(page, 'danarJefe', 9999)
    await expect.poll(async () => (await jefe(page)).vencido, { timeout: 10_000 }).toBe(true)
    await gancho(page, 'guardarAhora')
    await abrirMundo(page, 'rick')
    expect((await jefe(page)).vencido).toBe(true)
    await gancho(page, 'entrarArena')
    await avanzar(page, 1)
    const j = await jefe(page)
    expect(j.peleando).toBe(false)
    expect(j.portal).toBe(true)
    expect(j.cofreJefe).toBe(true)
  })
})
