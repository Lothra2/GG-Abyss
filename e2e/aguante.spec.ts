import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// El juego nunca se congela (lo que le pasó a Sophie con el Minotauro): una rata invocada la tumbó con su mordida, al
// caer se quitaron las invocadas (esa también, en medio de su turno) y al dibujarla otra vez el cuadro tronó. Phaser no
// pidió más cuadros: la pantalla quieta, los botones sin responder y Thor sin llegar.

type Juego = { loop: { frame: number }; scene: { getScene(k: string): unknown } }
type Mundo = { enemigos: { lista: { vivo: boolean; ent: { props: Record<string, unknown> }; update: (dt: number, ctx: unknown) => void }[] }; combate: { caido: boolean; danar(n: number): void }; events: { once(ev: string, f: () => void): void } }

const cuadros = (page: Page) => page.evaluate(() => (window as unknown as { __JUEGO__: Juego }).__JUEGO__.loop.frame)

test.describe('El juego no se congela', () => {
  test('si una invocada del jefe la tumba con su mordida, Thor la rescata y el juego sigue', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'saltarPresentacion')
    await gancho(page, 'ponerNivel', 6)
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'curarTodo')
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await gancho<{ peleando: boolean }>(page, 'jefe')).peleando, { timeout: 30_000 }).toBe(true)
    // la fase 2 del minotauro llama a sus ratas
    const j = await gancho<{ vidaMax: number }>(page, 'jefe')
    await gancho(page, 'danarJefe', j.vidaMax * 0.4)
    // (se la cura mientras tanto: que no la tumbe el minotauro antes de que lleguen)
    await expect.poll(async () => {
      await gancho(page, 'curarTodo')
      return page.evaluate(() => ((window as unknown as { __JUEGO__: Juego }).__JUEGO__.scene.getScene('Mundo') as Mundo).enemigos.lista.some((e) => e.vivo && e.ent.props.invocada === true))
    }, { timeout: 90_000, intervals: [300] }).toBe(true)
    // la mordida que la deja en cero sale en el turno de la rata, como en el juego
    await page.evaluate(() => {
      const m = (window as unknown as { __JUEGO__: Juego }).__JUEGO__.scene.getScene('Mundo') as Mundo
      const rata = m.enemigos.lista.find((e) => e.vivo && e.ent.props.invocada === true)!
      const turno = rata.update.bind(rata)
      rata.update = (dt, ctx) => {
        turno(dt, ctx)
        if (!m.combate.caido) m.combate.danar(99999)
      }
    })
    await expect.poll(async () => (await gancho<{ caido: boolean }>(page, 'combate')).caido, { timeout: 10_000 }).toBe(true)
    const c0 = await cuadros(page)
    // Thor llega, ella se levanta y el mundo sigue andando
    await expect.poll(async () => (await gancho<{ caido: boolean }>(page, 'combate')).caido, { timeout: 20_000 }).toBe(false)
    expect(await cuadros(page)).toBeGreaterThan(c0 + 10)
    await sinErrores(errores)
  })

  test('un cuadro que falla se avisa y el siguiente llega igual (la pantalla y los botones siguen)', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'saltarPresentacion')
    await page.evaluate(() => {
      const m = (window as unknown as { __JUEGO__: Juego }).__JUEGO__.scene.getScene('Mundo') as Mundo
      m.events.once('update', () => {
        throw new Error('falla de prueba')
      })
    })
    const c0 = await cuadros(page)
    await expect.poll(() => cuadros(page), { timeout: 10_000 }).toBeGreaterThan(c0 + 20)
    // se avisó, y solo eso
    await expect.poll(() => errores.filter((e) => e.includes('Un cuadro falló')).length, { timeout: 5000 }).toBe(1)
    // y el mundo responde: un toque la hace caminar
    const p0 = await gancho<{ x: number; y: number }>(page, 'pos')
    await gancho(page, 'tocar', p0.x + 90, p0.y)
    await expect.poll(async () => { const p = await gancho<{ x: number; y: number }>(page, 'pos'); return Math.hypot(p.x - p0.x, p.y - p0.y) }, { timeout: 10_000 }).toBeGreaterThan(20)
    await sinErrores(errores.filter((e) => !e.includes('Un cuadro falló') && !e.includes('falla de prueba')))
  })
})
