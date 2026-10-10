import { describe, expect, it } from 'vitest'
import { DirectorJefe, type Plano } from '../escenaJefe'
import { ESCENA_JEFE } from '../../config/balance'

const correr = (d: DirectorJefe, seg: number, paso = 0.05): Plano[] => {
  const out: Plano[] = []
  for (let t = 0; t < seg; t += paso) out.push(d.tick(paso))
  return out
}

describe('director de la pelea con el jefe', () => {
  it('sin pelea la cámara sigue a la heroína y no hay nada de cine', () => {
    const p = new DirectorJefe().tick(0.1)
    expect(p).toMatchObject({ momento: null, foco: 'heroe', franjas: 0, titulo: null, bloquear: false })
  })
  it('la entrada: franjas, la cámara va al jefe, su nombre aparece y se va, la heroína espera', () => {
    const d = new DirectorJefe()
    d.empezar()
    const ps = correr(d, ESCENA_JEFE.intro.duracion - 0.06)
    expect(ps.every((p) => p.bloquear)).toBe(true)
    expect(ps.some((p) => p.foco === 'jefe')).toBe(true)
    expect(Math.max(...ps.map((p) => p.franjas))).toBe(1)
    expect(Math.max(...ps.map((p) => p.tituloAlfa))).toBe(1)
    expect(ps.find((p) => p.titulo)!.titulo).toBe('nombre')
    // después, pelea: la cámara encuadra a los dos y ella se mueve
    const despues = correr(d, 0.5).at(-1)!
    expect(despues).toMatchObject({ momento: null, foco: 'mezcla', franjas: 0, bloquear: false })
  })
  it('la fase 2 muestra el enojo sin frenar a la heroína', () => {
    const d = new DirectorJefe()
    d.empezar()
    correr(d, 3)
    d.fase2()
    const ps = correr(d, 1)
    expect(ps.some((p) => p.titulo === 'enojo' && p.tituloAlfa > 0.9)).toBe(true)
    expect(ps.every((p) => !p.bloquear)).toBe(true)
  })
  it('la muerte: la cámara mira al jefe, franjas y el título de victoria; al final vuelve a la heroína', () => {
    const d = new DirectorJefe()
    d.empezar()
    correr(d, 3)
    d.morir()
    d.fase2() // un golpe tardío no pisa la victoria
    const ps = correr(d, ESCENA_JEFE.muerte.duracion - 0.06)
    expect(ps[0]!.foco).toBe('jefe')
    expect(ps.some((p) => p.titulo === 'victoria' && p.tituloAlfa === 1)).toBe(true)
    expect(correr(d, 0.3).at(-1)).toMatchObject({ momento: null, foco: 'heroe' })
  })
  it('si la pelea se corta (rescate) se apaga todo', () => {
    const d = new DirectorJefe()
    d.empezar()
    correr(d, 0.5)
    d.cortar()
    expect(d.tick(0.1)).toMatchObject({ momento: null, foco: 'heroe', bloquear: false })
  })
})
