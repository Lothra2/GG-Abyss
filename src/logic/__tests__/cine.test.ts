import { describe, expect, it } from 'vitest'
import { CINE, duracionCine, hojasCine, letrasCine, panelesCine, planoEn, planosCine, sonidosCine, TEXTOS_CINE } from '../cine'

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

describe('el guion del taller (desde y hasta sobre la música)', () => {
  const c2 = {
    bajada_puerta: { w: 480, h: 270, capas: [capa] },
    bajada_titulo: { w: 480, h: 270, capas: [capa] },
    logo_hielo: { archivo: 'l.png', w: 300, h: 100, cuadros: 16, columnas: 4, bucle_desde: 12 },
    nieve_frente: { archivo: 'n.png', w: 128, h: 128, cuadros: 8 },
    guion: [
      { panel: 'bajada_puerta', desde: 0, hasta: 10, subtitulo: 'La Puerta Negra se abrió.', sonido: [{ nombre: 'puerta_negra', en: 0.5 }] },
      { panel: 'bajada_titulo', desde: 50.5, hasta: 60, sonido: [{ nombre: 'cine_rugido', en: 50.5 }] },
    ],
  }
  it('cada panel va en su segundo de la música, con sus sonidos', () => {
    const ps = planosCine(c2)
    expect(ps.map((p) => [p.desde, p.dura])).toEqual([[0, 10], [50.5, 9.5]])
    expect(ps[1]!.titulo).toBe(true)
    expect(ps[0]!.sonidos).toEqual([{ nombre: 'puerta_negra', en: 0.5 }])
    expect(sonidosCine(c2).sort()).toEqual(['cine_rugido', 'puerta_negra'])
  })
  it('separa el logo de lo que cruza delante', () => {
    expect(hojasCine(c2)).toEqual({ logo: 'logo_hielo', cruza: ['nieve_frente'] })
  })
})
