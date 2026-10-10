/**
 * TODOS los números del juego viven aquí (PLAN.md sección 4).
 * Ningún otro archivo define daño, vida, recargas ni probabilidades.
 */

export type ClaseId = 'amazona' | 'druida' | 'paladin' | 'hechicera'

export interface ClaseBalance {
  vida: number
  mana: number
  /** daño del ataque básico [min, max] a nivel 1 */
  dano: [number, number]
  /** alcance en px */
  alcance: number
  ataquesPorSeg: number
  /** animación del manifest para el ataque básico */
  animAtaque: string
  /** fx de proyectil (sin dirección) o null si es cuerpo a cuerpo */
  proyectil: string | null
  /** fx de impacto */
  impacto: string | null
  /** casillero de equipo del arma personal */
  armaPersonal: string
}

export const CLASES: Record<ClaseId, ClaseBalance> = {
  amazona: { vida: 60, mana: 30, dano: [4, 7], alcance: 220, ataquesPorSeg: 1.0, animAtaque: 'shoot_bow', proyectil: 'proyectil_flecha', impacto: 'impacto_flecha', armaPersonal: 'arco_de_sophie' },
  druida: { vida: 55, mana: 50, dano: [3, 6], alcance: 200, ataquesPorSeg: 1.0, animAtaque: 'cast', proyectil: 'proyectil_naturaleza', impacto: 'impacto_naturaleza', armaPersonal: 'varita_de_alana' },
  paladin: { vida: 90, mana: 20, dano: [5, 9], alcance: 44, ataquesPorSeg: 1.1, animAtaque: 'attack', proyectil: null, impacto: 'tajo', armaPersonal: 'juramento_de_rick' },
  hechicera: { vida: 50, mana: 60, dano: [5, 8], alcance: 220, ataquesPorSeg: 0.9, animAtaque: 'cast', proyectil: 'proyectil_fuego', impacto: 'impacto_fuego', armaPersonal: 'baculo_de_steph' },
}

/** Clase por defecto para una heroína nueva del estudio sin `clase` conocida */
export const CLASE_DEFECTO: ClaseId = 'amazona'

export const PROGRESION = {
  vidaPorNivel: 10,
  manaPorNivel: 5,
  danoPorNivelPct: 8,
  manaRegenPorSeg: 3,
  vidaRegenPorSeg: 5,
  vidaRegenTrasDanoS: 4,
  nivelMax: 10,
  xpBase: 40,
  xpExp: 1.5,
} as const

/** XP para pasar del nivel n al n+1: round(40 * n^1.5) */
export function xpParaSubir(nivel: number): number {
  return Math.round(PROGRESION.xpBase * Math.pow(nivel, PROGRESION.xpExp))
}

export interface HabilidadBalance {
  id: string
  nombre: string
  /** animación del manifest */
  anim: string
  mana: number
  /** recarga en segundos */
  recarga: number
  /** fx del manifest (opcional) */
  fx?: string
  /** parámetros propios de cada habilidad */
  params: Record<string, number>
}

export const HABILIDADES: Record<ClaseId, [HabilidadBalance, HabilidadBalance]> = {
  amazona: [
    { id: 'lluvia_flechas', nombre: 'Lluvia de flechas', anim: 'shoot_bow', mana: 6, recarga: 4, params: { flechas: 3, abanicoGrados: 20, danoPct: 80 } },
    { id: 'esquiva', nombre: 'Esquiva', anim: 'dodge', mana: 0, recarga: 3, params: { distancia: 90, duracion: 0.35 } },
  ],
  druida: [
    { id: 'llamar_thor', nombre: 'Llamar a Thor', anim: 'summon', mana: 10, recarga: 10, fx: 'escudo_de_thor', params: { escudoS: 4, escudoBase: 30, escudoPorNivel: 5, mordidaPct: 300 } },
    { id: 'curar', nombre: 'Curar', anim: 'cast', mana: 12, recarga: 8, fx: 'curar', params: { curaPct: 35 } },
  ],
  paladin: [
    { id: 'torbellino', nombre: 'Torbellino', anim: 'whirlwind', mana: 8, recarga: 5, params: { duracion: 1.2, radio: 60, cadaS: 0.3, danoPct: 70 } },
    { id: 'bloqueo', nombre: 'Bloqueo', anim: 'block_shield', mana: 0, recarga: 4, params: { duracion: 1.5, reduccionPct: 80 } },
  ],
  hechicera: [
    { id: 'nova_fuego', nombre: 'Nova de fuego', anim: 'nova', mana: 12, recarga: 5, fx: 'nova_fuego', params: { radio: 110, danoPct: 150 } },
    { id: 'rayo_canalizado', nombre: 'Rayo canalizado', anim: 'channel', mana: 0, recarga: 0, fx: 'proyectil_arcano', params: { manaPorSeg: 3, cadaS: 0.2, danoPct: 50 } },
  ],
}

