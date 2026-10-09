import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// F1b: del título al mundo, guardado, pausa y créditos. Corre en escritorio (mouse) y en tablet (dedo).

interface Tarjeta { id: string; nombre: string; x: number; y: number; w: number; h: number; tienePartida: boolean; nivel: number; oro: number; modoPeque: boolean }
interface Objetivo { tipo: string; x: number; y: number; llave: string; radio: number; parada: { x: number; y: number } }
interface Estado { id: string; oro: number; cofres: string[]; secretos: string[]; ultimaFogata: string; presentacionVista: boolean; ajustes: { noche: number; calidad: string; musica: number; efectos: number; modoPeque: boolean }; posicion: { x: number; y: number } }

const estado = (page: Page) => gancho<Estado>(page, 'estado')
const avanzar = (page: Page, seg: number, parar = false) => gancho(page, 'avanzar', seg, parar)
const objetivos = (page: Page, tipo: string) => gancho<Objetivo[]>(page, 'objetivos').then((l) => l.filter((o) => o.tipo === tipo))

async function toque(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  if (info.project.name === 'tablet') await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

/** De coordenadas lógicas de la vista (como las que dan los ganchos de la interfaz) a la página */
async function logicoAPagina(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const z = await gancho<{ cssZoom: number }>(page, 'escala')
  return { x: x * z.cssZoom, y: y * z.cssZoom }
}

async function tocarRect(page: Page, info: TestInfo, r: { x: number; y: number; width?: number; height?: number; w?: number; h?: number }): Promise<void> {
  const p = await logicoAPagina(page, r.x + (r.width ?? r.w ?? 0) / 2, r.y + (r.height ?? r.h ?? 0) / 2)
  await toque(page, info, p.x, p.y)
}

async function deTituloASeleccion(page: Page, info: TestInfo, url = '/?test=1&seed=1'): Promise<void> {
  await page.goto(url)
  await esperarEscena(page, 'Titulo')
  await toque(page, info, 40, 40)
  await esperarEscena(page, 'SeleccionJugador')
  await expect.poll(async () => (await gancho<{ tarjetas: Tarjeta[] }>(page, 'seleccion')).tarjetas.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(4)
}

async function elegir(page: Page, info: TestInfo, id: string): Promise<void> {
  const t = (await gancho<{ tarjetas: Tarjeta[] }>(page, 'seleccion')).tarjetas.find((q) => q.id === id)!
  await tocarRect(page, info, { x: t.x, y: t.y, w: t.w, h: t.h - 10 })
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true }, null, { timeout: 120_000 })
}

test.describe('Del título al mundo', () => {
  test('en dos toques se llega al mundo: título, jugadora, y la presentación se salta con un toque', async ({ page }, info) => {
    const errores = vigilarErrores(page)
    await page.goto('/?test=1&seed=1')
    await esperarEscena(page, 'Titulo')
    expect((await gancho<{ logo: boolean }>(page, 'titulo')).logo).toBe(true)
    await toque(page, info, 40, 40)
    await esperarEscena(page, 'SeleccionJugador')
    const sel = await gancho<{ tarjetas: Tarjeta[] }>(page, 'seleccion')
    expect(sel.tarjetas.length).toBeGreaterThanOrEqual(4)
    expect(sel.tarjetas.map((t) => t.id)).toEqual(expect.arrayContaining(['sophie', 'alana', 'rick', 'steph']))
    await elegir(page, info, 'sophie')
    // la primera vez hay presentación y un toque la salta
    expect((await gancho<{ activa: boolean }>(page, 'presentacion')).activa).toBe(true)
    await toque(page, info, 60, 60)
    await expect.poll(async () => (await gancho<{ activa: boolean }>(page, 'presentacion')).activa, { timeout: 10_000 }).toBe(false)
    expect((await estado(page)).presentacionVista).toBe(true)
    expect(await gancho(page, 'cartelAbierto')).toBe(false)
    await sinErrores(errores)
  })

  test('el cofre se abre, da oro y todo sigue ahí al recargar y elegir Continuar', async ({ page }, info) => {
    const errores = vigilarErrores(page)
    await deTituloASeleccion(page, info)
    await elegir(page, info, 'sophie')
    await gancho(page, 'saltarPresentacion')
    const cofre = (await objetivos(page, 'cofre'))[0]!
    await gancho(page, 'teleport', cofre.parada.x, cofre.parada.y)
    // se toca el cofre en el mundo, la heroína camina y lo abre
    await gancho(page, 'usarObjetivo', cofre.llave)
    await avanzar(page, 6, false)
    await expect.poll(async () => (await estado(page)).cofres, { timeout: 30_000 }).toContain(cofre.llave)
    await expect.poll(async () => (await estado(page)).oro, { timeout: 30_000 }).toBeGreaterThan(0)
    const antes = await estado(page)
    await gancho(page, 'guardarAhora')

    // recarga: la selección muestra su nivel y su oro, y Continuar deja todo como estaba
    await deTituloASeleccion(page, info)
    const t = (await gancho<{ tarjetas: Tarjeta[] }>(page, 'seleccion')).tarjetas.find((q) => q.id === 'sophie')!
    expect(t.tienePartida).toBe(true)
    expect(t.oro).toBe(antes.oro)
    await elegir(page, info, 'sophie')
    expect((await gancho<{ activa: boolean }>(page, 'presentacion')).activa).toBe(false)
    const despues = await estado(page)
    expect(despues.cofres).toContain(cofre.llave)
    expect(despues.oro).toBe(antes.oro)
    const abierto = await page.evaluate((l) => {
      const m = (window as unknown as { __JUEGO__: { scene: { getScene(k: string): { entidades: { cofres: { llave: string; abierto: boolean }[] } } } } }).__JUEGO__.scene.getScene('Mundo')
      return m.entidades.cofres.find((c) => c.llave === l)?.abierto
    }, cofre.llave)
    expect(abierto).toBe(true)
    await sinErrores(errores)
  })

  test('cada jugadora tiene su propia partida', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'ajustes', { noche: 0.4, musica: 0.3 })
    await gancho(page, 'guardarAhora')
    await abrirMundo(page, 'alana')
    const a = await estado(page)
    expect(a.id).toBe('alana')
    expect(a.ajustes.musica).not.toBe(0.3)
    expect(a.ajustes.modoPeque).toBe(true)
    await gancho(page, 'guardarAhora')
    const claves = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ggabyss:v1:perfil:')))
    expect(claves).toEqual(expect.arrayContaining(['ggabyss:v1:perfil:sophie', 'ggabyss:v1:perfil:alana']))
    await abrirMundo(page, 'sophie')
    const s = await estado(page)
    expect(s.ajustes.noche).toBeCloseTo(0.4, 2)
    expect(s.ajustes.musica).toBeCloseTo(0.3, 2)
  })

  test('la selección suma una tarjeta por cada heroína nueva que trae el kit (ficha del estudio)', async ({ page }, info) => {
    await page.route('**/assets/kit/manifest.json', async (r) => {
      const resp = await r.fetch()
      const m = await resp.json()
      m.personajes.prueba_ficha = { ...m.personajes.sophie, nombre: 'Prueba', desde_estudio: true }
      await r.fulfill({ response: resp, json: m })
    })
    await deTituloASeleccion(page, info)
    const ids = (await gancho<{ tarjetas: Tarjeta[] }>(page, 'seleccion')).tarjetas.map((t) => t.id)
    expect(ids.length).toBeGreaterThanOrEqual(5)
    expect(ids).toContain('prueba_ficha')
  })
})

