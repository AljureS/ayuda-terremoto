/**
 * `npm run validate` — valida /data/sitios.json contra el schema canónico.
 *
 * Verde (exit 0)  → el archivo es estructuralmente válido.
 * Rojo  (exit 1)  → archivo ausente, JSON malformado o violaciones del schema,
 *                   listadas con su ruta exacta para arreglarlas a mano.
 *
 * Esto valida ESTRUCTURA. Los chequeos de calidad (coordenadas fuera de
 * Colombia, datos > 72 h, duplicados no fusionados…) son capa aparte:
 * el skill /validate-data, que corre encima de este script.
 */
import fs from 'node:fs';
import { ArchivoSitiosSchema } from './schema.js';
import { RUTA_SITIOS_JSON } from './lib/paths.js';

function fallar(mensaje: string): never {
  console.error(`\n✗ VALIDACIÓN FALLIDA — ${mensaje}`);
  process.exit(1);
}

console.log(`Validando ${RUTA_SITIOS_JSON} …`);

if (!fs.existsSync(RUTA_SITIOS_JSON)) {
  fallar(
    `no existe ${RUTA_SITIOS_JSON}.\n` +
      '  El archivo inicial se crea en F1; los datos reales llegan con F2 (npm run import:sheet).',
  );
}

let crudo: string;
try {
  crudo = fs.readFileSync(RUTA_SITIOS_JSON, 'utf8');
} catch (e) {
  fallar(`no se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`);
}

let dato: unknown;
try {
  dato = JSON.parse(crudo);
} catch (e) {
  fallar(`el archivo no es JSON válido: ${e instanceof Error ? e.message : String(e)}`);
}

const resultado = ArchivoSitiosSchema.safeParse(dato);

if (!resultado.success) {
  console.error(`\n✗ VALIDACIÓN FALLIDA — ${resultado.error.issues.length} problema(s) de schema:\n`);
  for (const issue of resultado.error.issues) {
    const ruta = issue.path.length > 0 ? issue.path.map(String).join('.') : '(raíz del archivo)';
    console.error(`  ✗ ${ruta}: ${issue.message}`);
  }
  console.error('\n  Schema canónico: /scraper/src/schema.ts (contrato: docs/MASTER_PROMPT.md)');
  process.exit(1);
}

const { actualizado, sitios } = resultado.data;
const manuales = sitios.filter((s) => s.manual).length;
const sinCoordenadas = sitios.filter((s) => s.lat === null || s.lng === null).length;

console.log('\n✓ VÁLIDO');
console.log(`  Sitios: ${sitios.length} (manuales: ${manuales} · sin coordenadas: ${sinCoordenadas})`);
console.log(`  Actualizado: ${actualizado}`);
process.exit(0);