export const THOR = {
  distanciaSeguir: 40,
  distanciaReacomodar: 90,
  mordidaBase: [3, 5] as [number, number],
  mordidaPorNivel: 1,
  mordidaCadaS: 2,
  mordidaRadio: 160,
  recogerRadio: 120,
  aullidoVidaPct: 30,
  aullidoEscudoS: 5,
  aullidoEscudoBase: 40,
  aullidoEscudoPorNivel: 5,
  aullidoRecargaS: 20,
  desenterrarCadaS: [60, 90] as [number, number],
  desenterrarProb: 0.25,
  velocidad: 150,
  correr: 190,
  sentarseTrasS: 5,
}

export interface EnemigoBalance {
  vida: number
  dano: [number, number]
  /** animación de ataque del manifest */
  anim: string
  ataquesPorSeg: number
  /** alcance de ataque en px (cuerpo a cuerpo ~ 30) */
  alcance: number
  velocidad: number
  ve: number
  xp: number
  oro: [number, number]
  proyectil?: string
  impacto?: string
  /** a qué distancia se aleja si la heroína se acerca */
  huyeSi?: number
  escala?: number
}

export const ENEMIGOS: Record<string, EnemigoBalance> = {
  rata: { vida: 12, dano: [2, 3], anim: 'attack_thrust', ataquesPorSeg: 1, alcance: 26, velocidad: 70, ve: 140, xp: 5, oro: [1, 3] },
  calabaza: { vida: 30, dano: [3, 5], anim: 'attack', ataquesPorSeg: 0.8, alcance: 28, velocidad: 50, ve: 160, xp: 12, oro: [2, 5] },
  goblin_arquero: { vida: 22, dano: [3, 5], anim: 'shoot_bow', ataquesPorSeg: 0.7, alcance: 200, velocidad: 60, ve: 220, xp: 15, oro: [3, 6], proyectil: 'proyectil_flecha', impacto: 'impacto_flecha', huyeSi: 120 },
  trol: { vida: 140, dano: [7, 10], anim: 'attack', ataquesPorSeg: 0.6, alcance: 34, velocidad: 55, ve: 200, xp: 90, oro: [20, 35] },
}

export const TROL_ELITE = {
  golpePesadoCadaS: 6,
  golpePesadoRadio: 48,
  golpePesadoDano: [12, 16] as [number, number],
  golpePesadoAvisoS: 1.2,
  gritoVidaPct: 50,
  gritoVelocidadPct: 20,
}

export const ENEMIGO_COMUN = {
  /** vuelve a su sitio si la heroína se aleja más de esto de su punto de inicio */
  volverSiLejos: 320,
  paseoRadio: 60,
  paseoCadaS: [2, 5] as [number, number],
}

export const MODO_PEQUE = {
  danoEnemigos: 0.5,
  velocidadEnemigos: 0.8,
  avisos: 1.5,
  botones: 1.25,
  zonaToque: 60,
  /** el control de noche llega solo a esto */
  nocheMax: 0.25,
  /** la oscuridad final nunca pasa de esto */
  oscuridadMax: 0.45,
  /** ids que arrancan con el modo peque prendido */
  porDefecto: ['alana'] as string[],
}

export const ATAQUES_GRANDES = {
  avisoS: 1.2,
}

/** Oscuridad (PLAN.md sección 0) */
export const OSCURIDAD = {
  nocheDefecto: 0.15,
  nocheMax: 0.55,
  finalMax: 0.6,
  /** velocidad de mezcla entre zonas: k = min(1, dt * esto) */
  mezclaPorSeg: 1.2,
}

export interface BotinFuente {
  objeto: number
  oro: number
  /** cantidad de objetos si cae */
  cantidad: number
  /** rareza garantizada del primer objeto */
  garantiza?: 'rare'
}

