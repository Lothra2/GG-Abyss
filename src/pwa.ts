import { params } from './config/params'

/** Lo que el juego sabe de su instalación como app (para las pruebas) */
export const estadoPwa = {
  registrado: false,
  controlado: false,
  precache: null as null | { archivos: number; hechos: number },
  error: '' as string,
  /** ya estaba guardada una versión y llegó otra: hay que recargar para jugarla */
  nuevaVersion: false,
}

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
    if (e.data?.tipo === 'precache-listo') estadoPwa.precache = { archivos: e.data.archivos, hechos: e.data.hechos }
  })
  // si ya había un service worker, el cambio es una versión nueva: la página sigue con la vieja hasta recargar
  const habia = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    estadoPwa.controlado = true
    if (!habia) return
    estadoPwa.nuevaVersion = true
    window.dispatchEvent(new Event(EVENTO_VERSION_NUEVA))
  })
  const registrar = () =>
    navigator.serviceWorker
      .register('./sw.js')
      .then((r) => {
        estadoPwa.registrado = true
        estadoPwa.controlado = !!navigator.serviceWorker.controller
        void r
      })
      .catch((err: unknown) => (estadoPwa.error = String(err)))
  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar)
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
