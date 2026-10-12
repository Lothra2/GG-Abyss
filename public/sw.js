/* Service worker de GG Abyss (PLAN.md F5). Plantilla: `scripts/generar-sw.ts` pone la versión y la lista de archivos al construir. */
const VERSION = '__VERSION__'
/** [ruta, huella del contenido]: la huella dice si el archivo cambió desde la versión que ya está guardada */
const ARCHIVOS = /* __ARCHIVOS__ */ []
const CACHE = `gg-abyss-${VERSION}`
/** dónde queda anotada la huella de cada archivo guardado */
const HUELLAS = './__huellas__'

/** El cache de la versión que ya estaba guardada y sus huellas (las versiones viejas no anotaban huellas) */
async function guardadoAnterior() {
  let sinHuellas = null
  for (const k of await caches.keys()) {
    if (!k.startsWith('gg-abyss-') || k === CACHE) continue
    const c = await caches.open(k)
    const r = await c.match(HUELLAS)
    if (r) {
      try {
        return { cache: c, huellas: await r.json() }
      } catch {
        /* huellas rotas: se revalida cada archivo */
      }
    }
    sinHuellas ??= { cache: c, huellas: {} }
  }
  return sinHuellas
}

/** Lo guardado de antes, si sigue igual en el sitio: con la misma huella sin preguntar, sin huella preguntando por su ETag */
async function reusar(viejo, url, huella) {
  if (!viejo) return null
  const r = await viejo.cache.match(url)
  if (!r) return null
  if (viejo.huellas[url] === huella) return r
  if (viejo.huellas[url]) return null
  const etag = r.headers.get('ETag')
  if (!etag) return null
  const v = await fetch(url, { cache: 'no-store', headers: { 'If-None-Match': etag } })
  return v.status === 304 ? r : null
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // lo que no cambió se copia de la versión guardada: una actualización baja solo lo nuevo, no los 70 MB del kit
      const viejo = await guardadoAnterior()
      let hechos = 0
      let bajados = 0
      const huellas = {}
      await Promise.allSettled(
        ARCHIVOS.map(async ([url, huella]) => {
          try {
            const igual = await reusar(viejo, url, huella).catch(() => null)
            if (igual) {
              await cache.put(url, igual)
              huellas[url] = huella
              hechos++
              return
            }
            const r = await fetch(url, { cache: 'reload' })
            if (r.ok) {
              await cache.put(url, r)
              huellas[url] = huella
              bajados++
            }
          } catch {
            /* sin red para ese archivo: se pide después */
          }
          hechos++
        }),
      )
      await cache.put(HUELLAS, new Response(JSON.stringify(huellas), { headers: { 'Content-Type': 'application/json' } }))
      const clientes = await self.clients.matchAll({ includeUncontrolled: true })
      for (const c of clientes) c.postMessage({ tipo: 'precache-listo', archivos: ARCHIVOS.length, hechos, bajados })
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
