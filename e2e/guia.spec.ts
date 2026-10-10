import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'
import { GUIA } from '../src/config/balance'

// La flecha guía: aparece en el borde si pasa un rato sin progreso y apunta a lo que falta.

interface GuiaInfo { sinProgreso: number; visible: boolean; flecha: { x: number; y: number; dir: number; destino: { tipo: string; nombre: string } } | null }
const guia = (p: Page) => gancho<GuiaInfo>(p, 'guia')

test.describe('Flecha guía', () => {
  test('sin progreso aparece en el borde apuntando a una zona sin descubrir, y se va al descubrirla', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    // desde una punta del mapa, lo que falta queda fuera de la pantalla
    await gancho(page, 'irAPostal', 'claro_escondido')
    await gancho(page, 'avanzar', 1)
    expect((await guia(page)).flecha).toBeNull()
    await gancho(page, 'forzarGuia')
    await gancho(page, 'avanzar', 0.2)
    const g = await guia(page)
    expect(g.flecha).not.toBeNull()
    expect(g.flecha!.destino.tipo).toBe('zona')
    // está en el borde de la pantalla y se ve en el HUD
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    const f = g.flecha!
    expect(f.x).toBeGreaterThanOrEqual(0)
    expect(f.x).toBeLessThanOrEqual(v.vista.w)
    expect(f.y).toBeGreaterThanOrEqual(0)
    expect(f.y).toBeLessThanOrEqual(v.vista.h)
    const cerca = Math.min(f.x, v.vista.w - f.x, f.y, v.vista.h - f.y)
    expect(cerca).toBeLessThanOrEqual(Math.max(GUIA.margen, GUIA.margenAbajo) + 2)
    await expect.poll(async () => (await gancho<{ flecha: unknown }>(page, 'hudLayout')).flecha, { timeout: 10_000 }).not.toBeNull()
    // descubrir algo es progreso: la flecha se va y el reloj vuelve a cero
    await gancho(page, 'irAPostal', 'anillo_de_hadas')
    await gancho(page, 'avanzar', 0.5)
    const d = await guia(page)
    expect(d.flecha).toBeNull()
    expect(d.sinProgreso).toBeLessThan(5)
    await sinErrores(errores)
  })

  test('con nivel para el jefe apunta a la arena, y durante la pelea no aparece', async ({ page }) => {
    await abrirMundo(page, 'rick')
    await gancho(page, 'ponerNivel', 10)
    await gancho(page, 'avanzar', 0.2)
    await gancho(page, 'forzarGuia')
    await gancho(page, 'avanzar', 0.2)
    expect((await guia(page)).flecha?.destino.tipo).toBe('arena')
    await gancho(page, 'entrarArena')
    await gancho(page, 'avanzar', 0.5)
    await gancho(page, 'forzarGuia')
    await gancho(page, 'avanzar', 0.2)
    expect((await guia(page)).flecha).toBeNull()
  })

  test('el chip del objetivo siempre dice qué toca y al tocarlo sale la flecha', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'alana')
    await gancho(page, 'irAPostal', 'claro_escondido')
    await gancho(page, 'avanzar', 0.5)
    type Obj = { clave: string; texto: string; icono: string; chip: { x: number; y: number; width: number; height: number } }
    const obj = () => gancho<Obj>(page, 'hudObjetivo')
    await expect.poll(async () => (await obj()).clave, { timeout: 10_000 }).toBe('explorar')
    expect((await obj()).texto).toMatch(/^Explora \d+\/\d+$/)
    // con nivel para el jefe el objetivo cambia
    await gancho(page, 'ponerNivel', GUIA.nivelParaJefe)
    await expect.poll(async () => (await obj()).clave, { timeout: 10_000 }).toBe('jefe')
    expect((await guia(page)).flecha).toBeNull()
    // tocarlo pide la flecha sin esperar
    const c = (await obj()).chip
    const z = await gancho<{ cssZoom: number }>(page, 'escala')
    await page.mouse.click((c.x + c.width / 2) * z.cssZoom, (c.y + c.height / 2) * z.cssZoom)
    await expect.poll(async () => (await guia(page)).visible, { timeout: 10_000 }).toBe(true)
    await gancho(page, 'avanzar', 0.2)
    expect((await guia(page)).flecha?.destino.tipo).toBe('arena')
    await sinErrores(errores)
  })
})
