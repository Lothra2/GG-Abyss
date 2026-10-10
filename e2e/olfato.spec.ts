import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// Thor olfatea: al tocarlo ladra y lleva a la heroína hasta el cofre sin abrir más cercano, dejando huellas.

interface Olfato { activo: boolean; estado: string | null; info: { llave: string; llego: boolean; huellas: number } | null; thor: { x: number; y: number }; huellasVisibles: number }
const olfato = (p: Page) => gancho<Olfato>(p, 'olfato')

test.describe('Thor olfatea', () => {
  test('tocar a Thor lo pone a olfatear; si ella lo sigue, la lleva hasta un cofre sin abrir', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'avanzar', 1)
    const t = (await olfato(page)).thor
    await gancho(page, 'tocar', t.x, t.y - 12)
    await gancho(page, 'avanzar', 0.3)
    const o = await olfato(page)
    expect(o.activo).toBe(true)
    const llave = o.info!.llave
    expect(llave).not.toBe('')
    const cofres = await gancho<{ tipo: string; llave: string; x: number; y: number }[]>(page, 'objetivos')
    const cofre = cofres.find((c) => c.llave === llave)!
    expect(cofre.tipo).toBe('cofre')
    // ella lo sigue: cada tanto aparece al lado de Thor
    let fin = await olfato(page)
    for (let i = 0; i < 200 && fin.activo; i++) {
      await gancho(page, 'ponerHeroina', fin.thor.x - 30, fin.thor.y + 10)
      await gancho(page, 'avanzar', 0.4)
      fin = await olfato(page)
    }
    expect(fin.activo).toBe(false)
    expect(fin.info!.llego).toBe(true)
    expect(fin.info!.huellas).toBeGreaterThan(3)
    expect(Math.hypot(fin.thor.x - cofre.x, fin.thor.y - (cofre.y + 22))).toBeLessThan(70)
    await sinErrores(errores)
  })

  test('las huellas se ven en el piso y se apagan solas', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'matarEnemigos')
    expect(await gancho<string | null>(page, 'olfatear')).not.toBeNull()
    await gancho(page, 'avanzar', 2)
    await expect.poll(async () => (await olfato(page)).huellasVisibles, { timeout: 10_000 }).toBeGreaterThan(0)
    // si ella no lo sigue, la espera y después vuelve con ella; las huellas se apagan
    await gancho(page, 'avanzar', 30)
    await expect.poll(async () => (await olfato(page)).activo, { timeout: 20_000 }).toBe(false)
    await expect.poll(async () => (await olfato(page)).huellasVisibles, { timeout: 20_000 }).toBe(0)
  })
})
