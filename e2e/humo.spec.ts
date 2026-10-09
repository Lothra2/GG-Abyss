import { expect, test } from '@playwright/test'
import { esperarEscena, gancho, manifest, sinErrores, vigilarErrores } from './util'

// Humo de F0: corre en escritorio (1280x720 dpr 1) y en tablet (1180x820 dpr 2)

test('carga el juego, la escena Boot termina y no hay errores', async ({ page }, info) => {
  const errores = vigilarErrores(page)
  await page.goto('/?test=1')
  await esperarEscena(page, 'Titulo')
  await sinErrores(errores)

  const esc = await gancho<{ zoom: number; ancho: number; alto: number; dpr: number }>(page, 'escala')
  if (info.project.name === 'tablet') {
    expect(esc).toMatchObject({ zoom: 4, ancho: 590, alto: 410, dpr: 2 })
  } else {
    expect(esc).toMatchObject({ zoom: 1, ancho: 1280, alto: 720, dpr: 1 })
  }
  expect(await gancho(page, 'renderer')).toBe('webgl')
})

test('el canvas mide exactamente zoom pixeles físicos por pixel lógico', async ({ page }) => {
  await page.goto('/?test=1')
  await esperarEscena(page, 'Titulo')
  const r = await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    const b = c.getBoundingClientRect()
    return { cssW: b.width, cssH: b.height, w: c.width, h: c.height, dpr: window.devicePixelRatio, estilo: c.style.width }
  })
  const esc = await gancho<{ zoom: number; ancho: number; alto: number }>(page, 'escala')
  expect(r.w).toBe(esc.ancho)
  expect(r.h).toBe(esc.alto)
  expect(r.cssW * r.dpr).toBeCloseTo(esc.ancho * esc.zoom, 3)
  expect(r.cssH * r.dpr).toBeCloseTo(esc.alto * esc.zoom, 3)
})

test('al cambiar el tamaño de la ventana el zoom se recalcula y sigue entero', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'el cambio de tamaño se prueba en escritorio')
  await page.goto('/?test=1')
  await esperarEscena(page, 'Titulo')
  const casos: [number, number, number, number, number][] = [
    [1920, 1080, 2, 960, 540],
    [960, 540, 1, 960, 540],
    [800, 800, 2, 400, 400],
    [1280, 720, 1, 1280, 720],
  ]
  for (const [w, h, zoom, ancho, alto] of casos) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForFunction((z) => (window.__ABYSS__!.escala as () => { zoom: number })().zoom === z, zoom)
    const esc = await gancho<{ zoom: number; ancho: number; alto: number }>(page, 'escala')
    expect(Number.isInteger(esc.zoom)).toBe(true)
    expect(esc).toMatchObject({ zoom, ancho, alto })
    const c = await page.evaluate(() => ({ w: document.querySelector('canvas')!.width, h: document.querySelector('canvas')!.height }))
    expect(c).toEqual({ w: ancho, h: alto })
  }
})

test('si falta el kit sale el aviso claro y no se rompe nada', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.route('**/assets/kit/manifest.json', (r) => r.abort())
  await page.goto('/?test=1')
  const aviso = page.locator('#aviso')
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('No encuentro el kit. Corre npm run kit.')
  expect(await gancho(page, 'kitFaltante')).toBe(true)
  expect(errores.filter((e) => e.startsWith('pageerror'))).toEqual([])
})

test('un kit de otra versión también avisa', async ({ page }) => {
  await page.route('**/assets/kit/manifest.json', async (r) => {
    const resp = await r.fetch()
    const json = await resp.json()
    json.version = 99
    await r.fulfill({ json })
  })
  await page.goto('/?test=1')
  await expect(page.locator('#aviso')).toContainText('versión 99')
})

test('la sala del kit trae todo lo del manifest y se puede oír cada audio', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/?test=1&kit=1')
  await esperarEscena(page, 'SalaKit', 120_000)
  const m = await manifest(page)
  await page.waitForFunction(() => typeof (window.__ABYSS__ as Record<string, unknown>).sala === 'function')

  let sala = await gancho<Record<string, number>>(page, 'sala')
  expect(sala.personajes).toBe(Object.keys(m.personajes).length)
  expect(sala.personajes).toBeGreaterThanOrEqual(15)

  await gancho(page, 'salaPestana', 1)
  sala = await gancho(page, 'sala')
  expect(sala.fx).toBe(Object.keys(m.fx).length)

  await gancho(page, 'salaPestana', 2)
  sala = await gancho(page, 'sala')
  expect(sala.objetos).toBe(Object.keys(m.mundo.objetos).length)
  expect(sala.criaturas).toBe(Object.keys(m.mundo.criaturas).length)
  expect(sala.particulas).toBe(Object.keys(m.mundo.particulas).length)

  await gancho(page, 'salaPestana', 3)
  sala = await gancho(page, 'sala')
  expect(sala.audios).toBe(Object.keys(m.audio).length)
  const audios = await gancho<string[]>(page, 'salaAudios')
  expect(audios.length).toBe(Object.keys(m.audio).length)
  for (const a of audios) await gancho(page, 'salaTocarAudio', a)

  await gancho(page, 'salaPestana', 4)
  sala = await gancho(page, 'sala')
  expect(sala.fuentes).toBe(3)

  // cada personaje tiene sus animaciones creadas por dirección
  for (const id of Object.keys(m.personajes)) {
    const ok = await gancho<boolean[]>(page, 'salaAnimsDe', id)
    expect(ok.every(Boolean), id).toBe(true)
  }
  await sinErrores(errores)
})
