import type { Manifest, Personaje } from '../kit/tipos'
import { heroes } from '../kit/manifest'
import { APODOS, ICONO_ARMA_CLASE } from '../config/juego'
import { CLASE_DEFECTO, CLASES, MODO_PEQUE, type ClaseId } from '../config/balance'
import { leerPartida, type Almacen } from './guardado'

/** Una tarjeta de la selección de jugadora: sale del manifest, no de una lista fija */
export interface TarjetaPerfil {
  id: string
  nombre: string
  clase: ClaseId
  /** el personaje del manifest dice una clase que el juego no conoce, se usó la de por defecto */
  claseDesconocida: boolean
  /** cuadro del atlas `iconos` con el arma de su clase */
  iconoArma: string
  tienePartida: boolean
  nivel: number
  oro: number
  modoPeque: boolean
  desdeEstudio: boolean
}

export function apodoDe(id: string, nombreManifest: string): string {
  return APODOS[id] ?? nombreManifest
}

/** La clase del manifest a una clase con balance. Una clase nueva del estudio cae en la de por defecto. */
export function claseDe(p: Personaje): { clase: ClaseId; desconocida: boolean } {
  const c = p.clase
  if (c && c in CLASES) return { clase: c as ClaseId, desconocida: false }
  return { clase: CLASE_DEFECTO, desconocida: true }
}

/** Una tarjeta por cada personaje tipo `heroe` del manifest, con lo que haya guardado */
export function tarjetas(m: Manifest, alm: Almacen): TarjetaPerfil[] {
  return heroes(m).map((id) => {
    const p = m.personajes[id]!
    const { clase, desconocida } = claseDe(p)
    const guardada = leerPartida(alm, id).partida
    return {
      id,
      nombre: apodoDe(id, p.nombre),
      clase,
      claseDesconocida: desconocida,
      iconoArma: ICONO_ARMA_CLASE[clase] ?? 'sword_1',
      tienePartida: !!guardada,
      nivel: guardada?.nivel ?? 1,
      oro: guardada?.oro ?? 0,
      modoPeque: guardada?.ajustes.modoPeque ?? MODO_PEQUE.porDefecto.includes(id),
      desdeEstudio: p.desde_estudio === true,
    }
  })
}
