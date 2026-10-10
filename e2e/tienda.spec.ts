import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// El mercader de la fogata (Don Cachivache): está al lado de cada fogata, mira y saluda, y tocarlo abre la tienda.
// Vende pociones, armaduras de Thor y equipo de su nivel; compra lo de la bolsa y lo vendido se puede recomprar.

interface Oferta { id: string; precio: number; estado: string; origen: string; x: number; y: number; w: number; h: number; i?: number }
interface TiendaUI { abierta: boolean; oro: number; pestana: string; titulo: string; pagina: number; paginas: number; ofertas: Oferta[]; todas: Oferta[]; confirmar: string | null; ultima: { id: string; ok: boolean; motivo?: string } | null }
interface Obj { tipo: string; llave: string; x: number; y: number; parada: { x: number; y: number } }
interface Puesto { x: number; y: number; dir: number; saludo: boolean; anim: string | null; moneda: boolean }

const tienda = (p: Page) => gancho<TiendaUI>(p, 'tiendaUI')
const inventario = (p: Page) => gancho<{ equipo: Record<string, string>; bolsa: (string | null)[]; cinturon: (string | null)[]; armaduraThor: number; oro: number }>(p, 'inventario')
const objetivos = (p: Page) => gancho<Obj[]>(p, 'objetivos')
const abierta = async (p: Page) => (await gancho<string[]>(p, 'escenasActivas')).includes('Tienda')

async function abrirConMercader(page: Page): Promise<void> {
  const m = (await objetivos(page)).find((o) => o.tipo === 'mercader')!
  expect(m).toBeTruthy()
  await gancho(page, 'teleport', m.parada.x, m.parada.y + 20)
  await gancho(page, 'usarObjetivo', m.llave)
  await gancho(page, 'avanzar', 1.5)
  await expect.poll(async () => (await tienda(page).catch(() => null))?.abierta ?? false, { timeout: 10_000 }).toBe(true)
}

async function cerrar(page: Page): Promise<void> {
  await gancho(page, 'cerrarTienda')
  // Phaser cierra la escena en el cuadro siguiente
  await expect.poll(() => abierta(page), { timeout: 5_000 }).toBe(false)
}

/** Toca una tarjeta de la tienda con el mouse (coordenadas lógicas de la vista a la página) */
async function tocarTarjeta(page: Page, o: Oferta): Promise<void> {
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  await page.mouse.click((o.x + o.w / 2) * z.cssZoom, (o.y + o.h / 2) * z.cssZoom)
}

