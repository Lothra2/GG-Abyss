import { params } from './config/params'

/** Lo que el juego sabe de su instalación como app (para las pruebas) */
export const estadoPwa = {
  registrado: false,
  controlado: false,
  /** `bajados`: los que hubo que bajar (al actualizar, lo que no cambió se copia de lo ya guardado) */
  precache: null as null | { archivos: number; hechos: number; bajados: number },
  error: '' as string,
  /** ya estaba guardada una versión y llegó otra: hay que recargar para jugarla */
  nuevaVersion: false,
  /** la versión publicada en el sitio, si es otra que la que se está jugando */
  publicada: null as string | null,
  /** cuándo se vio que hay una publicada distinta (para ofrecer el botón si no llega sola) */
  vistaPublicadaEn: 0,
  /** mientras se baja una versión: cuántos archivos van */
  avance: null as null | { hechos: number; total: number },
}

/** Cada cuánto se pregunta si hay versión nueva mientras la app sigue abierta */
const BUSCAR_VERSION_MS = 20 * 60 * 1000

/** Evento de la ventana cuando llega una versión nueva del juego */
export const EVENTO_VERSION_NUEVA = 'gg-version-nueva'

/**
 * PWA (PLAN.md F5): registra el service worker que guarda el juego y el kit para abrir sin red. Solo en la versión construida
 * (en `npm run dev` y con `?test=1` no, para que las pruebas no vean una versión vieja guardada; `?sw=1` lo fuerza).
 */
export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return
  if (params.test && !params.sw) return
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.tipo === 'precache-listo') {
      estadoPwa.precache = { archivos: e.data.archivos, hechos: e.data.hechos, bajados: e.data.bajados ?? e.data.hechos }
      estadoPwa.avance = null
    }
    if (e.data?.tipo === 'precache-avance') estadoPwa.avance = { hechos: e.data.hechos, total: e.data.archivos }
  })
  // si ya había un service worker, el cambio es una versión nueva: la página sigue con la vieja hasta recargar
  const habia = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    estadoPwa.controlado = true
    if (!habia) return
    estadoPwa.nuevaVersion = true
    window.dispatchEvent(new Event(EVENTO_VERSION_NUEVA))
  })
  // el navegador solo busca versión nueva al abrir el juego desde cero. En la tablet la app casi nunca se cierra: se va
  // al fondo y vuelve. Por eso se pregunta al volver y cada rato; si ya llegó una nueva, recarga (Mundo guardó al irse)
  // Ojo: abrir o recargar la página no alcanza, el navegador revisa sw.js por su cuenta a lo sumo una vez al día
  // (medido: abrir la app de cero con una versión nueva publicada no pidió nada en 2 minutos; con update() bajó en 9 s)
  let registro: ServiceWorkerRegistration | null = null
  const buscar = () => {
    void registro?.update().catch(() => undefined)
    void revisarPublicada()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (estadoPwa.nuevaVersion) window.location.reload()
    else buscar()
  })
  setInterval(buscar, BUSCAR_VERSION_MS)
  const registrar = () =>
    navigator.serviceWorker
      .register('./sw.js')
      .then((r) => {
        registro = r
        estadoPwa.registrado = true
        estadoPwa.controlado = !!navigator.serviceWorker.controller
        // apenas abre se pregunta, no se espera a que el navegador se acuerde
        buscar()
      })
      .catch((err: unknown) => (estadoPwa.error = String(err)))
  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar)
}

/** Lee qué versión está publicada (sin pasar por lo guardado) y la anota si es otra que la que se juega */
async function revisarPublicada(): Promise<void> {
  try {
    const r = await fetch(`./version.json?nocache=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const j = (await r.json()) as { commit?: string }
    if (!j.commit || j.commit === __VERSION_JUEGO__) {
      estadoPwa.publicada = null
      return
    }
    if (estadoPwa.publicada !== j.commit) estadoPwa.vistaPublicadaEn = performance.now()
    estadoPwa.publicada = j.commit
  } catch {
    /* sin red: se juega lo guardado */
  }
}

/**
 * Por si una versión nueva no llega sola: se suelta el service worker viejo (lo guardado y la partida quedan) y se
 * recarga desde el sitio. El nuevo reusa lo que no cambió de lo ya guardado.
 */
export async function forzarActualizacion(): Promise<void> {
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
  } catch {
    /* sigue igual */
  }
  window.location.reload()
}

/** ¿Es un iPhone o un iPad? (el iPad nuevo dice que es un Mac, pero con pantalla táctil) */
export function esIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** ¿Ya está abierto como app instalada (sin barra del navegador)? */
export function instaladaComoApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches
}

export function puedePantallaCompleta(): boolean {
  return !!document.fullscreenEnabled && !esIOS()
}

export function alternarPantallaCompleta(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined)
}

/**
 * En el título y la selección (nunca en medio de una partida): si llegó una versión nueva, se recarga sola para
 * jugarla. La partida vive en localStorage, no se pierde nada.
 */
export function recargarSiHayVersionNueva(escena: { events: { once: (ev: string, f: () => void) => void } }): void {
  const recargar = () => window.location.reload()
  if (estadoPwa.nuevaVersion) return recargar()
  window.addEventListener(EVENTO_VERSION_NUEVA, recargar)
  escena.events.once('shutdown', () => window.removeEventListener(EVENTO_VERSION_NUEVA, recargar))
}
