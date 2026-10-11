/**
 * El mundo reacciona (PLAN.md F10, 8): arbustos y flores que se sacuden al pasar, hongos que se aplastan y rebotan,
 * charcos que salpican. Con lo que ya trae el kit: se mueve el mismo sprite y salen partículas del kit. Si el taller
 * entrega la animación (`sacudir`, `rebotar`, `salpicar`) se usa esa en vez del meneo.
 */

export type TipoReaccion = 'sacudir' | 'rebotar' | 'salpicar'

export interface Reaccion {
  tipo: TipoReaccion
  /** a qué distancia del pie del objeto reacciona (px), además de la mitad de su ancho */
  radio: number
  /** cuánto dura el meneo (s) */
  dura: number
  /** no vuelve a reaccionar antes de esto (s) */
  espera: number
  /** partícula del kit que suelta */
  particula: string | null
  /** cuántas suelta */
  cuantas: number
}

const REGLAS: [RegExp, Reaccion][] = [
  [/^(arbusto|juncos|helecho)/, { tipo: 'sacudir', radio: 10, dura: 0.7, espera: 1.2, particula: 'hoja_verde', cuantas: 2 }],
  [/^flores_grandes/, { tipo: 'sacudir', radio: 8, dura: 0.6, espera: 1.2, particula: 'polen', cuantas: 3 }],
  [/^(hongos$|tocon_hongos|hongo_gigante)/, { tipo: 'rebotar', radio: 8, dura: 0.55, espera: 1.5, particula: 'espora', cuantas: 3 }],
  [/^charco/, { tipo: 'salpicar', radio: 4, dura: 0.4, espera: 0.6, particula: 'gota', cuantas: 4 }],
]

export function reaccionDe(nombre: string): Reaccion | null {
  for (const [re, r] of REGLAS) if (re.test(nombre)) return r
  return null
}

/** ¿Alguien (heroína o Thor) toca el objeto? Mira solo la franja de los pies, no la copa. */
export function tocaReaccion(r: Reaccion, ancho: number, ox: number, oy: number, px: number, py: number): boolean {
  const dx = Math.abs(px - ox)
  const dy = py - oy
  return dx < ancho / 2 + r.radio && dy > -14 - r.radio && dy < 10 + r.radio
}

/**
 * Cómo se ve el meneo a los `el` segundos: ángulo en grados, escala en x y en y, y desplazamiento entero en x.
 * Todo se apaga solo hasta quedar quieto al terminar. `lado` es 1 o -1 (hacia dónde la empujaron).
 */
export function meneo(r: Reaccion, el: number, lado: number): { angulo: number; sx: number; sy: number; dx: number } {
  if (el < 0 || el >= r.dura) return { angulo: 0, sx: 1, sy: 1, dx: 0 }
  const k = 1 - el / r.dura
  const amort = k * k
  switch (r.tipo) {
    case 'sacudir':
      return { angulo: Math.sin(el * 26) * 6 * amort * lado, sx: 1, sy: 1, dx: Math.round(Math.sin(el * 30) * 1.4 * amort) }
    case 'rebotar': {
      // se aplasta de golpe y vuelve con un rebote
      const s = el < 0.1 ? 1 - (el / 0.1) * 0.28 * k : 1 - 0.28 * Math.cos((el - 0.1) * 18) * k
      return { angulo: 0, sx: 1 + (1 - s) * 0.6, sy: s, dx: 0 }
    }
    case 'salpicar':
      return { angulo: 0, sx: 1 + 0.08 * amort, sy: 1 - 0.08 * amort, dx: 0 }
  }
}
