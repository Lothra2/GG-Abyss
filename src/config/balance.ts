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

/**
 * El ataque básico sale del arma que lleva puesta (sin arma, el de su clase). Cinco familias: tajo (espadas, hachas,
 * mazas), pesado (mandobles, martillos: más lento y pega más), estocada (lanzas: llega más lejos), flecha (arcos) y
 * hechizo (varitas, báculos, cetros). Las habilidades siguen siendo de la clase.
 */
export type FamiliaAtaque = 'tajo' | 'pesado' | 'estocada' | 'flecha' | 'hechizo'

export const ATAQUES: Record<FamiliaAtaque, { anim: string; alcance: number; ritmo: number; danoPct: number; proyectil: string | null; impacto: string | null; sonido: string }> = {
  tajo: { anim: 'attack', alcance: 44, ritmo: 1, danoPct: 100, proyectil: null, impacto: 'tajo', sonido: 'espadazo' },
  pesado: { anim: 'attack_heavy', alcance: 50, ritmo: 0.75, danoPct: 140, proyectil: null, impacto: 'tajo', sonido: 'espadazo' },
  estocada: { anim: 'attack_thrust', alcance: 62, ritmo: 0.95, danoPct: 100, proyectil: null, impacto: 'tajo', sonido: 'espadazo' },
  flecha: { anim: 'shoot_bow', alcance: 220, ritmo: 1, danoPct: 100, proyectil: 'proyectil_flecha', impacto: 'impacto_flecha', sonido: 'arco' },
  // el hechizo toma el elemento de su clase si es de magia (druida naturaleza, hechicera fuego); si no, arcano
  hechizo: { anim: 'cast', alcance: 200, ritmo: 0.95, danoPct: 100, proyectil: 'proyectil_arcano', impacto: 'impacto_arcano', sonido: 'magia' },
}

/** Atacar sin elegir enemigo: el cono (grados a cada lado) en el que busca a quién pegarle */
export const ATAQUE_LIBRE = { conoGrados: 70 }

/** La familia de cada arma del catálogo, por su ícono base */
export const FAMILIA_DE_ARMA: Record<string, FamiliaAtaque> = {
  sword: 'tajo', scimitar: 'tajo', katana: 'tajo', rapier: 'estocada', dagger: 'tajo', kris: 'tajo', axe: 'tajo', hatchet: 'tajo', mace: 'tajo',
  morning_star: 'tajo', flail: 'tajo', club: 'tajo', claw: 'tajo', warhammer: 'pesado', greatsword: 'pesado', greataxe: 'pesado', maul: 'pesado', scythe: 'pesado',
  spear: 'estocada', halberd: 'estocada', javelin: 'estocada', bow: 'flecha', longbow: 'flecha', crossbow: 'flecha', wand: 'hechizo', staff: 'hechizo', scepter: 'hechizo',
}

/** La familia de cada clase sin arma puesta */
export const FAMILIA_DE_CLASE: Record<ClaseId, FamiliaAtaque> = { amazona: 'flecha', druida: 'hechizo', paladin: 'tajo', hechicera: 'hechizo' }

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
  /** en pelea el maná vuelve lento: las habilidades se eligen y las pociones azules sirven */
  manaRegenPorSeg: 1,
  /** en calma (sin recibir golpes ni usar habilidades un rato) vuelve rápido, para no esperar explorando */
  manaRegenCalmaPorSeg: 4,
  calmaTrasS: 4,
  // se cura sola, pero despacio y después de un rato sin golpes: las pociones importan
  vidaRegenPorSeg: 2,
  vidaRegenTrasDanoS: 6,
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
    { id: 'lluvia_flechas', nombre: 'Lluvia de flechas', anim: 'shoot_bow', mana: 10, recarga: 4, params: { flechas: 3, abanicoGrados: 20, danoPct: 80 } },
    { id: 'esquiva', nombre: 'Esquiva', anim: 'dodge', mana: 0, recarga: 3, params: { distancia: 90, duracion: 0.35 } },
  ],
  druida: [
    { id: 'llamar_thor', nombre: 'Llamar a Thor', anim: 'summon', mana: 15, recarga: 10, fx: 'escudo_de_thor', params: { escudoS: 4, escudoBase: 30, escudoPorNivel: 5, mordidaPct: 300 } },
    { id: 'curar', nombre: 'Curar', anim: 'cast', mana: 15, recarga: 8, fx: 'curar', params: { curaPct: 35 } },
  ],
  paladin: [
    { id: 'torbellino', nombre: 'Torbellino', anim: 'whirlwind', mana: 10, recarga: 5, params: { duracion: 1.2, radio: 60, cadaS: 0.3, danoPct: 70 } },
    { id: 'bloqueo', nombre: 'Bloqueo', anim: 'block_shield', mana: 0, recarga: 4, params: { duracion: 1.5, reduccionPct: 80 } },
  ],
  hechicera: [
    { id: 'nova_fuego', nombre: 'Nova de fuego', anim: 'nova', mana: 18, recarga: 5, fx: 'nova_fuego', params: { radio: 110, danoPct: 150 } },
    { id: 'rayo_canalizado', nombre: 'Rayo canalizado', anim: 'channel', mana: 0, recarga: 0, fx: 'proyectil_arcano', params: { manaPorSeg: 6, cadaS: 0.2, danoPct: 50 } },
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
  /** F8: si Thor anda cerca, persigue a Thor en vez de a la heroína (y a Thor no le hace nada): la raicita */
  distraeThor?: { radio: number }
  /** F8: golpe pesado anunciado sin ser élite (el guardián de cobre): cada cuánto, radio, aviso y daño */
  pesado?: { cadaS: number; radio: number; avisoS: number; dano: [number, number]; empuje?: number; barrido?: boolean; cadena?: boolean; linea?: { largo: number; ancho: number; jalarS: number } }
  /** F11: la polilla de ceniza va a apagar los cristales prendidos antes que pelear */
  buscaLuz?: boolean
  /** F11: la sombra solo se ve (y solo pega y se le pega) dentro de una luz. Afuera son dos ojos */
  soloEnLuz?: boolean
  /** F12: hecho de niebla: en la luz se ve y se deshace rápido (PUERTO.marinero), afuera casi no se ve y aguanta más */
  deNiebla?: boolean
  /** F12: va en grupo y rodea antes de pegar (el cangrejo de ceniza) */
  rodea?: boolean
  /** F12: no pega: va hacia Thor y si lo toca le apaga el farol (la medusa negra). Se aleja del farol alzado */
  apagaFarol?: boolean
  /** F12: el sonámbulo de piedra: en un barrio prendido (o en la luz de un farol de plaza) se queda quieto, de piedra */
  petrificaEnLuz?: boolean
  /** F12: la gárgola duerme posada hasta que la heroína se acerca, y pega en picada con su sombra de aviso en el piso */
  gargola?: { despiertaA: number; picadaCadaS: number; picadaAvisoS: number; picadaRadio: number; correa: number }
  /** F12: su proyectil hace bostezar a la heroína (el duende del sueño) */
  bostezo?: boolean
  /** F12, la Fragua: el hollín no pega, se le pega a la heroína (le achica el halo) y huye de la luz fría */
  pegaHollin?: boolean
  huyeLuzFria?: boolean
  /** F12: la salamandra deja un rastro de piso caliente y, mojada por Thor, queda de piedra (recibe el doble) */
  rastro?: boolean
  seMoja?: boolean
}

