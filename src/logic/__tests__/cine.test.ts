import { describe, expect, it } from 'vitest'
import { CINE, duracionCine, letrasCine, panelesCine, planoEn, planosCine, TEXTOS_CINE } from '../cine'

const capa = { nombre: 'fondo', archivo: 'x.png', cuadros: 1, fps: 1, paralaje: 0.5 }
const cine = {
  bajada_puerta: { w: 480, h: 270, capas: [capa] },
  bajada_escalera: { w: 480, h: 540, capas: [capa] },
  nieve_frente: { archivo: 'n.png', w: 64, h: 64, cuadros: 4, fps: 8 },
  bajada_titulo: { w: 480, h: 270, capas: [capa] },
  audio: { musica: 'cine_bajada_musica' },
  guion: { bajada_escalera: { dura: 7, texto: 'Abajo.' } },
}

describe('las cinemáticas del final', () => {
  it('lee solo los paneles (lo que trae capas), en su orden', () => {
    expect(panelesCine(cine).map((p) => p.nombre)).toEqual(['bajada_puerta', 'bajada_escalera', 'bajada_titulo'])
    expect(panelesCine(undefined)).toEqual([])
  })

  it('arma la línea de tiempo con el guion del taller y los textos de siempre', () => {
    const ps = planosCine(cine, TEXTOS_CINE.cine_bajada)
    expect(ps.map((p) => p.desde)).toEqual([0, CINE.duraS, CINE.duraS + 7])
    expect(ps[0]!.texto).toBe('La Puerta Negra se abrió.')
    expect(ps[1]!.texto).toBe('Abajo.')
    expect(ps[2]!.titulo).toBe(true)
    expect(duracionCine(ps)).toBe(CINE.duraS + 7 + CINE.tituloS)
  })

  it('sabe qué plano va en cada momento y cuántas letras se ven', () => {
    const ps = planosCine(cine)
    expect(planoEn(ps, 0)?.i).toBe(0)
    expect(planoEn(ps, CINE.duraS + 1)?.i).toBe(1)
    expect(planoEn(ps, 999)).toBeNull()
    expect(letrasCine('Hola', 0)).toBe(0)
    expect(letrasCine('Hola', 10)).toBe(4)
  })
})
