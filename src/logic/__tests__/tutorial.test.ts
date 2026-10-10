import { describe, expect, it } from 'vitest'
import { demostracion, pasoCumplido } from '../tutorial'

const base = { hechos: [] as string[], heroe: { x: 100, y: 100 }, enemigo: null, cofre: null, ocupada: false }

describe('demostraciones para Alana', () => {
  it('primero caminar, con la mano delante de ella', () => {
    const d = demostracion(base)!
    expect(d.paso).toBe('caminar')
    expect(d.donde.x).toBeGreaterThan(100)
  })
  it('pegar aparece recién con un enemigo cerca, y abrir con un cofre cerca', () => {
    const hecho = { ...base, hechos: ['caminar'] }
    expect(demostracion(hecho)).toBeNull()
    expect(demostracion({ ...hecho, enemigo: { x: 200, y: 100 } })!.paso).toBe('pegar')
    expect(demostracion({ ...hecho, hechos: ['caminar', 'pegar'], cofre: { x: 150, y: 90 } })!.paso).toBe('abrir')
  })
  it('nada mientras está ocupada (presentación, jefe, un panel)', () => {
    expect(demostracion({ ...base, ocupada: true })).toBeNull()
  })
  it('se cumple caminando 80 px, pegando una vez y abriendo un cofre', () => {
    expect(pasoCumplido('caminar', { movido: 79, golpes: 0, cofresAbiertos: 0 })).toBe(false)
    expect(pasoCumplido('caminar', { movido: 80, golpes: 0, cofresAbiertos: 0 })).toBe(true)
    expect(pasoCumplido('pegar', { movido: 0, golpes: 1, cofresAbiertos: 0 })).toBe(true)
    expect(pasoCumplido('abrir', { movido: 0, golpes: 0, cofresAbiertos: 1 })).toBe(true)
  })
})
