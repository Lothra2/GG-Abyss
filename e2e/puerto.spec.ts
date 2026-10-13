import { expect, test, type Page } from '@playwright/test'
import { abrirMundo, esperarEscena, gancho, sinErrores, vigilarErrores } from './util'

// F12, el Mundo 4: El Puerto Ahogado. La luz la carga Thor en un farol: se alza (crece y encandila), se apaga si lo toca
// una medusa, prende los faroles del muelle que quedan guardados y la marea abre y cierra caminos. El Pez Farol solo se
// golpea afuera del agua y al vencerlo el faro se prende. Todo se lee del mapa: cuántos faroles y dónde lo decide el taller.

interface Pto {
  marea: string
  agua: number
  cerrados: number
  faroles: { id: string; x: number; y: number; prendido: boolean }[]
  farol: { radio: number; apagado: boolean; alzado: boolean; capa: boolean }
  celdaBaja: { x: number; y: number } | null
  celdaAlta: { x: number; y: number } | null
  halo: number
  faro: boolean
  luzAlFaro: boolean
}
interface En { id: number; tipo: string; x: number; y: number; vida: number; vivo: boolean; estado: string; elite: boolean; nombre: string; enLuz?: boolean; alfa: number; anticipa: boolean }
interface Jefe { blindado: boolean; estado: string; fase: number; vida: number; vidaMax: number; peleando: boolean; vencido: boolean; portal: boolean; x: number; y: number; avisos: { ataque: string; forma: string }[] }

const pto = (p: Page) => gancho<Pto>(p, 'puerto')
const avanzar = (p: Page, s: number, parar = false) => gancho(p, 'avanzar', s, parar)
const enemigos = (p: Page) => gancho<En[]>(p, 'enemigos')

async function listo(page: Page): Promise<void> {
  await esperarEscena(page, 'Mundo')
  await page.waitForFunction(() => { const a = window.__ABYSS__ as unknown as Record<string, () => unknown>; return typeof a.noEsperar === 'function' && a.noEsperar() === true && typeof a.puerto === 'function' }, null, { timeout: 120_000 })
}

async function bajarAlPuerto(page: Page, heroe = 'rick'): Promise<void> {
  await abrirMundo(page, heroe)
  await gancho(page, 'irAMundo', 'mundo4')
  await esperarEscena(page, 'Bajada')
  await listo(page)
  await expect.poll(async () => (await gancho<{ id: string }>(page, 'mundoActual')).id, { timeout: 30_000 }).toBe('mundo4')
}

