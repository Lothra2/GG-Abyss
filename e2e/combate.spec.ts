import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores, type MapaInfo } from './util'

// F2: combate. Corre en escritorio y en tablet. Los golpes se avanzan con `avanzar()` (reloj del juego) y se esperan con poll.

interface Combate {
  clase: string; nivel: number; xp: number; vida: number; mana: number; vidaMax: number; manaMax: number; escudo: number
  caido: boolean; rescates: number; enRescate: boolean; muertes: number; objetivo: { vida: number; tipo: string } | null
  recargas: [number, number]; habilidades: [string, string]; bloqueo: boolean; invulnerable: boolean; modoPeque: boolean
  danoMin: number; danoMax: number; cinturon: (string | null)[]; alcance: number; proyectiles: number; canalizando: boolean
}
interface En { id: number; tipo: string; x: number; y: number; vida: number; vidaMax: number; vivo: boolean; estado: string; elite: boolean; nombre: string; casa: { x: number; y: number } }

const combate = (page: Page) => gancho<Combate>(page, 'combate')
const enemigos = (page: Page) => gancho<En[]>(page, 'enemigos')
const avanzar = (page: Page, seg: number) => gancho(page, 'avanzar', seg)
const pos = (page: Page) => gancho<{ x: number; y: number }>(page, 'pos')

async function cerca(page: Page, tipo: string, indice = 0): Promise<{ id: number }> {
  const c = await gancho<{ x: number; y: number; enemigo: number } | null>(page, 'cercaDeEnemigo', tipo, indice)
  expect(c, `hay un ${tipo} en el mapa`).not.toBeNull()
  await gancho(page, 'teleport', c!.x, c!.y)
  return { id: c!.enemigo }
}

const enemigo = async (page: Page, id: number) => (await enemigos(page)).find((e) => e.id === id)!

/** Toca al enemigo y avanza el reloj hasta que muera (máximo `max` s). Mantiene viva a la heroína. */
async function matar(page: Page, id: number, max = 40): Promise<number> {
  await gancho(page, 'tocarEnemigo', id)
  let t = 0
  while (t < max) {
    await gancho(page, 'curarTodo')
    await avanzar(page, 1)
    t += 1
    if (!(await enemigo(page, id)).vivo) return t
  }
  return t
}

