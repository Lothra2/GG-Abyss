import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// Lo que se pone se ve y cambia cómo ataca: el arma, la mano libre, el pecho y el casco son capas de PixelForja
// encima de la heroína, y el ataque básico sale del arma (sin arma, el de su clase).

interface Capa { tipo: string; clave: string; cuadro: number; visible: boolean }
interface Aspecto { capas: Capa[]; clave: string; base: string; cuadro: number }
interface Combate { ataque: { familia: string; anim: string; proyectil: string | null } | null; alcance: number }

const aspecto = (p: Page) => gancho<Aspecto>(p, 'aspecto')
const combate = (p: Page) => gancho<Combate>(p, 'combate')
const inv = (p: Page) => gancho<{ bolsa: (string | null)[]; equipo: Record<string, string> }>(p, 'inventario')
const SP = process.env.CAPTURAS_EQUIPO

async function ponerse(page: Page, id: string): Promise<void> {
  await gancho(page, 'darObjeto', id)
  const i = (await inv(page)).bolsa.indexOf(id)
  expect((await gancho<{ ok: boolean }>(page, 'equipar', i)).ok).toBe(true)
}

/** Espera a que lo que se ve sea esto (las capas nuevas se cargan al vuelo) */
async function verse(page: Page, esperado: string): Promise<void> {
  await expect.poll(async () => (await aspecto(page)).capas.map((c) => `${c.tipo}:${c.clave}`).join('|'), { timeout: 20_000 }).toBe(esperado)
}

async function retratar(page: Page, nombre: string): Promise<void> {
  if (!SP) return
  const h = await gancho<{ x: number; y: number }>(page, 'pos')
  const c = await gancho<{ x: number; y: number; ancho: number; alto: number }>(page, 'camara')
  const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
  const k = v.vista.w / c.ancho
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  const px = ((h.x - c.x) * k + v.vista.w / 2) * z.cssZoom
  const py = ((h.y - c.y) * k + v.vista.h / 2) * z.cssZoom
  await page.screenshot({ path: `${SP}/${nombre}.png`, clip: { x: Math.max(0, px - 90), y: Math.max(0, py - 120), width: 180, height: 150 } })
}

test.describe('Equipo visible', () => {
  test('Sophie sin nada puesto lleva su arco y dispara flechas', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const a = await aspecto(page)
    expect(a.capas.map((c) => `${c.tipo}:${c.clave}`)).toEqual(['arma:bow'])
    expect(a.capas[0]!.visible).toBe(true)
    expect((await combate(page)).ataque).toMatchObject({ familia: 'flecha', proyectil: 'proyectil_flecha' })
    await retratar(page, 'sophie_arco')
    await sinErrores(errores)
  })

  test('con una espada se ve la espada, pega cuerpo a cuerpo y la capa sigue la animación de ataque', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await ponerse(page, 'sword_1')
    await verse(page, 'arma:sword')
    const c = await combate(page)
    expect(c.ataque).toMatchObject({ familia: 'tajo', anim: 'attack', proyectil: null })
    expect(c.alcance).toBeLessThan(100)
    await retratar(page, 'sophie_espada')
    // atacar a una rata: la heroína hace el tajo y la capa del arma va con el mismo cuadro
    const cerca = await gancho<{ x: number; y: number; enemigo: number }>(page, 'cercaDeEnemigo', 'rata', 1)
    await gancho(page, 'teleport', cerca.x, cerca.y)
    await gancho(page, 'tocarEnemigo', cerca.enemigo)
    let vista = false
    for (let i = 0; i < 40 && !vista; i++) {
      await gancho(page, 'avanzar', 0.1)
      const a = await aspecto(page)
      if (a.base.endsWith('_attack')) {
        vista = true
        expect(a.capas[0]!.visible).toBe(true)
        expect(a.capas[0]!.cuadro).toBeGreaterThanOrEqual(0)
      }
    }
    expect(vista).toBe(true)
    expect(await gancho<number>(page, 'proyectilesActivos')).toBe(0)
    await sinErrores(errores)
  })

  test('Rick con un arco dispara flechas, y con un mandoble suelta el escudo', async ({ page }) => {
    await abrirMundo(page, 'rick')
    // sin nada: espada y escudo de paladín
    await verse(page, 'arma:sword|mano:shield_kite')
    await ponerse(page, 'bow_1')
    await verse(page, 'arma:bow|mano:shield_kite')
    expect((await combate(page)).ataque).toMatchObject({ familia: 'flecha', proyectil: 'proyectil_flecha' })
    await ponerse(page, 'greatsword_1')
    await verse(page, 'arma:greatsword')
    expect((await combate(page)).ataque).toMatchObject({ familia: 'pesado', anim: 'attack_heavy' })
    await retratar(page, 'rick_mandoble')
  })

  test('la coraza y el yelmo se ven, y todo sigue puesto al volver a entrar', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'alana')
    for (const id of ['armor_placas_chest_1', 'armor_malla_helm_1', 'shield_round_1']) await ponerse(page, id)
    await verse(page, 'pecho:placas_1|casco:malla_1|arma:wand|mano:shield_round')
    await retratar(page, 'alana_coraza')
    await gancho(page, 'guardarAhora')
    await abrirMundo(page, 'alana')
    // al entrar ya se ve, sin esperar a cargar nada
    expect((await aspecto(page)).capas.map((c) => `${c.tipo}:${c.clave}`).join('|')).toBe('pecho:placas_1|casco:malla_1|arma:wand|mano:shield_round')
    await sinErrores(errores)
  })

  test('sacarse el arma vuelve a lo de su clase', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await ponerse(page, 'sword_1')
    await verse(page, 'arma:sword')
    await gancho(page, 'desequipar', 'arma')
    await verse(page, 'arma:bow')
    expect((await combate(page)).ataque!.familia).toBe('flecha')
  })
})
