import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// F3: botín. Cofres con botín real, drops en el piso, rompibles, inventario, armadura de Thor y guardado.

interface Drop { id: string; x: number; y: number; rareza: string; haz: boolean; cae: boolean }
interface Botin { drops: Drop[]; monedas: { oro: number; x: number; y: number }[] }
interface Inv { equipo: Record<string, string>; bolsa: (string | null)[]; cinturon: (string | null)[]; armaduraThor: number; oro: number; velMult: number }
interface Obj { tipo: string; llave: string; x: number; y: number; parada: { x: number; y: number } }
interface Casilla { tipo: string; i: number; ranura: string; x: number; y: number; w: number; h: number; id: string | null }

const botin = (p: Page) => gancho<Botin>(p, 'botin')
const inv = (p: Page) => gancho<Inv>(p, 'inventario')
const avanzar = (p: Page, s: number) => gancho(p, 'avanzar', s)
const objetivos = (p: Page, tipo: string) => gancho<Obj[]>(p, 'objetivos').then((l) => l.filter((o) => o.tipo === tipo))
const combate = (p: Page) => gancho<{ danoMin: number; danoMax: number; vidaMax: number; clase: string }>(p, 'combate')

async function toque(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  if (info.project.name === 'tablet') await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}
async function aPagina(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  return { x: x * z.cssZoom, y: y * z.cssZoom }
}

