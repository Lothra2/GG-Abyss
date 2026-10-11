import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// Atacar sin elegir enemigo, como Diablo: clic derecho o Shift + clic hacia el puntero, Espacio, y en la tablet un botón
// con el ícono del arma puesta. No camina: pega donde está.

interface Enemigo { id: number; tipo: string; x: number; y: number; vida: number; vivo: boolean }
const enemigos = (p: Page) => gancho<Enemigo[]>(p, 'enemigos')
const pos = (p: Page) => gancho<{ x: number; y: number }>(p, 'pos')
const avanzar = (p: Page, s: number) => gancho(p, 'avanzar', s)

async function mundoAPagina(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  const c = await gancho<{ x: number; y: number; ancho: number; alto: number }>(page, 'camara')
  const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  const k = v.vista.w / c.ancho
  return { x: ((wx - c.x) * k + v.vista.w / 2) * z.cssZoom, y: ((wy - c.y) * k + v.vista.h / 2) * z.cssZoom }
}

/** Pone a la heroína a `dx` px a la izquierda de una rata y devuelve la rata */
async function frenteARata(page: Page, dx: number): Promise<Enemigo> {
  const c = await gancho<{ x: number; y: number; enemigo: number }>(page, 'cercaDeEnemigo', 'rata', 1)
  const r = (await enemigos(page)).find((e) => e.id === c.enemigo)!
  await gancho(page, 'teleport', r.x - dx, r.y)
  await avanzar(page, 0.2)
  return (await enemigos(page)).find((e) => e.id === c.enemigo)!
}

async function pegoA(page: Page, r: Enemigo): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    await gancho(page, 'curarTodo')
    await avanzar(page, 0.1)
    const e = (await enemigos(page)).find((q) => q.id === r.id)!
    if (!e.vivo || e.vida < r.vida) return true
  }
  return false
}

test.describe('Atacar sin elegir enemigo', () => {
  test('clic derecho hacia una rata le pega sin caminar', async ({ page }, info: TestInfo) => {
    test.skip(info.project.name === 'tablet', 'el mouse se prueba en escritorio')
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    const r = await frenteARata(page, 36)
    const p0 = await pos(page)
    const d = await mundoAPagina(page, r.x, r.y - 12)
    await page.mouse.move(d.x, d.y)
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
    expect(await pegoA(page, r)).toBe(true)
    const p1 = await pos(page)
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeLessThan(6)
    await sinErrores(errores)
  })

  test('Shift + clic al aire dispara la flecha hacia el puntero aunque no haya nadie', async ({ page }, info: TestInfo) => {
    test.skip(info.project.name === 'tablet', 'el teclado se prueba en escritorio')
    await abrirMundo(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    await avanzar(page, 1)
    const h = await pos(page)
    const d = await mundoAPagina(page, h.x + 120, h.y)
    await page.keyboard.down('Shift')
    await page.mouse.click(d.x, d.y)
    await page.keyboard.up('Shift')
    let vuela = false
    for (let i = 0; i < 20 && !vuela; i++) {
      await avanzar(page, 0.05)
      vuela = (await gancho<number>(page, 'proyectilesActivos')) > 0
    }
    expect(vuela).toBe(true)
    // no caminó hacia el clic
    const p1 = await pos(page)
    expect(Math.hypot(p1.x - h.x, p1.y - h.y)).toBeLessThan(6)
  })

  test('Espacio le pega al más cercano', async ({ page }, info: TestInfo) => {
    test.skip(info.project.name === 'tablet', 'el teclado se prueba en escritorio')
    await abrirMundo(page, 'rick')
    const r = await frenteARata(page, 36)
    await page.keyboard.down('Space')
    const ok = await pegoA(page, r)
    await page.keyboard.up('Space')
    expect(ok).toBe(true)
  })

  test('el botón de ataque de la tablet tiene el arma puesta y le pega a la rata', async ({ page }, info: TestInfo) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    const l = await gancho<{ ataque: { x: number; y: number; lado: number; arma: string }; botones: { x: number; y: number; lado: number }[] }>(page, 'hudCombate')
    expect(l.ataque.lado).toBeGreaterThanOrEqual(40)
    expect(l.ataque.arma.startsWith('sword_1|tajo')).toBe(true)
    // no se encima con las habilidades
    for (const b of l.botones) expect(Math.abs(b.y - l.ataque.y)).toBeGreaterThanOrEqual((b.lado + l.ataque.lado) / 2)
    const r = await frenteARata(page, 36)
    const z = await gancho<{ cssZoom: number }>(page, 'escala')
    const x = l.ataque.x * z.cssZoom
    const y = l.ataque.y * z.cssZoom
    if (info.project.name === 'tablet') await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)
    expect(await pegoA(page, r)).toBe(true)
    // con otra arma cambia el ícono
    await gancho(page, 'darObjeto', 'bow_1')
    await gancho(page, 'equipar', (await gancho<{ bolsa: (string | null)[] }>(page, 'inventario')).bolsa.indexOf('bow_1'))
    await expect.poll(async () => (await gancho<{ ataque: { arma: string } }>(page, 'hudCombate')).ataque.arma, { timeout: 10_000 }).toBe('bow_1|flecha')
    await sinErrores(errores)
  })
})
