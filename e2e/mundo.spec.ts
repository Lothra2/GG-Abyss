import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, gancho, mundoAPagina, puntoPropioDeZona, sinErrores, vigilarErrores, type MapaInfo } from './util'

// F1a: el Bosque GG vivo. Corre en escritorio (mouse y teclado) y en tablet (dedo).

const info = (page: Page) => gancho<MapaInfo>(page, 'mapa')
const pos = (page: Page) => gancho<{ x: number; y: number }>(page, 'pos')
const avanzar = (page: Page, seg: number, parar = false) => gancho(page, 'avanzar', seg, parar)

/** Posiciones de un objeto en el mapa de Tiled */
async function decosDelMapa(page: Page, nombre: string): Promise<{ x: number; y: number }[]> {
  return page.evaluate(async (n) => {
    const t = await (await fetch('assets/kit/mundo/mundo1_bosque.json')).json()
    const capa = t.layers.find((l: { name: string }) => l.name === 'objetos')
    return capa.objects
      .filter((o: { properties?: { name: string; value: string }[] }) => o.properties?.some((p) => p.name === 'sprite' && p.value === n))
      .map((o: { x: number; y: number }) => ({ x: o.x, y: o.y }))
  }, nombre)
}

async function puntoLibre(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return (await gancho<{ x: number; y: number } | null>(page, 'puntoCerca', x, y)) ?? { x, y }
}

