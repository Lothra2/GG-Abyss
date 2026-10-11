import { Grilla, type Punto } from './grilla'

export interface Cuerpo {
  x: number
  y: number
  radio: number
}

export interface ResultadoMover {
  x: number
  y: number
  /** cuánto avanzó de verdad */
  movido: number
  /** chocó con algo */
  choco: boolean
}

/**
 * Mueve un círculo `dx, dy`. Si choca, desliza por el eje que sí está libre (PLAN.md 3.4).
 */
export function moverCuerpo(g: Grilla, c: Cuerpo, dx: number, dy: number): ResultadoMover {
  let x = c.x
  let y = c.y
  let choco = false
  if (g.circuloLibre(x + dx, y + dy, c.radio)) {
    x += dx
    y += dy
  } else {
    choco = true
    // deslizar: primero el eje con más movimiento
    const primeroX = Math.abs(dx) >= Math.abs(dy)
    const intentos: [number, number][] = primeroX ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]]
    for (const [ax, ay] of intentos) {
      if ((ax !== 0 || ay !== 0) && g.circuloLibre(x + ax, y + ay, c.radio)) {
        x += ax
        y += ay
      }
    }
  }
  return { x, y, movido: Math.hypot(x - c.x, y - c.y), choco }
}

export interface PasoCamino {
  x: number
  y: number
  /** vector unitario de la marcha (0, 0 si no se movió) */
  vx: number
  vy: number
  llego: boolean
  /** no avanzó nada aunque tenía a dónde ir */
  trabado: boolean
}

/**
 * Sigue una lista de puntos a `velocidad` px/s durante `dt` segundos.
 * Muta `camino` (saca los puntos que ya pasó).
 */
export function seguirCamino(g: Grilla, c: Cuerpo, camino: Punto[], velocidad: number, dt: number): PasoCamino {
  let restante = velocidad * dt
  let x = c.x
  let y = c.y
  let recorrido = 0
  let vx = 0
  let vy = 0
  let trabado = false
  while (restante > 0.001 && camino.length > 0) {
    const objetivo = camino[0]!
    const dx = objetivo.x - x
    const dy = objetivo.y - y
    const d = Math.hypot(dx, dy)
    if (d < 0.5) {
      camino.shift()
      continue
    }
    const paso = Math.min(restante, d)
    const ux = dx / d
    const uy = dy / d
    const r = moverCuerpo(g, { x, y, radio: c.radio }, ux * paso, uy * paso)
    if (r.movido < paso * 0.25) {
      trabado = true
      break
    }
    x = r.x
    y = r.y
    recorrido += r.movido
    restante -= paso
    vx = ux
    vy = uy
    if (paso >= d - 0.001) camino.shift()
  }
  return { x, y, vx: recorrido > 0 ? vx : 0, vy: recorrido > 0 ? vy : 0, llego: camino.length === 0 && !trabado, trabado: trabado && recorrido < 0.01 }
}

/** Lleva un vector de dirección (teclado) a movimiento con deslizamiento */
export function caminarDireccion(g: Grilla, c: Cuerpo, dirX: number, dirY: number, velocidad: number, dt: number): PasoCamino {
  const largo = Math.hypot(dirX, dirY)
  if (largo < 0.001) return { x: c.x, y: c.y, vx: 0, vy: 0, llego: false, trabado: false }
  const ux = dirX / largo
  const uy = dirY / largo
  const r = moverCuerpo(g, c, ux * velocidad * dt, uy * velocidad * dt)
  const mueve = r.movido > 0.01
  return { x: r.x, y: r.y, vx: mueve ? ux : 0, vy: mueve ? uy : 0, llego: false, trabado: !mueve }
}

/**
 * Movimiento premium del taller: la animación de caminar o correr se acelera o se frena para que los pies no
 * patinen. `avance` son los pixeles que avanza un ciclo entero de la animación (lo dice el manifest).
 * ritmo = velocidad * cuadros / (avance * fps). Sin avance, 1. Con tope para que nunca se vea ridículo.
 */
export function ritmoAnim(velocidad: number, a: { cuadros: number; fps: number; avance?: number; velocidad_natural?: number }): number {
  // la velocidad a la que el pie no patina: la trae el kit, o sale del avance (px por ciclo completo)
  const natural = a.velocidad_natural ?? (a.avance && a.avance > 0 && a.cuadros > 0 ? (a.avance * a.fps) / a.cuadros : 0)
  if (!natural || natural <= 0) return 1
  // tope: la familia es chibi y de piernas cortas, el ritmo exacto sería de 3 a 11 veces (KIT_JUEGO.md). Un poco de patinar
  return Math.max(0.7, Math.min(1.5, velocidad / natural))
}

/** Los cuadros (desde 0) donde cae un evento del manifest de cierto tipo, o null si la animación no trae eventos */
export function cuadrosDe(a: { eventos?: { tipo: string; cuadro: number }[] }, tipo: string): number[] | null {
  if (!a.eventos) return null
  return a.eventos.filter((e) => e.tipo === tipo).map((e) => e.cuadro)
}

/** En qué fracción de la animación cae el golpe (`impacto`), o null si no lo trae */
export function faseImpacto(a: { cuadros: number; eventos?: { tipo: string; cuadro: number; fase?: number }[] }): number | null {
  const e = a.eventos?.find((x) => x.tipo === 'impacto')
  if (!e) return null
  return Math.max(0.05, Math.min(0.95, (e.cuadro + (e.fase ?? 0.5)) / Math.max(1, a.cuadros)))
}
