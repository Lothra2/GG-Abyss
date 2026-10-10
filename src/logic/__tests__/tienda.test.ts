import { describe, expect, it } from 'vitest'
import { leerJson } from '../../../scripts/lib/verificacion'
import { leerCatalogo } from '../catalogo'
import { comprar, ofertas } from '../tienda'
import type { Inv } from '../inventario'
import type { Manifest } from '../../kit/tipos'
import { TIENDA } from '../../config/balance'

const KIT = 'public/assets/kit/'
const manifest = leerJson(KIT + 'manifest.json') as Manifest
const cat = leerCatalogo(leerJson(KIT + manifest.botin.catalogo))
const inv = (extra: Partial<Inv> = {}): Inv => ({ equipo: {}, bolsa: Array(28).fill(null), cinturon: [null, null, null, null], ...extra })

describe('tienda de la fogata', () => {
  it('todo lo que vende existe en el catálogo del kit', () => {
    expect(ofertas(9999, inv(), cat)).toHaveLength(TIENDA.ofertas.length)
  })
  it('sin oro suficiente está cara y no se compra, y el oro no cambia', () => {
    const p = { oro: 3 }
    const i = inv()
    expect(ofertas(p.oro, i, cat).find((o) => o.id === 'potion_health_minor')!.estado).toBe('caro')
    expect(comprar(p, i, cat, 'potion_health_minor')).toEqual({ ok: false, motivo: 'caro' })
    expect(p.oro).toBe(3)
    expect(i.cinturon).toEqual([null, null, null, null])
  })
  it('una poción va al cinturón y descuenta el precio', () => {
    const p = { oro: 25 }
    const i = inv()
    const r = comprar(p, i, cat, 'potion_health_minor')
    expect(r).toEqual({ ok: true, donde: 'cinturon', oro: 15 })
    expect(i.cinturon[0]).toBe('potion_health_minor')
  })
  it('con el cinturón lleno la poción va a la bolsa, y con todo lleno no se vende', () => {
    const p = { oro: 100 }
    const i = inv({ cinturon: ['a', 'b', 'c', 'd'] })
    expect(comprar(p, i, cat, 'potion_mana_minor')).toMatchObject({ ok: true, donde: 'bolsa' })
    const lleno = inv({ cinturon: ['a', 'b', 'c', 'd'], bolsa: Array(28).fill('x') })
    expect(comprar(p, lleno, cat, 'potion_mana_minor')).toEqual({ ok: false, motivo: 'lleno' })
  })
  it('la armadura de Thor se le pone enseguida y la vieja vuelve a la bolsa', () => {
    const p = { oro: 500 }
    const i = inv({ equipo: { mascota: 'pet_armor_1' } })
    expect(comprar(p, i, cat, 'pet_armor_2')).toMatchObject({ ok: true, donde: 'thor' })
    expect(i.equipo.mascota).toBe('pet_armor_2')
    expect(i.bolsa).toContain('pet_armor_1')
  })
  it('si Thor ya tiene una igual o mejor, no se la vende', () => {
    const p = { oro: 500 }
    const i = inv({ equipo: { mascota: 'pet_armor_2' } })
    const o = ofertas(p.oro, i, cat)
    expect(o.find((x) => x.id === 'pet_armor_1')!.estado).toBe('tiene')
    expect(o.find((x) => x.id === 'pet_armor_2')!.estado).toBe('tiene')
    expect(o.find((x) => x.id === 'pet_armor_3')!.estado).toBe('ok')
    expect(comprar(p, i, cat, 'pet_armor_1')).toEqual({ ok: false, motivo: 'tiene' })
  })
  it('no vende lo que no está en la lista', () => {
    expect(comprar({ oro: 9999 }, inv(), cat, 'sword_1')).toEqual({ ok: false, motivo: 'no-vende' })
  })
})
