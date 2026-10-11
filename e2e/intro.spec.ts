import { expect, test, type Page } from '@playwright/test'
import { esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// El intro al estilo Diablo: sale después del primer toque del título, avanza por sus momentos y se salta tocando.

interface InfoIntro { t: number; momento: string; texto: string; duracion: number; cortes: number; franjas: number; latidos: number }
const intro = (p: Page) => gancho<InfoIntro>(p, 'intro')

async function abrirIntro(page: Page, extra = '&intro=1'): Promise<void> {
  await page.goto(`/?test=1&seed=1${extra}`)
  await esperarEscena(page, 'Titulo', 120_000)
  await gancho(page, 'empezar')
}

test.describe('Intro', () => {
  test('después del título pasa por los momentos con su texto y termina en la selección', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirIntro(page)
    await esperarEscena(page, 'Intro')
    await expect.poll(async () => (await intro(page)).momento, { timeout: 15_000 }).toBe('cueva')
    // el subtítulo se escribe letra por letra
    await expect.poll(async () => (await intro(page)).texto.length, { timeout: 10_000 }).toBeGreaterThan(0)
    await expect.poll(async () => (await intro(page)).momento, { timeout: 20_000 }).toBe('ojos')
    // como en el cine: franjas negras y un corte seco antes de los ojos, que laten
    const i = await intro(page)
    expect(i.franjas).toBeGreaterThan(0)
    expect(i.cortes).toBeGreaterThanOrEqual(1)
    await expect.poll(async () => (await intro(page)).latidos, { timeout: 10_000 }).toBeGreaterThanOrEqual(1)
    await gancho(page, 'saltarIntro')
    await esperarEscena(page, 'SeleccionJugador')
    await sinErrores(errores)
  })

  test('un toque lo salta y no vuelve a salir en este aparato', async ({ page }) => {
    await abrirIntro(page)
    await esperarEscena(page, 'Intro')
    await page.waitForTimeout(1200)
    const vp = page.viewportSize()!
    await page.mouse.click(vp.width / 2, vp.height / 2)
    await esperarEscena(page, 'SeleccionJugador')
    expect(await page.evaluate(() => localStorage.getItem('ggabyss:v1:intro'))).toBe('1')
  })

  test('en modo prueba sin pedirlo, el título va directo a la selección', async ({ page }) => {
    await abrirIntro(page, '')
    await esperarEscena(page, 'SeleccionJugador')
  })
})
