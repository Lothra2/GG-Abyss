import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

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
    expect(antes.vida).toBe(650)
    await gancho(page, 'entrarArena')
    await avanzar(page, 0.3)
    const j = await jefe(page)
    expect(j.peleando).toBe(true)
    expect(j.anillo).toBe(true)
    // las piedras se encienden una tras otra (en tiempo real)
    await expect.poll(async () => (await jefe(page)).piedras, { timeout: 15_000 }).toBeGreaterThanOrEqual(6)
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

  test('cambia a la fase 2 al 60 % de la vida y su vida nunca sube', async ({ page }) => {
    await empezar(page)
    expect((await jefe(page)).fase).toBe(1)
    await hasta(page, (j) => j.estado !== 'intro', 10)
    await gancho(page, 'danarJefe', 650 * 0.41)
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
      await gancho(page, 'danarJefe', 650 * 0.41)
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
    await gancho(page, 'danarJefe', 650 * 0.41)
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

  test('si la heroína cae, Thor la rescata, el jefe se duerme sin curarse y al volver sigue donde quedó', async ({ page }) => {
    await empezar(page)
    await hasta(page, (j) => j.estado !== 'intro', 10)
    await gancho(page, 'danarJefe', 300)
    const vida = (await jefe(page)).vida
    await gancho(page, 'danar', 9999)
    await expect.poll(async () => (await combate(page)).rescates, { timeout: 40_000, intervals: [500] }).toBe(1)
    const j = await jefe(page)
    expect(j.peleando).toBe(false)
    expect(j.anillo).toBe(false)
    expect(j.vida).toBe(vida)
    expect(j.piedras).toBe(0)
    // al volver a entrar, retoma con la misma vida
    await gancho(page, 'entrarArena')
    await avanzar(page, 0.3)
    const k = await jefe(page)
    expect(k.peleando).toBe(true)
    expect(k.vida).toBe(vida)
    // y su vida quedó guardada
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ jefeVida?: number }>(page, 'estado')).jefeVida).toBe(vida)
  })

  test('victoria: cae el jefe, llueve oro, se abre el portal y aparece el cofre legendario; el portal lleva a Continuará y se puede volver', async ({ page }, info: TestInfo) => {
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
    // el portal se abre unos segundos después, y suena la música de victoria
    await expect.poll(async () => (await jefe(page)).portal, { timeout: 20_000 }).toBe(true)
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
    // el portal lleva a Continuará
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Continuara')
    const c = await gancho<{ abierto: boolean; resumen: { nivel: number; oro: number; zonas: string; secretos: string; tiempo: string }; titulo: string }>(page, 'continuara')
    expect(c.titulo).toContain('Continuará')
    expect(c.resumen.nivel).toBeGreaterThanOrEqual(10)
    expect(c.resumen.zonas).toMatch(/^\d+\/\d+$/)
    // y se vuelve al bosque con el jefe ya vencido
    if (info.project.name === 'tablet') await gancho(page, 'volverAlBosque')
    else await page.keyboard.press('Enter')
    await esperarEscena(page, 'Mundo')
    await page.waitForFunction(() => typeof (window.__ABYSS__ as unknown as Record<string, unknown>).jefe === 'function', null, { timeout: 60_000 })
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
