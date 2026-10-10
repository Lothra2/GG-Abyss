import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, gancho } from './util'

// Tocar un botón de la interfaz no debe dejar el dedo "tomado" para siempre: después de reiniciar el HUD
// (cambiar de mundo, volver del título) el mundo tiene que seguir caminando con el toque.

const pos = (p: Page) => gancho<{ x: number; y: number }>(p, 'pos')
const avanzar = (p: Page, s: number) => gancho(p, 'avanzar', s)

async function toque(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  if (info.project.name === 'tablet') await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

/** De un punto del mundo a la página: la cámara da el centro y el tamaño de la vista en pixeles del mundo */
async function mundoAPagina(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  const c = await gancho<{ x: number; y: number; ancho: number; alto: number }>(page, 'camara')
  const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  const k = v.vista.w / c.ancho
  return { x: ((wx - c.x) * k + v.vista.w / 2) * z.cssZoom, y: ((wy - c.y) * k + v.vista.h / 2) * z.cssZoom }
}

/** Toca un botón de habilidad y después el piso a un costado: la heroína tiene que caminar */
async function botonYCaminar(page: Page, info: TestInfo): Promise<number> {
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  const b = (await gancho<{ botones: { x: number; y: number }[] }>(page, 'hudCombate')).botones[0]!
  await toque(page, info, b.x * z.cssZoom, b.y * z.cssZoom)
  await avanzar(page, 1.5)
  let mejor = 0
  for (const [dx, dy] of [[110, 0], [-110, 0], [0, 90], [0, -90]]) {
    const p0 = await pos(page)
    const d = await mundoAPagina(page, p0.x + dx, p0.y + dy)
    await toque(page, info, d.x, d.y)
    await avanzar(page, 1.5)
    const p1 = await pos(page)
    mejor = Math.max(mejor, Math.hypot(p1.x - p0.x, p1.y - p0.y))
    if (mejor > 40) break
  }
  return mejor
}

test('después de cambiar de mundo, tocar un botón no deja a la heroína sorda a los toques', async ({ page }, info) => {
  test.setTimeout(240_000)
  await abrirMundo(page, 'sophie')
  expect(await botonYCaminar(page, info)).toBeGreaterThan(40)
  // el HUD se reinicia al bajar a la Catedral
  await gancho(page, 'irAMundo', 'mundo2')
  await page.waitForFunction(() => {
    const a = window.__ABYSS__ as unknown as Record<string, () => unknown> | undefined
    return !!a && a.escena!() === 'Mundo' && typeof a.mundoActual === 'function' && (a.mundoActual() as { id: string }).id === 'mundo2' && typeof a.noEsperar === 'function' && a.noEsperar() === true
  }, null, { timeout: 120_000 })
  await avanzar(page, 2)
  expect(await botonYCaminar(page, info)).toBeGreaterThan(40)
})
