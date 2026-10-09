import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { leerJson } from '../../../scripts/lib/verificacion'
import { esEquipable, itemDe, leerCatalogo, ranuraDe } from '../catalogo'
import { aporteDe, bonosDeEquipo, bonosDeSets, comparar, nivelArmaduraThor, piezasDeSet } from '../equipo'
import { bolsaLlena, desequipar, equipar, normalizar, recoger, sacarDelCinturon, beber, type Inv } from '../inventario'
import { legendarioDe, tablaLegendarios, tablaMagicos, tablaNormal, tablaRaros, tamanoOro, tirarBotin } from '../botin'
import { statsDe } from '../stats'
import { BOTIN } from '../../config/balance'
import { partidaNueva, guardarPartida, leerPartida, AlmacenMemoria } from '../guardado'
import type { Manifest } from '../../kit/tipos'

const KIT = 'public/assets/kit/'
const manifest = leerJson<Manifest>(KIT + 'manifest.json')
const cat = leerCatalogo(leerJson(KIT + manifest.botin.catalogo))
const ctx = { nivelHeroe: 1, clase: 'amazona', idHeroe: 'sophie' }
const invVacio = (): Inv => normalizar({ equipo: {}, bolsa: [], cinturon: [] })
const it_ = (id: string) => itemDe(cat, id)!

describe('catálogo', () => {
  it('lee todo el catálogo y los objetos del Mundo 1 existen', () => {
    expect(cat.lista.length).toBeGreaterThan(400)
    for (const id of ['pet_armor_1', 'pet_armor_2', 'pet_armor_3', 'potion_health_minor', 'potion_mana_minor', 'pluma_de_cuervo', 'ramita_del_abuelo', ...Object.values(BOTIN.armaPersonal), BOTIN.armaPersonalDefecto, ...Object.values(BOTIN.legendarioClaro)]) {
      expect(cat.items.has(id), id).toBe(true)
    }
  })
  it('cada objeto sorteable tiene casillero', () => {
    expect(ranuraDe(it_('sword_1'))).toBe('arma')
    expect(ranuraDe(it_('armor_cuero_helm_1'))).toBe('casco')
    expect(ranuraDe(it_('pet_armor_1'))).toBe('mascota')
    expect(ranuraDe(it_('shield_heater_1'))).toBe('mano_libre')
    expect(ranuraDe(it_('collar_de_thor'))).toBe('amuleto')
    expect(esEquipable(it_('potion_health_minor'))).toBe(true)
    expect(esEquipable(it_('armor_cuero_shoulders_1'))).toBe(false)
  })
})

