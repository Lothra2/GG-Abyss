import { describe, expect, it } from 'vitest'
import { leerGrado, leerRayos, mezclarPremium, premiumDe, rayosEn, type Premium } from '../grado'
import { PREMIUM, premiumDeMundo } from '../../config/juego'

const base: Premium = {
  grado: { sombras: [10, 20, 30], luces: [250, 230, 200], contraste: 1, saturacion: 1 },
  rayos: { angulo: -20, color: [255, 240, 200], densidad: 0.5 },
  niebla: [200, 210, 220],
  brillo: 0.4,
}

describe('el look premium de las zonas', () => {
  it('lee la gradación y los rayos que pone el taller en la zona', () => {
    expect(leerGrado('#1a2a22,#ffd9a0,1.12,0.9')).toEqual({ sombras: [26, 42, 34], luces: [255, 217, 160], contraste: 1.12, saturacion: 0.9 })
    expect(leerRayos('-22,#ffe9a8,0.6')).toEqual({ angulo: -22, color: [255, 233, 168], densidad: 0.6 })
  })

  it('lo mal escrito no rompe nada: queda el del mundo', () => {
    for (const malo of [undefined, 3, '', 'rojo', '#12,#ffffff,1,1', '#112233,#ffffff,x,1']) expect(leerGrado(malo)).toBeNull()
    for (const malo of [undefined, '-20,#zzzzzz,0.5', '10,#ffffff']) expect(leerRayos(malo)).toBeNull()
    expect(premiumDe({ grado: 'no', rayos: 7 }, base)).toEqual(base)
  })

  it('los valores fuera de rango se recortan', () => {
    expect(leerGrado('#000000,#ffffff,9,0')).toMatchObject({ contraste: 1.6, saturacion: 0.4 })
    expect(leerRayos('-90,#ffffff,3')).toMatchObject({ angulo: -60, densidad: 1 })
  })

  it('la zona pisa al mundo solo en lo que trae', () => {
    const p = premiumDe({ rayos: '0,#ffffff,0' }, base)
    expect(p.rayos.densidad).toBe(0)
    expect(p.grado).toEqual(base.grado)
  })

  it('el cambio de zona es suave: a mitad de camino, mitad de cada cosa', () => {
    const b = premiumDe({ grado: '#000000,#ffffff,1.2,1.2', rayos: '20,#ffffff,1' }, base)
    const m = mezclarPremium(base, b, 0.5)
    expect(m.grado.contraste).toBeCloseTo(1.1)
    expect(m.rayos.angulo).toBeCloseTo(0)
    expect(mezclarPremium(base, b, 1)).toEqual(b)
    expect(mezclarPremium(base, b, 0)).toEqual(base)
  })

  it('los rayos están anclados al mundo: el mismo lugar, el mismo rayo', () => {
    const v = { x: 1000, y: 800, w: 400, h: 300 }
    expect(rayosEn(v, 160, 0.6)).toEqual(rayosEn(v, 160, 0.6))
    expect(rayosEn(v, 160, 0)).toEqual([])
    // con más densidad hay más rayos (o los mismos), nunca menos
    expect(rayosEn(v, 160, 1).length).toBeGreaterThanOrEqual(rayosEn(v, 160, 0.3).length)
    // y se mueven con la vista: lo de la derecha aparece al ir a la derecha
    const a = rayosEn(v, 160, 1).map((r) => `${r.x},${r.y}`)
    const b = rayosEn({ ...v, x: v.x + 160 }, 160, 1).map((r) => `${r.x},${r.y}`)
    expect(a.some((k) => b.includes(k))).toBe(true)
  })

  it('cada uno de los 7 mundos tiene su look, distinto del resto', () => {
    const ids = ['mundo1', 'mundo2', 'mundo3', 'mundo4', 'mundo5', 'mundo6', 'mundo7']
    for (const id of ids) expect(PREMIUM[id], id).toBeDefined()
    const firmas = new Set(ids.map((id) => JSON.stringify(premiumDeMundo(id).grado)))
    expect(firmas.size).toBe(ids.length)
    // un mundo desconocido usa el de defecto, sin romper
    expect(premiumDeMundo('mundo99')).toEqual(premiumDeMundo('defecto'))
  })
})
