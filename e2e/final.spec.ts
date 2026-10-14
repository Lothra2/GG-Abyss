import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, manifest, sinErrores, vigilarErrores } from './util'

// F13, el final: las cinemáticas (la bajada al infierno y el cierre), la escena del final con el botón para jugar con
// alas, y el Ciclo 2 que vuelve al Bosque con su nivel y su equipo, celestial y todo más difícil.

interface Ciclo { ciclo: number; celestial: boolean; cines: string[]; multJefe: number; halo: number; vidaMax: number; nivel: number; mundo: string; alasS: number; lanzaS: number; vuelos: number; volando: boolean; ultimaLanza: number; invulnerable: boolean }
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

  test('la celestial vuela con las alas sin recibir daño y su lanza de luz atraviesa en línea', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    await gancho(page, 'saltarPresentacion')
    // sin ser celestial no tiene poderes
    expect(await gancho(page, 'alas')).toBe(false)
    await gancho(page, 'hacerCelestial')
    await gancho(page, 'curarTodo')
    const p0 = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(await gancho(page, 'alas', p0.x + 300, p0.y)).toBe(true)
    await gancho(page, 'avanzar', 0.15)
    const enVuelo = await ciclo(page)
    expect(enVuelo.volando).toBe(true)
    expect(enVuelo.invulnerable).toBe(true)
    await gancho(page, 'avanzar', 0.8)
    const p1 = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeGreaterThan(60)
    const d = await ciclo(page)
    expect(d.volando).toBe(false)
    expect(d.alasS).toBeGreaterThan(0)
    // recargando no vuelve a volar
    expect(await gancho(page, 'alas')).toBe(false)
    // la lanza: de lejos, contra un enemigo del mapa
    const es = await gancho<{ id: number; x: number; y: number; vida: number; vivo: boolean }[]>(page, 'enemigos')
    const e = es.find((q) => q.vivo)!
    await gancho(page, 'teleport', e.x - 120, e.y)
    await gancho(page, 'curarTodo')
    expect(await gancho(page, 'lanza', e.x, e.y)).toBe(true)
    await gancho(page, 'avanzar', 1)
    expect((await ciclo(page)).ultimaLanza).toBeGreaterThanOrEqual(1)
    const despues = (await gancho<{ id: number; vida: number; vivo: boolean }[]>(page, 'enemigos')).find((q) => q.id === e.id)!
    expect(!despues.vivo || despues.vida < e.vida).toBe(true)
    // los dos botones se ven en el HUD
    await expect.poll(async () => (await gancho<{ celestial: { id: string; visible: boolean }[] }>(page, 'hudCombate')).celestial.map((b) => `${b.id}:${b.visible}`), { timeout: 8000 }).toEqual(['alas:true', 'lanza:true'])
    await sinErrores(errores)
  })
})
