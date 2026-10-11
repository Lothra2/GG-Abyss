import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// F10: la cámara del mundo más cerca en la compu, sombras largas con el mismo cuadro de cada objeto y reflejos en el agua.

interface LuzMundo { sombras: number; reflejos: number; reflejoPersonajes: number; zoomCamara: number }
const luz = (p: Page) => gancho<LuzMundo>(p, 'luzMundo')

/** Un punto caminable con agua justo debajo: se busca en el mapa, no se adivina */
async function orillaDelAgua(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const s = (window as unknown as { __JUEGO__: { scene: { getScene: (k: string) => unknown } } }).__JUEGO__.scene.getScene('Mundo') as { mapa: { ancho: number; alto: number; cuadro: number; agua: Uint8Array; colision: Uint8Array } }
    const m = s.mapa
    for (let ty = 2; ty < m.alto - 2; ty++) {
      for (let tx = 2; tx < m.ancho - 2; tx++) {
        const i = ty * m.ancho + tx
        // dos cuadros de tierra firme y libre arriba, agua abajo
        if (m.agua[i] || m.colision[i] || m.agua[i - m.ancho] || m.colision[i - m.ancho]) continue
        if (m.agua[i + m.ancho] && m.agua[i + 2 * m.ancho]) return { x: tx * m.cuadro + m.cuadro / 2, y: ty * m.cuadro + m.cuadro - 4 }
      }
    }
    return null
  })
}

test.describe('Luz del mundo', () => {
  test('los objetos altos tiran sombra larga y en calidad baja no', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await expect.poll(async () => (await luz(page)).sombras, { timeout: 10_000 }).toBeGreaterThan(0)
    // al cambiar a calidad baja las que entran ya no traen sombra
    await gancho(page, 'ajustes', { calidad: 'baja' })
    const ini = await gancho<{ x: number; y: number }>(page, 'pos')
    await gancho(page, 'teleport', ini.x + 2000, ini.y - 900)
    await gancho(page, 'avanzar', 0.5)
    await expect.poll(async () => (await luz(page)).sombras, { timeout: 10_000 }).toBe(0)
    await sinErrores(errores)
  })

  test('la heroína se refleja a la orilla del agua y lejos no', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const orilla = await orillaDelAgua(page)
    expect(orilla).not.toBeNull()
    await gancho(page, 'teleport', orilla!.x, orilla!.y)
    await gancho(page, 'avanzar', 0.3)
    await expect.poll(async () => (await luz(page)).reflejoPersonajes, { timeout: 10_000 }).toBeGreaterThanOrEqual(1)
    const ini = (await gancho<{ inicio: { x: number; y: number } }>(page, 'mapa')).inicio
    await gancho(page, 'teleport', ini.x, ini.y)
    await gancho(page, 'avanzar', 0.3)
    await expect.poll(async () => (await luz(page)).reflejoPersonajes, { timeout: 10_000 }).toBe(0)
    await sinErrores(errores)
  })

  test('el zoom de la cámara deja ver al menos 340 px de alto del mundo', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const c = await gancho<{ ancho: number; alto: number }>(page, 'camara')
    const z = (await luz(page)).zoomCamara
    expect(Number.isInteger(z)).toBe(true)
    expect(c.alto).toBeGreaterThanOrEqual(340)
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    // la cámara agranda el mundo, el HUD sigue en la vista lógica
    expect(Math.round(v.vista.w / c.ancho)).toBe(z)
  })
})
