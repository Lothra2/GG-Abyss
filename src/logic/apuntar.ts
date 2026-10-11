/** Atacar sin elegir enemigo (como Diablo): a quién le toca el golpe. Sin Phaser. */

export interface Blanco {
  x: number
  y: number
  vivo: boolean
}

/** Diferencia entre dos ángulos, de 0 a π */
export function difAngulo(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return d > Math.PI ? Math.PI * 2 - d : d
}

/**
 * El enemigo vivo más cercano dentro del alcance y del cono (medio ángulo `cono` a cada lado de `angulo`). Si hay
 * varios, gana el más cercano. null si no hay ninguno: el golpe cae al aire hacia esa dirección.
 */
export function blancoEnCono<T extends Blanco>(blancos: readonly T[], o: { x: number; y: number }, angulo: number, alcance: number, cono: number): T | null {
  let mejor: T | null = null
  let mejorD = Infinity
  for (const b of blancos) {
    if (!b.vivo) continue
    const d = Math.hypot(b.x - o.x, b.y - o.y)
    if (d > alcance) continue
    // pegado a ella siempre cuenta (si no, girar al lado que está encima falla)
    if (d > 12 && difAngulo(Math.atan2(b.y - o.y, b.x - o.x), angulo) > cono) continue
    if (d < mejorD) {
      mejor = b
      mejorD = d
    }
  }
  return mejor
}
