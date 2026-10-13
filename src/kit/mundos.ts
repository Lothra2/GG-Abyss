import type { Manifest, MundoManifest } from './tipos'
import { ABISMO } from '../config/balance'

/**
 * F8: los mundos del kit. `manifest.mundos` los trae a todos en orden de bajada; un kit de antes solo trae `mundo`
 * (el Bosque). Mientras la escena Mundo corre, el registro tiene un manifest cuyo `mundo` es el mundo donde está la
 * heroína: así todo lo que lee `m.mundo` (decos, partículas, criaturas, postales) lee el mundo de ahora.
 */

export const MUNDO_BOSQUE = 'mundo1'

export function idMundo(mu: MundoManifest): string {
  return mu.id ?? MUNDO_BOSQUE
}

export function mundosDe(m: Manifest): MundoManifest[] {
  return m.mundos?.length ? m.mundos : [{ ...m.mundo, id: MUNDO_BOSQUE }]
}

export function existeMundo(m: Manifest, id: string): boolean {
  return mundosDe(m).some((mu) => idMundo(mu) === id)
}

/**
 * ¿Se puede jugar? El mundo tiene que estar en el kit y, si es un piso del abismo, traer a su jefe: el taller lo entrega
 * al final, con los enemigos. Mientras falte, el portal de arriba sigue llevando a Continuará (nadie cae a un mundo a medias)
 */
export function mundoJugable(m: Manifest, id: string): boolean {
  if (!existeMundo(m, id)) return false
  const piso = ABISMO.pisos.find((p) => p.mundo === id)
  if (!piso || piso.piso <= 3) return true
  return !!m.personajes?.[piso.jefe]
}

/** El manifest visto desde un mundo (si no existe, el Bosque) */
export function manifestParaMundo(m: Manifest, id: string): Manifest {
  const mu = mundosDe(m).find((q) => idMundo(q) === id)
  return mu ? { ...m, mundo: { ...mu, id: idMundo(mu) } } : m
}
