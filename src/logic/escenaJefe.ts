import { ESCENA_JEFE } from '../config/balance'

export type MomentoJefe = 'intro' | 'fase2' | 'muerte'
export type Titulo = 'nombre' | 'enojo' | 'victoria'

export interface Plano {
  momento: MomentoJefe | null
  /** adónde mira la cámara: al jefe, a los dos (pelea) o a la heroína */
  foco: 'jefe' | 'mezcla' | 'heroe'
  /** franjas de cine, 0 (no se ven) a 1 */
  franjas: number
  titulo: Titulo | null
  /** transparencia del título, 0 a 1 */
  tituloAlfa: number
  /** la heroína no se mueve (solo en la entrada) */
  bloquear: boolean
}

const TITULO: Record<MomentoJefe, Titulo> = { intro: 'nombre', fase2: 'enojo', muerte: 'victoria' }

/** De 0 a 1 entrando en [a, b] con un fundido de `f` segundos en cada punta */
function ventana(t: number, [a, b]: readonly [number, number], f: number): number {
  if (t < a || t > b) return 0
  return Math.max(0, Math.min(1, (t - a) / f, (b - t) / f))
}

/**
 * El director de la pelea con el jefe, sin Phaser: dice en cada instante qué mira la cámara, si hay franjas de cine,
 * qué título se ve y si la heroína espera. Corre en tiempo real (la cámara lenta no lo frena).
 */
export class DirectorJefe {
  private momento: MomentoJefe | null = null
  private t = 0
  private peleando = false

  constructor(private cfg: typeof ESCENA_JEFE = ESCENA_JEFE) {}

  empezar(): void {
    this.peleando = true
    this.poner('intro')
  }
  fase2(): void {
    if (this.momento !== 'muerte') this.poner('fase2')
  }
  morir(): void {
    this.peleando = false
    this.poner('muerte')
  }
  /** La pelea se cortó (rescate): todo vuelve a la normalidad */
  cortar(): void {
    this.peleando = false
    this.momento = null
  }

  private poner(m: MomentoJefe): void {
    this.momento = m
    this.t = 0
  }

  get enCurso(): MomentoJefe | null {
    return this.momento
  }

  tick(dt: number): Plano {
    const libre: Plano = { momento: null, foco: this.peleando ? 'mezcla' : 'heroe', franjas: 0, titulo: null, tituloAlfa: 0, bloquear: false }
    const m = this.momento
    if (!m) return libre
    this.t += dt
    const c = this.cfg[m]
    if (this.t >= c.duracion) {
      this.momento = null
      return libre
    }
    const f = this.cfg.franjasS
    const largoFranjas = 'franjas' in c ? c.franjas : 0
    const franjas = largoFranjas > 0 ? Math.max(0, Math.min(1, this.t / f, (largoFranjas - this.t) / f)) : 0
    const foco = this.t >= c.foco[0] && this.t <= c.foco[1] ? 'jefe' : this.peleando ? 'mezcla' : 'heroe'
    return { momento: m, foco, franjas, titulo: TITULO[m], tituloAlfa: ventana(this.t, c.titulo, this.cfg.fundidoS), bloquear: m === 'intro' }
  }
}
