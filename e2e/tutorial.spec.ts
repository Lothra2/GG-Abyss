import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// F7: las demostraciones para Alana. Una manito con su ícono enseña a caminar, pegar y abrir, una por vez y hasta
// que lo haga. Se pueden saltar con un toque y no vuelven.

interface Tutorial { hechos: string[]; demo: { paso: string } | null }
interface HudTutorial { mano: boolean; icono: string | null; saltar: { x: number; y: number; width: number; height: number } | null }
interface En { id: number; tipo: string; x: number; y: number; vivo: boolean }

const tutorial = (p: Page) => gancho<Tutorial>(p, 'tutorial')
const hud = (p: Page) => gancho<HudTutorial>(p, 'hudTutorial')
const avanzar = (p: Page, s: number) => gancho(p, 'avanzar', s)

async function tocarRect(page: Page, info: TestInfo, r: { x: number; y: number; width: number; height: number }): Promise<void> {
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  const x = (r.x + r.width / 2) * z.cssZoom
  const y = (r.y + r.height / 2) * z.cssZoom
  if (info.project.name === 'tablet') await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

test.describe('Demostraciones para Alana', () => {
  test('caminar y pegar se enseñan uno por vez y se dan por hechos al hacerlos', async ({ page }, info) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'alana', '&tutorial=1')
    await avanzar(page, 0.3)
    expect((await tutorial(page)).demo?.paso).toBe('caminar')
    await expect.poll(async () => (await hud(page)).mano, { timeout: 15_000 }).toBe(true)
    expect((await hud(page)).icono).toContain('marca_destino')
    await page.screenshot({ path: info.outputPath('caminar.png') })
    // caminar un rato la da por hecha
    await gancho(page, 'tecla', 1, 0)
    await avanzar(page, 1.5)
    await gancho(page, 'tecla', 0, 0)
    await avanzar(page, 0.2)
    expect((await tutorial(page)).hechos).toContain('caminar')
    // cerca de un enemigo enseña a pegar
    const tipo = (await gancho<En[]>(page, 'enemigos')).find((e) => e.vivo)!.tipo
    const c = await gancho<{ x: number; y: number; enemigo: number }>(page, 'cercaDeEnemigo', tipo, 0)
    await gancho(page, 'teleport', c.x, c.y)
    await avanzar(page, 0.2)
    expect((await tutorial(page)).demo?.paso).toBe('pegar')
    await expect.poll(async () => (await hud(page)).icono, { timeout: 15_000 }).toContain('icono_calavera')
    await page.screenshot({ path: info.outputPath('pegar.png') })
    await gancho(page, 'tocarEnemigo', c.enemigo)
    for (let i = 0; i < 10 && !(await tutorial(page)).hechos.includes('pegar'); i++) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.5)
    }
    expect((await tutorial(page)).hechos).toContain('pegar')
    await sinErrores(errores)
  })

  test('el botón Saltar las quita todas y no vuelven al recargar', async ({ page }, info) => {
    await abrirMundo(page, 'alana', '&tutorial=1')
    await avanzar(page, 0.3)
    await expect.poll(async () => (await hud(page)).saltar !== null, { timeout: 15_000 }).toBe(true)
    await tocarRect(page, info, (await hud(page)).saltar!)
    await expect.poll(async () => (await tutorial(page)).hechos.length, { timeout: 15_000 }).toBe(3)
    expect((await tutorial(page)).demo).toBeNull()
    await page.reload()
    await abrirMundo(page, 'alana', '&tutorial=1')
    await avanzar(page, 0.3)
    expect((await tutorial(page)).demo).toBeNull()
    expect((await hud(page)).mano).toBe(false)
  })

  test('sin mejoras F7 no sale ninguna demostración', async ({ page }) => {
    await abrirMundo(page, 'alana', '&tutorial=1')
    await gancho(page, 'abrirPausa')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(true)
    await gancho(page, 'pausaAlternar', 'mejorasF7')
    await gancho(page, 'pausaContinuar')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(false)
    await avanzar(page, 0.3)
    expect((await tutorial(page)).demo).toBeNull()
  })
})