export const ENEMIGOS: Record<string, EnemigoBalance> = {
  rata: { vida: 18, dano: [3, 4], anim: 'attack_thrust', ataquesPorSeg: 1, alcance: 26, velocidad: 70, ve: 140, xp: 5, oro: [1, 3] },
  calabaza: { vida: 45, dano: [4, 7], anim: 'attack', ataquesPorSeg: 0.8, alcance: 28, velocidad: 50, ve: 160, xp: 12, oro: [2, 5] },
  goblin_arquero: { vida: 34, dano: [4, 7], anim: 'shoot_bow', ataquesPorSeg: 0.7, alcance: 200, velocidad: 60, ve: 220, xp: 15, oro: [3, 6], proyectil: 'proyectil_flecha', impacto: 'impacto_flecha', huyeSi: 120 },
  trol: { vida: 210, dano: [9, 13], anim: 'attack', ataquesPorSeg: 0.6, alcance: 34, velocidad: 55, ve: 200, xp: 90, oro: [20, 35] },
  // F8, la Catedral: lento y pesado. Su golpe común casi no duele: lo que enseña es el golpe grande, que avisa mucho
  // antes (el anillo se llena) y se esquiva saliéndose. Después del golpe queda un rato quieto: ahí se le pega.
  // chiquita y rápida: salta de un lado a otro. Lo que enseña: Thor la distrae (lo persigue a él) y ahí se le pega
  raicita: { vida: 21, dano: [3, 4], anim: 'attack', ataquesPorSeg: 1, alcance: 24, velocidad: 95, ve: 180, xp: 8, oro: [1, 4], distraeThor: { radio: 170 } },
  // se queda en su lugar y tira una bola violeta lenta que se ve venir: se esquiva de costado o se lo busca de cerca
  vigia_raices: { vida: 40, dano: [4, 7], anim: 'cast', ataquesPorSeg: 0.45, alcance: 230, velocidad: 25, ve: 260, xp: 20, oro: [4, 8], proyectil: 'proyectil_arcano', impacto: 'impacto_arcano' },
  guardian_cobre: { vida: 180, dano: [5, 8], anim: 'attack', ataquesPorSeg: 0.4, alcance: 34, velocidad: 38, ve: 190, xp: 80, oro: [15, 25], pesado: { cadaS: 4.5, radio: 48, avisoS: 1.5, dano: [13, 18] } },
  // F11, las Galerías. Rápida y frágil: si ve un cristal prendido va a apagarlo. Lo que enseña: cuidar la luz
  polilla_ceniza: { vida: 15, dano: [2, 4], anim: 'attack', ataquesPorSeg: 0.9, alcance: 24, velocidad: 80, ve: 200, xp: 7, oro: [1, 3], buscaLuz: true },
  // el gólem minero: lento y duro como el guardián de cobre, con su golpe de pico que avisa
  minero_piedra: { vida: 140, dano: [4, 7], anim: 'attack', ataquesPorSeg: 0.45, alcance: 32, velocidad: 34, ve: 180, xp: 60, oro: [10, 18], pesado: { cadaS: 5, radio: 44, avisoS: 1.4, dano: [11, 16] } },
  // vive en lo oscuro: hay que traerla a la luz (un cristal prendido o el brillo de Thor) para pelearle
  sombra: { vida: 40, dano: [4, 6], anim: 'attack', ataquesPorSeg: 0.7, alcance: 26, velocidad: 58, ve: 200, xp: 20, oro: [3, 6], soloEnLuz: true },
  // F12, el Puerto. El marinero de niebla: en la luz del farol se ve entero y se deshace rápido; afuera son dos linternitas
  marinero_niebla: { vida: 40, dano: [4, 7], anim: 'attack', ataquesPorSeg: 0.7, alcance: 28, velocidad: 48, ve: 200, xp: 22, oro: [3, 7], deNiebla: true },
  // chiquitos, en grupos: se reparten alrededor de la heroína y entran de a uno
  cangrejo_ceniza: { vida: 14, dano: [2, 3], anim: 'attack', ataquesPorSeg: 1.1, alcance: 22, velocidad: 80, ve: 180, xp: 6, oro: [1, 3], rodea: true },
  // flota lenta y no pega: si toca a Thor le apaga el farol. Lo que enseña: cuidar al perro y alzar el farol
  medusa_negra: { vida: 22, dano: [0, 0], anim: 'idle', ataquesPorSeg: 0.5, alcance: 0, velocidad: 28, ve: 170, xp: 8, oro: [1, 2], apagaFarol: true },
  // el minijefe del Astillero: el golpe de ancla avisa grande en el piso, levanta una ola corta que empuja y lo deja clavado
  // F12, la Ciudad Dormida. El sonámbulo: lento y duro, de piedra en la luz (ahí se le pega tranquilo), camina a oscuras
  sonambulo_piedra: { vida: 52, dano: [5, 8], anim: 'attack', ataquesPorSeg: 0.55, alcance: 30, velocidad: 34, ve: 200, xp: 26, oro: [4, 8], petrificaEnLuz: true },
  // posada parece una estatua más; despierta y se tira en picada donde estaba la heroína (la sombra avisa)
  gargola_dormida: { vida: 30, dano: [6, 9], anim: 'attack', ataquesPorSeg: 0.4, alcance: 30, velocidad: 72, ve: 200, xp: 20, oro: [3, 7], gargola: { despiertaA: 150, picadaCadaS: 3.6, picadaAvisoS: 1.1, picadaRadio: 30, correa: 260 } },
  // dormilón con su bolsa de arena: tira de lejos y la arena hace bostezar (más lento un rato)
  duende_sueno: { vida: 22, dano: [2, 4], anim: 'attack', ataquesPorSeg: 0.5, alcance: 190, velocidad: 52, ve: 230, xp: 14, oro: [2, 5], proyectil: 'proyectil_arena', impacto: 'impacto_arena', huyeSi: 100, bostezo: true },
  // el minijefe de la Torre: la aguja de su reloj barre girando alrededor de él (con aviso en línea)
  relojero: { vida: 260, dano: [6, 9], anim: 'attack', ataquesPorSeg: 0.5, alcance: 40, velocidad: 38, ve: 230, xp: 150, oro: [30, 50], pesado: { cadaS: 6, radio: 150, avisoS: 1.6, dano: [12, 16], barrido: true } },
  capitan_ahogado: { vida: 240, dano: [6, 9], anim: 'attack', ataquesPorSeg: 0.5, alcance: 40, velocidad: 40, ve: 230, xp: 140, oro: [30, 50], pesado: { cadaS: 5, radio: 56, avisoS: 1.6, dano: [14, 18], empuje: 56 } },
  // F12, la Fragua. El hollín: en grupo, salta a pegarse (si ya tiene muchos encima, raspa poquito). Huye de la luz fría
  hollin: { vida: 12, dano: [1, 2], anim: 'attack', ataquesPorSeg: 0.8, alcance: 22, velocidad: 74, ve: 190, xp: 6, oro: [1, 2], pegaHollin: true, huyeLuzFria: true },
  // rápida, escupe brasas de lejos y deja el piso caliente donde pasa; mojada por Thor queda de piedra un rato
  salamandra_brasa: { vida: 30, dano: [4, 7], anim: 'attack', ataquesPorSeg: 0.55, alcance: 170, velocidad: 70, ve: 220, xp: 18, oro: [3, 6], proyectil: 'proyectil_brasa', impacto: 'impacto_brasa', huyeSi: 80, rastro: true, seMoja: true },
  // lenta: la cadena gira en anillo alrededor de ella (el aviso se llena en el piso). Algunas cargan una jaula de luz
  farolero_cadenas: { vida: 90, dano: [5, 8], anim: 'attack', ataquesPorSeg: 0.5, alcance: 34, velocidad: 32, ve: 200, xp: 40, oro: [6, 12], pesado: { cadaS: 5.5, radio: 64, avisoS: 1.6, dano: [11, 15], cadena: true } },
  // el minijefe de la Cárcel: lanza la cadena en línea (aviso en el piso) y se jala hasta donde cayó
  carcelero: { vida: 300, dano: [7, 10], anim: 'attack', ataquesPorSeg: 0.5, alcance: 40, velocidad: 36, ve: 240, xp: 170, oro: [35, 55], pesado: { cadaS: 5.5, radio: 190, avisoS: 1.6, dano: [13, 17], linea: { largo: 210, ancho: 34, jalarS: 0.45 } } },
}

