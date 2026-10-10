import Phaser from 'phaser'
import { K } from '../kit/claves'
import type { Zona } from '../kit/mapa'
import { fx } from '../logic/azar'

export interface VolumenesSonido {
  musica: number
  efectos: number
}

interface Lazo {
  nombre: string
  s: Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound
  vol: number
  meta: number
  /** segundos que tarda en llegar */
  fundido: number
}

/** Ambiente: 0.55 como el visor. La música va más baja para no tapar los efectos. */
const VOL_AMBIENTE = 0.55
const VOL_MUSICA = 0.45

/**
 * Sonido del juego (PLAN.md 2.5): un ambiente en bucle por zona (fundido de 1.2 s), la música aparte
 * (fundido de 2 s) y los efectos sueltos. El audio arranca con el primer toque (Phaser lo desbloquea solo).
 */
export class Sonido {
  private lazos = new Map<string, Lazo>()
  private ambienteMeta: string | null = null
  private musicaFija: string | null = null
  private ultimaMusicaZona = 'musica_bosque'
  private musicaMeta: string | null = null
  /** F7: la música del momento (amenaza, combate, fogata); null = la de la zona */
  private musicaEstado: string | null = null
  /** F7: detalles que suenan según la distancia a su fuente (agua cerca del río...): nombre a volumen 0..1 */
  private detalles = new Map<string, number>()
  private ultimoPaso = 0
  private ultimaVariante = -1
  private ultimoNombrePaso = ''

  constructor(
    private escena: Phaser.Scene,
    private vol: () => VolumenesSonido,
  ) {}

  /** Qué suena en una zona. La música `jefe` la controla la pelea (F4), no entrar a la arena. */
  fijarZona(zona: Zona | null): void {
    this.ambienteMeta = `ambiente_${zona?.ambiente ?? 'bosque'}`
    const musica = zona?.musica && zona.musica !== 'jefe' ? zona.musica : 'bosque'
    // la música de la pelea (o de la victoria) no se pisa al cambiar de zona
    this.ultimaMusicaZona = `musica_${musica}`
    this.musicaMeta = this.musicaFija ?? this.musicaEstado ?? this.ultimaMusicaZona
  }

  /** F7: la música según lo que pasa (la del jefe y la victoria mandan igual por encima) */
  fijarEstado(nombre: string | null): void {
    if (nombre && !this.escena.cache.audio.exists(K.aud(nombre))) nombre = null
    this.musicaEstado = nombre
    this.musicaMeta = this.musicaFija ?? this.musicaEstado ?? this.ultimaMusicaZona
  }

  /** F7: un detalle de ambiente con su volumen (0 lo apaga de a poco) */
  fijarDetalle(nombre: string, v: number): void {
    if (v <= 0.001) this.detalles.delete(nombre)
    else this.detalles.set(nombre, Math.min(1, v))
  }

  /** La pelea con el jefe manda la música. Con null se suelta y vuelve la de la zona. */
  fijarMusica(nombre: string | null): void {
    this.musicaFija = nombre
    this.musicaMeta = nombre ?? this.musicaEstado ?? this.ultimaMusicaZona
  }

  private asegurar(nombre: string, fundido: number): Lazo | null {
    let l = this.lazos.get(nombre)
    if (l) return l
    const key = K.aud(nombre)
    if (!this.escena.cache.audio.exists(key)) return null
    const s = this.escena.sound.add(key, { loop: true, volume: 0 })
    l = { nombre, s, vol: 0, meta: 0, fundido }
    this.lazos.set(nombre, l)
    s.play()
    return l
  }

  update(dt: number): void {
    const { musica, efectos } = this.vol()
    const metas: [string | null, number, number][] = [
      [this.ambienteMeta, VOL_AMBIENTE * efectos, 1.2],
      [this.musicaMeta, VOL_MUSICA * musica, 1.5],
      ...[...this.detalles].map(([n, v]) => [n, VOL_AMBIENTE * efectos * v, 1.5] as [string, number, number]),
    ]
    for (const [nombre, v, fundido] of metas) {
      if (!nombre) continue
      const l = this.asegurar(nombre, fundido)
      if (l) {
        l.meta = v
        l.fundido = fundido
      }
    }
    for (const l of [...this.lazos.values()]) {
      const quiere = l.nombre === this.ambienteMeta || l.nombre === this.musicaMeta || this.detalles.has(l.nombre)
      const meta = quiere ? l.meta : 0
      const velocidad = 1 / Math.max(0.1, l.fundido)
      if (l.vol < meta) l.vol = Math.min(meta, l.vol + (Math.max(meta, 0.2) * velocidad) * dt)
      else if (l.vol > meta) l.vol = Math.max(meta, l.vol - (Math.max(l.vol, 0.2) * velocidad) * dt)
      l.s.setVolume(l.vol)
      if (!quiere && l.vol <= 0.001) {
        l.s.stop()
        l.s.destroy()
        this.lazos.delete(l.nombre)
      }
    }
  }

  /** Volumen actual de cada lazo, para las pruebas */
  estado(): Record<string, number> {
    const o: Record<string, number> = {}
    for (const l of this.lazos.values()) o[l.nombre] = Math.round(l.vol * 1000) / 1000
    return o
  }

  efecto(nombre: string, op: { volumen?: number; rate?: number; detune?: number } = {}): void {
    const key = K.aud(nombre)
    if (!this.escena.cache.audio.exists(key)) return
    const v = (op.volumen ?? 1) * this.vol().efectos
    if (v <= 0) return
    this.escena.sound.play(key, { volume: v, rate: op.rate ?? 1, detune: op.detune ?? 0 })
  }

  /**
   * Un paso sobre una superficie: el kit trae 3 variantes de cada una (`paso_<superficie>_<0..2>`) y se alternan sin repetir.
   * Volumen y tono con un poco de azar para que no suene a máquina.
   */
  paso(superficie: string = 'pasto', fuerte = false): void {
    const ahora = this.escena.time.now
    if (ahora - this.ultimoPaso < 90) return
    this.ultimoPaso = ahora
    let nombre = 'paso'
    const variantes = [0, 1, 2].filter((i) => this.escena.cache.audio.exists(K.aud(`paso_${superficie}_${i}`)))
    if (variantes.length > 0) {
      const opciones = variantes.length > 1 ? variantes.filter((i) => i !== this.ultimaVariante) : variantes
      const v = opciones[Math.floor(fx().next() * opciones.length)]!
      this.ultimaVariante = v
      nombre = `paso_${superficie}_${v}`
    }
    this.ultimoNombrePaso = nombre
    this.efecto(nombre, { volumen: (fuerte ? 0.55 : 0.4) * (0.8 + fx().next() * 0.4), detune: (fx().next() - 0.5) * 240 })
  }

  /** El último paso que sonó, para las pruebas */
  ultimoPasoSonado(): string {
    return this.ultimoNombrePaso
  }

  detener(): void {
    for (const l of this.lazos.values()) {
      l.s.stop()
      l.s.destroy()
    }
    this.lazos.clear()
  }
}