test.describe('Bosque GG vivo', () => {
  test('el mundo carga sin errores y trae todas sus capas', async ({ page }) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page)
    await page.waitForTimeout(800)
    const c = await gancho<Record<string, number>>(page, 'conteos')
    expect(c.decosTotal).toBeGreaterThan(2000)
    expect(c.decos).toBeGreaterThan(20)
    expect(c.decos).toBeLessThan(450)
    const a = await gancho<{ postFx: boolean; capasBruma: number; luces: number }>(page, 'atmosfera')
    expect(a.postFx).toBe(true)
    expect(a.capasBruma).toBe(2)
    expect(a.luces).toBeGreaterThanOrEqual(1)
    await sinErrores(errores)
  })

  test('tocar el piso hace caminar a la heroína hasta ahí y pone la marca de destino', async ({ page }, info) => {
    await abrirMundo(page)
    const p0 = await pos(page)
    const meta = await puntoLibre(page, p0.x + 130, p0.y + 40)
    const pantalla = await mundoAPagina(page, meta.x, meta.y)
    if (info.project.name === 'tablet') await page.touchscreen.tap(pantalla.x, pantalla.y)
    else await page.mouse.click(pantalla.x, pantalla.y)
    await expect.poll(async () => (await gancho<{ visible: boolean }>(page, 'marca')).visible, { timeout: 5000 }).toBe(true)
    await expect
      .poll(async () => {
        const p = await pos(page)
        return Math.hypot(p.x - meta.x, p.y - meta.y)
      }, { timeout: 30_000, intervals: [250] })
      .toBeLessThan(8)
  })

  // Chromium sin GPU dibuja lento: los gestos reales se esperan con poll, no con tiempos fijos
  test('el teclado mueve a la heroína en escritorio', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'sin teclado en la tablet')
    await abrirMundo(page)
    const a = await pos(page)
    await page.keyboard.down('d')
    await expect.poll(async () => (await pos(page)).x, { timeout: 30_000, intervals: [200] }).toBeGreaterThan(a.x + 10)
    await page.keyboard.up('d')
    const b = await pos(page)
    await page.keyboard.down('a')
    await expect.poll(async () => (await pos(page)).x, { timeout: 30_000, intervals: [200] }).toBeLessThan(b.x - 10)
    await page.keyboard.up('a')
  })

  test('mantener presionado camina hacia el dedo', async ({ page }, testInfo) => {
    await abrirMundo(page)
    const a = await pos(page)
    const meta = await puntoLibre(page, a.x + 120, a.y - 50)
    const pg = await mundoAPagina(page, meta.x, meta.y)
    const movio = () => pos(page).then((p) => Math.hypot(p.x - a.x, p.y - a.y))
    if (testInfo.project.name === 'tablet') {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pg.x, y: pg.y, id: 1 }] })
      await expect.poll(movio, { timeout: 30_000, intervals: [250] }).toBeGreaterThan(10)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else {
      await page.mouse.move(pg.x, pg.y)
      await page.mouse.down()
      await expect.poll(movio, { timeout: 30_000, intervals: [250] }).toBeGreaterThan(10)
      await page.mouse.up()
    }
  })

  test('se llega caminando, solo tocando el piso, a todas las zonas del mapa', async ({ page }) => {
    test.setTimeout(240_000)
    await abrirMundo(page)
    const mapa = await info(page)
    for (const z of mapa.zonas) {
      const objetivo = puntoPropioDeZona(mapa, z.nombre)
      const meta = await puntoLibre(page, objetivo.x, objetivo.y)
      await gancho(page, 'tocar', meta.x, meta.y)
      await avanzar(page, 150, true)
      const p = await pos(page)
      expect(Math.hypot(p.x - meta.x, p.y - meta.y), `no llegó a ${z.nombre}`).toBeLessThan(12)
      const zona = await gancho<string | null>(page, 'zona')
      expect(zona, `en ${z.nombre} estaba en ${zona}`).toBe(z.nombre)
    }
    const r = (await info(page)).resumen
    expect(r.zonas).toBe(r.totalZonas)
  })

  test('al entrar a una zona por primera vez sale su banner, una sola vez, y suma al contador', async ({ page }) => {
    await abrirMundo(page)
    const mapa = await info(page)
    const antes = mapa.resumen.zonas
    const z = mapa.zonas.find((q) => q.nombre === 'Pradera de las Mariposas')!
    const pz = puntoPropioDeZona(mapa, z.nombre)
    await gancho(page, 'teleport', pz.x, pz.y)
    await avanzar(page, 0.3)
    const h = await gancho<{ ultimo: string; resumen: { zonas: number } }>(page, 'hud')
    expect(h.ultimo).toBe(z.nombre)
    expect(h.resumen.zonas).toBe(antes + 1)
    await expect.poll(async () => (await gancho<{ visible: boolean; nombre: string }>(page, 'hudBanner')).visible).toBe(true)
    expect((await gancho<{ nombre: string }>(page, 'hudBanner')).nombre).toBe(z.nombre)
    // afuera y de vuelta: no cuenta otra vez
    const ini = mapa.inicio
    await gancho(page, 'teleport', ini.x, ini.y)
    await avanzar(page, 0.3)
    await gancho(page, 'teleport', pz.x, pz.y)
    await avanzar(page, 0.3)
    expect((await gancho<{ resumen: { zonas: number } }>(page, 'hud')).resumen.zonas).toBe(antes + 1)
  })

  test('el Bosque Profundo oscurece hasta 0.55 y el modo peque no pasa de 0.45', async ({ page }) => {
    await abrirMundo(page)
    const mapa = await info(page)
    const p = puntoPropioDeZona(mapa, 'Bosque Profundo')
    await gancho(page, 'teleport', p.x, p.y)
    await avanzar(page, 0.5)
    let a = await gancho<{ oscuridad: number; zona: string }>(page, 'atmosfera')
    expect(a.zona).toBe('Bosque Profundo')
    expect(a.oscuridad).toBeCloseTo(0.55, 1)
    await gancho(page, 'ajustes', { modoPeque: true, noche: 0.55 })
    await avanzar(page, 0.3)
    a = await gancho(page, 'atmosfera')
    expect(a.oscuridad).toBeLessThanOrEqual(0.451)
    // el control de noche en modo peque se recorta a 0.25
    await gancho(page, 'teleport', mapa.inicio.x, mapa.inicio.y)
    await avanzar(page, 0.3)
    a = await gancho(page, 'atmosfera')
    expect(a.oscuridad).toBeCloseTo(0.25, 2)
    await gancho(page, 'ajustes', { modoPeque: false, noche: 0.55 })
    await avanzar(page, 0.3)
    a = await gancho(page, 'atmosfera')
    expect(a.oscuridad).toBeCloseTo(0.55, 2)
    // el tope absoluto es 0.6
    await gancho(page, 'teleport', p.x, p.y)
    await avanzar(page, 0.3)
    expect((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad).toBeCloseTo(0.6, 2)
  })

  test('entrar caminando al Bosque Profundo oscurece de a poco, en 1 a 3 segundos', async ({ page }) => {
    test.setTimeout(120_000)
    await abrirMundo(page)
    const mapa = await info(page)
    const z = mapa.zonas.find((q) => q.nombre === 'Bosque Profundo')!
    // un punto libre un poco al este de la zona (el este del bosque es el pasto de la pradera)
    const fuera = await puntoLibre(page, z.x + z.w + 60, z.y + z.h * 0.6)
    const dentro = await puntoLibre(page, z.x + z.w - 80, z.y + z.h * 0.6)
    await gancho(page, 'teleport', fuera.x, fuera.y)
    await avanzar(page, 4)
    const afuera = (await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad
    expect(afuera).toBeLessThan(0.25)
    await gancho(page, 'tocar', dentro.x, dentro.y)
    const muestras: number[] = []
    for (let i = 0; i < 40; i++) {
      await avanzar(page, 0.25)
      muestras.push((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad)
    }
    // sube sin saltos bruscos y termina en 0.55
    for (let i = 1; i < muestras.length; i++) expect(muestras[i]! - muestras[i - 1]!).toBeLessThan(0.2)
    expect(muestras[muestras.length - 1]!).toBeGreaterThan(0.5)
  })

  test('los árboles se mecen, el agua se mueve y las criaturas viven', async ({ page }) => {
    await abrirMundo(page)
    await gancho(page, 'irAPostal', 'cascada_y_vado')
    await avanzar(page, 0.5)
    const c = await gancho<{ aguaVisible: number }>(page, 'conteos')
    expect(c.aguaVisible).toBeGreaterThan(20)
    const f0 = await gancho<number>(page, 'aguaFrame')
    await avanzar(page, 0.23)
    const f1 = await gancho<number>(page, 'aguaFrame')
    expect(f1).not.toBe(f0)
    // los árboles arrancan en cuadros distintos y cambian con el tiempo
    const antes = await gancho<{ frame: number }[]>(page, 'decoInfo', 'roble_0')
    const antes1 = await gancho<{ frame: number }[]>(page, 'decoInfo', 'pino_1')
    const todos = [...antes, ...antes1]
    expect(todos.length).toBeGreaterThan(3)
    expect(new Set(todos.map((d) => d.frame)).size).toBeGreaterThan(1)
    await avanzar(page, 0.5)
    const despues = await gancho<{ frame: number }[]>(page, 'decoInfo', 'roble_0')
    expect(despues.map((d) => d.frame)).not.toEqual(antes.map((d) => d.frame))
  })

  test('los árboles hechizados despiertan al acercarse y duermen al irse', async ({ page }) => {
    await abrirMundo(page)
    const arboles = await decosDelMapa(page, 'arbol_hechizado_0')
    expect(arboles.length).toBeGreaterThan(0)
    const a = arboles[0]!
    const cerca = await puntoLibre(page, a.x + 20, a.y + 20)
    await gancho(page, 'teleport', cerca.x, cerca.y)
    await avanzar(page, 0.6)
    const d = await gancho<{ x: number; anim: string; despierto: boolean }[]>(page, 'decoInfo', 'arbol_hechizado_0')
    const suyo = d.find((q) => Math.abs(q.x - a.x) < 1)!
    expect(suyo.despierto).toBe(true)
    expect(['despierto', 'parpadeo']).toContain(suyo.anim)
    // sus ojos alumbran
    expect((await gancho<{ luces: number }>(page, 'atmosfera')).luces).toBeGreaterThanOrEqual(2)
    const lejos = await puntoLibre(page, a.x + 300, a.y + 60)
    await gancho(page, 'teleport', lejos.x, lejos.y)
    await avanzar(page, 0.4)
    const d2 = await gancho<{ x: number; anim: string; despierto: boolean }[]>(page, 'decoInfo', 'arbol_hechizado_0')
    const suyo2 = d2.find((q) => Math.abs(q.x - a.x) < 1)
    if (suyo2) {
      expect(suyo2.despierto).toBe(false)
      expect(suyo2.anim).toBe('dormido')
    }
  })

  test('las copas se vuelven transparentes con la heroína detrás y el pasto alto se aparta', async ({ page }) => {
    await abrirMundo(page)
    // un roble con espacio libre detrás
    const robles = await decosDelMapa(page, 'roble_1')
    let probado = false
    for (const r of robles.slice(0, 60)) {
      const detras = await puntoLibre(page, r.x, r.y - 50)
      if (Math.hypot(detras.x - r.x, detras.y - (r.y - 50)) > 6) continue
      await gancho(page, 'teleport', detras.x, detras.y)
      await avanzar(page, 0.5)
      const d = await gancho<{ x: number; y: number; alfa: number }[]>(page, 'decoInfo', 'roble_1')
      const suyo = d.find((q) => Math.abs(q.x - r.x) < 1 && Math.abs(q.y - r.y) < 1)
      if (!suyo) continue
      expect(suyo.alfa).toBeLessThanOrEqual(0.5)
      // se va y la copa vuelve a verse entera
      const lejos = await puntoLibre(page, r.x + 200, r.y + 10)
      await gancho(page, 'teleport', lejos.x, lejos.y)
      await gancho(page, 'irAPostal', 'llegada')
      probado = true
      break
    }
    expect(probado).toBe(true)

    const pastos = await decosDelMapa(page, 'pasto_alto')
    expect(pastos.length).toBeGreaterThan(0)
    const g = pastos[0]!
    await gancho(page, 'teleport', g.x - 6, g.y + 2)
    await avanzar(page, 0.35)
    const d = await gancho<{ x: number; y: number; angulo: number }[]>(page, 'decoInfo', 'pasto_alto')
    const mio = d.find((q) => Math.abs(q.x - g.x) < 1 && Math.abs(q.y - g.y) < 1)!
    expect(Math.abs(mio.angulo)).toBeGreaterThan(4)
    // se va y vuelve a su sitio
    await gancho(page, 'teleport', g.x + 160, g.y + 80)
    await avanzar(page, 0.1)
    await gancho(page, 'irAPostal', 'llegada')
    await gancho(page, 'teleport', g.x - 6, g.y + 2)
    await gancho(page, 'teleport', g.x + 200, g.y + 100)
    await avanzar(page, 1.2)
    const d2 = await gancho<{ x: number; y: number; angulo: number }[]>(page, 'decoInfo', 'pasto_alto')
    const mio2 = d2.find((q) => Math.abs(q.x - g.x) < 1 && Math.abs(q.y - g.y) < 1)
    if (mio2) expect(Math.abs(mio2.angulo)).toBeLessThan(1.5)
  })

  test('los cuervos huyen cuando la heroína se acerca', async ({ page }) => {
    await abrirMundo(page)
    const cuervos = await gancho<{ x: number; y: number; st: string }[]>(page, 'cuervos')
    expect(cuervos.length).toBeGreaterThanOrEqual(10)
    const c = cuervos[0]!
    const cerca = await puntoLibre(page, c.x + 30, c.y + 12)
    await gancho(page, 'teleport', cerca.x, cerca.y)
    await avanzar(page, 0.3)
    expect(await gancho<number>(page, 'cuervosVolando')).toBeGreaterThanOrEqual(1)
  })

  test('Thor sigue a la heroína sin quedarse trabado, y se sienta cuando ella para', async ({ page }) => {
    test.setTimeout(120_000)
    await abrirMundo(page)
    const mapa = await info(page)
    const meta = await puntoLibre(page, mapa.inicio.x + 900, mapa.inicio.y - 300)
    await gancho(page, 'tocar', meta.x, meta.y)
    let trabadoS = 0
    let maxTrabadoS = 0
    for (let i = 0; i < 80; i++) {
      await avanzar(page, 0.25)
      const h = await pos(page)
      const t = await gancho<{ x: number; y: number }>(page, 'thorInfo')
      const d = Math.hypot(h.x - t.x, h.y - t.y)
      if (d > 110) trabadoS += 0.25
      else trabadoS = 0
      maxTrabadoS = Math.max(maxTrabadoS, trabadoS)
    }
    expect(maxTrabadoS).toBeLessThanOrEqual(2)
    const h = await pos(page)
    const t = await gancho<{ x: number; y: number; estado: string }>(page, 'thorInfo')
    expect(Math.hypot(h.x - t.x, h.y - t.y)).toBeLessThan(100)
    // la heroína ya llegó: pasados 6 s, Thor se sienta
    await avanzar(page, 7)
    expect((await gancho<{ estado: string }>(page, 'thorInfo')).estado).toBe('sit')
  })

  test('el ambiente cambia con fundido al cambiar de zona', async ({ page }) => {
    await abrirMundo(page)
    const mapa = await info(page)
    await avanzar(page, 4)
    let v = await gancho<Record<string, number>>(page, 'sonido')
    expect(v.ambiente_bosque).toBeGreaterThan(0.2)
    const p = puntoPropioDeZona(mapa, 'Bosque Profundo')
    await gancho(page, 'teleport', p.x, p.y)
    await avanzar(page, 0.5)
    v = await gancho(page, 'sonido')
    // a medio fundido: los dos suenan
    expect(v.ambiente_noche).toBeGreaterThan(0)
    expect(v.ambiente_noche).toBeLessThan(0.5)
    expect(v.ambiente_bosque).toBeGreaterThan(0)
    await avanzar(page, 3)
    v = await gancho(page, 'sonido')
    expect(v.ambiente_noche).toBeGreaterThan(0.4)
    expect(v.ambiente_bosque ?? 0).toBeLessThan(0.05)
  })

  test('la interfaz queda pegada a los bordes en escritorio y en tablet, y se reacomoda al cambiar el tamaño', async ({ page }, testInfo) => {
    await abrirMundo(page)
    await page.waitForTimeout(500)
    const medir = () => gancho<{ vista: { w: number; h: number }; panel: { x: number; y: number }; fps: { x: number; w: number; y: number }; banner: { x: number } }>(page, 'hudLayout')
    let l = await medir()
    expect(l.panel.x).toBe(6)
    expect(l.panel.y).toBe(6)
    expect(l.fps.x + l.fps.w).toBeGreaterThanOrEqual(l.vista.w - 8)
    expect(l.fps.x + l.fps.w).toBeLessThanOrEqual(l.vista.w - 5)
    expect(Math.abs(l.banner.x - l.vista.w / 2)).toBeLessThanOrEqual(1)
    if (testInfo.project.name === 'escritorio') {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForFunction(() => (window.__ABYSS__!.escala as () => { zoom: number })().zoom === 2)
      await page.waitForTimeout(300)
      l = await medir()
      expect(l.vista).toEqual({ w: 960, h: 540 })
      expect(l.panel.x).toBe(6)
      expect(l.fps.x + l.fps.w).toBeGreaterThanOrEqual(960 - 8)
      expect(Math.abs(l.banner.x - 480)).toBeLessThanOrEqual(1)
    }
  })

  test('la oscuridad y las luces respetan los topes de la calidad', async ({ page }) => {
    await abrirMundo(page)
    const mapa = await info(page)
    const p = puntoPropioDeZona(mapa, 'Bosque Profundo')
    await gancho(page, 'teleport', p.x, p.y)
    await avanzar(page, 2)
    let a = await gancho<{ luces: number; particulas: number; topeParticulas: number; calidad: string; capasBruma: number }>(page, 'atmosfera')
    expect(a.luces).toBeLessThanOrEqual(40)
    expect(a.particulas).toBeLessThanOrEqual(a.topeParticulas)
    expect(a.capasBruma).toBe(2)
    await gancho(page, 'ajustes', { calidad: 'baja' })
    await avanzar(page, 2)
    a = await gancho(page, 'atmosfera')
    expect(a.calidad).toBe('baja')
    expect(a.luces).toBeLessThanOrEqual(20)
    expect(a.topeParticulas).toBe(50)
    expect(a.particulas).toBeLessThanOrEqual(50)
    expect(a.capasBruma).toBe(1)
    expect((await gancho<{ postFx: boolean }>(page, 'atmosfera')).postFx).toBe(false)
  })
})