describe('tablas de botín', () => {
  it('los normales respetan nivel de la heroína + 2', () => {
    for (const i of tablaNormal(cat, 1)) expect(i.level).toBeLessThanOrEqual(3)
    for (const i of tablaNormal(cat, 5)) expect(i.level).toBeLessThanOrEqual(7)
    expect(tablaNormal(cat, 1).length).toBeGreaterThan(5)
  })
  it('los mágicos son los m_* y los raros los r_*', () => {
    expect(tablaMagicos(cat, 10).every((i) => i.id.startsWith('m_'))).toBe(true)
    expect(tablaRaros(cat).length).toBeGreaterThanOrEqual(8)
    expect(tablaRaros(cat).every((i) => i.rarity === 'rare')).toBe(true)
  })
  it('los legendarios van de nivel 16 a 24', () => {
    const t = tablaLegendarios(cat)
    expect(t.length).toBeGreaterThan(3)
    for (const i of t) {
      expect(i.level).toBeGreaterThanOrEqual(16)
      expect(i.level).toBeLessThanOrEqual(24)
    }
  })
  it('con la misma semilla el botín es el mismo', () => {
    const a = tirarBotin(new Azar(5), cat, ctx, { tipo: 'cofre', nivel: 'dorado' })
    const b = tirarBotin(new Azar(5), cat, ctx, { tipo: 'cofre', nivel: 'dorado' })
    expect(a).toEqual(b)
  })
  it('el cofre tutorial da pet_armor_1 además del azar', () => {
    const p = tirarBotin(new Azar(1), cat, ctx, { tipo: 'cofre', nivel: 'madera', tutorial: true })
    expect(p.objetos).toContain('pet_armor_1')
    expect(p.objetos.length).toBe(2)
    expect(p.oro).toBeGreaterThanOrEqual(5)
    expect(p.oro).toBeLessThanOrEqual(10)
  })
  it('los premios fijos de los secretos', () => {
    const pasto = tirarBotin(new Azar(2), cat, ctx, { tipo: 'cofre', nivel: 'madera', pista: 'pasto_alto' })
    expect(pasto.objetos.filter((x) => x === 'potion_health_minor')).toHaveLength(3)
    expect(tirarBotin(new Azar(3), cat, ctx, { tipo: 'cofre', nivel: 'dorado', pista: 'anillo_hadas' }).objetos).toContain('pet_armor_2')
    const cascada = tirarBotin(new Azar(4), cat, ctx, { tipo: 'cofre', nivel: 'reforzado', pista: 'tras_la_cascada' })
    expect(cascada.objetos.some((id) => it_(id).rarity === 'rare')).toBe(true)
    const claro = tirarBotin(new Azar(5), cat, ctx, { tipo: 'cofre', nivel: 'dorado', pista: 'claro_escondido' })
    expect(claro.objetos).toContain('pluma_de_cuervo')
    const claroAlana = tirarBotin(new Azar(5), cat, { ...ctx, clase: 'druida', idHeroe: 'alana' }, { tipo: 'cofre', nivel: 'dorado', pista: 'claro_escondido' })
    expect(claroAlana.objetos).toContain('ramita_del_abuelo')
  })
  it('cada clase tiene su legendario del Claro Escondido', () => {
    const r = new Azar(1)
    for (const c of ['amazona', 'druida', 'paladin', 'hechicera']) expect(it_(legendarioDe(r, cat, c)).rarity).toBe('legendary')
    expect(it_(legendarioDe(r, cat, 'otra')).rarity).toBe('legendary')
  })
  it('el cofre dorado da 3 objetos con al menos un raro; el reforzado 2; el de madera 1', () => {
    for (let s = 1; s <= 30; s++) {
      const d = tirarBotin(new Azar(s), cat, ctx, { tipo: 'cofre', nivel: 'dorado' })
      expect(d.objetos).toHaveLength(3)
      expect(d.objetos.some((id) => it_(id).rarity === 'rare' || it_(id).rarity === 'legendary')).toBe(true)
      expect(tirarBotin(new Azar(s), cat, ctx, { tipo: 'cofre', nivel: 'reforzado' }).objetos).toHaveLength(2)
      expect(tirarBotin(new Azar(s), cat, ctx, { tipo: 'cofre', nivel: 'madera' }).objetos).toHaveLength(1)
    }
  })
  it('el cofre legendario da el arma personal y la armadura 3 de Thor, con 200 de oro', () => {
    const p = tirarBotin(new Azar(1), cat, ctx, { tipo: 'cofre', nivel: 'legendario' })
    expect(p.objetos).toEqual(['arco_de_sophie', 'pet_armor_3'])
    expect(p.oro).toBe(200)
    expect(tirarBotin(new Azar(1), cat, { ...ctx, idHeroe: 'prima' }, { tipo: 'cofre', nivel: 'legendario' }).objetos[0]).toBe('collar_de_thor')
  })
  it('el trol siempre suelta 2 objetos y el primero es raro', () => {
    for (let s = 1; s <= 20; s++) {
      const p = tirarBotin(new Azar(s), cat, ctx, { tipo: 'enemigo', enemigo: 'trol' })
      expect(p.objetos).toHaveLength(2)
      expect(it_(p.objetos[0]!).rarity).toBe('rare')
      expect(p.oro).toBeGreaterThanOrEqual(20)
    }
  })
  it('las ratas sueltan objeto cerca del 25 % de las veces y oro cerca del 60 %', () => {
    const r = new Azar(99)
    let obj = 0
    let oro = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const p = tirarBotin(r, cat, ctx, { tipo: 'enemigo', enemigo: 'rata' })
      if (p.objetos.length > 0) obj++
      if (p.oro > 0) oro++
    }
    expect(obj / n).toBeGreaterThan(0.21)
    expect(obj / n).toBeLessThan(0.29)
    expect(oro / n).toBeGreaterThan(0.55)
    expect(oro / n).toBeLessThan(0.65)
  })
  it('los rompibles a veces sueltan pociones', () => {
    const r = new Azar(7)
    let pociones = 0
    let otros = 0
    for (let i = 0; i < 3000; i++) for (const id of tirarBotin(r, cat, ctx, { tipo: 'rompible' }).objetos) (it_(id).base.cat === 'potion' ? pociones++ : otros++)
    expect(pociones).toBeGreaterThan(0)
    expect(otros).toBeGreaterThan(0)
  })
  it('el tamaño de la moneda según el oro', () => {
    expect([1, 3, 4, 8, 9, 25, 26, 200].map(tamanoOro)).toEqual(['small', 'small', 'medium', 'medium', 'large', 'large', 'huge', 'huge'])
  })
})

