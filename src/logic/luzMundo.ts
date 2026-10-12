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
  /** alfa de la sombra al pie */
  alfa: number
  /** alfa en la punta: las sombras del taller se aclaran a medida que se alejan del pie */
  alfaPunta: number
  /** en cuántos tramos se reparte ese degradado */
  tramos: number
  /**
   * La luz del mundo, igual que la de las sombras horneadas del taller: la punta de un objeto de alto h cae
   * `kx * h` a la derecha y `ky * h` hacia abajo de su pie. La base se queda pegada al piso
   */
  kx: number
  ky: number
  /** objetos más bajos que esto no tiran sombra larga (alcanza la de contacto) */
  altoMin: number
  /** adentro no hay sol: cada sombra cae lejos de la luz que la alumbra (ver `sombraDeLuces`) */
  luces?: CfgSombraLuces
}

export interface CfgSombraLuces {
  /** largo de la sombra (en altos del objeto) cuando la luz está a `lejos` px o más */
  largo: number
  /** debajo de la luz la sombra casi no sale: a esta distancia ya tiene su largo entero */
  lejos: number
  /** la vista va de costado: lo que va hacia arriba o abajo en pantalla se ve más corto */
  aplaste: number
  /** caída mínima en y, para que la sombra de costado no quede como una raya */
  kyMin: number
  /** qué tanto pesa la luz que alumbra apenas: con esto en 1, una luz a medio radio ya da la sombra entera */
  ganancia: number
}

export interface LuzQueAlumbra {
  x: number
  y: number
  r: number
  /** qué tan arriba del piso está la luz (la llama de una antorcha está alta): su pie es y + alto */
  alto?: number
}

export interface SombraPorLuz {
  kx: number
  ky: number
  /** 0 a oscuras, 1 bien alumbrado: la sombra se ve en la luz */
  fuerza: number
}

/**
 * La sombra de algo parado en (x, y) y de alto `alto`, con luces puntuales: cae del lado contrario a la luz que
 * más alumbra, más larga cuanto más lejos está la luz, y se ve tanto como alumbra la luz. Las luces que lleva
 * encima quien tira la sombra (el farol de la heroína, el brillo de Thor) no cuentan para la suya.
 */
export function sombraDeLuces(x: number, y: number, alto: number, luces: readonly LuzQueAlumbra[], cfg: CfgSombraLuces): SombraPorLuz {
  let vx = 0
  let vy = 0
  let peso = 0
  let dist = 0
  let fuerza = 0
  for (const l of luces) {
    // la luz que lleva encima: casi en su misma x y entre su pie y su cabeza
    if (Math.abs(l.x - x) < 10 && l.y <= y + 2 && l.y >= y - alto - 4) continue
    const ly = l.y + (l.alto ?? 10)
    const dx = x - l.x
    const dy = y - ly
    const d = Math.hypot(dx, dy)
    if (d >= l.r) continue
    const w = (1 - d / l.r) ** 2
    if (d > 0.5) {
      vx += (w * dx) / d
      vy += (w * dy) / d
    }
    peso += w
    dist += w * d
    fuerza = 1 - (1 - fuerza) * (1 - Math.min(1, w * 4 * cfg.ganancia))
  }
  if (peso <= 0) return { kx: 0, ky: cfg.kyMin, fuerza: 0 }
  const n = Math.hypot(vx, vy)
  // justo debajo de la luz: la sombra se junta en el pie
  const ux = n > 1e-6 ? vx / n : 0
  const uy = n > 1e-6 ? vy / n : 1
  const largo = cfg.largo * Math.min(1, dist / peso / cfg.lejos)
  let ky = uy * largo * cfg.aplaste
  if (Math.abs(ky) < cfg.kyMin) ky = uy < 0 ? -cfg.kyMin : cfg.kyMin
  return { kx: ux * largo, ky, fuerza }
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

/**
 * Los tramos de filas de un cuadro de alto `h` con el pie en la fila `pie`, del pie para arriba: el primero agarra
 * también lo que queda debajo del pie y el último llega hasta arriba. Sin huecos ni filas repetidas.
 */
export function tramosSombra(h: number, pie: number, n: number): { desde: number; hasta: number }[] {
  const p = Math.max(0, Math.min(h, pie))
  const out: { desde: number; hasta: number }[] = []
  for (let i = 0; i < n; i++) {
    const hasta = i === 0 ? h : Math.round(p - (p * i) / n)
    const desde = i === n - 1 ? 0 : Math.round(p - (p * (i + 1)) / n)
    out.push({ desde, hasta })
  }
  return out
}

/**
 * La sombra inclinada (cizallada) hecha con el mismo dibujo: la matriz [[1, -kx], [0, -ky]] lleva el punto de alto h
 * sobre el pie a (kx h, ky h) y deja la base donde está. Phaser no inclina sprites, pero cualquier matriz 2 x 2 es
 * giro, escala y giro: el contenedor gira `fi` y escala (sx, sy), el sprite de adentro gira `theta`.
 */
export function cizallaSombra(kx: number, ky: number): { fi: number; sx: number; sy: number; theta: number } {
  const m00 = 1
  const m01 = -kx
  const m10 = 0
  const m11 = -ky
  const E = (m00 + m11) / 2
  const F = (m00 - m11) / 2
  const G = (m10 + m01) / 2
  const H = (m10 - m01) / 2
  const Q = Math.hypot(E, H)
  const R = Math.hypot(F, G)
  const a1 = Math.atan2(G, F)
  const a2 = Math.atan2(H, E)
  return { fi: (a2 + a1) / 2, sx: Q + R, sy: Q - R, theta: (a2 - a1) / 2 }
}