test.describe('Combate', () => {
  test('el mapa trae sus enemigos y todos se crean con la vida de la tabla', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const mapa = await gancho<MapaInfo & { enemigos?: number }>(page, 'mapa')
    expect(mapa).toBeTruthy()
    const lista = await enemigos(page)
    const delMapa = await page.evaluate(async () => {
      const t = await (await fetch('assets/kit/mundo/mundo1_bosque.json')).json()
      const capa = t.layers.find((l: { name: string }) => l.name === 'entidades')
      return capa.objects.filter((o: { type: string; properties?: { name: string; value: unknown }[] }) => o.type === 'enemigo' && !o.properties?.some((p) => p.name === 'tras_jefe')).length
    })
    expect(lista.length).toBe(delMapa)
    expect(lista.length).toBeGreaterThanOrEqual(29)
    const vidas: Record<string, number> = { rata: 12, calabaza: 30, goblin_arquero: 22, trol: 140 }
    for (const e of lista) expect(e.vida).toBe(vidas[e.tipo])
    const trol = lista.find((e) => e.elite)!
    expect(trol.nombre).toBe('Trol del Puente')
    await sinErrores(errores)
  })

  test('tocar una rata: la heroína la mata, sube la XP y salen números', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const { id } = await cerca(page, 'rata', 0)
    const antes = await combate(page)
    expect(antes.xp).toBe(0)
    await matar(page, id)
    expect((await enemigo(page, id)).vivo).toBe(false)
    const despues = await combate(page)
    expect(despues.xp).toBeGreaterThanOrEqual(5)
    expect(despues.muertes).toBeGreaterThanOrEqual(1)
    expect(despues.objetivo).toBeNull()
  })

  test('los golpes pesan: matar congela un instante, sacude la cámara y el mundo sigue solo', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const { id } = await cerca(page, 'rata', 0)
    await matar(page, id)
    const i = await gancho<{ ultimo: { tipo: string; pausa: number; sacude: boolean } | null; pausa: number; escalaAnims: number }>(page, 'impactos')
    expect(i.ultimo?.tipo).toBe('muerte')
    expect(i.ultimo?.pausa).toBeGreaterThan(0)
    expect(i.ultimo?.sacude).toBe(true)
    // la pausa es cortita: después todo vuelve a su velocidad
    await avanzar(page, 0.5)
    const j = await gancho<{ pausa: number; escalaAnims: number }>(page, 'impactos')
    expect(j.pausa).toBe(0)
    expect(j.escalaAnims).toBe(1)
  })

  test('el enemigo marcado se persigue: la heroína camina hasta su alcance y ataca sola', async ({ page }) => {
    await abrirMundo(page, 'rick')
    const c = await gancho<{ x: number; y: number; enemigo: number }>(page, 'cercaDeEnemigo', 'calabaza', 1)
    await gancho(page, 'teleport', c.x - 120, c.y)
    const antes = await pos(page)
    await gancho(page, 'tocarEnemigo', c.enemigo)
    await gancho(page, 'curarTodo')
    await avanzar(page, 2)
    const despues = await pos(page)
    expect(Math.hypot(despues.x - antes.x, despues.y - antes.y)).toBeGreaterThan(40)
  })

  test('los goblins disparan desde lejos y se alejan si la heroína se acerca', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const g = await gancho<{ x: number; y: number; enemigo: number }>(page, 'cercaDeEnemigo', 'goblin_arquero', 0)
    const e0 = await enemigo(page, g.enemigo)
    // a 170 px: dentro de su alcance de 200 y fuera de los 120 de huida
    await gancho(page, 'teleport', e0.x - 170, e0.y)
    await gancho(page, 'curarTodo')
    let disparo = false
    for (let i = 0; i < 12 && !disparo; i++) {
      await avanzar(page, 0.5)
      if ((await gancho<number>(page, 'proyectilesActivos')) > 0) disparo = true
    }
    expect(disparo).toBe(true)
    // pegada a él se aleja
    const e1 = await enemigo(page, g.enemigo)
    await gancho(page, 'teleport', e1.x - 50, e1.y)
    await gancho(page, 'curarTodo')
    const d0 = Math.hypot((await pos(page)).x - e1.x, (await pos(page)).y - e1.y)
    await avanzar(page, 1.5)
    const e2 = await enemigo(page, g.enemigo)
    const p = await pos(page)
    expect(Math.hypot(p.x - e2.x, p.y - e2.y)).toBeGreaterThan(d0 + 10)
  })

  test('el trol avisa su golpe pesado 1.2 s antes y se esquiva caminando', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const t = (await enemigos(page)).find((e) => e.elite)!
    await gancho(page, 'teleport', t.x - 40, t.y)
    await gancho(page, 'curarTodo')
    // espera el aviso en pasos chicos y mide cuánto dura
    let tAviso = 0
    let vio = false
    let pesado = false
    const vida0 = (await combate(page)).vida
    for (let i = 0; i < 400; i++) {
      await avanzar(page, 0.05)
      const e = await enemigo(page, t.id)
      if (e.estado === 'aviso') {
        vio = true
        tAviso += 0.05
        if (tAviso >= 0.4 && !pesado) {
          // la heroína sale caminando del círculo: 150 px atrás
          await gancho(page, 'teleport', e.x - 150, e.y)
          pesado = true
        }
      } else if (vio) break
    }
    expect(vio).toBe(true)
    expect(tAviso).toBeGreaterThan(0.9)
    expect(tAviso).toBeLessThan(1.5)
    // esquivó: no recibió el golpe pesado (12 a 16)
    expect((await combate(page)).vida).toBeGreaterThan(vida0 - 11)
  })

  test('en modo peque el trol avisa 1.8 s', async ({ page }) => {
    await abrirMundo(page, 'alana')
    expect((await combate(page)).modoPeque).toBe(true)
    const t = (await enemigos(page)).find((e) => e.elite)!
    await gancho(page, 'teleport', t.x - 40, t.y)
    await gancho(page, 'curarTodo')
    let tAviso = 0
    let vio = false
    for (let i = 0; i < 600; i++) {
      await avanzar(page, 0.05)
      const e = await enemigo(page, t.id)
      if (e.estado === 'aviso') {
        vio = true
        tAviso += 0.05
        if (tAviso > 0.2) await gancho(page, 'teleport', e.x - 160, e.y)
      } else if (vio) break
    }
    expect(vio).toBe(true)
    expect(tAviso).toBeGreaterThan(1.5)
    expect(tAviso).toBeLessThan(2.2)
  })

  test('morir nunca quita nada: Thor la rescata en la última fogata con vida y maná llenos', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    // una fogata guardada y algo de progreso
    const objs = await gancho<{ tipo: string; llave: string; parada: { x: number; y: number } }[]>(page, 'objetivos')
    const fogata = objs.find((o) => o.tipo === 'fogata')!
    await gancho(page, 'teleport', fogata.parada.x, fogata.parada.y + 10)
    await gancho(page, 'usarObjetivo', fogata.llave)
    await avanzar(page, 2)
    // tocar la fogata abre su tienda: se cierra para seguir
    await expect.poll(async () => (await gancho<{ abierta: boolean } | null>(page, 'tiendaUI'))?.abierta ?? false, { timeout: 10_000 }).toBe(true)
    await gancho(page, 'cerrarTienda')
    await gancho(page, 'darXp', 50)
    const e0 = await gancho<{ oro: number; nivel: number; xp: number; cofres: string[]; zonas: string[]; ultimaFogata: string }>(page, 'estado')
    expect(e0.ultimaFogata).not.toBe('')
    const lejos = await cerca(page, 'rata', 0)
    await gancho(page, 'danar', 9999)
    await expect.poll(async () => (await combate(page)).caido, { timeout: 15_000 }).toBe(true)
    await expect.poll(async () => (await combate(page)).rescates, { timeout: 40_000, intervals: [500] }).toBe(1)
    const c = await combate(page)
    expect(c.vida).toBe(c.vidaMax)
    expect(c.mana).toBe(c.manaMax)
    expect(c.caido).toBe(false)
    const e1 = await gancho<typeof e0>(page, 'estado')
    expect(e1.oro).toBe(e0.oro)
    expect(e1.nivel).toBe(e0.nivel)
    expect(e1.xp).toBe(e0.xp)
    expect(e1.cofres).toEqual(e0.cofres)
    expect(e1.zonas).toEqual(expect.arrayContaining(e0.zonas))
    const p = await pos(page)
    expect(Math.hypot(p.x - fogata.parada.x, p.y - fogata.parada.y)).toBeLessThan(80)
    expect(lejos.id).toBeGreaterThan(0)
    await sinErrores(errores)
  })

  test('subir de nivel: vida y maná llenos, banner y más vida máxima', async ({ page }) => {
    await abrirMundo(page, 'steph')
    const c0 = await combate(page)
    await gancho(page, 'danar', 20)
    await gancho(page, 'darXp', 40)
    const c1 = await combate(page)
    expect(c1.nivel).toBe(2)
    expect(c1.vidaMax).toBe(c0.vidaMax + 10)
    expect(c1.manaMax).toBe(c0.manaMax + 5)
    expect(c1.vida).toBe(c1.vidaMax)
    await expect.poll(async () => (await gancho<{ texto: string }>(page, 'hudNivel')).texto, { timeout: 10_000 }).toBe('¡Nivel 2!')
  })

  test('los orbes muestran el nivel justo: lleno solo al 100 %, vacío solo en 0 y un poquito con 1 punto', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const orbes = () => gancho<{ vida: number; mana: number }>(page, 'hudOrbes')
    const esperado = (f: number) => (f <= 0 ? 0 : f >= 1 ? 10 : Math.min(9, Math.max(1, Math.round(f * 10))))
    await expect.poll(async () => (await orbes()).vida, { timeout: 10_000 }).toBe(10)
    const c0 = await combate(page)
    // a media vida
    await gancho(page, 'danar', Math.round(c0.vidaMax * 0.45))
    const c = await combate(page)
    expect(c.caido).toBe(false)
    await expect.poll(async () => (await orbes()).vida, { timeout: 10_000 }).toBe(esperado(c.vida / c.vidaMax))
    expect((await orbes()).vida).toBeGreaterThan(1)
    expect((await orbes()).vida).toBeLessThan(10)
    // con 1 punto de vida no se ve vacío
    await gancho(page, 'curarTodo')
    const c1 = await combate(page)
    await gancho(page, 'danar', c1.vidaMax - 1)
    const c2 = await combate(page)
    expect(c2.caido).toBe(false)
    expect(c2.vida).toBeGreaterThan(0)
    await expect.poll(async () => (await orbes()).vida, { timeout: 10_000 }).toBe(esperado(c2.vida / c2.vidaMax))
    expect(await orbes().then((o) => o.vida)).toBeGreaterThanOrEqual(1)
  })

  test('la interfaz de combate queda pegada al borde de abajo, sin encimarse', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const l = await gancho<{ orbeVida: R; orbeMana: R; cinturon: R; xp: R; botones: { x: number; y: number; lado: number }[] }>(page, 'hudCombate')
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    expect(l.orbeVida.x).toBeLessThanOrEqual(10)
    expect(l.orbeMana.x + l.orbeMana.width).toBeGreaterThanOrEqual(v.vista.w - 10)
    expect(l.orbeVida.y + l.orbeVida.height).toBeGreaterThanOrEqual(v.vista.h - 10)
    expect(Math.abs(l.cinturon.x + l.cinturon.width / 2 - v.vista.w / 2)).toBeLessThanOrEqual(2)
    const [b0, b1] = l.botones
    expect(b0!.x + b0!.lado / 2).toBeLessThanOrEqual(b1!.x - b1!.lado / 2)
    expect(b1!.x + b1!.lado / 2).toBeLessThanOrEqual(l.orbeMana.x)
    expect(l.cinturon.x + l.cinturon.width).toBeLessThanOrEqual(b0!.x - b0!.lado / 2)
    for (const b of l.botones) expect(b.lado).toBeGreaterThanOrEqual(40)
  })

  test('en modo peque los botones son más grandes y la heroína ataca sola al que tenga al alcance', async ({ page }) => {
    await abrirMundo(page, 'alana')
    const alana = await gancho<{ botones: { lado: number }[] }>(page, 'hudCombate')
    await abrirMundo(page, 'sophie')
    const sophie = await gancho<{ botones: { lado: number }[] }>(page, 'hudCombate')
    expect(alana.botones[0]!.lado).toBeGreaterThan(sophie.botones[0]!.lado)
    await abrirMundo(page, 'alana')
    const { id } = await cerca(page, 'rata', 2)
    // sin tocar nada
    for (let i = 0; i < 20; i++) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 1)
      if (!(await enemigo(page, id)).vivo) break
    }
    expect((await enemigo(page, id)).vivo).toBe(false)
  })

  test('teclas: Q usa la primera habilidad y 1 toma la poción de vida', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'sin teclado en la tablet')
    await abrirMundo(page, 'sophie')
    await page.keyboard.press('q')
    await expect.poll(async () => (await combate(page)).recargas[0], { timeout: 10_000 }).toBeGreaterThan(0)
    await gancho(page, 'danar', 30)
    const v0 = (await combate(page)).vida
    await page.keyboard.press('1')
    await expect.poll(async () => (await combate(page)).cinturon[0], { timeout: 10_000 }).toBeNull()
    await avanzar(page, 1.2)
    expect((await combate(page)).vida).toBeGreaterThan(v0 + 15)
  })
})

