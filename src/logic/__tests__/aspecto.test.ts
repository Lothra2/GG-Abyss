import { describe, expect, it } from 'vitest'
import { leerCatalogo } from '../catalogo'
import { aspectoDe, aspectoDefecto, claveAspecto } from '../aspecto'
import type { CapasPersonaje, CapaHoja } from '../../kit/tipos'

const hoja: CapaHoja = { archivo: 'x.png', columnas: 27, bloques: { idle: { x: 0, y: 0, cuadros: 8 } } }
const capas: CapasPersonaje = {
  orden: ['pecho', 'casco', 'arma', 'mano'],
  defecto: { arma: 'bow', mano: null },
  arma: { bow: hoja, sword: hoja, greatsword: hoja },
  mano: { shield_kite: hoja },
  pecho: { placas_2: hoja },
  casco: { malla_3: hoja },
}
const item = (id: string, base: Record<string, unknown>, visual?: { capa: string; clave: string }, extra: Record<string, unknown> = {}) => ({ id, name: { es: id }, rarity: 'normal', level: 1, base, stats: { mods: [] }, text: { es: [] }, icon: id, atlas: 'iconos', animated: false, ...(visual ? { visual } : {}), ...extra })
const cat = leerCatalogo({
  rarities: {},
  sets: {},
  items: [
    item('espada', { cat: 'weapon', icon: 'sword' }, { capa: 'arma', clave: 'sword' }),
    item('mandoble', { cat: 'weapon', icon: 'greatsword' }, { capa: 'arma', clave: 'greatsword' }, { twoHanded: true }),
    item('escudo', { cat: 'offhand', icon: 'shield_kite' }, { capa: 'mano', clave: 'shield_kite' }),
    item('coraza', { cat: 'armor', slot: 'chest', line: 'placas', tier: 2 }, { capa: 'pecho', clave: 'placas_2' }),
    item('yelmo', { cat: 'armor', slot: 'helm', line: 'malla', tier: 3 }, { capa: 'casco', clave: 'malla_3' }),
    item('anillo', { cat: 'jewel', icon: 'ring' }),
  ],
} as never)

describe('lo que se ve puesto', () => {
  it('sin nada puesto lleva lo de su clase', () => {
    expect(aspectoDe({}, cat, capas)).toEqual([{ tipo: 'arma', clave: 'bow' }])
    expect(aspectoDefecto(capas)).toEqual([{ tipo: 'arma', clave: 'bow' }])
  })
  it('se apila en orden: pecho, casco, arma y mano', () => {
    const l = aspectoDe({ arma: 'espada', mano_libre: 'escudo', pecho: 'coraza', casco: 'yelmo', anillo_1: 'anillo' }, cat, capas)
    expect(claveAspecto(l)).toBe('pecho:placas_2|casco:malla_3|arma:sword|mano:shield_kite')
  })
  it('un arma de dos manos deja la mano libre vacía', () => {
    const conMano = { ...capas, defecto: { arma: 'sword', mano: 'shield_kite' } }
    expect(aspectoDe({ arma: 'mandoble' }, cat, conMano)).toEqual([{ tipo: 'arma', clave: 'greatsword' }])
    expect(aspectoDe({ arma: 'espada' }, cat, conMano).map((p) => p.tipo)).toEqual(['arma', 'mano'])
  })
  it('lo que el kit no trae dibujado no se pide', () => {
    expect(aspectoDe({ arma: 'espada' }, cat, { ...capas, arma: {} })).toEqual([])
    expect(aspectoDe({ arma: 'espada' }, cat, undefined)).toEqual([])
  })
})
