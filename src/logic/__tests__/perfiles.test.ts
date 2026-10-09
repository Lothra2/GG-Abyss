import { describe, expect, it } from 'vitest'
import { apodoDe, claseDe, tarjetas } from '../perfiles'
import { AlmacenMemoria, guardarPartida, partidaNueva } from '../guardado'
import { leerJson } from '../../../scripts/lib/verificacion'
import type { Manifest } from '../../kit/tipos'

const manifest = leerJson<Manifest>('public/assets/kit/manifest.json')

describe('perfiles', () => {
  it('lee las heroínas del manifest en el orden de las tarjetas', () => {
    const t = tarjetas(manifest, new AlmacenMemoria())
    expect(t.slice(0, 4).map((x) => x.id)).toEqual(['sophie', 'alana', 'rick', 'steph'])
    expect(t.length).toBeGreaterThanOrEqual(4)
  })

  it('los apodos: Papá y Mamá, el resto usa el nombre del manifest', () => {
    const t = tarjetas(manifest, new AlmacenMemoria())
    expect(t.find((x) => x.id === 'rick')!.nombre).toBe('Papá')
    expect(t.find((x) => x.id === 'steph')!.nombre).toBe('Mamá')
    expect(t.find((x) => x.id === 'sophie')!.nombre).toBe(manifest.personajes.sophie!.nombre)
    expect(apodoDe('prima', 'Prima')).toBe('Prima')
  })

  it('cada heroína de la familia cae en su clase y su arma', () => {
    const t = Object.fromEntries(tarjetas(manifest, new AlmacenMemoria()).map((x) => [x.id, x]))
    expect(t.sophie!.clase).toBe('amazona')
    expect(t.sophie!.iconoArma).toBe('bow_1')
    expect(t.alana!.clase).toBe('druida')
    expect(t.alana!.iconoArma).toBe('wand_1')
    expect(t.rick!.clase).toBe('paladin')
    expect(t.steph!.clase).toBe('hechicera')
    expect(t.steph!.iconoArma).toBe('staff_1')
  })

  it('el modo peque arranca prendido solo para Alana', () => {
    const t = tarjetas(manifest, new AlmacenMemoria())
    expect(t.find((x) => x.id === 'alana')!.modoPeque).toBe(true)
    expect(t.filter((x) => x.id !== 'alana').every((x) => !x.modoPeque)).toBe(true)
  })

  it('muestra el nivel y el oro de la partida guardada', () => {
    const alm = new AlmacenMemoria()
    const p = partidaNueva('sophie')
    p.nivel = 3
    p.oro = 57
    guardarPartida(alm, p)
    const t = tarjetas(manifest, alm)
    const s = t.find((x) => x.id === 'sophie')!
    expect(s).toMatchObject({ tienePartida: true, nivel: 3, oro: 57 })
    expect(t.find((x) => x.id === 'alana')!.tienePartida).toBe(false)
  })

  it('una heroína nueva del estudio sale sola, con la clase de por defecto si es desconocida', () => {
    const m = structuredClone(manifest)
    m.personajes.prima = { ...m.personajes.sophie!, nombre: 'Prima', clase: 'bardo', desde_estudio: true }
    const t = tarjetas(m, new AlmacenMemoria())
    const prima = t.find((x) => x.id === 'prima')!
    expect(prima).toBeDefined()
    expect(prima.nombre).toBe('Prima')
    expect(prima.claseDesconocida).toBe(true)
    expect(prima.clase).toBe('amazona')
    expect(prima.desdeEstudio).toBe(true)
    expect(t.length).toBe(tarjetas(manifest, new AlmacenMemoria()).length + 1)
    expect(claseDe(m.personajes.prima).clase).toBe('amazona')
  })
})
