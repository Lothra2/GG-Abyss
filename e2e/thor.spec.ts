import { expect, test } from '@playwright/test'
import { abrirMundo, gancho, manifest, sinErrores, vigilarErrores } from './util'

// Thor camina con sus patas con cualquier armadura que traiga el kit. Con la 4 y la 5 se quedaba congelado: el juego
// cargaba solo los dibujos de la 1 a la 3 y Thor se deslizaba en el primer cuadro, mirando de frente.

interface InfoThor { x: number; y: number; estado: string; personaje: string; anim: string | null; cuadro: number; tocando: boolean }

test('Thor camina y corre con sus patas sin armadura y con cada armadura del kit', async ({ page }) => {
  test.setTimeout(240_000)
  const errores = vigilarErrores(page)
  await abrirMundo(page, 'rick')
  await gancho(page, 'matarEnemigos')
  const m = await manifest(page)
  const niveles = Object.keys(m.personajes).filter((k) => /^thor_armadura\d+$/.test(k)).map((k) => Number(/\d+$/.exec(k)![0]))
  expect(niveles.length).toBeGreaterThanOrEqual(3)
  for (const n of [0, ...niveles]) {
    if (n > 0) {
      await gancho(page, 'darObjeto', `pet_armor_${n}`)
      const bolsa = (await gancho<{ bolsa: (string | null)[] }>(page, 'inventario')).bolsa
      await gancho(page, 'equipar', bolsa.indexOf(`pet_armor_${n}`))
    }
    await gancho(page, 'avanzar', 0.3)
    // camina de un lado al otro: Thor la sigue y se le ven las patas (el cuadro cambia)
    const p0 = await gancho<{ x: number; y: number }>(page, 'pos')
    await gancho(page, 'tocar', p0.x + (n % 2 ? -520 : 520), p0.y)
    const cuadros = new Set<number>()
    let info: InfoThor | null = null
    // en tiempo real: las animaciones avanzan con el reloj del juego, no con el paso de prueba. Con la máquina lenta
    // el juego corre más despacio (cada cuadro avanza a lo sumo 50 ms), así que se espera hasta ver las patas
    for (let i = 0; i < 80 && cuadros.size < 3; i++) {
      await page.waitForTimeout(220)
      info = await gancho<InfoThor>(page, 'thorInfo')
      if (info.anim && /_(walk|run)_/.test(info.anim)) cuadros.add(info.cuadro)
    }
    expect(info!.personaje).toBe(n > 0 ? `thor_armadura${n}` : 'thor')
    expect(info!.tocando).toBe(true)
    expect(cuadros.size, `armadura ${n}: Thor tiene que mover las patas`).toBeGreaterThanOrEqual(3)
  }
  await sinErrores(errores)
})
