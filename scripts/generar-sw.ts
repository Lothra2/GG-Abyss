import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Después de `vite build`: toma `public/sw.js` (ya copiado a dist) y le pone la lista de todo lo que hay que guardar
 * para que el juego abra sin red, más una versión que cambia cuando cambia cualquier archivo.
 * Las postales de comparación del kit no hacen falta en el juego (solo la de la arena).
 */
const dist = join(process.cwd(), 'dist')
if (!existsSync(join(dist, 'sw.js'))) {
  console.error('No hay dist/sw.js: corre `vite build` primero')
  process.exit(1)
}

const NO_GUARDAR = [/\/sw\.js$/, /\/version\.json$/, /\/mundo\/postales\/(?!arena_del_minotauro)/, /\.map$/]

function listar(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...listar(p))
    else out.push(p)
  }
  return out
}

const archivos = listar(dist)
  .map((p) => relative(dist, p).split(sep).join('/'))
  .filter((u) => !NO_GUARDAR.some((re) => re.test('/' + u)))
  .sort()

const hash = createHash('sha1')
for (const u of archivos) {
  hash.update(u)
  hash.update(String(statSync(join(dist, u)).size))
}
const version = hash.digest('hex').slice(0, 10)

// la página y la raíz siempre; los demás con ruta relativa al scope
const lista = ['./', ...archivos.map((u) => `./${u}`)]
let sw = readFileSync(join(dist, 'sw.js'), 'utf8')
sw = sw.replace("'__VERSION__'", JSON.stringify(version)).replace('/* __ARCHIVOS__ */ []', JSON.stringify(lista))
writeFileSync(join(dist, 'sw.js'), sw)
console.log(`sw.js listo: versión ${version}, ${lista.length} archivos para guardar`)

// version.json: qué commit quedó publicado (Netlify da COMMIT_REF). Lo lee `npm run verificar-publicacion`
// para no decir "publicado" sin ver que el sitio en vivo es el nuevo. No se guarda en el service worker.
let commit = process.env.COMMIT_REF ?? ''
if (!commit) {
  try {
    commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    commit = 'desconocido'
  }
}
writeFileSync(join(dist, 'version.json'), JSON.stringify({ commit: commit.slice(0, 7), sw: version, fecha: new Date().toISOString(), rama: process.env.BRANCH ?? null }, null, 1))
console.log(`version.json: ${commit.slice(0, 7)}`)
