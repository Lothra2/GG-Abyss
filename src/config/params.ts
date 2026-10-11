/** Parámetros de la URL: ?test=1 ?seed=N ?heroe=<id> ?kit=1 ?postal=1 ?tutorial=1 ?medir=1 */
export interface Params {
  test: boolean
  seed: number | null
  heroe: string | null
  kit: boolean
  postal: boolean
  sinTitulo: boolean
  /** entrar con ?heroe= también hace la presentación */
  presentacion: boolean
  calidad: 'alta' | 'baja' | null
  /** ?sw=1 deja que el service worker corra también con ?test=1 (las pruebas de la PWA) */
  sw: boolean
  /** ?tutorial=1: con ?heroe= las demostraciones para Alana también salen (sin esto se saltan, como la presentación) */
  tutorial: boolean
  /** ?medir=1: el medidor de frames y respuesta a la entrada en pantalla (para probar en la tablet de verdad) */
  medir: boolean
  /** ?intro=1: el intro sale aunque ya se haya visto (y también en modo prueba) */
  intro: boolean
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
    presentacion: q.get('presentacion') === '1',
    calidad: cal === 'alta' || cal === 'baja' ? cal : null,
    sw: q.get('sw') === '1',
    tutorial: q.get('tutorial') === '1',
    medir: q.get('medir') === '1',
    intro: q.get('intro') === '1',
  }
}

export const params: Params = leerParams()
