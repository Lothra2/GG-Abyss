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
export function aspectoDe(equipo: Record<string, string>, cat: Catalogo, capas: CapasPersonaje | undefined, celestial = false): PiezaVisible[] {
  if (!capas) return []
  if (celestial) return aspectoCelestial(aspectoDe(equipo, cat, capas), capas)
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

/**
 * F13: la heroína celestial: lo de siempre más las alas (detrás y delante) y la aureola, en el orden de
 * `orden_celestial`. Sin nada en el pecho lleva la túnica celestial.
 */
export function aspectoCelestial(base: readonly PiezaVisible[], capas: CapasPersonaje): PiezaVisible[] {
  const piezas = [...base]
  if (!piezas.some((p) => p.tipo === 'pecho') && capas.pecho?.tunica_celestial) piezas.push({ tipo: 'pecho', clave: 'tunica_celestial' })
  for (const tipo of ['alas_detras', 'alas_delante', 'aura'] as const) if (capas[tipo]?.celestial) piezas.push({ tipo, clave: 'celestial' })
  const orden = capas.orden_celestial ?? ['alas_detras', 'base', ...capas.orden, 'alas_delante', 'aura']
  const pos = (t: string) => {
    const i = orden.indexOf(t)
    return i < 0 ? orden.length : i
  }
  return piezas.sort((a, b) => pos(a.tipo) - pos(b.tipo))
}

/** ¿Esta pieza va detrás del cuerpo? (las alas de atrás, antes de `base` en el orden) */
export function vaDetras(tipo: TipoCapa, capas: CapasPersonaje | undefined): boolean {
  const orden = capas?.orden_celestial
  if (!orden) return tipo === 'alas_detras'
  const b = orden.indexOf('base')
  const i = orden.indexOf(tipo)
  return b >= 0 && i >= 0 && i < b
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
