/**
 * Cómo se reparten las tarjetas de jugadora en la vista lógica (PLAN.md F1b, tarea 2):
 * en una fila si caben y si no en dos, con la heroína a la escala entera más grande posible.
 */
export interface DisposicionTarjetas {
  /** escala entera de la heroína dentro de la tarjeta (1 a 3) */
  escalaHeroe: number
  cols: number
  filas: number
  /** tamaño de cada tarjeta */
  w: number
  h: number
  gap: number
  /** esquina superior izquierda de cada tarjeta, en el orden de entrada */
  posiciones: { x: number; y: number }[]
}

const GAP = 8
const MARGEN = 8

/** Ancho y alto de una tarjeta según la escala de la heroína (celda de 48 px) */
export function medidasTarjeta(escalaHeroe: number): { w: number; h: number } {
  return { w: 48 * escalaHeroe + 24, h: 48 * escalaHeroe + 96 }
}

export function disponerTarjetas(n: number, ancho: number, alto: number, margenSup = MARGEN, margenInf = MARGEN): DisposicionTarjetas {
  const util = { w: ancho - 2 * MARGEN, h: alto - margenSup - margenInf }
  let elegida: Omit<DisposicionTarjetas, 'posiciones'> | null = null
  for (const s of [3, 2, 1]) {
    const { w, h } = medidasTarjeta(s)
    for (let cols = Math.max(1, n); cols >= 1; cols--) {
      const filas = Math.ceil(n / cols)
      const totalW = cols * w + (cols - 1) * GAP
      const totalH = filas * h + (filas - 1) * GAP
      if (totalW <= util.w && totalH <= util.h) {
        elegida = { escalaHeroe: s, cols, filas, w, h, gap: GAP }
        break
      }
    }
    if (elegida) break
  }
  // no cabe ni a escala 1: se deja en una fila y se acepta que se salga un poco
  if (!elegida) {
    const { w, h } = medidasTarjeta(1)
    elegida = { escalaHeroe: 1, cols: Math.max(1, n), filas: 1, w, h, gap: GAP }
  }
  const { cols, filas, w, h, gap } = elegida
  const totalH = filas * h + (filas - 1) * gap
  const oy = margenSup + Math.max(0, (util.h - totalH) / 2)
  const posiciones: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / cols)
    const enFila = fila === filas - 1 ? n - fila * cols : cols
    const anchoFila = enFila * w + (enFila - 1) * gap
    const ox = (ancho - anchoFila) / 2
    posiciones.push({ x: Math.round(ox + (i % cols) * (w + gap)), y: Math.round(oy + fila * (h + gap)) })
  }
  return { ...elegida, posiciones }
}
