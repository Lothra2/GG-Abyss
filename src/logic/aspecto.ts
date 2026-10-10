import type { CapasPersonaje, TipoCapa } from '../kit/tipos'
import { itemDe, type Catalogo } from './catalogo'

export interface PiezaVisible {
  tipo: TipoCapa
  clave: string
}

/**
 * Lo que se ve puesto en la heroína (el muñeco de papel), en el orden en que se apilan: pecho, casco, arma, mano.
 * El arma y la mano libre que no tiene puestas son las de su clase (Sophie sin arma lleva su arco). Un arma de dos
 * manos deja la mano libre vacía. Solo entra lo que el kit trae dibujado.
 */
export function aspectoDe(equipo: Record<string, string>, cat: Catalogo, capas: CapasPersonaje | undefined): PiezaVisible[] {
  if (!capas) return []
  const vis = (ranura: string) => itemDe(cat, equipo[ranura])?.visual ?? null
  const arma = itemDe(cat, equipo.arma)
  const elegido: Partial<Record<TipoCapa, string | null>> = {
    pecho: vis('pecho')?.capa === 'pecho' ? vis('pecho')!.clave : null,
    casco: vis('casco')?.capa === 'casco' ? vis('casco')!.clave : null,
    arma: arma ? (arma.visual?.capa === 'arma' ? arma.visual.clave : null) : capas.defecto.arma,
    mano: vis('mano_libre')?.capa === 'mano' ? vis('mano_libre')!.clave : arma?.twoHanded ? null : capas.defecto.mano,
  }
  const out: PiezaVisible[] = []
  for (const tipo of capas.orden) {
    const clave = elegido[tipo]
    if (clave && capas[tipo]?.[clave]) out.push({ tipo, clave })
  }
  return out
}

/** Para comparar si cambió lo que se ve */
export function claveAspecto(l: readonly PiezaVisible[]): string {
  return l.map((p) => `${p.tipo}:${p.clave}`).join('|')
}

/** Lo que se ve sin nada puesto: el arma y la mano libre de su clase (para la selección de jugadora) */
export function aspectoDefecto(capas: CapasPersonaje | undefined): PiezaVisible[] {
  if (!capas) return []
  const out: PiezaVisible[] = []
  for (const tipo of capas.orden) {
    const clave = tipo === 'arma' ? capas.defecto.arma : tipo === 'mano' ? capas.defecto.mano : null
    if (clave && capas[tipo]?.[clave]) out.push({ tipo, clave })
  }
  return out
}
