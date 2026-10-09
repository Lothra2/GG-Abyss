import { describe, expect, it } from 'vitest'
import { verificarKit, leerJson, tamanoPng, LIMITE_TEXTURA } from '../../../scripts/lib/verificacion'
import { fuentesDe, heroes, idThor, personaje, rutasDelManifest, uiImagenes, validarManifest, KitError } from '../manifest'
import type { Manifest } from '../tipos'

const KIT = 'public/assets/kit'
const manifest = leerJson<Manifest>(`${KIT}/manifest.json`)

describe('kit de PixelForja', () => {
  const r = verificarKit(KIT)

  it('pasa la verificación completa sin errores', () => {
    expect(r.errores).toEqual([])
  })

  it('todas las rutas que nombra el manifest existen', () => {
    expect(rutasDelManifest(manifest).length).toBeGreaterThan(300)
    expect(r.errores.filter((e) => e.startsWith('Falta el archivo'))).toEqual([])
  })

  it('las hojas miden lo que dicen y ninguna textura pasa de 4096 px', () => {
    expect(r.revisado.hojas).toBeGreaterThan(300)
    expect(r.errores.filter((e) => e.includes('mide') || e.includes('pasa de'))).toEqual([])
    for (const s of manifest.mundo.suelo) {
      const t = tamanoPng(`${KIT}/${s.archivo}`)
      expect(t.w).toBeLessThanOrEqual(LIMITE_TEXTURA)
      expect(t.h).toBeLessThanOrEqual(LIMITE_TEXTURA)
    }
  })

  it('cada objeto que pone el mapa existe en el manifest', () => {
    expect(r.errores.filter((e) => e.includes('El mapa'))).toEqual([])
    expect(r.revisado.objetosMapa).toBeGreaterThan(30)
  })

  it('las 3 fuentes bitmap traen ñ, tildes, ¡ y ¿', () => {
    expect(Object.keys(fuentesDe(manifest)).sort()).toEqual(['fuente_titulo', 'fuente_titulo_plata', 'fuente_ui'])
    expect(r.errores.filter((e) => e.includes('fuente'))).toEqual([])
  })

  it('las 4 heroínas de la familia están y salen en orden', () => {
    const h = heroes(manifest)
    expect(h.slice(0, 4)).toEqual(['sophie', 'alana', 'rick', 'steph'])
    for (const id of h) expect(personaje(manifest, id).retrato).toBeTruthy()
  })

  it('cada heroína trae las animaciones que usan sus clases', () => {
    const necesarias = ['idle', 'walk', 'run', 'die', 'hit', 'attack', 'cast', 'shoot_bow', 'summon', 'whirlwind', 'block_shield', 'nova', 'channel', 'dodge']
    for (const id of heroes(manifest)) for (const a of necesarias) expect(manifest.personajes[id]!.anims[a], `${id}.${a}`).toBeDefined()
  })

  it('Thor y sus 5 armaduras existen', () => {
    expect(manifest.personajes[idThor(0)]).toBeDefined()
    for (let n = 1; n <= 5; n++) expect(manifest.personajes[idThor(n)], `armadura ${n}`).toBeDefined()
  })

  it('los enemigos del Mundo 1 y el jefe existen', () => {
    for (const id of ['rata', 'calabaza', 'goblin_arquero', 'trol', 'minotauro']) expect(manifest.personajes[id], id).toBeDefined()
    expect(manifest.personajes.minotauro!.tipo).toBe('jefe')
  })

  it('la interfaz que usa el juego está', () => {
    const ui = uiImagenes(manifest)
    for (const n of ['barra_marco', 'barra_xp', 'boton', 'panel', 'orbe_vida', 'orbe_mana', 'numeros', 'inventario', 'marca_destino', 'estandarte', 'barra_jefe']) {
      expect(ui[n], n).toBeDefined()
    }
  })

  it('validarManifest rechaza un kit que no es de GG Abyss o está viejo', () => {
    expect(() => validarManifest(null)).toThrow(KitError)
    expect(() => validarManifest({ ...manifest, juego: 'Otro' })).toThrow(KitError)
    expect(() => validarManifest({ ...manifest, version: 99 })).toThrow(/versión/)
    expect(() => validarManifest({ ...manifest, mundo: undefined })).toThrow(/mundo/)
    expect(validarManifest(manifest).juego).toBe('GG Abyss')
  })
})
