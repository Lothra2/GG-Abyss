import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, manifest, sinErrores, vigilarErrores } from './util'

// F13, el final: las cinemáticas (la bajada al infierno y el cierre), la escena del final con el botón para jugar con
// alas, y el Ciclo 2 que vuelve al Bosque con su nivel y su equipo, celestial y todo más difícil.

interface Ciclo { ciclo: number; celestial: boolean; cines: string[]; multJefe: number; halo: number; vidaMax: number; nivel: number; mundo: string }
interface CineInfo { cine: string; t: number; plano: string | null; planos: string[]; texto: string; duracion: number; capas: number; terminada: boolean }

const ciclo = (p: Page) => gancho<Ciclo>(p, 'ciclo')

async function listo(page: Page): Promise<void> {
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.ciclo === 'function' }, null, { timeout: 120_000 })
}

test.describe('El final', () => {
  test('cada cinemática pasa sus paneles con subtítulo (o sigue derecho si el kit no la trae) y vuelve al juego', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const m = (await manifest(page)) as unknown as Record<string, Record<string, unknown> | undefined>
    for (const cine of ['cine_bajada', 'cine_fin'] as const) {
      const paneles = Object.values(m[cine] ?? {}).filter((v) => v && typeof v === 'object' && Array.isArray((v as { capas?: unknown }).capas)).length
      await gancho(page, 'verCine', cine)
      if (paneles > 0) {
        await esperarEscena(page, 'Cine')
        await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => { plano: string | null } | undefined>; return !!a.cine?.()?.plano }, null, { timeout: 20_000 })
        const c = await gancho<CineInfo>(page, 'cine')
        expect(c.planos.length).toBeGreaterThanOrEqual(paneles)
        expect(c.capas).toBeGreaterThan(0)
        expect(c.duracion).toBeGreaterThan(paneles * 3)
        // el subtítulo se escribe solo
        await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => { texto: string }>; return a.cine!().texto.length > 3 }, null, { timeout: 15_000 })
        await gancho(page, 'saltarCine')
      }
      await listo(page)
    }
    await sinErrores(errores)
  })

  test('vencer al Diablo: el final ofrece jugar con alas y el Ciclo 2 vuelve al Bosque con su nivel, celestial y más duro', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'saltarPresentacion')
    await gancho(page, 'ponerNivel', 9)
    const antes = await ciclo(page)
    expect(antes.ciclo).toBe(1)
    expect(antes.celestial).toBe(false)
    await gancho(page, 'probarFinal')
    await esperarEscena(page, 'Continuara')
    const f = await gancho<{ final: boolean; titulo: string }>(page, 'continuara')
    expect(f.final).toBe(true)
    expect(f.titulo).toContain('Diablo')
    await gancho(page, 'cicloNuevo')
    await esperarEscena(page, 'Bajada')
    expect((await gancho<{ titulo: string }>(page, 'bajada')).titulo).toBe('Ciclo 2')
    await listo(page)
    const d = await ciclo(page)
    expect(d.ciclo).toBe(2)
    expect(d.celestial).toBe(true)
    expect(d.mundo).toBe('mundo1')
    expect(d.nivel).toBe(antes.nivel)
    // celestial: más vida y más luz. Ciclo 2: el jefe pega más
    expect(d.vidaMax).toBeGreaterThan(antes.vidaMax)
    expect(d.halo).toBeGreaterThan(antes.halo)
    expect(d.multJefe).toBeGreaterThan(antes.multJefe)
    // y queda guardado
    await page.reload()
    await abrirMundo(page, 'sophie')
    expect((await ciclo(page)).ciclo).toBe(2)
    await sinErrores(errores)
  })
})
