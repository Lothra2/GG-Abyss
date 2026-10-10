import { describe, expect, it } from 'vitest'
import { AlmacenMemoria, borrarPartida, cargarOCrear, claveDe, guardarPartida, leerPartida, listaPerfiles, migrar, partidaNueva } from '../guardado'

describe('guardado', () => {
  it('crea una partida nueva con lo básico', () => {
    const p = partidaNueva('sophie', 1000)
    expect(p.version).toBe(1)
    expect(p.nivel).toBe(1)
    expect(p.oro).toBe(0)
    expect(p.bolsa).toHaveLength(28)
    expect(p.cinturon).toHaveLength(4)
    expect(p.ajustes.noche).toBeCloseTo(0.15)
    expect(p.ajustes.modoPeque).toBe(false)
    expect(partidaNueva('alana').ajustes.modoPeque).toBe(true)
  })

  it('guarda y lee lo mismo, y la lista de perfiles crece sin repetir', () => {
    const alm = new AlmacenMemoria()
    const p = partidaNueva('rick', 5)
    p.oro = 42
    p.cofres.push('cofre:112:2640')
    guardarPartida(alm, p, 10)
    guardarPartida(alm, p, 20)
    const r = leerPartida(alm, 'rick')
    expect(r.rota).toBe(false)
    expect(r.partida!.oro).toBe(42)
    expect(r.partida!.cofres).toEqual(['cofre:112:2640'])
    expect(r.partida!.actualizada).toBe(20)
    expect(listaPerfiles(alm)).toEqual(['rick'])
    expect(alm.getItem(claveDe('rick'))).toContain('"oro":42')
  })

  it('cada jugadora tiene su partida aparte', () => {
    const alm = new AlmacenMemoria()
    const a = partidaNueva('sophie')
    a.oro = 10
    const b = partidaNueva('alana')
    b.oro = 99
    guardarPartida(alm, a)
    guardarPartida(alm, b)
    expect(leerPartida(alm, 'sophie').partida!.oro).toBe(10)
    expect(leerPartida(alm, 'alana').partida!.oro).toBe(99)
    expect(listaPerfiles(alm).sort()).toEqual(['alana', 'sophie'])
  })

  it('sin nada guardado no hay partida y no es un error', () => {
    const r = leerPartida(new AlmacenMemoria(), 'steph')
    expect(r).toEqual({ partida: null, rota: false })
    const c = cargarOCrear(new AlmacenMemoria(), 'steph')
    expect(c.nueva).toBe(true)
    expect(c.partida.id).toBe('steph')
  })

  it('migra una versión 0 de prueba a la actual sin perder lo importante', () => {
    const v0 = { version: 0, id: 'sophie', level: 4, gold: 120, zonas: ['Claro de la Llegada'], ajustes: { noche: 0.9 }, bolsa: ['sword_1'] }
    const p = migrar(v0)!
    expect(p.version).toBe(1)
    expect(p.nivel).toBe(4)
    expect(p.oro).toBe(120)
    expect(p.zonas).toEqual(['Claro de la Llegada'])
    // la noche se recorta al máximo de 0.55
    expect(p.ajustes.noche).toBeCloseTo(0.55)
    expect(p.bolsa).toHaveLength(28)
    expect(p.bolsa[0]).toBe('sword_1')
    expect(p.cinturon).toHaveLength(4)
  })

  it('migrar arregla tipos raros y recorta rangos', () => {
    const p = migrar({ id: 'alana', nivel: 99, oro: -5, zonas: 'no soy lista', cofres: [1, 'cofre:1:2'], ajustes: { modoPeque: true, noche: 0.5, calidad: 'rara' } })!
    expect(p.nivel).toBe(10)
    expect(p.oro).toBe(0)
    expect(p.zonas).toEqual([])
    expect(p.cofres).toEqual(['cofre:1:2'])
    expect(p.ajustes.calidad).toBe('alta')
    // modo peque: la noche llega a 0.25
    expect(p.ajustes.noche).toBeCloseTo(0.25)
  })

  it('algo que no es una partida da null', () => {
    expect(migrar(null)).toBeNull()
    expect(migrar([])).toBeNull()
    expect(migrar({ nivel: 3 })).toBeNull()
    expect(migrar({ nivel: 3 }, 'rick')!.id).toBe('rick')
  })

  it('un JSON roto no se pierde: queda una copia y se puede crear una partida nueva', () => {
    const alm = new AlmacenMemoria()
    alm.setItem(claveDe('sophie'), '{esto no es json')
    const r = leerPartida(alm, 'sophie', 777)
    expect(r.partida).toBeNull()
    expect(r.rota).toBe(true)
    expect(r.copia).toBe('ggabyss:v1:roto:sophie:777')
    expect(alm.getItem(r.copia!)).toBe('{esto no es json')
    const c = cargarOCrear(alm, 'sophie', 800)
    expect(c.nueva).toBe(true)
  })

  it('una partida de otro perfil guardada en la clave equivocada también va a la copia', () => {
    const alm = new AlmacenMemoria()
    alm.setItem(claveDe('sophie'), JSON.stringify({ id: 'alana', nivel: 3 }))
    const r = leerPartida(alm, 'sophie', 5)
    expect(r.rota).toBe(true)
    expect(alm.getItem('ggabyss:v1:roto:sophie:5')).toContain('alana')
  })

  it('borrar deja una copia por si fue sin querer y saca al perfil de la lista', () => {
    const alm = new AlmacenMemoria()
    guardarPartida(alm, partidaNueva('rick'))
    borrarPartida(alm, 'rick', 9)
    expect(leerPartida(alm, 'rick').partida).toBeNull()
    expect(listaPerfiles(alm)).toEqual([])
    expect(alm.claves().some((k) => k.startsWith('ggabyss:v1:roto:rick:borrada'))).toBe(true)
  })
  it('una partida de antes de F7 abre con efectos normales y las mejoras prendidas', () => {
    const vieja = { ...partidaNueva('sophie'), ajustes: { noche: 0.2, calidad: 'alta', musica: 0.5, efectos: 0.5, modoPeque: false } }
    const p = migrar(JSON.parse(JSON.stringify(vieja)), 'sophie')!
    expect(p.ajustes.efectosSuaves).toBe(false)
    expect(p.ajustes.mejorasF7).toBe(true)
    expect(p.ajustes.musica).toBe(0.5)
  })
})
