import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, sinErrores, vigilarErrores } from './util'

// El álbum de postales: una por lugar del mapa; las de zonas descubiertas a color, las que faltan en sombra.

interface Figu { postal: string; titulo: string; desbloqueada: boolean; x: number; y: number; w: number; h: number }
interface AlbumUI { abierto: boolean; desde: string; figuritas: Figu[]; grande: string | null; escalaFoto: number }
const ui = (p: Page) => gancho<AlbumUI>(p, 'albumUI')

async function abrir(page: Page): Promise<AlbumUI> {
  await gancho(page, 'abrirAlbum')
  await expect.poll(async () => (await ui(page).catch(() => null))?.abierto ?? false, { timeout: 10_000 }).toBe(true)
  return ui(page)
}

test.describe('Álbum de postales', () => {
  test('trae una figurita por postal del mapa, entra en la pantalla, y al principio faltan casi todas', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'sophie')
    const postales = await gancho<unknown[]>(page, 'postales')
    const a = await abrir(page)
    expect(a.figuritas.length).toBe(postales.length)
    expect(a.figuritas.filter((f) => !f.desbloqueada).length).toBeGreaterThan(0)
    const v = await gancho<{ vista: { w: number; h: number } }>(page, 'hudLayout')
    for (const f of a.figuritas) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x + f.w).toBeLessThanOrEqual(v.vista.w)
      expect(f.y + f.h).toBeLessThanOrEqual(v.vista.h)
    }
    // una que falta no se agranda; una pegada sí
    const falta = a.figuritas.find((f) => !f.desbloqueada)!
    expect(await gancho<boolean>(page, 'albumTocar', falta.postal)).toBe(false)
    await gancho(page, 'cerrarAlbum')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Album'), { timeout: 5_000 }).toBe(false)
    await sinErrores(errores)
  })

  test('al descubrir una zona, su postal queda pegada y se puede ver grande', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const a0 = await abrir(page)
    const falta = a0.figuritas.find((f) => !f.desbloqueada)!
    await gancho(page, 'cerrarAlbum')
    // Phaser cierra la escena en el cuadro siguiente: se espera, si no se vuelve a leer el álbum viejo
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Album'), { timeout: 10_000 }).toBe(false)
    // ir a esa postal descubre su zona
    await gancho(page, 'irAPostal', falta.postal)
    await gancho(page, 'avanzar', 1)
    const a1 = await abrir(page)
    expect(a1.figuritas.find((f) => f.postal === falta.postal)!.desbloqueada).toBe(true)
    expect(await gancho<boolean>(page, 'albumTocar', falta.postal)).toBe(true)
    expect((await ui(page)).grande).toBe(falta.postal)
  })

  test('se abre desde la pausa y al cerrar vuelve a la pausa', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'abrirPausa')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(true)
    const b = (await gancho<{ botones: { album: { width: number } } }>(page, 'pausa')).botones.album
    expect(b.width).toBeGreaterThan(0)
    await gancho(page, 'pausaAlbum')
    await expect.poll(async () => (await ui(page).catch(() => null))?.desde ?? '', { timeout: 10_000 }).toBe('Pausa')
    await gancho(page, 'cerrarAlbum')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 5_000 }).toBe(true)
    expect(await gancho<string[]>(page, 'escenasActivas')).not.toContain('Album')
  })
})
