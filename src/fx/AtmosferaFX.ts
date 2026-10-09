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
varying vec2 outTexCoord;

vec3 d(vec3 x) {
  return mix(sqrt(x), ((16.0 * x - 12.0) * x + 4.0) * x, step(x, vec3(0.25)));
}

vec3 softLight(vec3 cb, vec3 cs) {
  vec3 lo = cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  vec3 hi = cb + (2.0 * cs - 1.0) * (d(cb) - cb);
  return mix(hi, lo, step(cs, vec3(0.5)));
}

void main() {
  vec4 c = texture2D(uMainSampler, outTexCoord);
  vec3 col = mix(c.rgb, softLight(c.rgb, uTinte), uTinteK);
  vec2 p = outTexCoord * uRes;
  float r0 = min(uRes.x, uRes.y) * 0.35;
  float r1 = max(uRes.x, uRes.y) * 0.75;
  float t = clamp((distance(p, uRes * 0.5) - r0) / (r1 - r0), 0.0, 1.0);
  col = mix(col, vec3(2.0, 4.0, 10.0) / 255.0, uVineta * t);
  gl_FragColor = vec4(col, c.a);
}
`

export const NOMBRE_FX = 'AtmosferaFX'

export class AtmosferaFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** color de la zona en 0 a 1 */
  tinte: [number, number, number] = [1, 0.89, 0.69]
  tinteK = 0.35
  vineta = 0.75

  constructor(game: Phaser.Game) {
    super({ game, name: NOMBRE_FX, fragShader: FRAG })
  }

  override onPreRender(): void {
    this.set3f('uTinte', this.tinte[0], this.tinte[1], this.tinte[2])
    this.set1f('uTinteK', this.tinteK)
    this.set1f('uVineta', this.vineta)
    this.set2f('uRes', this.renderer.width, this.renderer.height)
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
