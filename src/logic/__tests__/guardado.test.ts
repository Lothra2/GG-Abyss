import { describe, expect, it } from 'vitest'
import { AlmacenMemoria, borrarPartida, cargarOCrear, claveDe, guardarPartida, leerPartida, listaPerfiles, migrar, partidaNueva, cambiarDeMundo } from '../guardado'

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

describe('F8: varios mundos', () => {
  it('una partida vieja queda en el Bosque, sin otros mundos', () => {
    const vieja = { id: 'sophie', nivel: 4, zonas: ['Claro de la Llegada'], jefeVencido: true }
    const p = migrar(vieja)!
    expect(p.mundo).toBe('mundo1')
    expect(p.otrosMundos).toEqual({})
    expect(p.jefeVencido).toBe(true)
  })
  it('bajar a la Catedral guarda el Bosque tal cual y empieza la Catedral de cero; volver lo devuelve todo', () => {
    const p = partidaNueva('alana')
    p.zonas.push('Claro de la Llegada', 'Arroyo Cristalino')
    p.cofres.push('cofre:1:2')
    p.jefeVencido = true
    p.ultimaFogata = 'escalera'
    p.oro = 77
    const zonas = p.zonas
    cambiarDeMundo(p, 'mundo2', { x: 100, y: 200 })
    expect(p.mundo).toBe('mundo2')
    expect(p.zonas).toEqual([])
    // es el mismo arreglo (quien lo tenga en la mano ve el del mundo nuevo)
    expect(p.zonas).toBe(zonas)
    expect(p.jefeVencido).toBe(false)
    expect(p.posicion).toEqual({ x: 0, y: 0 })
    expect(p.oro).toBe(77)
    expect(p.otrosMundos.mundo1!.posicion).toEqual({ x: 100, y: 200 })
    p.zonas.push('La Escalera Hundida')
    p.brasas.push('nave')
    cambiarDeMundo(p, 'mundo1')
    expect(p.brasas).toEqual([])
    expect(p.otrosMundos.mundo2!.brasas).toEqual(['nave'])
    expect(p.zonas).toEqual(['Claro de la Llegada', 'Arroyo Cristalino'])
    expect(p.cofres).toEqual(['cofre:1:2'])
    expect(p.jefeVencido).toBe(true)
    expect(p.ultimaFogata).toBe('escalera')
    expect(p.posicion).toEqual({ x: 100, y: 200 })
    expect(p.otrosMundos.mundo2!.zonas).toEqual(['La Escalera Hundida'])
    expect(p.otrosMundos.mundo1).toBeUndefined()
  })
  it('lo de otros mundos sobrevive a guardar y leer, y un JSON roto no lo rompe', () => {
    const p = partidaNueva('rick')
    cambiarDeMundo(p, 'mundo2')
    p.zonas.push('El Atrio de las Luciérnagas')
    const leida = migrar(JSON.parse(JSON.stringify(p)))!
    expect(leida.mundo).toBe('mundo2')
    expect(leida.zonas).toEqual(['El Atrio de las Luciérnagas'])
    expect(leida.otrosMundos.mundo1!.posicion).toEqual({ x: 0, y: 0 })
    const rota = migrar({ id: 'rick', mundo: 'mundo2', otrosMundos: { mundo1: 'basura', mundo3: { zonas: [1, 'x'] } } })!
    expect(rota.otrosMundos.mundo1).toBeUndefined()
    expect(rota.otrosMundos.mundo3!.zonas).toEqual(['x'])
  })
})