export const BOTIN = {
  rata: { objeto: 0.25, oro: 0.6, cantidad: 1 } satisfies BotinFuente,
  calabaza: { objeto: 0.35, oro: 0.6, cantidad: 1 } satisfies BotinFuente,
  goblin_arquero: { objeto: 0.35, oro: 0.7, cantidad: 1 } satisfies BotinFuente,
  trol: { objeto: 1, oro: 1, cantidad: 2, garantiza: 'rare' } as BotinFuente,
  rompible: { objeto: 0.2, oro: 0.5, cantidad: 1, pocionProb: 0.5 },
  cofres: {
    madera: { objetos: 1, oro: [5, 10] as [number, number], raroProb: 0, raroGarantizado: 0, legendarioProb: 0 },
    reforzado: { objetos: 2, oro: [15, 25] as [number, number], raroProb: 0.15, raroGarantizado: 0, legendarioProb: 0 },
    dorado: { objetos: 3, oro: [30, 50] as [number, number], raroProb: 0, raroGarantizado: 1, legendarioProb: 0.1 },
    legendario: { objetos: 0, oro: [200, 200] as [number, number], raroProb: 0, raroGarantizado: 0, legendarioProb: 0 },
  },
  /** los objetos normales sorteados tienen nivel <= nivel de la heroína + esto */
  nivelExtra: 2,
  legendarioNivel: [16, 24] as [number, number],
  rarezaRaro: 'rare',
  /** premios fijos por llave de pista de cofre secreto, o `tutorial` */
  premiosFijos: {
    tutorial: ['pet_armor_1'],
    pasto_alto: ['potion_health_minor', 'potion_health_minor', 'potion_health_minor'],
    tras_la_cascada: ['@raro'],
    anillo_hadas: ['pet_armor_2'],
    estanque_alto: ['@raro'],
    claro_escondido: ['@legendario'],
  } as Record<string, string[]>,
  /** arma personal del cofre legendario por id de heroína */
  armaPersonal: {
    sophie: 'arco_de_sophie',
    alana: 'varita_de_alana',
    rick: 'juramento_de_rick',
    steph: 'baculo_de_steph',
  } as Record<string, string>,
  armaPersonalDefecto: 'collar_de_thor',
  cofreLegendarioExtra: 'pet_armor_3',
  pociones: { vidaPct: 40, manaPct: 50, duracionS: 1 },
  cinturonInicial: ['potion_health_minor', 'potion_health_minor', 'potion_mana_minor', null] as (string | null)[],
  /** probabilidad de que un objeto normal sorteado sea un mágico `m_*` (si hay uno que le toque a su nivel) */
  magicoProb: 0.25,
  /** el legendario del Claro Escondido por clase de heroína */
  legendarioClaro: { amazona: 'pluma_de_cuervo', druida: 'ramita_del_abuelo', paladin: 'filo_del_alba', hechicera: 'rama_del_bosque_eterno' } as Record<string, string>,
  /** pociones que sueltan los rompibles cuando sale poción */
  pocionesSuelo: ['potion_health_minor', 'potion_mana_minor'] as string[],
  /** el tamaño de la moneda según la cantidad de oro: hasta small, medium, large y lo demás huge */
  oroTamano: { small: 3, medium: 8, large: 25 },
  /** la lluvia de oro al vencer al jefe: una moneda por número */
  lluviaDeOro: [40, 30, 25, 20, 15, 10, 8, 5],
  bolsaCasillas: 28,
  cinturonCasillas: 4,
}

/** Stats del catálogo que el Mundo 1 sí usa. El resto se muestra en el tooltip pero no hace nada. */
export const STATS_ACTIVOS = [
  'damage', 'defense', 'life', 'mana', 'dmgPct', 'armorPct', 'atkSpeed', 'castSpeed', 'moveSpeed',
  'critChance', 'lifeRegen', 'healPct', 'petDmg', 'petArmor', 'restoreLife', 'restoreMana',
] as const

/** Cuándo, dentro de la animación, sale el golpe o el disparo (0 a 1 del total de cuadros) */
export const GOLPE_EN = {
  heroe: 0.55,
  enemigo: 0.55,
}

export const PROYECTIL = {
  velocidad: 300,
  /** radio de choque contra un cuerpo, en px */
  radio: 12,
  vidaMaxS: 1.6,
}

export const COMBATE = {
  /** el enemigo marcado por el toque pierde la marca si se va más lejos que esto */
  soltarObjetivoLejos: 420,
  /** al recibir un golpe el enemigo se frena este rato, en s */
  aturdidoS: 0.28,
  empujeHit: 10,
  /** cuántos números de daño caben a la vez en pantalla */
  topeNumeros: 24,
  /** la heroína cae a este nivel de vida */
  vidaCaida: 0,
  fundidoRescateS: 1,
  rescateVidaPct: 100,
  critDanoMult: 1.5,
  critBase: 0.05,
  /** cada punto de armadura reduce el daño: dano * 100 / (100 + armadura * esto) */
  armaduraFactor: 4,
  velocidadHeroe: 120,
  velocidadHeroeCorrer: 160,
  correrSiCaminoMayorA: 400,
  /** invulnerabilidad corta tras recibir daño, en s */
  invulnerableS: 0.35,
}

