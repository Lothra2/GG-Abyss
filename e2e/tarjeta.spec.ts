import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// La tarjeta del botín: al recoger algo que se puede poner dice si es mejor o peor que lo puesto y deja ponérselo.

interface Tarjeta { visible: boolean; id?: string; juicio?: string; lineas?: string[]; puesto?: boolean }
interface Drop { id: string; x: number; y: number; mejor: boolean }
const tarjeta = (p: Page) => gancho<Tarjeta>(p, 'hudTarjeta')
const inv = (p: Page) => gancho<{ equipo: Record<string, string>; bolsa: (string | null)[] }>(p, 'inventario')

async function soltarYRecoger(page: Page, id: string): Promise<void> {
  await gancho(page, 'soltarObjeto', id, 40)
  await gancho(page, 'avanzar', 0.7)
  const d = (await gancho<{ drops: Drop[] }>(page, 'botin')).drops.find((x) => x.id === id)!
  await gancho(page, 'ponerHeroina', d.x, d.y)
  await gancho(page, 'avanzar', 0.3)
}

test.describe('Tarjeta del botín', () => {
  test('lo que es mejor se marca en el piso, al recogerlo la tarjeta lo dice y se lo pone de un toque', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'rick')
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'darObjeto', 'sword_1')
    await gancho(page, 'equipar', 0)
    expect((await inv(page)).equipo.arma).toBe('sword_1')
    // una espada mejor: flechita verde en el piso
    await gancho(page, 'soltarObjeto', 'm_espada_cruel', 40)
    await gancho(page, 'avanzar', 0.2)
    expect((await gancho<{ drops: Drop[] }>(page, 'botin')).drops.find((x) => x.id === 'm_espada_cruel')!.mejor).toBe(true)
    const d = (await gancho<{ drops: Drop[] }>(page, 'botin')).drops.find((x) => x.id === 'm_espada_cruel')!
    await gancho(page, 'avanzar', 0.6)
    await gancho(page, 'ponerHeroina', d.x, d.y)
    await gancho(page, 'avanzar', 0.3)
    await expect.poll(async () => (await tarjeta(page)).visible, { timeout: 10_000 }).toBe(true)
    const t = await tarjeta(page)
    expect(t.id).toBe('m_espada_cruel')
    expect(t.juicio).toBe('mejor')
    expect(t.lineas!.length).toBeGreaterThan(0)
    expect(t.lineas!.some((l) => l.includes('+'))).toBe(true)
    await gancho(page, 'tarjetaPoner')
    const i = await inv(page)
    expect(i.equipo.arma).toBe('m_espada_cruel')
    expect(i.bolsa).toContain('sword_1')
    expect((await tarjeta(page)).puesto).toBe(true)
    await sinErrores(errores)
  })

  test('lo que es peor no se marca y la tarjeta avisa que lo puesto es mejor', async ({ page }) => {
    await abrirMundo(page, 'rick')
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'darObjeto', 'm_espada_cruel')
    await gancho(page, 'equipar', 0)
    await gancho(page, 'soltarObjeto', 'sword_1', 40)
    await gancho(page, 'avanzar', 0.2)
    expect((await gancho<{ drops: Drop[] }>(page, 'botin')).drops.find((x) => x.id === 'sword_1')!.mejor).toBe(false)
    await soltarYRecoger(page, 'sword_1')
    await expect.poll(async () => (await tarjeta(page)).juicio, { timeout: 10_000 }).toBe('peor')
    // y se puede poner igual si ella quiere
    await gancho(page, 'tarjetaPoner')
    expect((await inv(page)).equipo.arma).toBe('sword_1')
  })
})
