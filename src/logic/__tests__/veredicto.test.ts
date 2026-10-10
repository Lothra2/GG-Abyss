import { describe, expect, it } from 'vitest'
import { leerJson } from '../../../scripts/lib/verificacion'
import { leerCatalogo } from '../catalogo'
import { veredicto } from '../veredicto'
import type { Manifest } from '../../kit/tipos'

const KIT = 'public/assets/kit/'
const manifest = leerJson<Manifest>(KIT + 'manifest.json')
const cat = leerCatalogo(leerJson(KIT + manifest.botin.catalogo))

describe('veredicto: ¿conviene ponérselo?', () => {
  it('con el casillero vacío, cualquier cosa es mejor', () => {
    expect(veredicto(cat, {}, 'sword_1', 'paladin')!.juicio).toBe('mejor')
  })
  it('un arma más fuerte es mejor y una más floja es peor, con las diferencias para mostrar', () => {
    const v = veredicto(cat, { arma: 'sword_1' }, 'm_espada_cruel', 'paladin')!
    expect(v.juicio).toBe('mejor')
    expect(v.dif.some((d) => d.etiqueta.startsWith('Daño') && d.delta > 0)).toBe(true)
    const w = veredicto(cat, { arma: 'm_espada_cruel' }, 'sword_1', 'paladin')!
    expect(w.juicio).toBe('peor')
    expect(w.contra).toBe('m_espada_cruel')
  })
  it('lo mismo que ya lleva es igual', () => {
    expect(veredicto(cat, { arma: 'sword_1' }, 'sword_1', 'paladin')!.juicio).toBe('igual')
  })
  it('las pociones no se juzgan', () => {
    expect(veredicto(cat, {}, 'potion_health_minor', 'paladin')).toBeNull()
  })
  it('un anillo va al hueco libre y, si están los dos, se compara con el más flojo', () => {
    expect(veredicto(cat, { anillo_1: 'm_anillo_vida' }, 'm_anillo_vida', 'paladin')!.ranura).toBe('anillo_2')
  })
})
