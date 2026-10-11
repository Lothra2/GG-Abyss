import { describe, expect, it } from 'vitest'
import { audioIntro, escalaPanel, hojasIntro, introPintado, PANEL_DE_MOMENTO, panelesIntro } from '../intro'
import type { Manifest } from '../tipos'

const capa = (nombre: string) => ({ nombre, archivo: `intro/${nombre}.png`, cuadros: 1, fps: 1, paralaje: 1 })
const conIntro = (intro: Record<string, unknown>) => ({ intro }) as unknown as Manifest

describe('el intro pintado del taller', () => {
  const todos = Object.fromEntries(Object.values(PANEL_DE_MOMENTO).map((n) => [n, { w: 480, h: 270, capas: [capa('fondo')] }]))

  it('separa paneles, hojas, audio y notas del mismo objeto', () => {
    const m = conIntro({ ...todos, fuego_pared: { archivo: 'f.png', w: 128, h: 96, cuadros: 8, fps: 12 }, audio: { musica: 'musica_intro', latido: 'latido' }, notas: 'texto' })
    expect(Object.keys(panelesIntro(m))).toHaveLength(Object.keys(todos).length)
    expect(Object.keys(hojasIntro(m))).toEqual(['fuego_pared'])
    expect(audioIntro(m)).toEqual({ musica: 'musica_intro', latido: 'latido' })
  })

  it('solo es pintado si están los cinco paneles; un kit viejo sigue con lo prestado', () => {
    expect(introPintado(conIntro(todos))).toBe(true)
    const { intro_ojos: _, ...falta } = todos
    expect(introPintado(conIntro(falta))).toBe(false)
    expect(introPintado({} as Manifest)).toBe(false)
  })

  it('la escala del panel es entera y cubre la pantalla con aire para correrlo', () => {
    const k = escalaPanel(480, 270, 1280, 720, 18)
    expect(Number.isInteger(k)).toBe(true)
    expect(480 * k).toBeGreaterThanOrEqual(1280 + 36)
    expect(270 * k).toBeGreaterThanOrEqual(720)
    expect(escalaPanel(480, 270, 300, 200)).toBe(1)
  })
})