test.describe('El mercader', () => {
  test('hay uno al lado de cada fogata, mira a la heroína y la saluda, y tocarlo abre su tienda', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const objs = await objetivos(page)
    const fogatas = objs.filter((o) => o.tipo === 'fogata')
    const puestos = await gancho<Puesto[]>(page, 'mercader')
    expect(puestos.length).toBe(fogatas.length)
    for (const f of fogatas) expect(Math.min(...puestos.map((p) => Math.hypot(p.x - f.x, p.y - f.y))), f.llave).toBeLessThanOrEqual(130)
    expect(puestos.every((p) => p.moneda)).toBe(true)
    // se acerca: la mira y la saluda una vez
    const p0 = puestos[0]!
    await gancho(page, 'teleport', p0.x - 70, p0.y + 10)
    await gancho(page, 'avanzar', 0.3)
    const cerca = (await gancho<Puesto[]>(page, 'mercader'))[0]!
    expect(cerca.saludo).toBe(true)
    expect(cerca.anim).toContain('mercader_')
    // mirarla: hacia la izquierda (donde está ella)
    expect(['left', 'up_left', 'down_left']).toContain(['down', 'down_left', 'left', 'up_left', 'up', 'up_right', 'right', 'down_right'][cerca.dir])
    await abrirConMercader(page)
    expect(await gancho<string[]>(page, 'escenasActivas')).toContain('Tienda')
    const t = await tienda(page)
    expect(t.titulo).toBe('Don Cachivache')
    expect(t.pestana).toBe('comprar')
    expect(t.ofertas.length).toBeGreaterThanOrEqual(4)
    // las tarjetas entran en la pantalla
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    for (const o of t.ofertas) {
      expect(o.x).toBeGreaterThanOrEqual(0)
      expect(o.x + o.w).toBeLessThanOrEqual(v.vista.w)
      expect(o.y + o.h).toBeLessThanOrEqual(v.vista.h)
    }
    await cerrar(page)
    await sinErrores(errores)
  })

  test('con el mercader al lado, la fogata guarda pero no abre la tienda', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const f = (await objetivos(page)).find((o) => o.tipo === 'fogata')!
    await gancho(page, 'teleport', f.parada.x, f.parada.y + 10)
    await gancho(page, 'usarObjetivo', f.llave)
    await gancho(page, 'avanzar', 1.5)
    expect(await abierta(page)).toBe(false)
    expect((await gancho<{ ultimaFogata: string }>(page, 'estado')).ultimaFogata).toBe(f.llave)
  })

  test('sin oro no compra; con oro la poción va al cinturón y la armadura se la pone Thor', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await abrirConMercader(page)
    const caro = await gancho<{ ok: boolean; motivo?: string }>(page, 'tiendaComprar', 'pet_armor_1')
    expect(caro).toEqual({ ok: false, motivo: 'caro' })
    await cerrar(page)
    await gancho(page, 'darOro', 200)
    const antes = await inventario(page)
    await abrirConMercader(page)
    expect((await gancho<{ ok: boolean }>(page, 'tiendaComprar', 'potion_health_minor')).ok).toBe(true)
    expect((await gancho<{ ok: boolean }>(page, 'tiendaComprar', 'pet_armor_1')).ok).toBe(true)
    const despues = await inventario(page)
    expect(despues.oro).toBe(antes.oro - 10 - 40)
    expect(despues.cinturon.filter((x) => x === 'potion_health_minor').length).toBe(antes.cinturon.filter((x) => x === 'potion_health_minor').length + 1)
    expect(despues.equipo.mascota).toBe('pet_armor_1')
    expect(despues.armaduraThor).toBe(1)
    // ya la tiene: no se la vuelve a vender
    expect((await tienda(page)).todas.find((o) => o.id === 'pet_armor_1')!.estado).toBe('tiene')
    // queda guardado
    await cerrar(page)
    const g = await page.evaluate(() => JSON.parse(localStorage.getItem('ggabyss:v1:perfil:sophie') ?? 'null'))
    expect(g.equipo.mascota).toBe('pet_armor_1')
    expect(g.oro).toBe(despues.oro)
  })

  test('trae un arma de su clase; comprarla la pone en la bolsa y sale del surtido', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'darOro', 500)
    await abrirConMercader(page)
    const eq = (await tienda(page)).todas.filter((o) => o.origen === 'surtido')
    expect(eq.length).toBeGreaterThanOrEqual(2)
    const arma = eq[0]!
    const r = await gancho<{ ok: boolean }>(page, 'tiendaComprar', arma.id, 'surtido')
    expect(r.ok).toBe(true)
    expect((await inventario(page)).bolsa).toContain(arma.id)
    expect((await tienda(page)).todas.some((o) => o.origen === 'surtido' && o.id === arma.id)).toBe(false)
  })

  test('vender pide dos toques, paga oro, y lo vendido se recompra al mismo precio', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    await gancho(page, 'darObjeto', 'sword_1')
    const oro0 = (await inventario(page)).oro
    await abrirConMercader(page)
    await gancho(page, 'tiendaPestana', 'vender')
    // las tarjetas nuevas entran al input de Phaser en el cuadro siguiente
    await page.waitForTimeout(300)
    let t = await tienda(page)
    expect(t.pestana).toBe('vender')
    const espada = t.ofertas.find((o) => o.id === 'sword_1')!
    expect(espada.estado).toBe('ok')
    // primer toque: pregunta
    await tocarTarjeta(page, espada)
    await expect.poll(async () => (await tienda(page)).confirmar, { timeout: 5_000 }).not.toBeNull()
    expect((await inventario(page)).bolsa).toContain('sword_1')
    // segundo toque: vende
    await tocarTarjeta(page, espada)
    await expect.poll(async () => (await inventario(page)).bolsa.includes('sword_1'), { timeout: 5_000 }).toBe(false)
    const oro1 = (await inventario(page)).oro
    expect(oro1).toBe(oro0 + espada.precio)
    // en Comprar aparece para recomprar al mismo precio
    await gancho(page, 'tiendaPestana', 'comprar')
    t = await tienda(page)
    const re = t.todas.find((o) => o.origen === 'recompra' && o.id === 'sword_1')!
    expect(re.precio).toBe(espada.precio)
    expect((await gancho<{ ok: boolean }>(page, 'tiendaComprar', 'sword_1', 'recompra')).ok).toBe(true)
    expect((await inventario(page)).bolsa).toContain('sword_1')
    expect((await inventario(page)).oro).toBe(oro0)
    expect((await tienda(page)).todas.some((o) => o.origen === 'recompra')).toBe(false)
    await cerrar(page)
    await sinErrores(errores)
  })

  test('el arma de la familia no se vende', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'darObjeto', 'arco_de_sophie')
    await abrirConMercader(page)
    await gancho(page, 'tiendaPestana', 'vender')
    const arco = (await tienda(page)).todas.find((o) => o.id === 'arco_de_sophie')!
    expect(arco.estado).toBe('no-vende')
    const r = await gancho<{ ok: boolean; motivo?: string }>(page, 'tiendaVender', arco.i)
    expect(r).toEqual({ ok: false, motivo: 'no-vende' })
    expect((await inventario(page)).bolsa).toContain('arco_de_sophie')
  })

  test('en la Catedral también hay mercader en su refugio', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'irAMundo', 'mundo2')
    await page.waitForFunction(() => {
      const a = window.__ABYSS__ as unknown as Record<string, () => unknown> | undefined
      return !!a && a.escena!() === 'Mundo' && typeof a.mundoActual === 'function' && (a.mundoActual() as { id: string }).id === 'mundo2' && typeof a.noEsperar === 'function' && a.noEsperar() === true
    }, null, { timeout: 120_000 })
    const puestos = await gancho<Puesto[]>(page, 'mercader')
    expect(puestos.length).toBeGreaterThanOrEqual(1)
    await abrirConMercader(page)
    expect((await tienda(page)).titulo).toBe('Don Cachivache')
  })
})