test.describe('Cosas del mundo', () => {
  test('un cartel abre su panel con ícono y se cierra tocando', async ({ page }, info) => {
    await abrirMundo(page, 'sophie')
    const cartel = (await objetivos(page, 'cartel'))[0]!
    await gancho(page, 'teleport', cartel.parada.x, cartel.parada.y + 8)
    await gancho(page, 'usarObjetivo', cartel.llave)
    await avanzar(page, 3, true)
    await expect.poll(async () => (await gancho<{ abierto: boolean }>(page, 'hudCartel')).abierto, { timeout: 20_000 }).toBe(true)
    const c = await gancho<{ icono: string; texto: string }>(page, 'hudCartel')
    expect(c.icono.length).toBeGreaterThan(0)
    expect(c.texto.length).toBeGreaterThan(0)
    expect(await gancho(page, 'cartelAbierto')).toBe(true)
    await toque(page, info, 30, 200)
    await expect.poll(async () => (await gancho<{ abierto: boolean }>(page, 'hudCartel')).abierto, { timeout: 10_000 }).toBe(false)
    expect(await gancho(page, 'cartelAbierto')).toBe(false)
  })

  test('la fogata guarda la partida y deja anotada la última fogata', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const f = (await objetivos(page, 'fogata'))[0]!
    expect((await estado(page)).ultimaFogata).toBe('')
    await gancho(page, 'teleport', f.parada.x, f.parada.y + 10)
    await gancho(page, 'usarObjetivo', f.llave)
    await avanzar(page, 3, true)
    await expect.poll(async () => (await estado(page)).ultimaFogata, { timeout: 20_000 }).not.toBe('')
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('ggabyss:v1:perfil:sophie') ?? 'null'))
    expect(guardado?.ultimaFogata).not.toBe('')
  })

  test('el Abuelo Roble sonríe cuando lo abrazan', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    const ab = (await objetivos(page, 'abuelo'))[0]!
    await gancho(page, 'teleport', ab.parada.x, ab.parada.y + 8)
    await avanzar(page, 1)
    await gancho(page, 'usarObjetivo', ab.llave)
    await avanzar(page, 3, true)
    await expect
      .poll(async () => (await gancho<{ anim: string }[]>(page, 'decoInfo', 'abuelo_roble_v3')).some((d) => /sonreir/.test(d.anim)), { timeout: 20_000, intervals: [100] })
      .toBe(true)
  })
})

