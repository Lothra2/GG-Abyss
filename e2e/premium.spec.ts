import { expect, test } from '@playwright/test'
import { abrirMundo, gancho, manifest, sinErrores, vigilarErrores } from './util'
import { mkdirSync } from 'node:fs'

type HeroAnim = { estado: string; anim: string; frame: string | number; x: number; y: number; perfil: string }

test('Rick usa el kit premium y conserva fase al girar mientras camina', async ({ page }) => {
  const errors = vigilarErrores(page)
  await abrirMundo(page, 'rick')
  await gancho(page, 'ajustes', { noche: 0 })
  const kit = await manifest(page)
  const rick = kit.personajes.rick!
  expect(rick.perfil_movimiento).toBe('premium-v1')
  expect(rick.anims.walk!.eventos?.filter((e) => e.tipo === 'foot_contact').map((e) => e.pie)).toEqual(['near', 'far'])
  expect(rick.anims.attack!.eventos?.find((e) => e.tipo === 'impact')?.fase).toBe(0.5)
  const start = await gancho<HeroAnim>(page, 'animHeroina')
  expect(start.perfil).toBe('premium-v1')
  await gancho(page, 'tecla', 1, 0)
  await gancho(page, 'avanzar', 0.2)
  const right = await gancho<HeroAnim>(page, 'animHeroina')
  expect(right.x).toBeGreaterThan(start.x + 10)
  expect(right.estado).toBe('walk')
  expect(right.anim).toContain('right')
  await gancho(page, 'tecla', 0, -1)
  await gancho(page, 'avanzar', 0.1)
  const up = await gancho<HeroAnim>(page, 'animHeroina')
  expect(up.y).toBeLessThan(right.y - 5)
  expect(up.estado).toBe('walk')
  expect(up.anim).toContain('up')
  mkdirSync('docs/premium-integration', { recursive: true })
  await page.screenshot({ path: 'docs/premium-integration/rick-game.png' })
  await gancho(page, 'tecla', 0, 0)
  await gancho(page, 'avanzar', 0.1)
  expect((await gancho<HeroAnim>(page, 'animHeroina')).estado).toBe('idle')
  await sinErrores(errors)
})
