import { HABILIDADES, type ClaseId, type HabilidadBalance } from '../config/balance'

export function habilidadesDe(clase: ClaseId): [HabilidadBalance, HabilidadBalance] {
  return HABILIDADES[clase]
}

export type MotivoNoUsar = 'recargando' | 'sinMana' | 'ocupada' | null

/**
 * Recargas y maná de las dos habilidades de una clase. Sin Phaser: el reloj lo da quien llama con `tick(dt)`.
 * El Rayo canalizado cuesta 0 por uso y gasta maná por segundo mientras se mantiene (`canalizar`).
 */
export class Recargas {
  private resta: [number, number] = [0, 0]

  constructor(readonly clase: ClaseId) {}

  get habilidades(): [HabilidadBalance, HabilidadBalance] {
    return habilidadesDe(this.clase)
  }

  tick(dt: number): void {
    this.resta[0] = Math.max(0, this.resta[0] - dt)
    this.resta[1] = Math.max(0, this.resta[1] - dt)
  }

  restante(i: 0 | 1): number {
    return this.resta[i]
  }

  /** 0 (lista) a 1 (recién usada), para el arco oscuro del botón */
  fraccion(i: 0 | 1): number {
    const h = this.habilidades[i]
    return h.recarga <= 0 ? 0 : Math.min(1, this.resta[i] / h.recarga)
  }

  puede(i: 0 | 1, mana: number): MotivoNoUsar {
    const h = this.habilidades[i]
    if (this.resta[i] > 0) return 'recargando'
    if (mana + 1e-9 < h.mana) return 'sinMana'
    return null
  }

  /** Gasta el maná y arranca la recarga. Devuelve el maná que queda, o null si no se pudo. */
  usar(i: 0 | 1, mana: number): number | null {
    if (this.puede(i, mana) !== null) return null
    const h = this.habilidades[i]
    this.resta[i] = h.recarga
    return mana - h.mana
  }

  reiniciar(): void {
    this.resta = [0, 0]
  }
}

/** Vector unitario de una dirección en grados, para el abanico de flechas */
export function abanico(anguloCentro: number, n: number, abiertoGrados: number): number[] {
  if (n <= 1) return [anguloCentro]
  const paso = (abiertoGrados * Math.PI) / 180 / (n - 1)
  const ini = anguloCentro - (paso * (n - 1)) / 2
  return Array.from({ length: n }, (_, i) => ini + paso * i)
}
