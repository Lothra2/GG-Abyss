import { expect, type Page } from '@playwright/test'
import type { Manifest } from '../src/kit/tipos'

/** Junta los errores de la consola y de la página */
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`console.error: ${m.text()}`)
  })
  return errores
}

export async function esperarEscena(page: Page, nombre: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction((n) => window.__ABYSS__ && (window.__ABYSS__.escena as () => string)() === n, nombre, { timeout })
}

/** Lee un gancho de prueba */
export async function gancho<T = unknown>(page: Page, nombre: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([n, a]) => {
      const f = (window.__ABYSS__ as unknown as Record<string, (...x: unknown[]) => unknown>)[n as string]
      if (!f) throw new Error(`No existe el gancho ${String(n)}`)
      return f(...(a as unknown[]))
    },
    [nombre, args] as const,
  ) as Promise<T>
}

export async function manifest(page: Page): Promise<Manifest> {
  return page.evaluate(async () => (await fetch('assets/kit/manifest.json')).json())
}

export async function sinErrores(errores: string[]): Promise<void> {
  expect(errores.filter((e) => !/favicon/i.test(e))).toEqual([])
}

export interface MapaInfo {
  ancho: number
  alto: number
  inicio: { x: number; y: number }
  zonas: { nombre: string; x: number; y: number; w: number; h: number; secreto: boolean; descubrir: boolean; oscuridad: number }[]
  postales: { nombre: string; x: number; y: number }[]
  resumen: { zonas: number; totalZonas: number; secretos: number; totalSecretos: number }
}

/** Abre el mundo con una heroína y espera a que esté listo */
export async function abrirMundo(page: Page, heroe = 'sophie', extra = ''): Promise<void> {
  await page.goto(`/?test=1&seed=1&heroe=${heroe}${extra}`)
  await page.waitForFunction(
    () => {
      const a = window.__ABYSS__ as unknown as Record<string, () => unknown> | undefined
      return !!a && a.escena!() === 'Mundo' && typeof a.noEsperar === 'function' && a.noEsperar() === true
    },
    null,
    { timeout: 120_000 },
  )
}

/** Una zona se recorre con un punto que no cae dentro de otra más chica que ella */
export function puntoPropioDeZona(mapa: MapaInfo, nombre: string): { x: number; y: number } {
  const z = mapa.zonas.find((q) => q.nombre === nombre)!
  const dentroDeMenor = (x: number, y: number) => mapa.zonas.some((o) => o !== z && o.w * o.h < z.w * z.h && x >= o.x && y >= o.y && x < o.x + o.w && y < o.y + o.h)
  for (let fy = 0.5; fy <= 0.95; fy += 0.1) {
    for (let fx = 0.5; fx <= 0.95; fx += 0.1) {
      const x = z.x + z.w * fx
      const y = z.y + z.h * fy
      if (!dentroDeMenor(x, y)) return { x, y }
    }
  }
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 }
}

/** De coordenadas del mundo a coordenadas de la página (pixeles CSS) para tocar con mouse o dedo */
export async function mundoAPagina(page: Page, wx: number, wy: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([x, y]) => {
      const a = window.__ABYSS__ as unknown as Record<string, () => Record<string, number>>
      const cam = a.camara!()
      const esc = a.escala!()
      const sx = x! - (cam.x! - cam.ancho! / 2)
      const sy = y! - (cam.y! - cam.alto! / 2)
      return { x: sx * esc.cssZoom!, y: sy * esc.cssZoom! }
    },
    [wx, wy] as const,
  )
}