describe('inventario', () => {
  it('una poción va al cinturón si hay lugar y lo demás a la bolsa', () => {
    const inv = invVacio()
    expect(recoger(inv, cat, 'potion_health_minor')).toMatchObject({ ok: true, donde: 'cinturon' })
    expect(recoger(inv, cat, 'sword_1')).toMatchObject({ ok: true, donde: 'bolsa' })
    expect(inv.cinturon[0]).toBe('potion_health_minor')
    expect(inv.bolsa[0]).toBe('sword_1')
  })
  it('con el cinturón lleno la poción va a la bolsa', () => {
    const inv = invVacio()
    for (let i = 0; i < 5; i++) recoger(inv, cat, 'potion_health_minor')
    expect(inv.cinturon.every((x) => x === 'potion_health_minor')).toBe(true)
    expect(inv.bolsa[0]).toBe('potion_health_minor')
  })
  it('con la bolsa llena no recoge y avisa', () => {
    const inv = invVacio()
    for (let i = 0; i < 28; i++) expect(recoger(inv, cat, 'sword_1').ok).toBe(true)
    expect(bolsaLlena(inv)).toBe(true)
    expect(recoger(inv, cat, 'sword_1')).toEqual({ ok: false, motivo: 'llena' })
  })
  it('equipar saca de la bolsa y pone en el casillero; el objeto de antes vuelve al mismo hueco', () => {
    const inv = invVacio()
    inv.bolsa[3] = 'sword_1'
    inv.bolsa[5] = 'scimitar_1'
    expect(equipar(inv, cat, 3)).toMatchObject({ ok: true, donde: 'equipo', ranura: 'arma' })
    expect(inv.equipo.arma).toBe('sword_1')
    expect(inv.bolsa[3]).toBeNull()
    equipar(inv, cat, 5)
    expect(inv.equipo.arma).toBe('scimitar_1')
    expect(inv.bolsa[5]).toBe('sword_1')
  })
  it('los anillos usan los dos casilleros', () => {
    const inv = invVacio()
    inv.bolsa[0] = 'm_anillo_vida'
    inv.bolsa[1] = 'm_sortija_arcana'
    equipar(inv, cat, 0)
    equipar(inv, cat, 1)
    expect(inv.equipo.anillo_1).toBe('m_anillo_vida')
    expect(inv.equipo.anillo_2).toBe('m_sortija_arcana')
  })
  it('una poción equipada va al cinturón y lo que no se equipa avisa', () => {
    const inv = invVacio()
    inv.bolsa[0] = 'potion_mana_minor'
    expect(equipar(inv, cat, 0)).toMatchObject({ ok: true, donde: 'cinturon' })
    inv.bolsa[1] = 'armor_cuero_shoulders_1'
    expect(equipar(inv, cat, 1)).toEqual({ ok: false, motivo: 'no-equipable' })
    expect(equipar(inv, cat, 9)).toEqual({ ok: false, motivo: 'vacio' })
  })
  it('desequipar devuelve a la bolsa y con la bolsa llena se queda puesto', () => {
    const inv = invVacio()
    inv.equipo.arma = 'sword_1'
    expect(desequipar(inv, 'arma')).toMatchObject({ ok: true })
    expect(inv.equipo.arma).toBeUndefined()
    expect(inv.bolsa[0]).toBe('sword_1')
    inv.equipo.casco = 'armor_cuero_helm_1'
    for (let i = 0; i < 28; i++) inv.bolsa[i] = 'sword_1'
    expect(desequipar(inv, 'casco')).toEqual({ ok: false, motivo: 'llena' })
    expect(inv.equipo.casco).toBe('armor_cuero_helm_1')
  })
  it('sacar una poción del cinturón y beberla', () => {
    const inv = invVacio()
    inv.cinturon[1] = 'potion_health_minor'
    expect(beber(inv, cat, 1)).toEqual({ vidaPct: 40, manaPct: 0 })
    expect(inv.cinturon[1]).toBeNull()
    inv.cinturon[0] = 'potion_mana_minor'
    expect(beber(inv, cat, 0)).toEqual({ vidaPct: 0, manaPct: 50 })
    inv.cinturon[2] = 'potion_mana_minor'
    expect(sacarDelCinturon(inv, 2)).toMatchObject({ ok: true })
    expect(inv.bolsa[0]).toBe('potion_mana_minor')
  })
  it('normalizar completa una bolsa de otro tamaño', () => {
    const inv = normalizar({ equipo: {}, bolsa: ['sword_1'], cinturon: [] })
    expect(inv.bolsa).toHaveLength(28)
    expect(inv.cinturon).toHaveLength(4)
  })
})

