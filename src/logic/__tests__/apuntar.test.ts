import { describe, expect, it } from 'vitest'
import { blancoEnCono, difAngulo } from '../apuntar'

const o = { x: 0, y: 0 }
const der = 0
const cono = (70 * Math.PI) / 180

describe('atacar sin elegir enemigo', () => {
  it('le pega al más cercano que está hacia donde apunta y dentro del alcance', () => {
    const a = { x: 40, y: 0, vivo: true }
    const b = { x: 25, y: 5, vivo: true }
    const atras = { x: -10, y: -20, vivo: true }
    expect(blancoEnCono([a, b, atras], o, der, 60, cono)).toBe(b)
  })
  it('lo que está detrás o fuera del alcance no cuenta; los muertos tampoco', () => {
    expect(blancoEnCono([{ x: -40, y: 0, vivo: true }], o, der, 60, cono)).toBeNull()
    expect(blancoEnCono([{ x: 80, y: 0, vivo: true }], o, der, 60, cono)).toBeNull()
    expect(blancoEnCono([{ x: 30, y: 0, vivo: false }], o, der, 60, cono)).toBeNull()
  })
  it('alguien pegado a ella cuenta aunque esté a un costado', () => {
    const encima = { x: 0, y: 10, vivo: true }
    expect(blancoEnCono([encima], o, der, 60, cono)).toBe(encima)
  })
  it('los ángulos dan la vuelta bien', () => {
    expect(difAngulo(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2)
    expect(difAngulo(0, Math.PI)).toBeCloseTo(Math.PI)
  })
})