test.describe('Pausa y créditos', () => {
  test('la pausa cambia la noche, nunca pasa de 0.25 en modo peque y todo se guarda', async ({ page }, info) => {
    const errores = vigilarErrores(page)
    await abrirMundo(page, 'alana')
    const p0 = await gancho<{ x: number; y: number }>(page, 'pos')
    await gancho(page, 'abrirPausa')
    await esperarPausa(page)
    expect((await gancho<{ abierta: boolean }>(page, 'pausa')).abierta).toBe(true)
    await gancho(page, 'pausaFijar', 'noche', 0.55)
    expect((await estado(page)).ajustes.noche).toBeCloseTo(0.25, 2)
    await gancho(page, 'pausaFijar', 'musica', 0.35)
    // el deslizador también se arrastra con el dedo o el mouse
    const d = (await gancho<{ deslizadores: { nombre: string; x: number; y: number; w: number }[] }>(page, 'pausa')).deslizadores.find((q) => q.nombre === 'efectos')!
    const ini = await logicoAPagina(page, d.x + d.w * 0.2, d.y)
    await toque(page, info, ini.x, ini.y)
    await expect.poll(async () => (await estado(page)).ajustes.efectos, { timeout: 10_000 }).toBeLessThan(0.35)
    await gancho(page, 'pausaContinuar')
    await esperarEscena(page, 'Mundo')
    expect(await page.evaluate(() => (window.__ABYSS__ as unknown as { escenasActivas(): string[] }).escenasActivas().includes('Pausa'))).toBe(false)
    const g = await page.evaluate(() => JSON.parse(localStorage.getItem('ggabyss:v1:perfil:alana') ?? 'null'))
    expect(g.ajustes.musica).toBeCloseTo(0.35, 2)
    expect(g.ajustes.noche).toBeCloseTo(0.25, 2)
    // la heroína no se movió mientras estuvo en pausa
    const p1 = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeLessThan(2)
    await sinErrores(errores)
  })

  test('el botón de pausa del HUD y la tecla Esc abren la pausa', async ({ page }, info) => {
    await abrirMundo(page, 'sophie')
    const l = await gancho<{ pausa: { x: number; y: number; w: number; h: number } }>(page, 'hudLayout')
    await tocarRect(page, info, l.pausa)
    await esperarPausa(page)
    await gancho(page, 'pausaContinuar')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 10_000 }).toBe(false)
    if (info.project.name !== 'tablet') {
      await page.keyboard.press('Escape')
      await esperarPausa(page)
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 10_000 }).toBe(false)
    }
  })

  test('desde la pausa se cambia de jugadora y se guarda lo de la anterior', async ({ page }) => {
    await abrirMundo(page, 'sophie')
    await gancho(page, 'ajustes', { calidad: 'baja' })
    await gancho(page, 'abrirPausa')
    await esperarPausa(page)
    await gancho(page, 'pausaCambiarJugadora')
    await esperarEscena(page, 'SeleccionJugador')
    const g = await page.evaluate(() => JSON.parse(localStorage.getItem('ggabyss:v1:perfil:sophie') ?? 'null'))
    expect(g.ajustes.calidad).toBe('baja')
  })

  test('los créditos se abren desde el título y desde la pausa, y se pueden recorrer', async ({ page }, info) => {
    await page.goto('/?test=1&seed=1')
    await esperarEscena(page, 'Titulo')
    const b = (await gancho<{ creditos: { x: number; y: number; width: number; height: number } }>(page, 'titulo')).creditos
    await tocarRect(page, info, b)
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Creditos'), { timeout: 10_000 }).toBe(true)
    // el toque en el botón no empieza el juego
    expect(await gancho<string[]>(page, 'escenasActivas')).not.toContain('SeleccionJugador')
    const c = await gancho<{ desde: string; max: number }>(page, 'creditos')
    expect(c.desde).toBe('Titulo')
    expect(c.max).toBeGreaterThan(0)
    await gancho(page, 'scrollCreditos', 10_000)
    expect((await gancho<{ scroll: number; max: number }>(page, 'creditos')).scroll).toBe(c.max)
    await gancho(page, 'cerrarCreditos')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Creditos'), { timeout: 10_000 }).toBe(false)
    expect(await gancho(page, 'escena')).toBe('Titulo')

    await abrirMundo(page, 'sophie')
    await gancho(page, 'abrirPausa')
    await esperarPausa(page)
    const bc = (await gancho<{ botones: { creditos: { x: number; y: number; width: number; height: number } } }>(page, 'pausa')).botones.creditos
    await tocarRect(page, info, bc)
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Creditos'), { timeout: 10_000 }).toBe(true)
    expect((await gancho<{ desde: string }>(page, 'creditos')).desde).toBe('Pausa')
    await gancho(page, 'cerrarCreditos')
    await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Creditos'), { timeout: 10_000 }).toBe(false)
    expect((await gancho<{ abierta: boolean }>(page, 'pausa')).abierta).toBe(true)
  })
})

async function esperarPausa(page: Page): Promise<void> {
  await expect.poll(async () => (await gancho<string[]>(page, 'escenasActivas')).includes('Pausa'), { timeout: 20_000 }).toBe(true)
  await page.waitForFunction(() => typeof (window.__ABYSS__ as unknown as Record<string, unknown>).pausa === 'function', null, { timeout: 10_000 })
}

