/* Service worker de GG Abyss (PLAN.md F5). Plantilla: `scripts/generar-sw.ts` pone la versión y la lista de archivos al construir. */
const VERSION = '__VERSION__'
const ARCHIVOS = /* __ARCHIVOS__ */ []
const CACHE = `gg-abyss-${VERSION}`

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // uno por uno: si un archivo falla no se cae toda la instalación
      let hechos = 0
      await Promise.allSettled(
        ARCHIVOS.map(async (url) => {
          try {
            const r = await fetch(url, { cache: 'reload' })
            if (r.ok) await cache.put(url, r)
          } catch {
            /* sin red para ese archivo: se pide después */
          }
          hechos++
        }),
      )
      const clientes = await self.clients.matchAll({ includeUncontrolled: true })
      for (const c of clientes) c.postMessage({ tipo: 'precache-listo', archivos: ARCHIVOS.length, hechos })
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('gg-abyss-') && k !== CACHE) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      // la página: sin importar los parámetros (?test=1, ?heroe=...) se sirve el index guardado
      const clave = req.mode === 'navigate' ? new Request(new URL('./', self.registration.scope).href) : req
      const guardado = await cache.match(clave, { ignoreSearch: req.mode === 'navigate' })
      if (guardado) return guardado
      try {
        const r = await fetch(req)
        if (r.ok && !url.search.includes('nocache')) cache.put(req, r.clone())
        return r
      } catch (err) {
        if (req.mode === 'navigate') {
          const idx = await cache.match(new URL('index.html', self.registration.scope).href)
          if (idx) return idx
        }
        throw err
      }
    })(),
  )
})
