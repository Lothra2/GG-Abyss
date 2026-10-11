import { execSync } from 'node:child_process'

/**
 * ¿El sitio en vivo es el commit que acabo de subir? Lee <sitio>/version.json (lo escribe el build) y lo compara con
 * el commit de ahora. Espera a que Netlify termine (por defecto hasta 10 minutos) y sale con error si no llega.
 *   npm run verificar-publicacion [-- <url> <minutos>]
 * Regla (CLAUDE.md): nunca decir "publicado" si esto no dio OK.
 */
const sitio = (process.argv[2] ?? 'https://gg-abyss.netlify.app').replace(/\/$/, '')
const minutos = Number(process.argv[3] ?? 10)
const esperado = execSync('git rev-parse --short=7 HEAD').toString().trim()
const hasta = Date.now() + minutos * 60_000
let ultimo = '(sin respuesta)'
for (;;) {
  try {
    const r = await fetch(`${sitio}/version.json?nocache=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } })
    if (r.ok) {
      const v = (await r.json()) as { commit: string; fecha: string; rama: string | null }
      ultimo = `${v.commit} (${v.fecha}${v.rama ? `, rama ${v.rama}` : ''})`
      if (v.commit === esperado) {
        console.log(`OK: ${sitio} ya sirve ${esperado}`)
        process.exit(0)
      }
    } else ultimo = `HTTP ${r.status}`
  } catch (e) {
    ultimo = String(e)
  }
  if (Date.now() > hasta) break
  console.log(`esperando: en vivo ${ultimo}, quiero ${esperado}...`)
  await new Promise((res) => setTimeout(res, 20_000))
}
console.error(`NO PUBLICADO: ${sitio} sigue en ${ultimo} y el commit es ${esperado}. Revisar el deploy en Netlify.`)
process.exit(1)
