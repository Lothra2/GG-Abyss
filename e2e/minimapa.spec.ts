import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// F10: el minimapa arriba a la derecha se descubre al caminar, se agranda al tocarlo y lo descubierto se guarda.

interface InfoMinimapa { abierto: boolean; avance: number; caja: { x: number; y: number; w: number; h: number } }
const mini = (p: Page) => gancho<InfoMinimapa>(p, 'hudMinimapa')

test.describe('Minimapa', () => {
  test('caminar descubre más mapa y queda guardado al volver a entrar', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await expect.poll(async () => (await mini(page)).avance, { timeout: 10_000 }).toBeGreaterThan(0)
    const antes = (await mini(page)).avance
    const m = await gancho<{ ancho: number; alto: number }>(page, 'mapa')
    await gancho(page, 'teleport', m.ancho / 2, m.alto / 2)
    await gancho(page, 'avanzar', 0.5)
    await expect.poll(async () => (await mini(page)).avance, { timeout: 10_000 }).toBeGreaterThan(antes)
    const despues = (await mini(page)).avance
    await gancho(page, 'guardarAhora')
    await abrirMundo(page, 'sophie')
    expect((await mini(page)).avance).toBeGreaterThanOrEqual(despues)
    await sinErrores(errores)
  })

  test('tocarlo lo agranda sin mover a la heroína, y tocar otra vez lo cierra', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const z = await gancho<{ cssZoom: number }>(page, 'escala')
    const c = (await mini(page)).caja
    const pos = await gancho<{ x: number; y: number }>(page, 'pos')
    await page.waitForTimeout(300)
    await page.mouse.click((c.x + c.w / 2) * z.cssZoom, (c.y + c.h / 2) * z.cssZoom)
    await expect.poll(async () => (await mini(page)).abierto, { timeout: 5_000 }).toBe(true)
    await gancho(page, 'avanzar', 0.5)
    const ahora = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(ahora.x - pos.x, ahora.y - pos.y)).toBeLessThan(4)
    await page.waitForTimeout(300)
    await page.mouse.click(40 * z.cssZoom, 200 * z.cssZoom)
    await expect.poll(async () => (await mini(page)).abierto, { timeout: 5_000 }).toBe(false)
  })
})
