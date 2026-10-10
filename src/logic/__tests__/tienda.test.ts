import { describe, expect, it } from 'vitest'
import { leerJson } from '../../../scripts/lib/verificacion'
import { itemDe, leerCatalogo } from '../catalogo'
import { comprar, ofertas, precioDe, precioVenta, semillaSurtido, sePuedeVender, surtido, vender } from '../tienda'
import type { Inv } from '../inventario'
import type { Manifest } from '../../kit/tipos'
import { BOTIN, CLASES, TIENDA } from '../../config/balance'

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

describe('el mercader', () => {
  it('trae un arma de la clase de cada heroína y piezas de su nivel, sin repetir casillero', () => {
    for (const clase of Object.keys(CLASES)) {
      for (const nivel of [1, 4, 10]) {
        const s = surtido(cat, nivel, clase, semillaSurtido('sophie', 'mundo1', nivel))
        expect(s.length, `${clase} ${nivel}`).toBeGreaterThanOrEqual(2)
        const items = s.map((o) => itemDe(cat, o.id)!)
        // el primero es un arma que le sirve a su clase
        expect(items[0]!.base.cat).toBe('weapon')
        expect(TIENDA.armasDeClase[clase]).toContain(items[0]!.base.icon)
        for (const i of items) expect(i.level, i.id).toBeLessThanOrEqual(nivel + BOTIN.nivelExtra)
        const casilleros = items.slice(1).map((i) => `${i.base.cat}:${i.base.slot ?? ''}`)
        expect(new Set(casilleros).size).toBe(casilleros.length)
        for (const o of s) expect(o.precio).toBe(precioDe(itemDe(cat, o.id)!))
      }
    }
  })
  it('la misma semilla trae lo mismo y al subir de nivel cambia', () => {
    const a = surtido(cat, 3, 'amazona', semillaSurtido('sophie', 'mundo1', 3))
    expect(surtido(cat, 3, 'amazona', semillaSurtido('sophie', 'mundo1', 3))).toEqual(a)
    const otros = [4, 5, 6].map((n) => JSON.stringify(surtido(cat, n, 'amazona', semillaSurtido('sophie', 'mundo1', n))))
    expect(otros.some((o) => o !== JSON.stringify(a))).toBe(true)
  })
  it('vender paga una parte del precio, libera el hueco y las armas de la familia no se venden', () => {
    const p = { oro: 10 }
    const i = inv()
    i.bolsa[2] = 'sword_1'
    const r = vender(p, i, cat, 2)
    expect(r.ok).toBe(true)
    const precio = precioVenta(itemDe(cat, 'sword_1')!)
    expect(precio).toBeGreaterThanOrEqual(1)
    expect(precio).toBeLessThan(precioDe(itemDe(cat, 'sword_1')!))
    expect(p.oro).toBe(10 + precio)
    expect(i.bolsa[2]).toBeNull()
    expect(vender(p, i, cat, 2)).toEqual({ ok: false, motivo: 'vacio' })
    for (const id of Object.values(BOTIN.armaPersonal)) {
      expect(sePuedeVender(itemDe(cat, id)), id).toBe(false)
      i.bolsa[0] = id
      expect(vender(p, i, cat, 0)).toEqual({ ok: false, motivo: 'no-vende' })
      expect(i.bolsa[0]).toBe(id)
    }
  })
  it('lo que se vende se puede recomprar al mismo precio que pagó el mercader', () => {
    const p = { oro: 0 }
    const i = inv()
    i.bolsa[0] = 'sword_1'
    const v = vender(p, i, cat, 0)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    const recompra = [{ id: v.id, precio: v.precio }]
    const r = comprar(p, i, cat, 'sword_1', recompra)
    expect(r.ok).toBe(true)
    expect(p.oro).toBe(0)
    expect(i.bolsa).toContain('sword_1')
  })
  it('una poción vale menos al venderla que al comprarla', () => {
    const it_ = itemDe(cat, 'potion_health_minor')!
    expect(precioVenta(it_)).toBeLessThan(TIENDA.ofertas.find((o) => o.id === 'potion_health_minor')!.precio)
  })
})
