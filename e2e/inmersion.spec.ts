import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho } from './util'

// F7: la música por estados y el agua que suena según la cercanía.

const musica = (p: Page) => gancho<{ estado: string; agua: number }>(p, 'musicaEstado')

test.describe('Inmersión (F7)', () => {
  test('cerca del trol la música pasa a combate, y en la fogata a descanso', async ({ page }) => {
    await abrirMundo(page, 'rick')
    await gancho(page, 'ponerNivel', 10)
    expect((await musica(page)).estado).toBe('explorar')
    const c = await gancho<{ x: number; y: number }>(page, 'cercaDeEnemigo', 'trol', 0)
    await gancho(page, 'teleport', c.x, c.y)
    for (let i = 0; i < 40 && (await musica(page)).estado !== 'combate'; i++) {
      await gancho(page, 'curarTodo')
      await gancho(page, 'avanzar', 0.25)
    }
    expect((await musica(page)).estado).toBe('combate')
    // suena la música de combate
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).some((k) => k.includes('musica_combate')), { timeout: 15_000 }).toBe(true)
    // en la fogata, sin enemigos cerca: descanso
    await gancho(page, 'matarEnemigos')
    const f = (await gancho<{ tipo: string; parada: { x: number; y: number } }[]>(page, 'objetivos')).find((o) => o.tipo === 'fogata')!
    await gancho(page, 'teleport', f.parada.x, f.parada.y)
    await gancho(page, 'avanzar', 14)
    expect((await musica(page)).estado).toBe('descanso')
  })

  test('el agua suena más fuerte cerca del río, y con las mejoras apagadas no', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    // cerca del lago, pero fuera de la zona del agua (ahí el ambiente ya es el agua)
    await gancho(page, 'matarEnemigos')
    let hay = false
    for (const n of await gancho<string[]>(page, 'postales')) {
      await gancho(page, 'irAPostal', n)
      await gancho(page, 'avanzar', 0.5)
      if ((await musica(page)).agua > 0.2) {
        hay = true
        break
      }
    }
    expect(hay, 'en alguna postal se oye el agua cercana').toBe(true)
    await gancho(page, 'abrirPausa')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(true)
    await gancho(page, 'pausaAlternar', 'mejorasF7')
    await gancho(page, 'pausaContinuar')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(false)
    await gancho(page, 'avanzar', 0.5)
    expect((await musica(page)).agua).toBe(0)
  })
})
