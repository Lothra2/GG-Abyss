/**
 * Luz del mundo que no necesita arte nuevo (PLAN.md F10): sombras largas hacia el mismo lado y reflejos en el agua.
 * Todo sale de los sprites que ya existen: la sombra es el mismo cuadro teñido de negro y aplastado hacia abajo
 * a la derecha (la luz del kit viene de arriba a la izquierda), el reflejo es el mismo cuadro dado vuelta.
 */

export interface DefSombra {
  h: number
  capa?: string
  luz?: unknown
}

export interface CfgSombra {
  /** alfa de la sombra */
  alfa: number
  /** cuánto mide hacia abajo, en fracción del alto del objeto */
  largo: number
  /** giro en grados (negativo = la punta va a la derecha) */
  angulo: number
  /** objetos más bajos que esto no tiran sombra larga (alcanza la de contacto) */
  altoMin: number
}

/** Lo que no tira sombra: lo del suelo, lo que da luz (la sombra de una fogata no tiene sentido) y lo muy bajito */
const SIN_SOMBRA = /^(pasto_alto|portal_|aviso_|anillo_|nenufar|charco|haz_|luciernaga)/

export function tiraSombra(nombre: string, def: DefSombra, cfg: CfgSombra): boolean {
  if (def.capa === 'suelo' || def.capa === 'frente' || def.capa === 'fondo') return false
  if (def.luz) return false
  if (def.h < cfg.altoMin) return false
  return !SIN_SOMBRA.test(nombre)
}

export interface MapaAgua {
  ancho: number
  alto: number
  cuadro: number
  agua: Uint8Array
}

/** ¿Hay agua en la franja de `largo` px justo debajo de (x, y), con medio cuadro de margen a los lados? */
export function aguaDebajo(m: MapaAgua, x: number, y: number, largo: number): boolean {
  const c = m.cuadro
  const tx0 = Math.max(0, Math.floor((x - c / 2) / c))
  const tx1 = Math.min(m.ancho - 1, Math.floor((x + c / 2) / c))
  const ty0 = Math.max(0, Math.floor(y / c))
  const ty1 = Math.min(m.alto - 1, Math.floor((y + largo) / c))
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (m.agua[ty * m.ancho + tx]) return true
  return false
}

/** El reflejo se mece un poquito: desplazamiento en x (entero, para no romper los pixeles) */
export function meneoReflejo(t: number, ph: number, amplitud = 1): number {
  return Math.round(Math.sin(t * 2.2 + ph * 6.28) * amplitud)
}

/** Radio del farol de la heroína: respira un poquito y en modo peque es más grande */
export function radioFarol(t: number, base: number, peque: boolean, extraPeque: number): number {
  const r = peque ? base + extraPeque : base
  return r * (0.97 + 0.03 * Math.sin(t * 1.6))
}
