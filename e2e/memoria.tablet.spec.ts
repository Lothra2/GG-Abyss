import { expect, test } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// Pedido de Rick: en el iPad, al pasar al Mundo 6 el juego se cerraba (la memoria de los mundos de antes se acumulaba)
// y al volver la heroína quedó fuera del mapa, trancada. Al cambiar de mundo se suelta lo del anterior, y una posición
// guardada que no sirve se corrige al lugar bueno más cerca.

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await esperarEscena(page, 'Bajada')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return a.escena!() === 'Mundo' && typeof a.noEsperar === 'function' && a.noEsperar() === true }, null, { timeout: 180_000 })
}

test('bajar por los mundos no acumula memoria y se puede volver sin errores', async ({ page }) => {
  test.setTimeout(400_000)
  const errores = vigilarErrores(page)
  await abrirMundo(page, 'sophie')
  const bosque = await gancho<{ mpx: number }>(page, 'texturas')
  let maximo = 0
  for (const m of ['mundo2', 'mundo4', 'mundo5', 'mundo6', 'mundo5']) {
    await gancho(page, 'irAMundo', m)
    await listo(page)
    expect((await gancho<{ id: string }>(page, 'mundoActual')).id).toBe(m)
    maximo = Math.max(maximo, (await gancho<{ mpx: number }>(page, 'texturas')).mpx)
  }
  // nunca más de un mundo y medio encima de lo del Bosque (antes eran casi tres)
  expect(maximo).toBeLessThan(bosque.mpx * 1.5)
  await sinErrores(errores)
})

test('una posición guardada fuera del mapa se corrige al cargar', async ({ page }) => {
  const errores = vigilarErrores(page)
  await abrirMundo(page, 'sophie')
  await gancho(page, 'saltarPresentacion')
  const mapa = await gancho<{ ancho: number; alto: number }>(page, 'mapa')
  await gancho(page, 'forzarGuardar')
  // se guarda como si hubiera quedado pegada al borde de abajo, afuera
  await page.evaluate(([w, h]) => {
    const k = Object.keys(localStorage).find((q) => q.includes(':perfil:sophie'))!
    const p = JSON.parse(localStorage.getItem(k)!)
    p.posicion = { x: Math.round(w! / 2), y: h! - 2 }
    localStorage.setItem(k, JSON.stringify(p))
  }, [mapa.ancho, mapa.alto])
  await page.reload()
  await abrirMundo(page, 'sophie')
  const p = await gancho<{ x: number; y: number }>(page, 'pos')
  expect(p.y).toBeLessThan(mapa.alto - 20)
  expect(await gancho<boolean>(page, 'puntoCerca', p.x, p.y)).toBeTruthy()
  await sinErrores(errores)
})