/**
 * La dureza de cada piso (pedido de Rick: "mato todo muy fácil", y en F13 otra vez: "sigue siendo muy fácil"). La
 * heroína sube de nivel y de equipo al bajar: los enemigos también. Medido en logic/__tests__/dificultad.test.ts con el
 * equipo normal de su nivel: un enemigo común aguanta unos 3 a 7 golpes, la heroína unos 10 a 25 golpes comunes y un
 * jefe más de un minuto de golpes seguidos.
 */
export const DUREZA = {
  /** desde el Bosque: la vida y el daño de todos los enemigos se multiplican por esto */
  vidaBase: 2.6,
  danoBase: 2.6,
  /** y cada piso más abajo suma esto */
  vidaPorPiso: 0.35,
  danoPorPiso: 0.25,
  /** los jefes aguantan esto más (sus fases y sus ventanas siguen igual) */
  jefeVida: 2.8,
  /** F13: los jefes también pegan más, y más abajo más (multiplica sus golpes: 1.4 en el piso 1, 4.1 en el 7) */
  jefeDanoBase: 1.4,
  jefeDanoPorPiso: 0.45,
  /** desde este piso los grupos traen refuerzos: cada enemigo común trae un compañero con esta probabilidad por piso */
  refuerzoDesde: 3,
  refuerzoPorPiso: 0.12,
  /** el Ciclo 2 en adelante: cada ciclo extra multiplica otra vez la vida y el daño (y los jefes) */
  ciclo: { vida: 1.7, dano: 1.5 },
}