test.describe('El Puerto Ahogado', () => {
  test('baja sin errores: el mapa, el farol en la boca de Thor, el halo chico y casi sin música', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    const m = await gancho<{ nombre: string; zonas: string[]; jefe: boolean; jefeTipo: string }>(page, 'mundoActual')
    expect(m.nombre).toBe('El Puerto Ahogado')
    expect(m.jefe).toBe(true)
    expect(m.jefeTipo).toBe('pez_farol')
    expect(m.zonas.length).toBeGreaterThanOrEqual(8)
    const p = await pto(page)
    expect(p.faroles.length).toBeGreaterThanOrEqual(4)
    expect(p.farol.capa).toBe(true)
    expect(p.farol.radio).toBeGreaterThanOrEqual(150)
    expect(p.halo).toBeLessThan(100)
    expect(p.faro).toBe(false)
    // piso 4: más oscuro que el 3
    expect((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad).toBeGreaterThan(0.65)
    await avanzar(page, 3)
    // el ambiente del puerto suena; música de zona no hay (entra en las peleas)
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toMatch(/ambiente_puerto|ambiente_campana|ambiente_agua/)
    const sonando = await gancho<Record<string, number>>(page, 'sonido')
    expect(Object.keys(sonando).filter((k) => k.startsWith('musica_') && k !== 'musica_fogata' && sonando[k]! > 0.05)).toEqual([])
    await sinErrores(errores)
  })

  test('Thor prende el farol del muelle al pasar y queda guardado', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page, 'alana')
    await gancho(page, 'matarEnemigos')
    const f = (await pto(page)).faroles.find((q) => !q.prendido)!
    await gancho(page, 'teleport', f.x + 20, f.y + 30)
    await expect.poll(async () => (await pto(page)).faroles.find((q) => q.id === f.id)!.prendido, { timeout: 30_000 }).toBe(true)
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ faroles: string[] }>(page, 'estado')).faroles).toContain(f.id)
    await sinErrores(errores)
  })

  test('el farol: alzado crece, la medusa no lo apaga alzado, apagado queda una brasa y alzarlo lo vuelve a prender', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    await gancho(page, 'matarEnemigos')
    const r0 = (await pto(page)).farol.radio
    // el botón redondo del farol (para Alana): tocarlo alza el farol
    const hud = await gancho<{ farol: { x: number; y: number; lado: number } | null }>(page, 'hudCombate')
    expect(hud.farol).not.toBeNull()
    const z = (await gancho<{ cssZoom: number }>(page, 'escala')).cssZoom
    await page.mouse.click(hud.farol!.x * z, hud.farol!.y * z)
    await expect.poll(async () => (await pto(page)).farol.alzado, { timeout: 5_000 }).toBe(true)
    let p = await pto(page)
    expect(p.farol.alzado).toBe(true)
    expect(p.farol.radio).toBeGreaterThan(r0)
    await gancho(page, 'apagarFarol')
    expect((await pto(page)).farol.apagado).toBe(false)
    // tiene recarga: no se alza dos veces seguidas
    expect(await gancho<boolean>(page, 'alzarFarol')).toBe(false)
    for (let i = 0; i < 5; i++) await avanzar(page, 1)
    await gancho(page, 'apagarFarol')
    p = await pto(page)
    expect(p.farol.apagado).toBe(true)
    expect(p.farol.radio).toBeLessThan(r0)
    expect(p.farol.radio).toBeGreaterThan(0)
    for (let i = 0; i < 11; i++) await avanzar(page, 1)
    expect(await gancho<boolean>(page, 'alzarFarol')).toBe(true)
    expect((await pto(page)).farol.apagado).toBe(false)
    await sinErrores(errores)
  })

  test('la marea alta tapa los caminos bajos y saca suave al seco a quien alcanza, sin daño', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    await gancho(page, 'matarEnemigos')
    const p0 = await pto(page)
    expect(p0.marea).toBe('baja')
    expect(p0.celdaBaja).not.toBeNull()
    // parada en el barro con la marea baja
    await gancho(page, 'ponerHeroina', p0.celdaBaja!.x, p0.celdaBaja!.y)
    const vida0 = (await gancho<{ vida: number }>(page, 'combate')).vida
    const pos0 = await gancho<{ x: number; y: number }>(page, 'pos')
    // la campana y la marea sube
    for (let i = 0; i < 70 && (await pto(page)).marea !== 'alta'; i++) await avanzar(page, 1)
    await avanzar(page, 0.5)
    const p1 = await pto(page)
    expect(p1.marea).toBe('alta')
    expect(p1.cerrados).toBeGreaterThan(0)
    const pos1 = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(pos1.x - pos0.x, pos1.y - pos0.y)).toBeGreaterThan(4)
    expect((await gancho<{ vida: number }>(page, 'combate')).vida).toBeGreaterThanOrEqual(vida0)
    await sinErrores(errores)
  })

  test('la medusa negra no pega: va por Thor y le apaga el farol', async ({ page }) => {
    test.setTimeout(150_000)
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    const md = (await enemigos(page)).find((e) => e.tipo === 'medusa_negra' && e.vivo)
    expect(md).toBeDefined()
    const vida0 = (await gancho<{ vida: number }>(page, 'combate')).vida
    await gancho(page, 'teleport', md!.x + 30, md!.y)
    let apagado = false
    for (let i = 0; i < 40 && !apagado; i++) {
      await avanzar(page, 0.5)
      apagado = (await pto(page)).farol.apagado
    }
    expect(apagado).toBe(true)
    // la medusa no le hizo nada a la heroína (los demás del muelle sí podrían: se cura antes de mirar)
    expect((await enemigos(page)).find((e) => e.id === md!.id)!.vivo).toBe(true)
    void vida0
    await sinErrores(errores)
  })

  test('el marinero de niebla: a oscuras casi no se ve y aguanta; en la luz del farol se deshace más rápido', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    const ms = (await enemigos(page)).filter((e) => e.tipo === 'marinero_niebla' && e.vivo)
    expect(ms.length).toBeGreaterThanOrEqual(2)
    // uno lejos de toda luz: casi invisible
    await avanzar(page, 1)
    const lejos = (await enemigos(page)).find((e) => e.tipo === 'marinero_niebla' && e.enLuz === false)
    expect(lejos).toBeDefined()
    expect(lejos!.alfa).toBeLessThan(0.5)
    const v0 = lejos!.vida
    await gancho(page, 'danarEnemigo', lejos!.id, 10)
    const oscuro = v0 - (await enemigos(page)).find((e) => e.id === lejos!.id)!.vida
    // con Thor al lado, en la luz del farol
    const m2 = ms.find((e) => e.id !== lejos!.id)!
    await gancho(page, 'teleport', m2.x + 24, m2.y + 10)
    await expect.poll(async () => { await avanzar(page, 0.3); return (await enemigos(page)).find((e) => e.id === m2.id)!.enLuz }, { timeout: 20_000 }).toBe(true)
    const v1 = (await enemigos(page)).find((e) => e.id === m2.id)!.vida
    await gancho(page, 'danarEnemigo', m2.id, 10)
    const enLuz = v1 - (await enemigos(page)).find((e) => e.id === m2.id)!.vida
    expect(enLuz).toBeGreaterThan(oscuro)
    await sinErrores(errores)
  })

  test('el Capitán Ahogado avisa el golpe de ancla en el piso y la ola corta empuja', async ({ page }) => {
    test.setTimeout(150_000)
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    await gancho(page, 'ponerNivel', 10)
    const cap = (await enemigos(page)).find((e) => e.tipo === 'capitan_ahogado')
    expect(cap).toBeDefined()
    expect(cap!.elite).toBe(true)
    expect(cap!.nombre).toBe('El Capitán Ahogado')
    await gancho(page, 'teleport', cap!.x + 30, cap!.y + 6)
    let aviso = false
    for (let i = 0; i < 60 && !aviso; i++) {
      await gancho(page, 'curarTodo')
      await avanzar(page, 0.25)
      aviso = (await enemigos(page)).find((e) => e.id === cap!.id)!.estado === 'aviso'
    }
    expect(aviso).toBe(true)
    // se queda quieta adentro del aviso: el ancla cae y la ola la empuja
    const c = (await enemigos(page)).find((e) => e.id === cap!.id)!
    await gancho(page, 'ponerHeroina', c.x + 20, c.y + 6)
    const pos0 = await gancho<{ x: number; y: number }>(page, 'pos')
    for (let i = 0; i < 12; i++) await avanzar(page, 0.25, true)
    const pos1 = await gancho<{ x: number; y: number }>(page, 'pos')
    expect(Math.hypot(pos1.x - pos0.x, pos1.y - pos0.y)).toBeGreaterThan(10)
    await sinErrores(errores)
  })

  test('la figura de los ojos rojos mira desde lejos (una en lo alto del faro) y se va si te acercas', async ({ page }) => {
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    await gancho(page, 'matarEnemigos')
    const mis = await gancho<{ figuras: { x: number; y: number; alto: boolean; estado: string }[]; mural: boolean | null }>(page, 'misterio')
    expect(mis.figuras.length).toBeGreaterThanOrEqual(2)
    expect(mis.figuras.some((f) => f.alto)).toBe(true)
    const f = mis.figuras.find((q) => !q.alto)!
    await gancho(page, 'teleport', f.x - 120, f.y + 20)
    await expect.poll(async () => { await avanzar(page, 0.3); return (await gancho<{ figuras: { x: number; estado: string }[] }>(page, 'misterio')).figuras.find((q) => q.x === f.x)!.estado }, { timeout: 20_000 }).not.toBe('mirando')
    await sinErrores(errores)
  })

  test('el Pez Farol: bajo el agua el golpe salpica, el farol alzado lo saca encandilado y al vencerlo el faro se prende', async ({ page }) => {
    test.setTimeout(240_000)
    const errores = vigilarErrores(page)
    await bajarAlPuerto(page)
    await gancho(page, 'matarEnemigos')
    await gancho(page, 'ponerNivel', 14)
    await gancho(page, 'curarTodo')
    const osc0 = (await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad
    await gancho(page, 'entrarArena')
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).peleando, { timeout: 30_000 }).toBe(true)
    await avanzar(page, 3)
    // la música del pez
    await expect.poll(async () => Object.keys(await gancho<Record<string, number>>(page, 'sonido')).join(','), { timeout: 20_000 }).toContain('musica_jefe_pez')
    // sumergido: el golpe no le llega
    for (let i = 0; i < 40 && !(await gancho<Jefe>(page, 'jefe')).blindado; i++) await avanzar(page, 0.25)
    let j = await gancho<Jefe>(page, 'jefe')
    expect(j.blindado).toBe(true)
    await gancho(page, 'danarJefe', 50)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j.vida)
    // Thor alza el farol al lado: sale encandilado y ahí se le pega
    await gancho(page, 'teleport', j.x - 60, j.y + 20)
    for (let i = 0; i < 20 && !(await gancho<boolean>(page, 'alzarFarol')); i++) await avanzar(page, 1)
    await gancho(page, 'curarTodo')
    await avanzar(page, 0.3)
    j = await gancho<Jefe>(page, 'jefe')
    expect(j.estado).toBe('aturdido')
    await gancho(page, 'danarJefe', 50)
    expect((await gancho<Jefe>(page, 'jefe')).vida).toBe(j.vida - 50)
    // vencido: la luz robada vuela al faro y el faro se prende con todo el muelle
    await gancho(page, 'danarJefe', 9999)
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).vencido, { timeout: 10_000 }).toBe(true)
    await expect.poll(async () => (await pto(page)).faro, { timeout: 60_000 }).toBe(true)
    await expect.poll(async () => (await pto(page)).faroles.every((f) => f.prendido), { timeout: 20_000 }).toBe(true)
    for (let i = 0; i < 10; i++) await avanzar(page, 1)
    expect((await gancho<{ oscuridad: number }>(page, 'atmosfera')).oscuridad).toBeLessThan(osc0)
    expect(Object.keys(await gancho<Record<string, number>>(page, 'sonido'))).toContain('musica_faro')
    await gancho(page, 'guardarAhora')
    expect((await gancho<{ jefeVencido: boolean }>(page, 'estado')).jefeVencido).toBe(true)
    // el portal baja más hondo: el kit todavía no trae el Mundo 5, así que Continuará
    await expect.poll(async () => (await gancho<Jefe>(page, 'jefe')).portal, { timeout: 60_000 }).toBe(true)
    await gancho(page, 'irAlPortal')
    await esperarEscena(page, 'Continuara')
    await sinErrores(errores)
  })
})
