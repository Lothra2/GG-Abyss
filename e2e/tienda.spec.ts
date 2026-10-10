import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// La tienda de la fogata: se abre al tocar una fogata, vende pociones y armaduras de Thor por oro.

interface Oferta { id: string; precio: number; estado: string; x: number; y: number; w: number; h: number }
interface TiendaUI { abierta: boolean; oro: number; ofertas: Oferta[]; ultima: { id: string; ok: boolean; motivo?: string } | null }

const tienda = (p: Page) => gancho<TiendaUI>(p, 'tiendaUI')
const inventario = (p: Page) => gancho<{ equipo: Record<string, string>; bolsa: (string | null)[]; cinturon: (string | null)[]; armaduraThor: number; oro: number }>(p, 'inventario')

async function abrirEnFogata(page: Page): Promise<void> {
  const objs = await gancho<{ tipo: string; llave: string; parada: { x: number; y: number } }[]>(page, 'objetivos')
  const f = objs.find((o) => o.tipo === 'fogata')!
  await gancho(page, 'teleport', f.parada.x, f.parada.y + 10)
  await gancho(page, 'usarObjetivo', f.llave)
  await gancho(page, 'avanzar', 1)
  await expect.poll(async () => (await tienda(page).catch(() => null))?.abierta ?? false, { timeout: 10_000 }).toBe(true)
}

test.describe('Tienda de la fogata', () => {
  test('tocar una fogata abre la tienda y pausa el mundo; cerrarla lo reanuda', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await abrirEnFogata(page)
    expect(await gancho<string[]>(page, 'escenasActivas')).toContain('Tienda')
    const t = await tienda(page)
    expect(t.ofertas.length).toBeGreaterThanOrEqual(4)
    // las tarjetas entran en la pantalla
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    for (const o of t.ofertas) {
      expect(o.x).toBeGreaterThanOrEqual(0)
      expect(o.y + o.h).toBeLessThanOrEqual(v.vista.h)
    }
    await gancho(page, 'cerrarTienda')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Tienda'), { timeout: 5_000 }).toBe(false)
    await sinErrores(errores)
  })

  test('sin oro no compra; con oro la poción va al cinturón y la armadura se la pone Thor', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await abrirEnFogata(page)
    const caro = await gancho<{ ok: boolean; motivo?: string }>(page, 'tiendaComprar', 'pet_armor_1')
    expect(caro).toEqual({ ok: false, motivo: 'caro' })
    await gancho(page, 'cerrarTienda')
    await gancho(page, 'darOro', 200)
    const antes = await inventario(page)
    await abrirEnFogata(page)
    expect((await gancho<{ ok: boolean }>(page, 'tiendaComprar', 'potion_health_minor')).ok).toBe(true)
    expect((await gancho<{ ok: boolean }>(page, 'tiendaComprar', 'pet_armor_1')).ok).toBe(true)
    const despues = await inventario(page)
    expect(despues.oro).toBe(antes.oro - 10 - 40)
    expect(despues.cinturon.filter((x) => x === 'potion_health_minor').length).toBe(antes.cinturon.filter((x) => x === 'potion_health_minor').length + 1)
    expect(despues.equipo.mascota).toBe('pet_armor_1')
    expect(despues.armaduraThor).toBe(1)
    // ya la tiene: no se la vuelve a vender
    expect((await tienda(page)).ofertas.find((o) => o.id === 'pet_armor_1')!.estado).toBe('tiene')
    // queda guardado
    await gancho(page, 'cerrarTienda')
    const g = await page.evaluate(() => JSON.parse(localStorage.getItem('ggabyss:v1:perfil:sophie') ?? 'null'))
    expect(g.equipo.mascota).toBe('pet_armor_1')
    expect(g.oro).toBe(despues.oro)
  })
})