export const TROL_ELITE = {
  golpePesadoCadaS: 6,
  golpePesadoRadio: 48,
  golpePesadoDano: [15, 20] as [number, number],
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
  // F13: un poco menos generoso (Rick: "sube la dificultad en los dos modos")
  danoEnemigos: 0.6,
  /** en modo peque la heroína pega más fuerte: los enemigos más duros siguen cayendo rápido para Alana */
  danoHeroina: 1.3,
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
  rata: { objeto: 0.08, oro: 0.45, cantidad: 1 } satisfies BotinFuente,
  calabaza: { objeto: 0.12, oro: 0.5, cantidad: 1 } satisfies BotinFuente,
  goblin_arquero: { objeto: 0.12, oro: 0.55, cantidad: 1 } satisfies BotinFuente,
  trol: { objeto: 1, oro: 1, cantidad: 2, garantiza: 'rare' } as BotinFuente,
  guardian_cobre: { objeto: 0.6, oro: 1, cantidad: 1 } as BotinFuente,
  raicita: { objeto: 0.06, oro: 0.45, cantidad: 1 } as BotinFuente,
  vigia_raices: { objeto: 0.15, oro: 0.6, cantidad: 1 } as BotinFuente,
  polilla_ceniza: { objeto: 0.05, oro: 0.4, cantidad: 1 } as BotinFuente,
  minero_piedra: { objeto: 0.5, oro: 1, cantidad: 1 } as BotinFuente,
  sombra: { objeto: 0.15, oro: 0.6, cantidad: 1 } as BotinFuente,
  marinero_niebla: { objeto: 0.15, oro: 0.6, cantidad: 1 } as BotinFuente,
  cangrejo_ceniza: { objeto: 0.05, oro: 0.4, cantidad: 1 } as BotinFuente,
  medusa_negra: { objeto: 0.06, oro: 0.4, cantidad: 1 } as BotinFuente,
  capitan_ahogado: { objeto: 1, oro: 1, cantidad: 2, garantiza: 'rare' } as BotinFuente,
  sonambulo_piedra: { objeto: 0.15, oro: 0.6, cantidad: 1 } as BotinFuente,
  gargola_dormida: { objeto: 0.1, oro: 0.5, cantidad: 1 } as BotinFuente,
  duende_sueno: { objeto: 0.08, oro: 0.5, cantidad: 1 } as BotinFuente,
  relojero: { objeto: 1, oro: 1, cantidad: 2, garantiza: 'rare' } as BotinFuente,
  hollin: { objeto: 0.05, oro: 0.4, cantidad: 1 } as BotinFuente,
  salamandra_brasa: { objeto: 0.12, oro: 0.6, cantidad: 1 } as BotinFuente,
  farolero_cadenas: { objeto: 0.25, oro: 0.8, cantidad: 1 } as BotinFuente,
  carcelero: { objeto: 1, oro: 1, cantidad: 2, garantiza: 'rare' } as BotinFuente,
  rompible: { objeto: 0.1, oro: 0.4, cantidad: 1, pocionProb: 0.6 },
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
  cinturonInicial: ['potion_health_minor', 'potion_health_minor', 'potion_mana_minor', null, null] as (string | null)[],
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
  /** casillas del cinturón (teclas 1 a 5); se ordenan arrastrando una poción sobre otra */
  cinturonCasillas: 5,
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
  // F13: la armadura protege menos (con 4, el equipo normal dejaba pasar apenas un quinto del daño)
  armaduraFactor: 1.5,
  // más pausado desde F10: con la cámara más cerca en la compu se ve el doble de rápido en pantalla
  velocidadHeroe: 105,
  velocidadHeroeCorrer: 140,
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
 * F8, el Guardián de la Campana (la Catedral). Tres patrones que se enseñan de a uno:
 * golpe frontal (desde el principio), onda de campana (desde la fase 2, la primera vez sola) y llamada de raíces
 * (desde `raicesPct`, la primera vez sola). La onda es un anillo: cerca de la campana (adentro de `interior`) no llega.
 * Después de la onda queda aturdido un rato: es la ventana clara para pegarle.
 */
export const JEFE_CAMPANA = {
  vida: 720,
  onda: { dano: [12, 16] as [number, number], interior: 64, exterior: 176, avisoS: 1.6, aturdidoS: 1.6 },
  // radio 48: el aviso del kit (96 x 48) a escala 1, sin decimales
  raices: { dano: [10, 14] as [number, number], radio: 48, avisoS: 1.4, separacion: 96, duranS: 3.5 },
  raicesPct: 35,
}

/**
 * F11, la Polilla Reina (las Galerías). Vuela alto y no se le puede pegar mientras los cuatro cristales grandes de la
 * arena estén apagados: hay que prenderlos. Cuando se prende el cuarto cae aturdida y ahí se le pega fuerte.
 * Ataques: aletazo (chico), lluvia de polvo (una mancha que avisa en el piso: el polvo apaga los cristales que tapa)
 * y la llamada de polillas. En modo peque el polvo no apaga los cristales grandes.
 */
export const JEFE_POLILLA = {
  vida: 600,
  aletazo: { dano: [8, 12] as [number, number], radio: 56 },
  // radio 48: el aviso_polvo del kit (96 x 96) a escala 1
  polvo: { dano: [10, 14] as [number, number], radio: 48, avisoS: 1.5 },
  llamada: { polillas: 2, maxPolillas: 4, avisoS: 1, cadaS: 14 },
  /** cae aturdida al prenderse el cuarto cristal grande */
  aturdidaS: 5,
  /** cada cuánto vuelve a caer aturdida si los cuatro siguen prendidos */
  aturdidaCadaS: 9,
  /** con los cristales apagados un golpe le hace esto del daño (nada: hay que prenderlos) */
  danoSinLuz: 0,
}

/**
 * F12, el Pez Farol (el Puerto Ahogado). Vive bajo el agua negra del pie del faro: sumergido no se le puede pegar, solo
 * se ve su lucecita. Sale a morder (con aviso en el piso) y queda afuera un rato: ahí se le pega. Desde la fase 2 salta y
 * levanta una ola en línea que empuja. Desde la 3 llama cangrejos y medusas. Si Thor alza el farol cerca, la luz lo
 * encandila: sale a la superficie aturdido y es la ventana grande para pegarle.
 */
export const JEFE_PEZ = {
  vida: 760,
  velocidad: 48,
  fase3Pct: 30,
  // radio 44: el aviso_mordida del kit (128 x 64) a escala 1 es una elipse de 64 x 32 de semiejes, el golpe pega en su cuerpo
  mordida: { dano: [11, 15] as [number, number], radio: 44, delante: 56, alcance: 104, avisoS: 1.3, fueraS: 1.8 },
  ola: { dano: [12, 16] as [number, number], largo: 260, ancho: 52, avisoS: 1.5, empuje: 72, fueraS: 1.6 },
  llamada: { cangrejos: 2, medusas: 1, max: 4, avisoS: 1, cadaS: 15 },
  /** Thor alza el farol a esta distancia o menos: el pez sale aturdido */
  alzarRadio: 230,
  aturdidoS: 4.5,
  /** después de encandilarlo no vuelve a caer por el farol hasta pasado esto */
  alzarCadaS: 6,
  /** el pez emerge y se hunde en esto (anim `emerger` y `hundirse`) */
  emergerS: 0.8,
  /** a qué altura sobre su pie va la lucecita de la antena (pivote [64, 69] en la celda de 128) */
  antenaAlto: 48,
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
  /** colchón de entrada: una habilidad tocada mientras termina el golpe se guarda este rato y sale al terminar */
  colchonS: 0.15,
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
  /** el equipo que trae el mercader: precio = base de la rareza + nivel x porNivel */
  precioBase: { normal: 15, magic: 45, rare: 120, set: 220, unique: 260, legendary: 300 } as Record<string, number>,
  precioPorNivel: 3,
  /** lo que paga el mercader por algo de la bolsa: esta parte del precio (al menos 1) */
  ventaPct: 30,
  /** cuántas piezas de equipo trae (una es un arma de la clase de la heroína) */
  surtido: 3,
  /** las armas que el mercader le guarda a cada clase (por el ícono base del catálogo) */
  armasDeClase: {
    amazona: ['bow', 'longbow', 'crossbow', 'javelin', 'spear'],
    druida: ['wand', 'staff', 'scepter', 'club'],
    paladin: ['sword', 'mace', 'axe', 'warhammer', 'morning_star', 'scimitar'],
    hechicera: ['staff', 'wand', 'scepter'],
  } as Record<string, string[]>,
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

/**
 * Los momentos de cine de la pelea con el jefe (en segundos reales desde que empieza cada uno):
 * la entrada (franjas, la cámara va al jefe, su nombre grande), la fase 2 (se enoja) y la muerte (cámara lenta, victoria).
 */
export const ESCENA_JEFE = {
  intro: { duracion: 2.5, foco: [0.15, 1.9] as [number, number], titulo: [0.45, 2.3] as [number, number], franjas: 2.5 },
  fase2: { duracion: 1.4, foco: [0, 0.9] as [number, number], titulo: [0.1, 1.4] as [number, number] },
  muerte: { duracion: 4.6, foco: [0, 2.6] as [number, number], titulo: [1.4, 4.6] as [number, number], franjas: 3.6 },
  /** las franjas entran y salen en esto */
  franjasS: 0.35,
  /** el título aparece y se va en esto */
  fundidoS: 0.3,
  /** durante la pelea la cámara se corre hacia el jefe esta fracción, si está a menos de `mezclaHasta` px */
  mezcla: 0.32,
  mezclaHasta: 340,
  /** la cámara lenta de la muerte */
  lenta: { factor: 0.35, seg: 1.8 },
}

/** F7: la música por estados. Tiempos en segundos; los cambios se funden en 1.5 s */
export const MUSICA_ESTADOS = {
  /** cuántos enemigos alertas hacen "combate" (o un élite solo) */
  combateDesde: 3,
  subirAmenazaS: 1.5,
  subirCombateS: 2.5,
  /** volver a la calma */
  bajarS: 6,
  /** sentarse a la fogata */
  descansoS: 2,
  /** después de un cambio, la música se queda al menos esto */
  minimoS: 5,
  /** a esta distancia un enemigo alerta cuenta */
  radioAlerta: 420,
  /** a esta distancia de una fogata es descanso */
  radioFogata: 110,
}

export const CAMARA = {
  lerp: 0.12,
  adelanto: 40,
}

export const AUTOGUARDADO_S = 30

/**
 * F11: el camino al fondo (PLAN.md F11). Siete pisos, cada uno más oscuro. En modo peque la oscuridad nunca pasa de
 * 0.60 y siempre hay farol. El nombre del piso 7 es de trabajo.
 */
export const ABISMO = {
  pisos: [
    { piso: 1, mundo: 'mundo1', nombre: 'El Bosque', oscuridadMax: 0.6, jefe: 'minotauro' },
    { piso: 2, mundo: 'mundo2', nombre: 'La Catedral de las Raíces', oscuridadMax: 0.65, jefe: 'guardian_campana' },
    { piso: 3, mundo: 'mundo3', nombre: 'Las Galerías del Eco', oscuridadMax: 0.75, jefe: 'polilla_reina' },
    { piso: 4, mundo: 'mundo4', nombre: 'El Puerto Ahogado', oscuridadMax: 0.8, jefe: 'pez_farol' },
    { piso: 5, mundo: 'mundo5', nombre: 'La Ciudad Dormida', oscuridadMax: 0.8, jefe: 'rey_de_piedra' },
    { piso: 6, mundo: 'mundo6', nombre: 'La Fragua de las Luces', oscuridadMax: 0.82, jefe: 'dragona_brasa' },
    { piso: 7, mundo: 'mundo7', nombre: 'El Corazón del Abismo', oscuridadMax: 0.85, jefe: 'diablo' },
  ],
  /** la oscuridad de cualquier piso en modo peque nunca pasa de esto */
  oscuridadMaxPeque: 0.6,
  /** desde este piso Thor brilla un poquito, así nunca se pierden de vista */
  thorBrillaDesde: 3,
  thorBrilloRadio: 54,
  /** y el jefe de esos pisos también, un poco más grande y violeta */
  jefeBrilloRadio: 120,
  /** Mundo 3: cristales que se prenden al pegarles */
  cristal: { radioLuz: 80, radioLuzGrande: 180, golpeRadio: 26 },
  /** la sombra se ve dentro de una luz que la cubra hasta esta fracción del radio (en el borde de la luz no) */
  sombraVisibleEn: 0.85,
  /** la polilla de ceniza va al cristal prendido más cercano dentro de esto, y lo apaga al llegar a esto */
  polilla: { ve: 260, apagaA: 40 },
  /** la figura de los ojos rojos: aparece lejos, en el borde de la luz, y se va si te acercas */
  figura: { desdePiso: 3, distMin: 260, distMax: 340, seVaA: 180, thorGrunneA: 240, porPiso: [0, 0, 0, 1, 2, 3, 4, 1] },
} as const

/**
 * F12: el Mundo 4, El Puerto Ahogado (PLAN.md F12). La luz la carga Thor en su farol, la marea cambia el mapa, los
 * marineros de niebla se deshacen en la luz y el faro, al prenderse, ilumina el piso entero.
 */
export const PUERTO = {
  farol: {
    /** la luz grande del piso, en la boca de Thor */
    radio: 210,
    /** con el farol alzado (aullido) la luz crece, expone a los marineros y espanta medusas */
    radioAlzado: 320,
    /** apagado por una medusa: queda una brasa chiquita, nunca a oscuras del todo */
    radioApagado: 46,
    alzadoS: 4,
    recargaAlzarS: 14,
    /** cuánto dura apagado si una medusa lo toca (en modo peque menos) */
    apagadoS: 6,
    apagadoPequeS: 3,
    /** en modo peque el farol alumbra un poco más */
    extraPeque: 30,
  },
  /** el halo de la heroína se achica: la luz es de Thor */
  haloHeroina: 70,
  /** el ciclo de la marea en segundos: baja, sube (con aviso), alta, baja (con aviso) */
  marea: { baja: 50, subiendo: 8, alta: 25, bajando: 8, pequeMult: 1.5 },
  /** el empujón suave cuando la marea alcanza a la heroína: busca el seco más cercano hasta esta distancia en cuadros */
  rescateMareaCuadros: 12,
  /** el marinero de niebla en la luz del farol se deshace más rápido; a oscuras casi no se le hace nada */
  marinero: { danoEnLuz: 1.6, danoOscuro: 0.4 },
  /** los cangrejos rodean a esta distancia del objetivo */
  cangrejo: { radioRodeo: 46 },
  /**
   * La medusa negra: si llega a esto de Thor le apaga el farol y se aleja un rato. No se va más lejos que `correa` de su
   * casa (flota sobre el agua y la orilla). Con el farol alzado cerca se espanta y se aleja.
   */
  medusa: { tocaA: 22, esperaS: 6, correa: 220, espantaA: 200, velHuye: 1.8 },
  /** el marinero en la luz: cuánto se ve afuera (casi nada: los ojos hacen el trabajo) */
  marineroAlfaOscuro: 0.12,
  /** con el faro prendido la oscuridad del piso baja hasta acá */
  oscuridadFaro: 0.35,
} as const

/** F10: el mundo que reacciona. Las moras de un arbusto curan un poquito, una vez por arbusto */
/**
 * F12, el Rey de Piedra (la Ciudad Dormida). Fase 1: puño con aviso y pisotón. Fase 2: canta la canción de cuna y las
 * cuatro lámparas del salón se apagan: en lo oscuro su piedra no siente los golpes. Cuando las cuatro vuelven a estar
 * prendidas cae de rodillas con las grietas brillando (ahí se le pega). Cada golpe al piso suelta chispas de la corona
 * (las pone el juego). Fase 3: barrido con el brazo y llamada de sonámbulos.
 */
export const JEFE_REY = {
  vida: 820,
  velocidad: 34,
  fase3Pct: 30,
  // radio 48: el aviso_puno del kit (96 x 48) a escala 1
  puno: { dano: [13, 17] as [number, number], radio: 48, delante: 52, alcance: 120, avisoS: 1.4 },
  pisoton: { dano: [12, 16] as [number, number], radio: 96, avisoS: 1.5 },
  barrido: { dano: [12, 16] as [number, number], largo: 170, ancho: 48, avisoS: 1.5 },
  cancion: { avisoS: 1.6, cadaS: 28 },
  llamada: { sonambulos: 2, max: 3, avisoS: 1, cadaS: 16 },
  /** de rodillas al prenderse la cuarta lámpara, y otra vez cada tanto mientras sigan prendidas */
  rodillasS: 4.5,
  rodillasCadaS: 10,
  /** chispas que suelta la corona en cada golpe al piso (fase 2 en adelante) */
  chispasPorGolpe: 1,
}

/**
 * F12, el Mundo 5: La Ciudad Dormida. La luz te la roban: cada barrio tiene un farol de plaza que lo aclara, la Ladrona
 * les chupa la luz y, si lo logra, la luz se rompe en chispas que Thor rastrea. Los sonámbulos solo se mueven a oscuras.
 */
export const CIUDAD = {
  /** con el farol de plaza prendido el barrio baja a esta oscuridad */
  oscuridadPrendido: 0.45,
  ladrona: {
    /** cada cuánto aparece a robar un barrio prendido (en modo peque la mitad de seguido) */
    cadaS: [70, 110] as [number, number],
    pequeMult: 2,
    /** lo que tarda en chupar la luz: si la heroína llega antes, se va en humo y la luz vuelve */
    roboS: 7,
    roboPequeS: 10,
    /** a esta distancia de la Ladrona la heroína la espanta */
    espantaA: 90,
    /** la primera vez espera esto desde que se prende el primer farol */
    primeraS: 45,
  },
  chispas: {
    cuantas: 3,
    /** a esta distancia se junta una chispa (la heroína o Thor) */
    juntarA: 24,
    /** en modo peque caen a esta distancia de Thor como mucho, si hay puntos */
    pequeCercaThor: 260,
  },
  /** el duende del sueño: la arena hace bostezar a la heroína (camina más lento) */
  bostezo: { seg: 2, velocidad: 0.55 },
  /** el Relojero: la aguja barre girando alrededor de él */
  barrido: { largo: 150, ancho: 34, gradosPorS: 120, vueltaGrados: 360, avisoS: 1.6, dano: [12, 16] as [number, number] },
}

/**
 * F12, el Mundo 6: La Fragua de las Luces. La luz quema: cerca del fuego se ve pero la heroína junta calor. Las grietas
 * respiran al ritmo de los fuelles, las jaulas liberadas dan luz fría (alumbra sin calentar) y Thor se moja en el agua
 * fría y se sacude para enfriar.
 */
export const FRAGUA = {
  calor: {
    max: 100,
    /** lo que calienta cada cosa, por segundo (el juego suma lo que tenga cerca) */
    lava: 12,
    /** a esta distancia de la orilla de la lava calienta */
    lavaA: 72,
    grieta: 28,
    fuegoPiso: 40,
    brasero: 6,
    braseroA: 64,
    rastro: 18,
    /** lo que enfría por segundo sin nada que caliente, dentro de la luz fría y en la fuente */
    enfriaBase: 7,
    enfriaLuzFria: 32,
    enfriaFuente: 120,
    /** con el calor lleno queda acalorada hasta que baje de esto */
    sueltaEn: 65,
    /** acalorada: camina más lento y pierde un poquito de vida cada tanto */
    velocidad: 0.7,
    dano: 3,
    danoCadaS: 2,
    /** en modo peque calienta la mitad y nunca quita vida */
    pequeMult: 0.5,
    pequeVelocidad: 0.8,
  },
  /** los fuelles soplan todos juntos y las grietas siguen el soplido: aviso, al rojo y después apagadas */
  fuelle: { periodoS: 7, periodoFase3S: 5, avisoS: 1.5, calienteS: 2.2, sonidoAntesS: 1 },
  jaula: {
    /** el radio de la luz que queda flotando al liberarla: luz fría */
    radioLuzLibre: 260,
    /** desde aquí se le pega al candado */
    golpeRadio: 30,
  },
  /** Thor se moja en el agua fría y guarda sacudidas */
  sacudida: { cargas: 3, recargaS: 1.5, radio: 140, apagaGrietasS: 6, mojarA: 40, piedraS: 4 },
  hollin: {
    /** cuántos se le pueden pegar a la vez (en modo peque de a uno) */
    max: 3,
    maxPeque: 1,
    /** cada hollín pegado achica el halo esto, hasta el mínimo */
    halo: 0.18,
    haloMin: 0.45,
    /** pegado: la heroína camina un poquito más lento */
    velocidad: 0.92,
  },
  salamandra: { rastroCadaS: 0.35, rastroS: 3, rastroRadio: 16, piedraMult: 2 },
  surtidor: { recargaS: 8, alcance: 96, palancaA: 44 },
  /** al vencer a la Dragona la fragua se enfría y la oscuridad baja a esto */
  oscuridadApagada: 0.5,
}

/**
 * F12: la Dragona de Brasa (Mundo 6). Fase 1: zarpazo y coletazo. Fase 2: se cubre de fuego (los golpes no le hacen nada)
 * y echa el aliento que deja el piso ardiendo. El chorro de un surtidor (o Thor sacudiéndose cerca) la apaga: echada y
 * humeando, ahí se le pega. Fase 3: llama hollines y salamandras.
 */
export const JEFE_DRAGONA = {
  vida: 900,
  velocidad: 36,
  fase3Pct: 30,
  zarpazo: { dano: [13, 17] as [number, number], radio: 50, delante: 56, alcance: 124, avisoS: 1.3 },
  /** el coletazo barre medio círculo del lado de la heroína */
  // radio 96: el aviso_cola del kit (192 x 96) a escala 1
  coletazo: { dano: [11, 15] as [number, number], radio: 96, alcance: 110, avisoS: 1.5 },
  aliento: { dano: [10, 14] as [number, number], largo: 240, ancho: 56, avisoS: 1.8, fuegoS: 5 },
  llamada: { hollines: 2, salamandras: 1, max: 4, avisoS: 1, cadaS: 16 },
  /** apagada por el chorro: echada y humeando. Con la sacudida de Thor dura menos */
  apagadaS: 5,
  apagadaThorS: 2.5,
  /** después de prenderse otra vez, hasta que otro chorro la pueda apagar */
  apagarCadaS: 3,
}

/**
 * F13, el Mundo 7: El Corazón Helado. Oscuridad casi total y frío: a oscuras y en la ventisca la heroína se congela,
 * cerca del fuego o de sus luces compañeras se calienta. La ventisca empuja y achica la luz (detrás de una columna de
 * hielo no llega). El hielo fino se rompe si se queda parada. Las sombras devoradoras se comen las luces compañeras.
 */
export const CORAZON = {
  frio: {
    max: 100,
    /** lo que enfría por segundo a oscuras, más en la ventisca y en el agua helada */
    oscuro: 6,
    ventisca: 16,
    aguaHelada: 60,
    /** lo que calienta por segundo cerca del fuego (hogueras, braseros) y en la luz de sus compañeras */
    fuego: 40,
    companeras: 10,
    /** congelada: camina más lento y pierde vida cada tanto, hasta bajar de esto */
    sueltaEn: 60,
    velocidad: 0.65,
    dano: 4,
    danoCadaS: 2,
    /** en modo peque enfría un poco menos y quita la mitad */
    pequeMult: 0.7,
    pequeDano: 2,
    /** al lado de una hoguera o un brasero prendido es fuego */
    fuegoA: 110,
  },
  ventisca: {
    /** cada cuánto viene (segundos entre una y otra), el aviso (el aullido) y cuánto dura */
    cadaS: [24, 38] as [number, number],
    avisoS: 2.5,
    duraS: 7,
    /** empuja a esto por segundo en su dirección y achica el halo a esto */
    empuje: 26,
    halo: 0.5,
    /** detrás de una columna o un gigante, hasta esta distancia, no llega */
    refugioLargo: 110,
    refugioAncho: 46,
  },
  hielo: {
    /** parada sobre el hielo fino: cruje desde aquí y se rompe aquí (en modo peque más tarde) */
    crujeS: 1.2,
    rompeS: 2.6,
    pequeMult: 1.6,
    /** roto queda así hasta que se vuelve a congelar */
    rehaceS: 12,
  },
  companeras: {
    max: 5,
    radio: 120,
    /** una devorada vuelve sola a los esto (o en la próxima hoguera) */
    vuelveS: 25,
  },
  oscuridad: 0.95,
}

/**
 * F13: El Diablo (Mundo 7). Cinco fases: el hielo y el fuego (zarpazo, nova, carga), el rayo (rayo que gira, pilares,
 * diablillos), la oscuridad (blindado hasta prender los cuatro braseros de hueso, que su aliento congela), la jaula de
 * huesos y la desesperada (todo junto y más rápido).
 */
export const JEFE_DIABLO = {
  vida: 1400,
  velocidad: 40,
  /** dónde empieza cada fase (porcentaje de vida) */
  fases: [75, 50, 30, 10] as [number, number, number, number],
  zarpazo: { dano: [16, 22] as [number, number], radio: 60, delante: 66, alcance: 140, avisoS: 1.2 },
  /** la nova sale en anillo desde él: pega a quien esté en el anillo cuando pasa (el hueco de adentro no) */
  nova: { dano: [14, 19] as [number, number], radio: 230, ancho: 46, avisoS: 1.6 },
  carga: { dano: [18, 24] as [number, number], ancho: 70, velocidad: 320, avisoS: 1.3 },
  /** el rayo rojo gira alrededor de él: una vuelta (como la aguja del Relojero, más largo) */
  rayo: { dano: [15, 20] as [number, number], largo: 250, ancho: 36, gradosPorS: 110, vuelta: 300, avisoS: 1.7 },
  /** los pilares salen donde está la heroína y alrededor */
  pilares: { dano: [14, 19] as [number, number], radio: 34, cuantos: 5, separacion: 70, avisoS: 1.4 },
  llamada: { demonios: 4, max: 7, avisoS: 1, cadaS: 14 },
  /** la oscuridad: con los cuatro braseros prendidos cae de rodillas (aturdido) y su aliento vuelve a congelar uno */
  oscuridad: { rodillasS: 5, rodillasCadaS: 11, congelaCadaS: 9 },
  /** la jaula de huesos: tantos golpes la rompen (Thor ayuda desde afuera) */
  jaula: { golpes: 8, avisoS: 1.2, cadaS: 18, pilaresDentro: 1 },
  /** la desesperada: todo más rápido */
  desesperado: { velocidad: 1.35, pausa: 0.6 },
}

/**
 * F13: la heroína celestial (al terminar el juego, para siempre en ese perfil). Más vida, daño y luz, y dos poderes:
 * las alas (un vuelo corto por encima de todo, sin recibir daño) y la lanza de luz (atraviesa a todos en línea).
 */
export const CELESTIAL = {
  vidaPct: 25,
  danoPct: 25,
  halo: 1.3,
  alas: { distancia: 170, duracionS: 0.45, recargaS: 4, mana: 8 },
  lanza: { largo: 260, ancho: 30, danoPct: 230, recargaS: 3, mana: 14 },
}

export const REACCIONES = { morasCuran: 8 } as const
