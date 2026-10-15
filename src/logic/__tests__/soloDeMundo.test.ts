import { describe, expect, it } from 'vitest'
import { delMundo, esDeOtroMundo } from '../soloDeMundo'
import { SOLO_EN_MUNDO } from '../../config/juego'
import { leerJson } from '../../../scripts/lib/verificacion'
import type { Manifest } from '../../kit/tipos'

const manifest = leerJson<Manifest>('public/assets/kit/manifest.json')
const solo = { mundo7: { audio: ['musica_diablo_1', 'frio_sube'], fx: ['rayo_rojo', 'proyectil_rayo_hielo'] } }

describe('lo que es de un solo mundo', () => {
  it('fuera de su mundo no hace falta, en su mundo sí', () => {
    expect(esDeOtroMundo('musica_diablo_1', 'audio', 'mundo1', solo)).toBe(true)
    expect(esDeOtroMundo('musica_diablo_1', 'audio', 'mundo7', solo)).toBe(false)
    expect(esDeOtroMundo('musica_bosque', 'audio', 'mundo1', solo)).toBe(false)
  })

  it('los proyectiles van por su base y sus 8 direcciones quedan adentro', () => {
    expect(esDeOtroMundo('proyectil_rayo_hielo_down_left', 'fx', 'mundo3', solo)).toBe(true)
    expect(esDeOtroMundo('proyectil_rayo_hielo_down_left', 'fx', 'mundo7', solo)).toBe(false)
    // otra base que empieza parecido no se confunde
    expect(esDeOtroMundo('proyectil_rayo', 'fx', 'mundo3', solo)).toBe(false)
  })

  it('la música de las cinemáticas es de la escena Cine: ningún mundo la carga', () => {
    for (const mu of ['mundo1', 'mundo7']) expect(esDeOtroMundo('cine_bajada_musica', 'audio', mu, solo)).toBe(true)
    expect(delMundo(['cine_fin_musica', 'click', 'frio_sube'], 'audio', 'mundo7', solo)).toEqual(['click', 'frio_sube'])
  })

  it('con el kit de verdad: el Bosque no carga lo del Mundo 7 y el Mundo 7 sí', () => {
    const audio = Object.keys(manifest.audio)
    const fx = Object.keys(manifest.fx)
    if (!(manifest.mundos ?? []).some((m) => m.id === 'mundo7')) return
    // cada nombre de la lista existe en el kit (si el taller lo renombra, se nota acá)
    for (const n of SOLO_EN_MUNDO.mundo7.audio) expect(audio, n).toContain(n)
    for (const n of SOLO_EN_MUNDO.mundo7.fx) expect(fx.some((f) => f === n || f.startsWith(`${n}_`)), n).toBe(true)
    const bosque = delMundo(audio, 'audio', 'mundo1', SOLO_EN_MUNDO)
    expect(bosque).not.toContain('musica_diablo_final')
    expect(bosque).toContain('musica_bosque')
    expect(delMundo(audio, 'audio', 'mundo7', SOLO_EN_MUNDO)).toContain('musica_diablo_final')
    expect(delMundo(fx, 'fx', 'mundo1', SOLO_EN_MUNDO)).not.toContain('gota_sangre_diablo')
    // lo de la celestial vuela en cualquier mundo
    expect(delMundo(fx, 'fx', 'mundo1', SOLO_EN_MUNDO)).toEqual(expect.arrayContaining(['lanza_luz', 'estela_alas']))
  })
})
