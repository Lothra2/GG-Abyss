/** Parámetros de la URL: ?test=1 ?seed=N ?heroe=<id> ?kit=1 ?postal=1 */
export interface Params {
  test: boolean
  seed: number | null
  heroe: string | null
  kit: boolean
  postal: boolean
  sinTitulo: boolean
  calidad: 'alta' | 'baja' | null
}

export function leerParams(search: string = typeof location !== 'undefined' ? location.search : ''): Params {
  const q = new URLSearchParams(search)
  const seed = q.get('seed')
  const cal = q.get('calidad')
  return {
    test: q.get('test') === '1',
    seed: seed !== null && seed !== '' && Number.isFinite(Number(seed)) ? Number(seed) : null,
    heroe: q.get('heroe'),
    kit: q.get('kit') === '1',
    postal: q.get('postal') === '1',
    sinTitulo: q.get('sinTitulo') === '1',
    calidad: cal === 'alta' || cal === 'baja' ? cal : null,
  }
}

export const params: Params = leerParams()
