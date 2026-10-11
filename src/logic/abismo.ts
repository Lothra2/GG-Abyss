import { ABISMO, MODO_PEQUE } from '../config/balance'

/**
 * Reglas del camino al fondo (PLAN.md F11), sin Phaser. Lo que pasa en los pisos 3 a 7 se decide aquí y se prueba
 * antes de que el taller entregue el arte: cuando llegue, el juego solo tiene que conectarlo.
 */

export type DefPiso = (typeof ABISMO.pisos)[number]

/** El piso de un mundo: mundo3 es el piso 3. Un id raro cae en el 1 */
export function pisoDe(mundo: string): number {
  const p = ABISMO.pisos.find((x) => x.mundo === mundo)
  if (p) return p.piso
  const n = Number(/(\d+)$/.exec(mundo)?.[1])
  return Number.isFinite(n) && n >= 1 ? Math.min(n, ABISMO.pisos.length) : 1
}

export function defPiso(piso: number): DefPiso {
  return ABISMO.pisos[Math.max(0, Math.min(ABISMO.pisos.length - 1, piso - 1))]!
}

/** Lo más oscuro que puede ponerse un piso. En modo peque nunca pasa de 0.60 (ni de lo de siempre en los dos primeros) */
export function topeOscuridad(piso: number, peque: boolean): number {
  const t = defPiso(piso).oscuridadMax
  if (!peque) return t
  return piso <= 2 ? Math.min(t, MODO_PEQUE.oscuridadMax) : Math.min(t, ABISMO.oscuridadMaxPeque)
}

/** ¿Thor lleva su brillo? Desde el piso 3, para que la heroína nunca lo pierda en lo oscuro */
export function thorBrilla(piso: number): boolean {
  return piso >= ABISMO.thorBrillaDesde
}

/* ---------- Mundo 3: los cristales ---------- */

export interface Cristal {
  id: string
  x: number
  y: number
  grande: boolean
  prendido: boolean
}

/** Pegarle a un cristal apagado lo prende. Devuelve true si cambió */
export function golpearCristal(c: Cristal): boolean {
  if (c.prendido) return false
  c.prendido = true
  return true
}

/** El cristal que recibe un golpe en (x, y), si hay uno */
export function cristalEn(cristales: readonly Cristal[], x: number, y: number): Cristal | null {
  let mejor: Cristal | null = null
  let dm = Infinity
  for (const c of cristales) {
    const r = ABISMO.cristal.golpeRadio * (c.grande ? 1.6 : 1)
    const d = Math.hypot(c.x - x, c.y - y)
    if (d <= r && d < dm) {
      dm = d
      mejor = c
    }
  }
  return mejor
}

/** Cuánto del piso ya está iluminado (de 0 a 1): la luz es el progreso */
export function avanceLuz(cristales: readonly Cristal[]): number {
  const chicos = cristales.filter((c) => !c.grande)
  return chicos.length ? chicos.filter((c) => c.prendido).length / chicos.length : 1
}

/** Las luces que dan los cristales prendidos */
export function lucesDeCristales(cristales: readonly Cristal[]): { x: number; y: number; r: number }[] {
  return cristales.filter((c) => c.prendido).map((c) => ({ x: c.x, y: c.y - 20, r: c.grande ? ABISMO.cristal.radioLuzGrande : ABISMO.cristal.radioLuz }))
}

/* ---------- la sombra ---------- */

/** La sombra solo se ve (y se le puede pegar) dentro de una luz. Afuera son dos ojos */
export function sombraVisible(x: number, y: number, luces: readonly { x: number; y: number; r: number }[]): boolean {
  return luces.some((l) => Math.hypot(l.x - x, l.y - y) <= l.r * ABISMO.sombraVisibleEn)
}

/* ---------- la polilla de ceniza ---------- */

export type OrdenPolilla = { tipo: 'ir'; x: number; y: number; cristal: string } | { tipo: 'apagar'; cristal: string } | { tipo: 'heroina' }

