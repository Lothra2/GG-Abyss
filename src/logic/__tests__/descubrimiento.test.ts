import { describe, expect, it } from 'vitest'
import { descubrirSecretoCofre, descubrirZona, llaveSecretoZona, resumen } from '../descubrimiento'
import type { MapaJuego, Zona } from '../../kit/mapa'

const z = (nombre: string, extra: Partial<Zona> = {}): Zona => ({
  nombre, x: 0, y: 0, w: 10, h: 10, area: 100, musica: 'bosque', ambiente: 'bosque', luz: null, oscuridad: 0, niebla: 0.3, particulas: [], descubrir: true, secreto: false, props: {}, ...extra,
})

// un mapa de prueba chico con 3 zonas, una secreta, y 2 cofres secretos de 3
const mapaChico = {
  zonas: [z('A'), z('B'), z('C', { secreto: true }), z('D', { descubrir: false })],
  entidades: [
    { id: 1, tipo: 'cofre', x: 0, y: 0, props: { secreto: true } },
    { id: 2, tipo: 'cofre', x: 1, y: 0, props: { secreto: true } },
    { id: 3, tipo: 'cofre', x: 2, y: 0, props: {} },
  ],
} as unknown as MapaJuego

describe('descubrimiento', () => {
  it('una zona se descubre una sola vez', () => {
    const est = { zonas: [] as string[], secretos: [] as string[] }
    expect(descubrirZona(est, mapaChico.zonas[0]!).nueva).toBe(true)
    expect(descubrirZona(est, mapaChico.zonas[0]!).nueva).toBe(false)
    expect(est.zonas).toEqual(['A'])
  })

  it('una zona sin `descubrir` no cuenta', () => {
    const est = { zonas: [] as string[], secretos: [] as string[] }
    expect(descubrirZona(est, mapaChico.zonas[3]!).nueva).toBe(false)
    expect(est.zonas).toEqual([])
  })

  it('una zona secreta suma a zonas y a secretos, una sola vez', () => {
    const est = { zonas: [] as string[], secretos: [] as string[] }
    const r = descubrirZona(est, mapaChico.zonas[2]!)
    expect(r).toEqual({ nueva: true, secreto: true })
    descubrirZona(est, mapaChico.zonas[2]!)
    expect(est.secretos).toEqual([llaveSecretoZona(mapaChico.zonas[2]!)])
  })

  it('un cofre secreto no se cuenta dos veces', () => {
    const est = { zonas: [] as string[], secretos: [] as string[] }
    expect(descubrirSecretoCofre(est, 'cofre:0:0')).toBe(true)
    expect(descubrirSecretoCofre(est, 'cofre:0:0')).toBe(false)
    expect(est.secretos.length).toBe(1)
  })

  it('los totales salen del mapa: 3 zonas que se descubren y 3 secretos (2 cofres y 1 zona)', () => {
    const est = { zonas: ['A'], secretos: [] as string[] }
    descubrirSecretoCofre(est, 'cofre:0:0')
    expect(resumen(est, mapaChico)).toEqual({ zonas: 1, totalZonas: 3, secretos: 1, totalSecretos: 3 })
  })
})
