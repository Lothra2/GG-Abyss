import type { AnimHoja } from '../kit/tipos'

/** Advances locomotion from distance actually traveled. A turn preserves phase. */
export class Cadencia {
  private traveled = 0
  private started = false
  reset(): void { this.traveled = 0; this.started = false }

  avanzar(distance: number, anim: AnimHoja | undefined): { frame: number; contacts: number } | null {
    const cycle = anim?.locomocion?.unidades_ciclo
    if (!cycle || !Number.isFinite(cycle) || cycle <= 0 || !anim || !Number.isFinite(distance) || distance <= 0) return null
    const phases = (anim.eventos ?? []).filter((e) => e.tipo === 'foot_contact' && e.fase >= 0 && e.fase < 1).map((e) => e.fase).sort((a, b) => a - b)
    const previous = this.traveled
    this.traveled += distance
    let contacts = 0
    if (!this.started && phases.includes(0)) contacts++
    this.started = true
    for (const phase of phases) {
      const first = Math.floor((previous / cycle) - phase) + 1
      const last = Math.floor((this.traveled / cycle) - phase)
      contacts += Math.max(0, last - first + 1)
    }
    const fraction = (this.traveled % cycle) / cycle
    return { frame: Math.min(anim.cuadros - 1, Math.floor(fraction * anim.cuadros)), contacts }
  }
}