/** Va hacia el cristal prendido más cercano que vea, y lo apaga al llegar. Si no ve ninguno, va por la heroína */
export function ordenPolilla(p: { x: number; y: number }, cristales: readonly Cristal[]): OrdenPolilla {
  let mejor: Cristal | null = null
  let dm = Infinity
  for (const c of cristales) {
    if (!c.prendido || c.grande) continue
    const d = Math.hypot(c.x - p.x, c.y - p.y)
    if (d <= ABISMO.polilla.ve && d < dm) {
      dm = d
      mejor = c
    }
  }
  if (!mejor) return { tipo: 'heroina' }
  if (dm <= ABISMO.polilla.apagaA) return { tipo: 'apagar', cristal: mejor.id }
  return { tipo: 'ir', x: mejor.x, y: mejor.y, cristal: mejor.id }
}

/* ---------- la Polilla Reina ---------- */

/** Solo se le puede pegar cuando los cuatro cristales grandes de la arena están prendidos */
export function reinaVulnerable(cristales: readonly Cristal[]): boolean {
  const g = cristales.filter((c) => c.grande)
  return g.length > 0 && g.every((c) => c.prendido)
}

/** El polvo que cae apaga los cristales que tapa (los grandes también) */
export function apagarConPolvo(cristales: Cristal[], manchas: readonly { x: number; y: number }[], radio: number): string[] {
  const apagados: string[] = []
  for (const c of cristales) {
    if (!c.prendido) continue
    if (manchas.some((m) => Math.hypot(m.x - c.x, m.y - c.y) <= radio)) {
      c.prendido = false
      apagados.push(c.id)
    }
  }
  return apagados
}

/* ---------- la figura de los ojos rojos ---------- */

/** Cuántas veces se asoma en un piso (desde el 3, y más seguido cuanto más abajo) */
export function vecesFigura(piso: number): number {
  return ABISMO.figura.porPiso[Math.max(0, Math.min(ABISMO.figura.porPiso.length - 1, piso))] ?? 0
}

export type EstadoFigura = 'mirando' | 'se_va'

/** Nunca se acerca ni ataca: si la heroína se acerca, se va en humo. Thor gruñe antes */
export function reaccionFigura(figura: { x: number; y: number }, heroina: { x: number; y: number }): { estado: EstadoFigura; thorGrunne: boolean } {
  const d = Math.hypot(figura.x - heroina.x, figura.y - heroina.y)
  return { estado: d <= ABISMO.figura.seVaA ? 'se_va' : 'mirando', thorGrunne: d <= ABISMO.figura.thorGrunneA }
}

/**
 * Dónde se asoma: lejos de la heroína (entre distMin y distMax) en la dirección `angulo`, en un lugar libre.
 * Prueba unos ángulos alrededor del pedido y devuelve null si no hay lugar (entonces no aparece).
 */
export function lugarFigura(heroina: { x: number; y: number }, angulo: number, libre: (x: number, y: number) => boolean): { x: number; y: number } | null {
  const { distMin, distMax } = ABISMO.figura
  for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
    for (const d of [distMax, (distMin + distMax) / 2, distMin]) {
      const x = heroina.x + Math.cos(angulo + da) * d
      const y = heroina.y + Math.sin(angulo + da) * d
      if (libre(x, y)) return { x: Math.round(x), y: Math.round(y) }
    }
  }
  return null
}

/* ---------- el mapa del abismo (la Bajada) ---------- */

export type EstadoPiso = 'pasado' | 'actual' | 'oculto'

/** La columna de siete pisos que se ve al bajar: los de arriba ya vistos, el actual brillando, el resto a oscuras */
export function columnaAbismo(pisoActual: number): { piso: number; nombre: string; estado: EstadoPiso }[] {
  return ABISMO.pisos.map((p) => ({
    piso: p.piso,
    nombre: p.piso <= pisoActual ? p.nombre : '?',
    estado: p.piso < pisoActual ? 'pasado' : p.piso === pisoActual ? 'actual' : 'oculto',
  }))
}
