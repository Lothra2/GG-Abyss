import type { Manifest, MundoManifest } from './tipos'

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

/** El manifest visto desde un mundo (si no existe, el Bosque) */
export function manifestParaMundo(m: Manifest, id: string): Manifest {
  const mu = mundosDe(m).find((q) => idMundo(q) === id)
  return mu ? { ...m, mundo: { ...mu, id: idMundo(mu) } } : m
}
