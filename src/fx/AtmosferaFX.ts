import Phaser from 'phaser'

/**
 * Tinte de zona en modo "soft light" y viñeta, en un solo shader (PLAN.md 3.2).
 * Es la copia en WebGL de los pasos 10 del visor: soft-light al 35 % con el color de la zona,
 * y un degradado radial de transparente a rgba(2,4,10,0.75) en las esquinas.
 */
const FRAG = `
#define SHADER_NAME ATMOSFERA_FS
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec3 uTinte;
uniform float uTinteK;
uniform float uVineta;
uniform vec2 uRes;
// F14, el look premium: negros con color, luces con tinte, contraste, saturación, brillo de lo que brilla y tramado
uniform float uPremium;
uniform vec3 uSombras;
uniform vec3 uLuces;
uniform float uKSombras;
uniform float uKLuces;
uniform float uContraste;
uniform float uSaturacion;
uniform float uBrillo;
uniform float uUmbral;
uniform float uRadio;
uniform float uTramado;
varying vec2 outTexCoord;

vec3 d(vec3 x) {
  return mix(sqrt(x), ((16.0 * x - 12.0) * x + 4.0) * x, step(x, vec3(0.25)));
}

vec3 softLight(vec3 cb, vec3 cs) {
  vec3 lo = cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  vec3 hi = cb + (2.0 * cs - 1.0) * (d(cb) - cb);
  return mix(hi, lo, step(cs, vec3(0.5)));
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// lo que pasa del umbral, con su color (para el brillo)
vec3 sobra(vec2 uv) {
  vec3 c = texture2D(uMainSampler, uv).rgb;
  return c * max(0.0, lum(c) - uUmbral) / max(0.001, 1.0 - uUmbral);
}

// tramado ordenado 4x4 (Bayer), como en las consolas de antes: rompe las bandas de los degradados
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  float m = 0.0;
  if (i < 1.0) m = 0.0; else if (i < 2.0) m = 8.0; else if (i < 3.0) m = 2.0; else if (i < 4.0) m = 10.0;
  else if (i < 5.0) m = 12.0; else if (i < 6.0) m = 4.0; else if (i < 7.0) m = 14.0; else if (i < 8.0) m = 6.0;
  else if (i < 9.0) m = 3.0; else if (i < 10.0) m = 11.0; else if (i < 11.0) m = 1.0; else if (i < 12.0) m = 9.0;
  else if (i < 13.0) m = 15.0; else if (i < 14.0) m = 7.0; else if (i < 15.0) m = 13.0; else m = 5.0;
  return m / 16.0 - 0.5;
}

void main() {
  vec4 c = texture2D(uMainSampler, outTexCoord);
  vec3 col = mix(c.rgb, softLight(c.rgb, uTinte), uTinteK);
  if (uPremium > 0.5) {
    // brillo: 8 muestras alrededor (cruz y diagonales) de lo que pasa del umbral
    vec2 px = uRadio / uRes;
    vec3 b = sobra(outTexCoord + vec2(px.x, 0.0)) + sobra(outTexCoord - vec2(px.x, 0.0))
           + sobra(outTexCoord + vec2(0.0, px.y)) + sobra(outTexCoord - vec2(0.0, px.y));
    vec3 b2 = sobra(outTexCoord + px * 2.0) + sobra(outTexCoord - px * 2.0)
            + sobra(outTexCoord + vec2(px.x, -px.y) * 2.0) + sobra(outTexCoord + vec2(-px.x, px.y) * 2.0);
    // el brillo se derrama hacia lo oscuro de alrededor y no quema lo que ya es claro (la heroína se sigue leyendo)
    float propio = lum(c.rgb);
    col += (b * 0.18 + b2 * 0.1) * uBrillo * (1.0 - propio) * (1.0 - propio);
    // negros con color y luces con tinte
    float l = lum(col);
    col += uSombras * uKSombras * (1.0 - l) * (1.0 - l);
    col = mix(col, col * (uLuces * 1.15), uKLuces * l * l);
    // contraste alrededor del gris medio y saturación
    col = (col - 0.5) * uContraste + 0.5;
    col = mix(vec3(lum(col)), col, uSaturacion);
  }
  vec2 p = outTexCoord * uRes;
  float r0 = min(uRes.x, uRes.y) * 0.35;
  float r1 = max(uRes.x, uRes.y) * 0.75;
  float t = clamp((distance(p, uRes * 0.5) - r0) / (r1 - r0), 0.0, 1.0);
  col = mix(col, vec3(2.0, 4.0, 10.0) / 255.0, uVineta * t);
  if (uPremium > 0.5) col += bayer(gl_FragCoord.xy) * uTramado / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}
`

export const NOMBRE_FX = 'AtmosferaFX'

export class AtmosferaFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** color de la zona en 0 a 1 */
  tinte: [number, number, number] = [1, 0.89, 0.69]
  tinteK = 0.35
  vineta = 0.75
  /** F14: el look premium (si está en 0 el shader hace solo lo de siempre) */
  premium = 0
  sombras: [number, number, number] = [0, 0, 0]
  luces: [number, number, number] = [1, 1, 1]
  kSombras = 0.5
  kLuces = 0.3
  contraste = 1
  saturacion = 1
  brillo = 0
  umbral = 0.62
  radio = 2
  tramado = 1.5

  constructor(game: Phaser.Game) {
    super({ game, name: NOMBRE_FX, fragShader: FRAG })
  }

  override onPreRender(): void {
    this.set3f('uTinte', this.tinte[0], this.tinte[1], this.tinte[2])
    this.set1f('uTinteK', this.tinteK)
    this.set1f('uVineta', this.vineta)
    this.set2f('uRes', this.renderer.width, this.renderer.height)
    this.set1f('uPremium', this.premium)
    this.set3f('uSombras', this.sombras[0], this.sombras[1], this.sombras[2])
    this.set3f('uLuces', this.luces[0], this.luces[1], this.luces[2])
    this.set1f('uKSombras', this.kSombras)
    this.set1f('uKLuces', this.kLuces)
    this.set1f('uContraste', this.contraste)
    this.set1f('uSaturacion', this.saturacion)
    this.set1f('uBrillo', this.brillo)
    this.set1f('uUmbral', this.umbral)
    this.set1f('uRadio', this.radio)
    this.set1f('uTramado', this.tramado)
  }
}

/** Registra el pipeline una sola vez si hay WebGL. Devuelve si se puede usar. */
export function registrarAtmosferaFX(game: Phaser.Game): boolean {
  const r = game.renderer
  if (r.type !== Phaser.WEBGL) return false
  const pipes = (r as Phaser.Renderer.WebGL.WebGLRenderer).pipelines
  if (!pipes.postPipelineClasses.has(NOMBRE_FX)) pipes.addPostPipeline(NOMBRE_FX, AtmosferaFX)
  return true
}