export const JEFE = {
  vida: 650,
  arenaRadio: 192,
  fase2Pct: 60,
  golpe: { dano: [10, 14] as [number, number], radio: 50 },
  /** el aviso `aviso_jefe` mide 96 px de ancho: el golpe fuerte usa su tamaño x1 (radio 48), el pisotón y el salto x2 (radio 96) para no escalar con decimales */
  golpeFuerte: { dano: [14, 18] as [number, number], radio: 48, avisoS: 1.2, delante: 44 },
  carga: { dano: [16, 22] as [number, number], avisoS: 1.2, velocidad: 330, aturdidoS: 1.5, ancho: 40 },
  pisoton: { dano: [14, 18] as [number, number], radio: 96, avisoS: 1.2 },
  salto: { dano: [18, 24] as [number, number], radio: 96, avisoS: 1.2, duracionS: 0.4 },
  grito: { ratas: 2, maxRatas: 4, avisoS: 0.8, cadaS: 12 },
  pausaEntreAtaquesS: [1.4, 2.4] as [number, number],
  /** el golpe normal tarda esto en caer tras empezar (sin aviso grande: es chico) */
  golpeVentanaS: 0.45,
  introS: 2.5,
  fase2RugidoS: 1.4,
  /** el borde de la arena queda a esto del radio: el jefe y la carga no pasan de ahí */
  margenBorde: 24,
  /** la heroína al entrar queda a este margen del borde */
  entradaMargen: 24,
  /** el cuerpo del jefe para recibir disparos */
  cuerpoRadio: 30,
  cuerpoAlto: 72,
  xp: 400,
  velocidad: 70,
}

/**
 * El peso de los golpes: una pausa cortita del mundo (hitstop) y una sacudida de cámara según lo que pasó.
 * Las pausas no se encadenan: en cualquier segundo no se congela más de topePausaPorSeg (el torbellino pega muchas veces).
 */
export const IMPACTO = {
  golpe: { pausa: 0, sacudidaMs: 0, fuerza: 0 },
  critico: { pausa: 0.05, sacudidaMs: 90, fuerza: 0.0025 },
  muerte: { pausa: 0.07, sacudidaMs: 120, fuerza: 0.003 },
  jefeGolpe: { pausa: 0.03, sacudidaMs: 0, fuerza: 0 },
  jefeCritico: { pausa: 0.07, sacudidaMs: 120, fuerza: 0.0035 },
  jefeFase2: { pausa: 0.35, sacudidaMs: 500, fuerza: 0.012 },
  jefeMuerte: { pausa: 0.5, sacudidaMs: 700, fuerza: 0.014 },
  recibidoFuerte: { pausa: 0.06, sacudidaMs: 200, fuerza: 0.006 },
  topePausaPorSeg: 0.16,
  /** el destello blanco de quien recibe el golpe */
  destelloMs: 70,
}

/**
 * La tienda de la fogata: se abre al tocar una fogata. Pociones para el cinturón y las armaduras de Thor, que se le ponen
 * enseguida. Los precios están pensados para lo que se junta en el Mundo 1 (un cofre de madera da 5 a 10, un trol 20 a 35).
 */
export const TIENDA = {
  ofertas: [
    { id: 'potion_health_minor', precio: 10 },
    { id: 'potion_mana_minor', precio: 10 },
    { id: 'potion_rejuv_minor', precio: 18 },
    { id: 'pet_armor_1', precio: 40 },
    { id: 'pet_armor_2', precio: 120 },
    { id: 'pet_armor_3', precio: 260 },
  ],
}

/**
 * Thor olfatea (tocarlo, o la tecla T): ladra, y lleva a la heroína hasta el cofre sin abrir más cercano dejando huellas.
 * Va un tramo adelante y la espera; si ella no viene en esperaMaxS, vuelve a seguirla.
 */
export const OLFATO = {
  /** después del ladrido (que dura lo suyo) arranca enseguida */
  ladrarS: 0.15,
  /** cuánto se adelanta antes de esperarla */
  adelanto: 200,
  /** a esta distancia ella "lo alcanzó" y él sigue */
  cerca: 90,
  esperaMaxS: 20,
  /** después de cavar y ladrar */
  llegoS: 0.4,
  /** una huella cada tantos px recorridos */
  huellaCada: 16,
  huellaVidaS: 4,
  recargaS: 3,
  /** no busca cofres más lejos que esto (en línea recta) */
  maxDistancia: 2600,
  /** al llegar, a esta distancia del cofre se para */
  llegada: 34,
}

/**
 * La flecha guía: aparece en el borde de la pantalla si pasa un rato sin progreso (zona nueva, cofre, enemigo, nivel).
 * Apunta a la zona sin descubrir más cercana; con nivel suficiente, a la arena del jefe; después de ganarle, al portal.
 * Las zonas secretas nunca se señalan.
 */
export const GUIA = {
  esperaS: 40,
  /** en modo peque aparece antes */
  esperaPequeS: 25,
  nivelParaJefe: 6,
  /** distancia al borde de la pantalla (lógica) */
  margen: 30,
  margenAbajo: 92,
  /** si el destino está a menos de esto de la heroína no hace falta flecha */
  cerca: 140,
}

export const CAMARA = {
  lerp: 0.12,
  adelanto: 40,
}

export const AUTOGUARDADO_S = 30
