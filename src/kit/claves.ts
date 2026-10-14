/** Nombres de las texturas, animaciones y sonidos de Phaser, calculados siempre igual desde el manifest. */
export const K = {
  ui: (n: string) => `ui_${n}`,
  pers: (id: string, anim: string) => `p_${id}_${anim}`,
  /** una capa de equipo de una heroína */
  capa: (id: string, tipo: string, clave: string) => `capa_${id}_${tipo}_${clave}`,
  /** F13: un bloque de una capa que viene en su propia hoja (el vuelo de la celestial) */
  capaBloque: (id: string, tipo: string, clave: string, anim: string) => `capa_${id}_${tipo}_${clave}__${anim}`,
  retrato: (id: string) => `retrato_${id}`,
  retratoCelestial: (id: string) => `retrato_celestial_${id}`,
  fx: (n: string) => `fx_${n}`,
  obj: (n: string, anim: string) => `o_${n}_${anim}`,
  /** la sombra horneada de un objeto */
  objSombra: (n: string) => `o_${n}__sombra`,
  /** el atlas de la espuma de orilla de un mundo */
  espumaDe: (mundo: string) => `espuma_${mundo}`,
  cri: (n: string, anim: string) => `c_${n}_${anim}`,
  par: (n: string) => `par_${n}`,
  aud: (n: string) => `a_${n}`,
  atlas: (n: string, tam: '32' | '64') => `atlas_${n}_${tam}`,
  anim: (id: string, anim: string, dir: string) => `${id}_${anim}_${dir}`,
  animFx: (n: string) => `afx_${n}`,
  /** F11: capas de los paneles del intro y sus hojas sueltas */
  intro: (n: string) => `intro_${n}`,
  /** F13: las capas de las cinemáticas del final */
  cine: (cine: string, n: string) => `${cine}__${n}`,
  suelo: (i: number) => `suelo_${i}`,
  agua: 'agua',
  luz: 'luz',
  nube: 'nube',
  nieblaNubes: 'niebla_nubes',
  nieblaJirones: 'niebla_jirones',
  mapa: 'mapa_tiled',
  manifest: 'manifest',
  catalogo: 'catalogo',
  postal: (n: string) => `postal_${n}`,
  /** F8: el mapa, el agua y el suelo de cada mundo (el Bosque con los nombres de siempre) */
  mapaDe: (mundo: string) => (mundo === 'mundo1' ? 'mapa_tiled' : `mapa_tiled_${mundo}`),
  aguaDe: (mundo: string) => (mundo === 'mundo1' ? 'agua' : `agua_${mundo}`),
  /** F12: la lava enfriada de la Fragua (la misma tira del agua, después de la Dragona) */
  aguaApagadaDe: (mundo: string) => `agua_apagada_${mundo}`,
  sueloDe: (mundo: string, i: number) => (mundo === 'mundo1' ? `suelo_${i}` : `suelo_${mundo}_${i}`),
} as const
