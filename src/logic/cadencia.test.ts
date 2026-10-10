import { expect, it } from 'vitest'
import { Cadencia } from './cadencia'
import type { AnimHoja } from '../kit/tipos'

const walk: AnimHoja = { archivo: '', cuadros: 8, fps: 10, loop: true, locomocion: { unidades_ciclo: 96 }, eventos: [{ tipo: 'foot_contact', fase: 0, pie: 'near' }, { tipo: 'foot_contact', fase: 0.5, pie: 'far' }] }

it('uses actual distance, including a turn and a wall stop', () => {
  const c = new Cadencia()
  expect(c.avanzar(12, walk)).toEqual({ frame: 1, contacts: 1 })
  expect(c.avanzar(0, walk)).toBeNull()
  expect(c.avanzar(36, walk)).toEqual({ frame: 4, contacts: 1 })
  expect(c.avanzar(48, walk)).toEqual({ frame: 0, contacts: 1 })
})

it('does not replay contacts after reset or a blocked tick', () => {
  const c = new Cadencia()
  expect(c.avanzar(0, walk)).toBeNull()
  expect(c.avanzar(1, walk)?.contacts).toBe(1)
  c.reset()
  expect(c.avanzar(1, walk)?.contacts).toBe(1)
})