interface R { x: number; y: number; width: number; height: number }

// cada clase con sus dos habilidades: se prueba cada efecto contra un enemigo real
const CLASES: { id: string; clase: string; ver: [(page: Page, id: number) => Promise<void>, (page: Page, id: number) => Promise<void>] }[] = [
  {
    id: 'sophie',
    clase: 'amazona',
    ver: [
      async (page, id) => {
        const v0 = (await enemigo(page, id)).vida
        await gancho(page, 'tocarEnemigo', id)
        await gancho(page, 'habilidad', 0)
        await avanzar(page, 2)
        expect((await enemigo(page, id)).vida).toBeLessThan(v0)
      },
      async (page) => {
        const p0 = await pos(page)
        await gancho(page, 'habilidad', 1)
        await avanzar(page, 0.1)
        expect((await combate(page)).invulnerable).toBe(true)
        await avanzar(page, 0.5)
        const p1 = await pos(page)
        expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeGreaterThan(40)
      },
    ],
  },
  {
    id: 'alana',
    clase: 'druida',
    ver: [
      async (page) => {
        await gancho(page, 'habilidad', 0)
        await avanzar(page, 1.5)
        expect((await combate(page)).escudo).toBeGreaterThanOrEqual(25)
      },
      async (page) => {
        // el escudo de Thor de la primera habilidad se comería el daño: se le gana con un golpe grande
        await gancho(page, 'danar', 55)
        const v0 = (await combate(page)).vida
        await gancho(page, 'habilidad', 1)
        await avanzar(page, 1.5)
        expect((await combate(page)).vida).toBeGreaterThan(v0 + 10)
      },
    ],
  },
  {
    id: 'rick',
    clase: 'paladin',
    ver: [
      async (page, id) => {
        // el torbellino pega a 60 px: la heroína se para al lado
        const e = await enemigo(page, id)
        await gancho(page, 'teleport', e.x - 30, e.y)
        const v0 = (await enemigo(page, id)).vida
        await gancho(page, 'habilidad', 0)
        await avanzar(page, 1.6)
        expect((await enemigo(page, id)).vida).toBeLessThan(v0)
      },
      async (page) => {
        await gancho(page, 'habilidad', 1)
        await avanzar(page, 0.3)
        expect((await combate(page)).bloqueo).toBe(true)
      },
    ],
  },
  {
    id: 'steph',
    clase: 'hechicera',
    ver: [
      async (page, id) => {
        const v0 = (await enemigo(page, id)).vida
        await gancho(page, 'habilidad', 0)
        await avanzar(page, 1.5)
        expect((await enemigo(page, id)).vida).toBeLessThan(v0)
      },
      async (page, id) => {
        const v0 = (await enemigo(page, id)).vida
        await gancho(page, 'habilidad', 1)
        await avanzar(page, 0.2)
        expect((await combate(page)).canalizando).toBe(true)
        await avanzar(page, 2)
        await gancho(page, 'soltarHabilidad', 1)
        expect((await combate(page)).canalizando).toBe(false)
        expect((await enemigo(page, id)).vida).toBeLessThan(v0)
      },
    ],
  },
]

test.describe('Las 4 clases', () => {
  for (const c of CLASES) {
    test(`${c.id} (${c.clase}) mata una rata, una calabaza y un goblin y usa sus 2 habilidades`, async ({ page }, info: TestInfo) => {
      test.skip(info.project.name === 'tablet', 'las 4 clases se prueban en escritorio, la tablet prueba lo táctil')
      test.setTimeout(240_000)
      const errores = vigilarErrores(page)
      await abrirMundo(page, c.id)
      expect((await combate(page)).clase).toBe(c.clase)
      for (const tipo of ['rata', 'calabaza', 'goblin_arquero']) {
        const { id } = await cerca(page, tipo, 1)
        const t = await matar(page, id)
        expect((await enemigo(page, id)).vivo, `${tipo} muerto con el ataque básico (${t} s)`).toBe(false)
      }
      // las dos habilidades contra una calabaza (30 de vida) con la heroína entera y sin recargas
      for (const i of [0, 1] as const) {
        await gancho(page, 'curarTodo')
        const { id } = await cerca(page, 'calabaza', 2 + i)
        await gancho(page, 'ponerNivel', 1)
        await c.ver[i](page, id)
      }
      await sinErrores(errores)
    })
  }
})
