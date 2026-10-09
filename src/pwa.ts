import { params } from './config/params'

/** Lo que el juego sabe de su instalación como app (para las pruebas) */
export const estadoPwa = {
  registrado: false,
  controlado: false,
  precache: null as null | { archivos: number; hechos: number },
  error: '' as string,
}

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
  navigator.serviceWorker.addEventListener('controllerchange', () => (estadoPwa.controlado = true))
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
