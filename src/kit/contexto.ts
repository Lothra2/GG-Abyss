import type Phaser from 'phaser'
import type { Manifest } from './tipos'

/** El manifest validado que dejó Boot en el registro */
export function manifestDe(e: Phaser.Scene | Phaser.Game): Manifest {
  const reg = 'registry' in e ? e.registry : (e as Phaser.Scene).registry
  const m = reg.get('manifest') as Manifest | undefined
  if (!m) throw new Error('El manifest no está cargado: la escena Boot tiene que correr primero')
  return m
}
