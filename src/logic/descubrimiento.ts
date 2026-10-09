import type { MapaJuego, Zona } from '../kit/mapa'
import { totalSecretos, totalZonasDescubribles } from '../kit/mapa'

/** Qué zonas y secretos lleva descubiertos una jugadora (lo que se guarda en la partida) */
export interface EstadoDescubrimiento {
  zonas: string[]
  secretos: string[]
}

export interface ResultadoDescubrir {
  /** primera vez que entra a esta zona */
  nueva: boolean
  /** la zona es un secreto */
  secreto: boolean
}

export const llaveSecretoZona = (z: Pick<Zona, 'nombre'>): string => `zona:${z.nombre}`

/** Marca una zona como descubierta. Solo cuentan las que traen `descubrir`. Sin duplicados. */
export function descubrirZona(est: EstadoDescubrimiento, zona: Zona): ResultadoDescubrir {
  if (!zona.descubrir || est.zonas.includes(zona.nombre)) return { nueva: false, secreto: zona.secreto }
  est.zonas.push(zona.nombre)
  if (zona.secreto) {
    const k = llaveSecretoZona(zona)
    if (!est.secretos.includes(k)) est.secretos.push(k)
  }
  return { nueva: true, secreto: zona.secreto }
}

/** Marca un cofre secreto como encontrado. true si es la primera vez. */
export function descubrirSecretoCofre(est: EstadoDescubrimiento, llaveCofre: string): boolean {
  if (est.secretos.includes(llaveCofre)) return false
  est.secretos.push(llaveCofre)
  return true
}

export interface ResumenDescubrimiento {
  zonas: number
  totalZonas: number
  secretos: number
  totalSecretos: number
}

/** Cuenta lo descubierto sobre los totales que salen del mapa */
export function resumen(est: EstadoDescubrimiento, mapa: MapaJuego): ResumenDescubrimiento {
  return {
    zonas: est.zonas.length,
    totalZonas: totalZonasDescubribles(mapa),
    secretos: est.secretos.length,
    totalSecretos: totalSecretos(mapa),
  }
}