test.describe('Botín', () => {
  test('el cofre tutorial da la armadura 1 de Thor: se recoge, se equipa y Thor la lleva puesta', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const cofre = (await objetivos(page, 'cofre')).find((c) => c.llave === 'cofre:112:2640')!
    expect(cofre).toBeTruthy()
    await gancho(page, 'teleport', cofre.parada.x, cofre.parada.y)
    await gancho(page, 'usarObjetivo', cofre.llave)
    // la tapa se abre y a mitad de la animación salen los objetos
    await expect.poll(async () => (await botin(page)).drops.length + (await inv(page)).bolsa.filter(Boolean).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
    // se recogen pasando cerca
    for (let i = 0; i < 8; i++) {
      const d = (await botin(page)).drops[0]
      if (!d) break
      await gancho(page, 'teleport', d.x, d.y)
      await avanzar(page, 1)
    }
    await expect.poll(async () => (await inv(page)).bolsa.concat((await inv(page)).cinturon).includes('pet_armor_1'), { timeout: 15_000 }).toBe(true)
    expect((await inv(page)).armaduraThor).toBe(0)
    const idx = (await inv(page)).bolsa.indexOf('pet_armor_1')
    await gancho(page, 'equipar', idx)
    const despues = await inv(page)
    expect(despues.equipo.mascota).toBe('pet_armor_1')
    expect(despues.armaduraThor).toBe(1)
    expect(despues.bolsa[idx]).toBeNull()
    // el oro del cofre también cayó al piso y se cobra
    await avanzar(page, 3)
    await sinErrores(errores)
  })

  test('equipar un arma cambia el daño y desequiparla lo devuelve', async ({ page }) => {
    await abrirMundo(page, 'rick')
    const base = await combate(page)
    await gancho(page, 'darObjeto', 'sword_1')
    await gancho(page, 'equipar', 0)
    const con = await combate(page)
    expect(con.danoMin).toBeCloseTo(base.danoMin + 3)
    expect(con.danoMax).toBeCloseTo(base.danoMax + 8)
    await gancho(page, 'desequipar', 'arma')
    const sin = await combate(page)
    expect(sin.danoMin).toBeCloseTo(base.danoMin)
    expect(sin.danoMax).toBeCloseTo(base.danoMax)
  })

  test('el equipo da vida, velocidad y se guarda: al recargar sigue puesto', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const base = await combate(page)
    for (const id of ['m_jubon_robusto', 'm_botas_viento', 'm_anillo_vida', 'pet_armor_1']) await gancho(page, 'darObjeto', id)
    for (let i = 0; i < 4; i++) await gancho(page, 'equipar', i)
    const puesto = await inv(page)
    expect(Object.keys(puesto.equipo).sort()).toEqual(['anillo_1', 'botas', 'mascota', 'pecho'])
    expect((await combate(page)).vidaMax).toBeGreaterThanOrEqual(base.vidaMax)
    expect(puesto.velMult).toBeGreaterThanOrEqual(1)
    const vidaMax = (await combate(page)).vidaMax
    await gancho(page, 'guardarAhora')
    await abrirMundo(page, 'sophie')
    const vuelto = await inv(page)
    expect(vuelto.equipo).toEqual(puesto.equipo)
    expect(vuelto.armaduraThor).toBe(1)
    expect((await combate(page)).vidaMax).toBe(vidaMax)
  })

  test('un raro cae con su haz de luz y un normal sin él', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'soltarObjeto', 'r_aguijon_de_cuervo', 90)
    await gancho(page, 'soltarObjeto', 'sword_1', -90)
    const b = await botin(page)
    const raro = b.drops.find((d) => d.id === 'r_aguijon_de_cuervo')!
    const normal = b.drops.find((d) => d.id === 'sword_1')!
    expect(raro.rareza).toBe('rare')
    expect(raro.haz).toBe(true)
    expect(normal.haz).toBe(false)
    // un legendario usa su propia animación de caída
    await gancho(page, 'soltarObjeto', 'pluma_de_cuervo', 150)
    expect((await botin(page)).drops.find((d) => d.id === 'pluma_de_cuervo')!.cae).toBe(true)
  })

  test('con la bolsa llena el objeto queda en el piso', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'llenarBolsa', 'sword_1')
    await gancho(page, 'soltarObjeto', 'm_anillo_vida', 10)
    await avanzar(page, 3)
    const b = await botin(page)
    expect(b.drops.map((d) => d.id)).toContain('m_anillo_vida')
    expect((await inv(page)).bolsa.includes('m_anillo_vida')).toBe(false)
    // al hacer lugar, se recoge
    await gancho(page, 'equipar', 0)
    await avanzar(page, 2)
    await expect.poll(async () => (await botin(page)).drops.length, { timeout: 10_000 }).toBe(0)
  })

  test('el oro cae en monedas y se cobra al pasar', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const antes = (await inv(page)).oro
    await gancho(page, 'soltarOro', 12, 20)
    expect((await botin(page)).monedas).toHaveLength(1)
    await avanzar(page, 2)
    await expect.poll(async () => (await inv(page)).oro, { timeout: 10_000 }).toBe(antes + 12)
  })

  test('el trol suelta 2 objetos con un raro, y las ratas a veces', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    const b = await botin(page)
    expect(b.drops.length + b.monedas.length).toBeGreaterThan(2)
    expect(b.drops.some((d) => d.rareza === 'rare')).toBe(true)
  })

  test('los rompibles se rompen una sola vez, sueltan botín y quedan rotos al volver', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const r = (await objetivos(page, 'rompible'))[0]!
    await gancho(page, 'teleport', r.parada.x, r.parada.y)
    await gancho(page, 'usarObjetivo', r.llave)
    await expect.poll(async () => (await gancho<{ rompibles: string[] }>(page, 'estado')).rompibles, { timeout: 15_000 }).toContain(r.llave)
    expect(await gancho(page, 'romper', r.llave)).toBe(false)
    await gancho(page, 'guardarAhora')
    await abrirMundo(page, 'sophie')
    expect((await objetivos(page, 'rompible')).some((o) => o.llave === r.llave)).toBe(false)
  })

  test('Thor desentierra un objeto normal', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    await page.waitForTimeout(100)
    const antes = (await botin(page)).drops.length
    await gancho(page, 'desenterrar')
    let n = antes
    for (let i = 0; i < 12 && n <= antes; i++) {
      await avanzar(page, 0.5)
      n = (await botin(page)).drops.length
    }
    expect(n).toBeGreaterThan(antes)
  })

  test('el inventario se abre con la tecla I o el botón, equipa tocando y muestra el tooltip al mantener', async ({ page }, info) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    for (const id of ['sword_1', 'm_espada_cruel']) await gancho(page, 'darObjeto', id)
    // botón de la bolsa en el HUD
    const l = await gancho<{ bolsa: { x: number; y: number; w: number; h: number } }>(page, 'hudLayout')
    const c0 = await aPagina(page, l.bolsa.x + l.bolsa.w / 2, l.bolsa.y + l.bolsa.h / 2)
    await toque(page, info, c0.x, c0.y)
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 15_000 }).toBe(true)
    const ui = await gancho<{ casillas: Casilla[]; escala: number }>(page, 'inventarioUI')
    const arma = ui.casillas.find((c) => c.tipo === 'bolsa' && c.id === 'sword_1')!
    // tocar equipa
    const p1 = await aPagina(page, arma.x + arma.w / 2, arma.y + arma.h / 2)
    await toque(page, info, p1.x, p1.y)
    await expect.poll(async () => (await inv(page)).equipo.arma, { timeout: 10_000 }).toBe('sword_1')
    // mantener presionado en la segunda arma muestra el tooltip con la comparación y no la equipa
    const ui2 = await gancho<{ casillas: Casilla[] }>(page, 'inventarioUI')
    const otra = ui2.casillas.find((c) => c.tipo === 'bolsa' && c.id === 'm_espada_cruel')!
    const p2 = await aPagina(page, otra.x + otra.w / 2, otra.y + otra.h / 2)
    if (info.project.name === 'tablet') {
      await gancho(page, 'tooltipDe', 'bolsa', otra.i)
    } else {
      await page.mouse.move(p2.x, p2.y)
      await page.mouse.down()
      await expect.poll(async () => (await gancho<{ tooltip: { visible: boolean } | null }>(page, 'inventarioUI')).tooltip?.visible ?? false, { timeout: 8000 }).toBe(true)
    }
    const tt = (await gancho<{ tooltip: { nombre: string; dif: { etiqueta: string; delta: number }[] } }>(page, 'inventarioUI')).tooltip
    expect(tt.nombre).toBe('Espada cruel')
    expect(tt.dif.find((d) => d.etiqueta === 'Daño %')?.delta).toBe(15)
    if (info.project.name !== 'tablet') {
      await page.mouse.up()
      expect((await inv(page)).equipo.arma).toBe('sword_1')
    }
    // desequipar tocando lo puesto
    const ui3 = await gancho<{ casillas: Casilla[] }>(page, 'inventarioUI')
    const puesta = ui3.casillas.find((c) => c.tipo === 'equipo' && c.ranura === 'arma')!
    const p3 = await aPagina(page, puesta.x + puesta.w / 2, puesta.y + puesta.h / 2)
    await toque(page, info, p3.x, p3.y)
    await expect.poll(async () => (await inv(page)).equipo.arma, { timeout: 10_000 }).toBeUndefined()
    // cierra con la X
    await gancho(page, 'cerrarInventario')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 10_000 }).toBe(false)
    if (info.project.name !== 'tablet') {
      await page.keyboard.press('i')
      await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 10_000 }).toBe(true)
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 10_000 }).toBe(false)
    }
    await sinErrores(errores)
  })

  test('arrastrar a otro hueco los acomoda, y arrastrar afuera lo deja en el piso para volver a recogerlo', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    for (const id of ['sword_1', 'm_espada_cruel']) await gancho(page, 'darObjeto', id)
    await page.keyboard.press('i')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 15_000 }).toBe(true)
    const arrastrar = async (de: { x: number; y: number }, a: { x: number; y: number }) => {
      const p0 = await aPagina(page, de.x, de.y)
      const p1 = await aPagina(page, a.x, a.y)
      await page.mouse.move(p0.x, p0.y)
      await page.mouse.down()
      for (let k = 1; k <= 6; k++) await page.mouse.move(p0.x + ((p1.x - p0.x) * k) / 6, p0.y + ((p1.y - p0.y) * k) / 6)
      await page.mouse.up()
    }
    const centro = (c: Casilla) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 })
    // a otro hueco de la bolsa
    let ui = await gancho<{ casillas: Casilla[]; panel: { x: number; y: number; w: number; h: number } }>(page, 'inventarioUI')
    const espada = ui.casillas.find((c) => c.tipo === 'bolsa' && c.id === 'sword_1')!
    const vacio = ui.casillas.find((c) => c.tipo === 'bolsa' && !c.id && c.i > espada.i + 2)!
    await arrastrar(centro(espada), centro(vacio))
    await expect.poll(async () => (await inv(page)).bolsa[vacio.i], { timeout: 10_000 }).toBe('sword_1')
    expect((await inv(page)).bolsa[espada.i]).toBeNull()
    // no se equipó por arrastrar ni se cerró la mochila
    expect((await inv(page)).equipo.arma).toBeUndefined()
    expect((await gancho<string[]>(page, 'escenasActivas')).includes('Inventario')).toBe(true)
    // afuera de la mochila: cae al piso
    ui = await gancho(page, 'inventarioUI')
    const cruel = ui.casillas.find((c) => c.tipo === 'bolsa' && c.id === 'm_espada_cruel')!
    await arrastrar(centro(cruel), { x: Math.max(4, ui.panel.x / 2), y: ui.panel.y + ui.panel.h / 2 })
    await expect.poll(async () => (await inv(page)).bolsa.includes('m_espada_cruel'), { timeout: 10_000 }).toBe(false)
    // soltar afuera no cierra la mochila
    expect((await gancho<string[]>(page, 'escenasActivas')).includes('Inventario')).toBe(true)
    await gancho(page, 'cerrarInventario')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 10_000 }).toBe(false)
    const d = (await botin(page)).drops.find((q) => q.id === 'm_espada_cruel')!
    expect(d).toBeTruthy()
    const h = await gancho<{ x: number; y: number }>(page, 'pos')
    // cae cerca, pero no encima (si no, se recogería sola enseguida)
    expect(Math.hypot(d.x - h.x, d.y - h.y)).toBeGreaterThan(26)
    expect(Math.hypot(d.x - h.x, d.y - h.y)).toBeLessThan(120)
    await avanzar(page, 2)
    expect((await inv(page)).bolsa.includes('m_espada_cruel')).toBe(false)
    // pasando por encima vuelve a la bolsa
    await gancho(page, 'teleport', d.x, d.y)
    await avanzar(page, 1)
    await expect.poll(async () => (await inv(page)).bolsa.includes('m_espada_cruel'), { timeout: 10_000 }).toBe(true)
    await sinErrores(errores)
  })

  test('soltar algo puesto lo saca del equipo y el daño vuelve a la base', async ({ page }) => {
    await abrirMundo(page, 'rick')
    const base = await combate(page)
    await gancho(page, 'darObjeto', 'sword_1')
    await gancho(page, 'equipar', (await inv(page)).bolsa.indexOf('sword_1'))
    expect((await combate(page)).danoMax).not.toBe(base.danoMax)
    await page.keyboard.press('i')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 15_000 }).toBe(true)
    const ui = await gancho<{ casillas: Casilla[]; panel: { x: number; y: number; w: number; h: number } }>(page, 'inventarioUI')
    expect(await gancho(page, 'arrastrarCasilla', 'equipo', 'arma', Math.max(2, ui.panel.x / 2), ui.panel.y + 10)).toBe(true)
    await expect.poll(async () => (await inv(page)).equipo.arma, { timeout: 10_000 }).toBeUndefined()
    expect((await combate(page)).danoMax).toBe(base.danoMax)
    expect((await botin(page)).drops.some((q) => q.id === 'sword_1')).toBe(true)
  })

  test('la interfaz del inventario cabe en la vista y no tapa lo que no debe', async ({ page }) => {
    await abrirMundo(page, 'alana')
    await gancho(page, 'abrirInventario')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Inventario'), { timeout: 15_000 }).toBe(true)
    const ui = await gancho<{ panel: { x: number; y: number; w: number; h: number }; escala: number; casillas: Casilla[] }>(page, 'inventarioUI')
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    expect(ui.panel.x).toBeGreaterThanOrEqual(0)
    expect(ui.panel.x + ui.panel.w).toBeLessThanOrEqual(v.vista.w)
    expect(ui.panel.y + ui.panel.h).toBeLessThanOrEqual(v.vista.h + 1)
    // 11 casilleros de equipo (sin el retrato) y 28 de bolsa
    expect(ui.casillas.filter((c) => c.tipo === 'equipo')).toHaveLength(11)
    expect(ui.casillas.filter((c) => c.tipo === 'bolsa')).toHaveLength(28)
  })
})

