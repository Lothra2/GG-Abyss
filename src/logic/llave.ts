/**
 * F13, decisión de Rick: "Sophie pasa todo llegando al boss directo". La arena del jefe queda sellada hasta vencer al
 * minijefe del piso: el élite más cerca de la arena (en el Bosque el Trol del Puente, en el Puerto el Capitán Ahogado,
 * en la Ciudad el Relojero, en la Fragua el Carcelero, en el Corazón Helado el Guardián de la Puerta). Los que quedan
 * lejos (la Reina Escarcha del Lago) siguen siendo ramas opcionales. Un mundo sin élites no tiene llave.
 */

export interface Elite {
  id: number
  x: number
  y: number
  nombre: string
}

export function claveLlave(id: number): string {
  return `minijefe:${id}`
}

/** El minijefe que guarda la arena, o null si el mundo no tiene */
export function llaveDeArena(elites: readonly Elite[], arena: { x: number; y: number } | null): Elite | null {
  if (!arena || !elites.length) return null
  return [...elites].sort((a, b) => Math.hypot(a.x - arena.x, a.y - arena.y) - Math.hypot(b.x - arena.x, b.y - arena.y))[0]!
}

/** ¿La arena sigue sellada? */
export function arenaSellada(llave: Elite | null, vencidos: readonly string[], jefeVencido: boolean): boolean {
  return !!llave && !jefeVencido && !vencidos.includes(claveLlave(llave.id))
}
