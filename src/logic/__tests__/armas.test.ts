import { describe, expect, it } from 'vitest'
import { leerJson } from '../../../scripts/lib/verificacion'
import { itemDe, leerCatalogo } from '../catalogo'
import { ataqueBasico, conAtaque, familiaDeArma } from '../armas'
import { statsDe } from '../stats'
import { ATAQUES, CLASES, FAMILIA_DE_ARMA, FAMILIA_DE_CLASE, type ClaseId } from '../../config/balance'
import type { Manifest } from '../../kit/tipos'

const KIT = 'public/assets/kit/'
const manifest = leerJson<Manifest>(KIT + 'manifest.json')
const cat = leerCatalogo(leerJson(KIT + manifest.botin.catalogo))

describe('el ataque sale del arma', () => {
  it('cada arma del catálogo tiene familia', () => {
    for (const i of cat.lista.filter((q) => q.base.cat === 'weapon')) expect(familiaDeArma(i), `${i.id} (${i.base.icon})`).not.toBeNull()
    expect(familiaDeArma(itemDe(cat, 'potion_health_minor'))).toBeNull()
  })
  it('sin arma, cada clase ataca como siempre', () => {
    for (const clase of Object.keys(CLASES) as ClaseId[]) {
      const a = ataqueBasico(clase, null)
      expect(a.familia).toBe(FAMILIA_DE_CLASE[clase])
      expect(a.anim, clase).toBe(CLASES[clase].animAtaque)
      expect(a.alcance).toBe(CLASES[clase].alcance)
      expect(a.proyectil).toBe(CLASES[clase].proyectil)
      expect(a.ritmo).toBe(1)
      expect(a.danoPct).toBe(100)
    }
  })
  it('Sophie con una espada pega cuerpo a cuerpo y Rick con un arco dispara flechas', () => {
    const espada = ataqueBasico('amazona', itemDe(cat, 'sword_1'))
    expect(espada.familia).toBe('tajo')
    expect(espada.proyectil).toBeNull()
    expect(espada.anim).toBe('attack')
    expect(espada.alcance).toBeLessThan(100)
    const arco = ataqueBasico('paladin', itemDe(cat, 'bow_1'))
    expect(arco.familia).toBe('flecha')
    expect(arco.proyectil).toBe('proyectil_flecha')
    expect(arco.alcance).toBeGreaterThan(150)
  })
  it('una varita en manos de la druida es su magia de naturaleza; en manos del paladín, arcana', () => {
    expect(ataqueBasico('druida', itemDe(cat, 'wand_1')).proyectil).toBe('proyectil_naturaleza')
    expect(ataqueBasico('paladin', itemDe(cat, 'wand_1')).proyectil).toBe('proyectil_arcano')
  })
  it('el golpe pesado es más lento y pega más; la lanza llega más lejos que la espada', () => {
    const s = statsDe('paladin', 3)
    const a = ataqueBasico('paladin', itemDe(cat, 'greatsword_1'))
    const pesado = conAtaque(s, a)
    expect(pesado.ataquesPorSeg).toBeLessThan(s.ataquesPorSeg)
    expect(a.danoPct).toBeGreaterThan(100)
    // el daño de las habilidades no cambia por el arma
    expect(pesado.danoMax).toBe(s.danoMax)
    expect(ataqueBasico('paladin', itemDe(cat, 'spear_1')).alcance).toBeGreaterThan(ataqueBasico('paladin', itemDe(cat, 'sword_1')).alcance)
  })
  it('las animaciones de cada familia existen en todas las heroínas del kit', () => {
    const heroes = Object.entries(manifest.personajes).filter(([, p]) => p.tipo === 'heroe')
    for (const f of Object.values(ATAQUES)) for (const [id, p] of heroes) expect(Object.keys(p.anims), `${id} ${f.anim}`).toContain(f.anim)
    expect(Object.keys(FAMILIA_DE_ARMA).length).toBeGreaterThanOrEqual(20)
  })
})
