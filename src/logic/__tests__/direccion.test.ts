import { describe, expect, it } from 'vitest'
import { DIRECCIONES, direccionConMargen, direccionDe, indiceDireccion, opuesta, vectorDe } from '../direccion'
import { leerJson } from '../../../scripts/lib/verificacion'
import type { Manifest } from '../../kit/tipos'

describe('direccion', () => {
  it('los 8 vectores dan las 8 direcciones en el orden del manifest', () => {
    const m = leerJson<Manifest>('public/assets/kit/manifest.json')
    expect([...DIRECCIONES]).toEqual(m.direcciones)
    const casos: [number, number, string][] = [
      [0, 1, 'down'], [-1, 1, 'down_left'], [-1, 0, 'left'], [-1, -1, 'up_left'],
      [0, -1, 'up'], [1, -1, 'up_right'], [1, 0, 'right'], [1, 1, 'down_right'],
    ]
    casos.forEach(([dx, dy, esperada], i) => {
      expect(direccionDe(dx, dy, m.direcciones)).toBe(esperada)
      expect(indiceDireccion(dx, dy)).toBe(i)
    })
  })

  it('un vector cerca de la frontera cae en la dirección más cercana', () => {
    expect(direccionDe(1, 0.2)).toBe('right')
    expect(direccionDe(1, 0.9)).toBe('down_right')
    expect(direccionDe(-0.2, 1)).toBe('down')
  })

  it('vectorDe es el inverso de direccionDe', () => {
    for (const d of DIRECCIONES) {
      const v = vectorDe(d)
      expect(direccionDe(v.x, v.y)).toBe(d)
    }
  })

  it('opuesta da la dirección contraria', () => {
    expect(opuesta('up')).toBe('down')
    expect(opuesta('left')).toBe('right')
    expect(opuesta('up_left')).toBe('down_right')
  })
})

describe('dirección con margen', () => {
  const DER = DIRECCIONES.indexOf('right')
  it('no cambia por un temblor chico hacia la dirección vecina', () => {
    // 30 grados hacia abajo desde la derecha: indiceDireccion ya diría abajo-derecha, con margen sigue a la derecha
    const a = (30 * Math.PI) / 180
    expect(indiceDireccion(Math.cos(a), Math.sin(a))).toBe(DIRECCIONES.indexOf('down_right'))
    expect(direccionConMargen(DER, Math.cos(a), Math.sin(a))).toBe(DER)
  })
  it('sí cambia cuando el giro es claro, y quieto se queda como estaba', () => {
    expect(direccionConMargen(DER, 0, 1)).toBe(DIRECCIONES.indexOf('down'))
    expect(direccionConMargen(DER, -1, 0)).toBe(DIRECCIONES.indexOf('left'))
    expect(direccionConMargen(DER, 0, 0)).toBe(DER)
  })
})
