/**
 * `npm run build:data` — F5: el pipeline completo del contrato en una sola
 * corrida:
 *
 *   import:sheet → scrape → MERGE con dedupe (src/merge.ts) → geocode
 *   → validación final zod → reporte consolidado
 *
 * NOTA DE ORDEN (documentada también en el README): el contrato enuncia
 * "geocodificar → dedupe → merge"; aquí geocode corre DESPUÉS del merge
 * porque opera sobre /data/sitios.json ya fusionado — una sola pasada de
 * geocodificación cubre también los sitios nuevos del staging, y las
 * direcciones ya publicadas conservan su entrada de caché (0 requests).
 * Funcionalmente equivalente; operativamente más simple.
 *
 * FALLA LIMPIO POR FASE: cada error dice en qué fase murió y /data/sitios.json
 * queda en el último estado CONSISTENTE (cada fase escribe con
 * zod → orden determinista → atómico, o no escribe nada):
 *   · import:sheet falla → se aborta; el archivo queda como estaba.
 *   · scrape falla (ErrorDePatron, red, robots) → NO aborta: se sigue con el
 *     staging previo si existe (aviso de antigüedad) o sin registros del
 *     scraper; el propio scrape es all-or-nothing y jamás corrompe su staging.
 *   · merge falla → no escribe; queda el estado que dejó import:sheet (válido).
 *   · geocode falla (p. ej. rate limit) → lo ya resuelto quedó escrito y en
 *     caché; se reporta y el pipeline termina con error para que se reintente.
 *
 * IDEMPOTENCIA (gate de F5): una segunda corrida sin cambios en las fuentes
 * deja sitios.json byte-idéntico. El merge restaura los timestamps de todo
 * registro cuyo CONTENIDO no cambió respecto al inicio de la corrida — así el
 * churn interno del import (re-altas de filas de la hoja que el dedupe vuelve
 * a fusionar, campos que el merge re-aplica) no mueve ni un byte del archivo.
 *
 * INVARIANTE CENTRAL: ningún registro manual:true se modifica ni se elimina.
 * Además de que merge.ts lo garantiza por construcción, aquí se VERIFICA
 * comparando byte a byte los manuales del estado inicial contra el resultado;
 * si la verificación falla, no se escribe nada y el pipeline muere en rojo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ZodError } from 'zod';
import { ArchivoSitiosSchema, CATEGORIAS } from './schema.js';
import type { ArchivoSitios, Sitio } from './schema.js';
import { ahoraBogota } from './lib/time.js';
import { RAIZ_REPO, RUTA_ESTADO_PIPELINE, RUTA_SITIOS_JSON } from './lib/paths.js';
import { escribirSitios, ordenarArchivo } from './lib/sitios-file.js';
import { RUTA_SCRAPED } from './scrape.js';
import { fusionarConStaging, type ResultadoFusion } from './merge.js';
import { FUENTES } from './sources.js';
import { escribirEstadoPipeline, VERSION_LATIDO } from './estado-pipeline.js';

const DIR_SCRAPER = path.join(RAIZ_REPO, 'scraper');
const SEP = '─'.repeat(72);

class ErrorDeFase extends Error {
  constructor(
    public fase: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeFase';
  }
}

// ───────────────────────── Utilidades ─────────────────────────

/** Corre un comando npm del contrato con la salida en vivo; devuelve su exit code. */
function correrComando(nombre: string): number {
  const r = spawnSync('npm', ['run', '--silent', nombre], {
    cwd: DIR_SCRAPER,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.error) {
    console.error(`✗ no pude ejecutar \`npm run ${nombre}\`: ${r.error.message}`);
    return 1;
  }
  return r.status ?? 1;
}

function banner(fase: string, titulo: string): void {
  console.log(`\n${SEP}`);
  console.log(`FASE ${fase}`);
  if (titulo) console.log(`  ${titulo}`);
  console.log(SEP);
}

function leerSitios(ruta: string): ArchivoSitios | null {
  if (!fs.existsSync(ruta)) return null;
  const crudo: unknown = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const parseado = ArchivoSitiosSchema.safeParse(crudo);
  if (!parseado.success) {
    const detalles = parseado.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
      .join(' · ');
    throw new Error(`${ruta} no valida contra el schema: ${detalles}`);
  }
  return parseado.data;
}

const TS_FIJO = '2000-01-01T00:00:00-05:00';

/** Forma canónica de UN sitio para comparar (claves y arrays en orden fijo). */
function canon(s: Sitio): string {
  return JSON.stringify(ordenarArchivo({ actualizado: TS_FIJO, sitios: [s] }).sitios[0]);
}

/** Igual que canon() pero ignorando ultimaActualizacion. */
function canonSinTs(s: Sitio): string {
  return canon({ ...s, ultimaActualizacion: TS_FIJO });
}

const CAMPOS_DIFF = [
  'nombre', 'categorias', 'descripcion', 'direccion', 'ciudad', 'localidad',
  'lat', 'lng', 'horario', 'contacto', 'fuente', 'estado', 'verificado', 'manual',
] as const;

function camposCambiados(a: Sitio, b: Sitio): string[] {
  return CAMPOS_DIFF.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

// ───────────────────────── Programa principal ─────────────────────────

async function main(): Promise<void> {
  const inicioMs = Date.now();
  const ahora = ahoraBogota();
  console.log('build:data — F5: pipeline completo (import → scrape → merge+dedupe → geocode → validar)');
  console.log(`  fuente única de verdad: ${RUTA_SITIOS_JSON}`);

  const avisos: string[] = [];

  // ── Fase 0 · preflight: estado inicial ──
  // Los BYTES exactos del archivo al arrancar: al cerrar la corrida se comparan
  // con los de salida para saber si esta pasada modificó sitios.json (campo
  // `huboCambios` del latido). Byte a byte y no "contenido equivalente" a
  // propósito: es la misma verdad que verá `git diff` en el commit.
  const bytesIniciales = fs.existsSync(RUTA_SITIOS_JSON)
    ? fs.readFileSync(RUTA_SITIOS_JSON, 'utf8')
    : null;

  let state0: ArchivoSitios;
  try {
    state0 = leerSitios(RUTA_SITIOS_JSON) ?? { actualizado: ahora, sitios: [] };
  } catch (e) {
    throw new ErrorDeFase(
      'preflight',
      `el /data/sitios.json ACTUAL no es válido — no se ejecuta nada hasta arreglarlo a mano.\n  ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const manuales0 = state0.sitios.filter((s) => s.manual);
  console.log(`  estado inicial: ${state0.sitios.length} sitios (manuales: ${manuales0.length})`);

  // ── Fase 1 · import:sheet ──
  banner('1/5 · import:sheet', 'hoja comunitaria → merge sobre sitios.json (jamás toca manual:true)');
  if (correrComando('import:sheet') !== 0) {
    throw new ErrorDeFase('import:sheet', 'la importación falló; /data/sitios.json queda como estaba (el importador es all-or-nothing).');
  }

  // ── Fase 2 · scrape ──
  banner('2/5 · scrape', 'fuentes oficiales → staging cache/scraped.json (all-or-nothing)');
  const scrapeFallo = correrComando('scrape') !== 0;
  if (scrapeFallo) {
    avisos.push(
      'scrape FALLÓ (patrón roto, robots.txt o red). El pipeline continúa con el staging previo: ' +
        'un artículo caído no borra puntos ya conocidos. Revisar el error de arriba y actualizar el parser.',
    );
    console.error('\n⚠ scrape falló — se continúa con el staging previo (si existe). Ver aviso en el reporte final.');
  }

  // ── Fase 3 · merge con dedupe ──
  banner('3/5 · merge', 'staging → sitios.json con dedupe (manual:true intocable)');
  let resultado: ResultadoFusion;
  try {
    const state1 = leerSitios(RUTA_SITIOS_JSON) ?? { actualizado: ahora, sitios: [] };

    let staging: Sitio[] = [];
    try {
      const archivoStaging = leerSitios(RUTA_SCRAPED);
      if (archivoStaging === null) {
        avisos.push(`no existe ${RUTA_SCRAPED}: merge sin registros del scraper`);
      } else {
        staging = archivoStaging.sitios;
        console.log(`  staging: ${staging.length} registros oficiales (actualizado ${archivoStaging.actualizado})`);
      }
    } catch (e) {
      avisos.push(`staging ilegible (${e instanceof Error ? e.message : String(e)}): merge sin registros del scraper`);
    }

    resultado = fusionarConStaging(state1.sitios, staging);

    // Restauración de timestamps: contenido igual al inicio → timestamp del
    // inicio (idempotencia sin churn); contenido distinto o nuevo → ahora.
    const porId0 = new Map(state0.sitios.map((s) => [s.id, s]));
    const finales: Sitio[] = resultado.sitios.map((s) => {
      const s0 = porId0.get(s.id);
      return s0 && canonSinTs(s0) === canonSinTs(s)
        ? { ...s, ultimaActualizacion: s0.ultimaActualizacion }
        : { ...s, ultimaActualizacion: ahora };
    });

    // VERIFICACIÓN DEL INVARIANTE: todo manual del inicio (y del estado
    // post-import) debe llegar byte-idéntico al resultado.
    const finalesPorId = new Map(finales.map((s) => [s.id, s]));
    for (const m of [...manuales0, ...state1.sitios.filter((s) => s.manual)]) {
      const f = finalesPorId.get(m.id);
      if (!f || canon(f) !== canon(m)) {
        throw new Error(
          `INVARIANTE VIOLADA: el registro manual:true "${m.id}" ${f ? 'cambió' : 'desapareció'} durante el merge — NO se escribe nada.`,
        );
      }
    }

    const sinCambios = finales.length === state0.sitios.length &&
      ordenarArchivo({ actualizado: TS_FIJO, sitios: finales }).sitios.every(
        (s, i) => canon(s) === canon(ordenarArchivo({ actualizado: TS_FIJO, sitios: state0.sitios }).sitios[i]!),
      );
    const archivoFinal: ArchivoSitios = {
      actualizado: sinCambios ? state0.actualizado : ahora,
      sitios: finales,
    };

    const disco = JSON.stringify(ordenarArchivo(state1));
    if (JSON.stringify(ordenarArchivo(archivoFinal)) === disco) {
      console.log('  sin cambios respecto al archivo en disco — no se reescribe (timestamps intactos).');
    } else {
      escribirSitios(RUTA_SITIOS_JSON, archivoFinal);
      console.log(`  escrito ${RUTA_SITIOS_JSON} (zod → orden determinista → atómico).`);
    }
    console.log(
      `  merge: overlays mismo id ${resultado.overlays.length} · fusiones ${resultado.fusiones.length} · ` +
        `altas ${resultado.altas.length} · candidatos ${resultado.candidatos.length} · ` +
        `gemelos conservados ${resultado.gemelosConservados.length} · contradicciones con manual ${resultado.contradiccionesManual.length}`,
    );
  } catch (e) {
    if (e instanceof ZodError) {
      const detalle = e.issues.map((i) => `${i.path.map(String).join('.')}: ${i.message}`).join('\n    ');
      throw new ErrorDeFase('merge', `el resultado no valida contra el schema — no se escribió nada:\n    ${detalle}`);
    }
    throw new ErrorDeFase(
      'merge',
      `${e instanceof Error ? e.message : String(e)}\n  /data/sitios.json queda en el estado consistente que dejó import:sheet.`,
    );
  }

  // ── Fase 4 · geocode ──
  banner('4/5 · geocode', 'Nominatim ≤ 1 req/s con caché versionada — llena lat/lng nulos nuevos');
  const geocodeFallo = correrComando('geocode') !== 0;
  if (geocodeFallo) {
    avisos.push(
      'geocode terminó con error (¿rate limit o red?). Lo ya resuelto quedó escrito y en caché; ' +
        're-ejecutar `npm run build:data` (o solo `npm run geocode`) más tarde para completar.',
    );
  }

  // ── Fase 5 · validación final ──
  banner('5/5 · validate', 'validación zod final de /data/sitios.json');
  if (correrComando('validate') !== 0) {
    throw new ErrorDeFase('validate', 'la validación final falló — revisar los errores de arriba.');
  }

  // ── Reporte consolidado (estado inicial → estado final en disco) ──
  const final = leerSitios(RUTA_SITIOS_JSON);
  if (final === null) throw new ErrorDeFase('reporte', 'desapareció /data/sitios.json (no debería ser posible)');

  // ── El LATIDO: se escribe SIEMPRE que la corrida llega hasta aquí ──
  // Aquí = después de que validate pasó (no se afirma "revisado" sobre un
  // archivo que no valida) y antes de imprimir el reporte (queda en disco
  // aunque la impresión se interrumpa). Es lo que permite que la web diga
  // "revisado esta mañana, sin novedades" en vez de "última actualización hace
  // 3 días". Ver src/estado-pipeline.ts para el porqué de cada campo.
  const bytesFinales = fs.readFileSync(RUTA_SITIOS_JSON, 'utf8');
  const latido = escribirEstadoPipeline({
    version: VERSION_LATIDO,
    // Sellado AQUÍ, no con el `ahora` del arranque: geocode corre como
    // subproceso con su propio reloj y puede haber estampado `actualizado`
    // segundos después: un `ultimoCambio` posterior a `ultimaRevision` sería
    // incoherente ("cambió después de que lo revisaran").
    ultimaRevision: ahoraBogota(),
    huboCambios: bytesFinales !== bytesIniciales,
    ultimoCambio: final.actualizado,
    totalSitios: final.sitios.length,
    fuentes: ['hoja-comunitaria', ...FUENTES.map((f) => f.clave)],
    fases: [
      { nombre: 'import:sheet', ok: true }, // si hubiera fallado, el pipeline habría abortado
      { nombre: 'scrape', ok: !scrapeFallo }, // única fase que puede fallar sin tumbar la corrida
      { nombre: 'merge', ok: true }, // idem: un fallo aquí aborta antes de llegar
      { nombre: 'geocode', ok: !geocodeFallo },
      { nombre: 'validate', ok: true }, // llegar hasta aquí ES que pasó
    ],
    avisos,
  });

  const porId0 = new Map(state0.sitios.map((s) => [s.id, s]));
  const porIdFinal = new Map(final.sitios.map((s) => [s.id, s]));
  const nuevos = final.sitios.filter((s) => !porId0.has(s.id));
  const modificados = state0.sitios
    .map((s0) => {
      const f = porIdFinal.get(s0.id);
      return f ? { id: s0.id, campos: camposCambiados(s0, f) } : null;
    })
    .filter((x): x is { id: string; campos: string[] } => x !== null && x.campos.length > 0);
  const descartadosEsperados = new Set(resultado.fusiones.map((f) => f.descartado));
  const desaparecidos = state0.sitios.filter((s) => !porIdFinal.has(s.id));
  const sinCoords = final.sitios.filter((s) => s.lat === null || s.lng === null);
  const sinCoordsNuevos = nuevos.filter((s) => s.lat === null || s.lng === null);

  console.log(`\n${'═'.repeat(72)}`);
  console.log('REPORTE CONSOLIDADO — build:data');
  console.log('═'.repeat(72));
  console.log(
    `TOTAL: ${final.sitios.length} sitios (inicio: ${state0.sitios.length}) · ` +
      `verificados: ${final.sitios.filter((s) => s.verificado).length} · ` +
      `manuales: ${final.sitios.filter((s) => s.manual).length} · sin coordenadas: ${sinCoords.length}`,
  );

  console.log(
    `LATIDO → ${RUTA_ESTADO_PIPELINE}\n` +
      `  revisión de esta corrida: ${latido.ultimaRevision} · ¿cambió sitios.json?: ${latido.huboCambios ? 'SÍ' : 'no'} · ` +
      `último cambio de datos: ${latido.ultimoCambio}\n` +
      `  ${latido.huboCambios
        ? 'Hay cambios que revisar en el diff.'
        : 'Sin novedades: sitios.json quedó byte a byte igual y el latido lo deja por escrito (la web dirá "revisado hoy", no "hace N días").'}`,
  );

  console.log(`\nNUEVOS (${nuevos.length}):`);
  for (const s of nuevos) console.log(`  + ${s.id} — "${s.nombre}" (${s.fuente})`);

  console.log(`\nFUSIONADOS (${resultado.fusiones.length})  [id conservado ← id descartado]:`);
  for (const f of resultado.fusiones) {
    console.log(`  ${f.conservado} ← ${f.descartado} ("${f.nombreDescartado}")`);
    console.log(`      criterio: ${f.criterio}`);
  }
  const desaparecidosRaros = desaparecidos.filter((s) => !descartadosEsperados.has(s.id));
  if (desaparecidosRaros.length > 0) {
    console.log(`  ⚠ desaparecidos SIN fusión que lo explique (bug — revisar): ${desaparecidosRaros.map((s) => s.id).join(', ')}`);
  }

  console.log(`\nOVERLAYS del staging sobre su mismo id (${resultado.overlays.length}):`);
  for (const o of resultado.overlays) console.log(`  ~ ${o.id}: ${o.campos.join(', ')}`);

  console.log(`\nMODIFICADOS respecto al inicio (${modificados.length})  [excluye timestamps]:`);
  for (const m of modificados) console.log(`  ~ ${m.id}: ${m.campos.join(', ')}`);

  console.log(`\nSIN COORDENADAS: ${sinCoords.length} en total (lista completa: docs/UBICAR_A_MANO.md)`);
  if (sinCoordsNuevos.length > 0) {
    console.log(`  nuevos de esta corrida (${sinCoordsNuevos.length}):`);
    for (const s of sinCoordsNuevos) console.log(`    · ${s.id} · ${s.ciudad} · ${s.direccion}`);
  }

  console.log(`\nCANDIDATOS no fusionados — revisión humana (${resultado.candidatos.length}):`);
  for (const c of resultado.candidatos) console.log(`  ? ${c.a} ↔ ${c.b}\n      ${c.motivo}`);

  console.log(`\nGEMELOS de pestaña conservados a propósito (${resultado.gemelosConservados.length}):`);
  for (const g of resultado.gemelosConservados) console.log(`  = ${g.a}  ‖  ${g.b}`);

  console.log(`\nCONTRADICCIONES con manual:true (${resultado.contradiccionesManual.length}):`);
  for (const c of resultado.contradiccionesManual) {
    console.log(`  ⚠ "${c.id}" difiere de su fuente (${c.origen}) en: ${c.campos.join(', ')} — decide la persona mantenedora`);
  }

  console.log('\nPOR CATEGORÍA:');
  for (const cat of CATEGORIAS) {
    const n = final.sitios.filter((s) => s.categorias.includes(cat)).length;
    if (n > 0) console.log(`  ${cat.padEnd(16)} ${n}`);
  }
  const porCiudad = new Map<string, number>();
  for (const s of final.sitios) {
    const clave = s.ciudad || '(sin ciudad — solo lista)';
    porCiudad.set(clave, (porCiudad.get(clave) ?? 0) + 1);
  }
  console.log('CIUDADES (top 8):');
  for (const [ciudad, n] of [...porCiudad.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8)) {
    console.log(`  ${ciudad.padEnd(24)} ${n}`);
  }

  if (avisos.length > 0) {
    console.log('\nAVISOS:');
    for (const a of avisos) console.log(`  ⚠ ${a}`);
  }

  const seg = ((Date.now() - inicioMs) / 1000).toFixed(0);
  console.log(`\nDuración total: ${seg} s`);
  if (geocodeFallo) {
    console.error('\n✗ PIPELINE INCOMPLETO: la fase geocode terminó con error (ver arriba). sitios.json es válido; re-ejecutar más tarde.');
    process.exit(1);
  }
  console.log('\n✓ Pipeline completo en verde. Siguiente paso: revisar el diff de /data/sitios.json y hacer push.');
}

// Ejecutar solo como script (el módulo es importable para pruebas).
const esEjecucionDirecta =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esEjecucionDirecta) {
  main().catch((e: unknown) => {
    if (e instanceof ErrorDeFase) {
      console.error(`\n✗ PIPELINE DETENIDO en la fase «${e.fase}»: ${e.message}`);
    } else {
      console.error(`\n✗ build:data abortó: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    }
    console.error('  /data/sitios.json queda en el último estado consistente (toda escritura es zod → atómica).');
    process.exit(1);
  });
}
