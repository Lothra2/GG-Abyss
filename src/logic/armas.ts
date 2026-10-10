import { ATAQUES, CLASES, FAMILIA_DE_ARMA, FAMILIA_DE_CLASE, type ClaseId, type FamiliaAtaque } from '../config/balance'
import type { ItemCat } from './catalogo'
import type { StatsHeroe } from './stats'

/** El ataque básico que toca: animación, alcance, ritmo, daño, proyectil, impacto y sonido */
export interface AtaqueBasico {
  familia: FamiliaAtaque
  anim: string
  alcance: number
  /** multiplica los ataques por segundo de la clase */
  ritmo: number
  /** multiplica el daño */
  danoPct: number
  proyectil: string | null
  impacto: string | null
  sonido: string
}

/** De qué familia es un arma (null si no es un arma o no se conoce) */
export function familiaDeArma(i: ItemCat | null): FamiliaAtaque | null {
  if (!i || i.base.cat !== 'weapon') return null
  return FAMILIA_DE_ARMA[i.base.icon ?? ''] ?? null
}

/**
 * El ataque básico según el arma puesta. Sin arma (o con una que no se conoce) es el de su clase, igual que antes.
 * El hechizo usa el elemento de su clase si es de magia; si no, arcano.
 */
export function ataqueBasico(clase: ClaseId, arma: ItemCat | null): AtaqueBasico {
  const propia = FAMILIA_DE_CLASE[clase] ?? 'tajo'
  const familia = familiaDeArma(arma) ?? propia
  const a = ATAQUES[familia]
  const c = CLASES[clase]
  const delaClase = familia === propia
  return {
    familia,
    anim: a.anim,
    // con el arma de su clase, el alcance de su clase (así nada cambia para quien no se cambia el arma)
    alcance: delaClase ? c.alcance : a.alcance,
    ritmo: delaClase ? 1 : a.ritmo,
    danoPct: delaClase ? 100 : a.danoPct,
    proyectil: familia === 'hechizo' && propia === 'hechizo' ? c.proyectil : a.proyectil,
    impacto: familia === 'hechizo' && propia === 'hechizo' ? c.impacto : delaClase && c.impacto ? c.impacto : a.impacto,
    sonido: a.sonido,
  }
}

/** El alcance y el ritmo del ataque van a las estadísticas. El daño extra (danoPct) es solo del ataque básico, no de las habilidades. */
export function conAtaque(s: StatsHeroe, a: AtaqueBasico): StatsHeroe {
  return { ...s, alcance: a.alcance, ataquesPorSeg: s.ataquesPorSeg * a.ritmo }
}

/** Para la tarjeta y la ficha: cómo ataca con esto, en palabras de niña */
export const NOMBRE_FAMILIA: Record<FamiliaAtaque, string> = {
  tajo: 'Ataque: espadazo',
  pesado: 'Ataque: golpe fuerte',
  estocada: 'Ataque: lanzazo',
  flecha: 'Ataque: flechas',
  hechizo: 'Ataque: magia',
}
