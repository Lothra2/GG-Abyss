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