describe('equipo y stats', () => {
  it('un arma suma su daño al ataque básico', () => {
    const sin = statsDe('paladin', 1)
    const b = bonosDeEquipo(cat, { arma: 'sword_1' }, 'paladin')
    const con = statsDe('paladin', 1, b)
    expect(con.danoMin).toBeCloseTo(sin.danoMin + 3)
    expect(con.danoMax).toBeCloseTo(sin.danoMax + 8)
  })
  it('equipar y desequipar suma y resta', () => {
    const inv = invVacio()
    inv.bolsa[0] = 'm_jubon_robusto'
    const base = statsDe('amazona', 1, bonosDeEquipo(cat, inv.equipo, 'amazona'))
    equipar(inv, cat, 0)
    const puesto = statsDe('amazona', 1, bonosDeEquipo(cat, inv.equipo, 'amazona'))
    expect(puesto.armadura).toBeGreaterThan(base.armadura)
    desequipar(inv, 'pecho')
    const fuera = statsDe('amazona', 1, bonosDeEquipo(cat, inv.equipo, 'amazona'))
    expect(fuera.armadura).toBe(base.armadura)
    expect(fuera.vidaMax).toBe(base.vidaMax)
  })
  it('la velocidad de ataque depende de la clase: atkSpeed para el arco y castSpeed para los hechizos', () => {
    const arco = aporteDe(it_('r_aguijon_de_cuervo'), 'amazona').bonos
    expect(arco.velocidadAtaquePct).toBe(10)
    expect(aporteDe(it_('r_aguijon_de_cuervo'), 'hechicera').bonos.velocidadAtaquePct).toBeUndefined()
    expect(aporteDe(it_('r_canto_del_bosque'), 'druida').bonos.velocidadAtaquePct).toBe(10)
  })
  it('lo que el Mundo 1 no usa se guarda aparte para el tooltip', () => {
    const a = aporteDe(it_('juramento_de_rick'), 'paladin')
    expect(a.ignorados.some((m) => m.stat === 'allRes')).toBe(true)
    expect(a.bonos.vida).toBe(60)
  })
  it('la armadura de Thor y su collar no suman a la heroína y su nivel se lee del casillero', () => {
    const b = bonosDeEquipo(cat, { mascota: 'pet_armor_2' }, 'amazona')
    expect(b.armadura).toBeUndefined()
    expect(nivelArmaduraThor(cat, { mascota: 'pet_armor_2' })).toBe(2)
    expect(nivelArmaduraThor(cat, {})).toBe(0)
  })
  it('los sets suman por piezas', () => {
    const equipo = { arma: 'juramento_de_rick', amuleto: 'collar_de_thor' }
    expect(piezasDeSet(cat, equipo)).toEqual({ legado_gg: 2 })
    const sets = bonosDeSets(cat, equipo, 'paladin')
    expect(sets.vida).toBeUndefined()
    const tres = bonosDeSets(cat, { arma: 'juramento_de_rick', amuleto: 'collar_de_thor', mano_libre: 'escudo_de_la_casa_gg' }, 'paladin')
    expect(tres.vida).toBe(120)
  })
  it('comparar dice qué sube y qué baja', () => {
    const d = comparar(it_('m_espada_cruel'), it_('sword_1'), 'paladin')
    expect(d.find((x) => x.etiqueta === 'Daño %')?.delta).toBe(15)
    expect(comparar(it_('sword_1'), it_('sword_1'), 'paladin')).toEqual([])
    const fuera = comparar(it_('sword_1'), it_('m_espada_cruel'), 'paladin')
    expect(fuera.find((x) => x.etiqueta === 'Daño %')?.delta).toBe(-15)
  })
})

describe('guardar y cargar el inventario', () => {
  it('equipo, bolsa y cinturón sobreviven al guardado', () => {
    const alm = new AlmacenMemoria()
    const p = partidaNueva('sophie', 1)
    p.equipo = { arma: 'sword_1', mascota: 'pet_armor_1' }
    p.bolsa[2] = 'm_anillo_vida'
    p.cinturon[3] = 'potion_mana_minor'
    p.rompibles = ['rompible:144:2448']
    guardarPartida(alm, p)
    const r = leerPartida(alm, 'sophie').partida
    expect(r?.equipo).toEqual(p.equipo)
    expect(r?.bolsa[2]).toBe('m_anillo_vida')
    expect(r?.cinturon[3]).toBe('potion_mana_minor')
    expect(r?.rompibles).toEqual(['rompible:144:2448'])
  })
})
