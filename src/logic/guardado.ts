import type { Calidad } from '../config/juego'
import { MODO_PEQUE, OSCURIDAD } from '../config/balance'

/**
 * La partida de una jugadora (PLAN.md 3.5). La clave en localStorage es `ggabyss:v1:perfil:<id>`.
 * F1a solo la usa en memoria. En F1b se le suma el guardado, la migración y la lista de perfiles.
 */

export interface Ajustes {
  /** control de Noche, 0 a 0.55 (0.25 en modo peque) */
  noche: number
  calidad: Calidad
  musica: number
  efectos: number
  modoPeque: boolean
}

export interface Partida {
  version: 1
  /** id del personaje en el manifest */
  id: string
  creada: number
  actualizada: number
  nivel: number
  xp: number
  oro: number
  vida: number
  mana: number
  posicion: { x: number; y: number }
  ultimaFogata: string
  zonas: string[]
  secretos: string[]
  cofres: string[]
  rompibles: string[]
  presentacionVista: boolean
  jefeVencido: boolean
  equipo: Record<string, string>
  bolsa: (string | null)[]
  cinturon: (string | null)[]
  ajustes: Ajustes
  /** F2: vida del jefe si la heroína cayó en la pelea (el jefe no se cura) */
  jefeVida?: number
  /** segundos jugados, para el resumen de Continuará */
  tiempoJugado?: number
}

export const VERSION_PARTIDA = 1

export function ajustesPorDefecto(id: string): Ajustes {
  return {
    noche: OSCURIDAD.nocheDefecto,
    calidad: 'alta',
    musica: 0.8,
    efectos: 0.9,
    modoPeque: MODO_PEQUE.porDefecto.includes(id),
  }
}

export function partidaNueva(id: string, ahora: number = Date.now()): Partida {
  return {
    version: VERSION_PARTIDA,
    id,
    creada: ahora,
    actualizada: ahora,
    nivel: 1,
    xp: 0,
    oro: 0,
    vida: 0,
    mana: 0,
    posicion: { x: 0, y: 0 },
    ultimaFogata: '',
    zonas: [],
    secretos: [],
    cofres: [],
    rompibles: [],
    presentacionVista: false,
    jefeVencido: false,
    equipo: {},
    bolsa: Array.from({ length: 28 }, () => null),
    cinturon: [null, null, null, null],
    ajustes: ajustesPorDefecto(id),
  }
}
