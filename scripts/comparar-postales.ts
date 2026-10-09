import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Arma docs/capturas/comparar.html: cada postal del kit al lado de la del juego (y la de la tablet)
 * para que Rick las revise. Uso: npx tsx scripts/comparar-postales.ts [fase]   (por defecto la última carpeta que haya)
 */
const raiz = join(process.cwd(), 'docs', 'capturas')
const kit = join(process.cwd(), 'public', 'assets', 'kit')
const manifest = JSON.parse(readFileSync(join(kit, 'manifest.json'), 'utf8')) as { mundo: { postales: Record<string, string> } }

const fases = existsSync(raiz) ? readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []
const fase = process.argv[2] ?? fases[fases.length - 1]
if (!fase) {
  console.error('No hay capturas todavía. Corre FASE_CAPTURAS=f1a npx playwright test e2e/postales.spec.ts --project=postales')
  process.exit(1)
}
const carpetaFase = join(raiz, fase)
mkdirSync(raiz, { recursive: true })

const nombres = Object.keys(manifest.mundo.postales)
// postales que el mapa trae y el manifest todavía no (las del taller que llegan después)
const extra = existsSync(carpetaFase)
  ? readdirSync(carpetaFase).filter((f) => f.endsWith('.png') && !f.endsWith('_tablet.png')).map((f) => f.replace('.png', '')).filter((n) => !nombres.includes(n))
  : []
const todas = [...nombres, ...extra]

const fila = (n: string) => {
  const kitRuta = manifest.mundo.postales[n]
  const juego = existsSync(join(carpetaFase, `${n}.png`)) ? `${fase}/${n}.png` : null
  const tablet = existsSync(join(carpetaFase, `${n}_tablet.png`)) ? `${fase}/${n}_tablet.png` : null
  return `<section>
  <h2>${n.replace(/_/g, ' ')}</h2>
  <div class="par">
    <figure>${kitRuta ? `<img src="../../public/assets/kit/${kitRuta}" alt="kit">` : '<div class="vacio">el kit todavía no la trae</div>'}<figcaption>Kit del taller</figcaption></figure>
    <figure>${juego ? `<img src="${juego}" alt="juego">` : '<div class="vacio">sin captura</div>'}<figcaption>Juego (960 x 540)</figcaption></figure>
  </div>
  ${tablet ? `<figure class="tablet"><img src="${tablet}" alt="tablet"><figcaption>Juego en la tablet (1180 x 820, dpr 2)</figcaption></figure>` : ''}
</section>`
}

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Postales: kit contra juego (${fase})</title>
<style>
  body { background:#0b0e14; color:#e6e0d2; font:16px/1.4 system-ui,sans-serif; margin:0; padding:24px; }
  h1 { font-size:22px; margin:0 0 4px } p.nota { color:#9a9caa; margin:0 0 24px }
  section { margin:0 0 40px } h2 { font-size:17px; text-transform:capitalize; color:#ffd27a; margin:0 0 8px }
  .par { display:grid; grid-template-columns:repeat(auto-fit,minmax(420px,1fr)); gap:12px }
  figure { margin:0 } img { width:100%; image-rendering:pixelated; display:block; border:1px solid #2a3040 }
  .tablet { margin-top:12px; max-width:760px } figcaption { color:#9a9caa; font-size:13px; margin-top:4px }
  .vacio { aspect-ratio:16/9; display:grid; place-items:center; border:1px dashed #3a4050; color:#7a7f90 }
</style></head><body>
<h1>Postales: kit contra juego (${fase})</h1>
<p class="nota">A la izquierda lo que hizo el taller. A la derecha el juego con luces, bruma, partículas y personajes. El juego tiene que verse igual o mejor.</p>
${todas.map(fila).join('\n')}
</body></html>
`
writeFileSync(join(raiz, 'comparar.html'), html)
console.log(`docs/capturas/comparar.html listo con ${todas.length} postales de la fase ${fase}`)
