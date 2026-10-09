import { join } from 'node:path'
import { verificarKit } from './lib/verificacion'

const carpeta = process.argv[2] ?? join(process.cwd(), 'public/assets/kit')
const r = verificarKit(carpeta)

for (const a of r.avisos) console.warn(`aviso: ${a}`)
for (const e of r.errores) console.error(`ERROR: ${e}`)
console.log(`Revisado: ${r.revisado.rutas} rutas, ${r.revisado.hojas} hojas, ${r.revisado.objetosMapa} objetos distintos del mapa, ${r.revisado.items} objetos de botín.`)
if (r.errores.length) {
  console.error(`El kit tiene ${r.errores.length} problema(s).`)
  process.exit(1)
}
console.log('El kit está bien.')
