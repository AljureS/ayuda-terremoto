/**
 * EL LATIDO DEL PIPELINE — schema y escritura de /data/estado-pipeline.json.
 *
 * QUÉ RESUELVE. `sitios.json` trae un solo sello (`actualizado`) y el pipeline
 * es idempotente a propósito: si las fuentes no traen novedades, el archivo no
 * se reescribe y ese sello se congela (eso es lo que mantiene el diff diario de
 * git legible — decisión #8). Pero desde que el pipeline corre solo todos los
 * días (.github/workflows/actualizar-datos.yml), congelar el sello vuelve
 * ambigua la única frase que la web le dice a la gente sobre frescura: tres
 * días tranquilos se leen como "proyecto abandonado" cuando la verdad es
 * "revisamos las fuentes esta mañana y no había nada nuevo". La segunda
 * afirmación es la honesta y la más tranquilizadora, y hasta hoy el sistema no
 * podía hacerla porque no guardaba ese hecho en ninguna parte.
 *
 * Este archivo guarda ese hecho: CUÁNDO SE REVISÓ, separado de CUÁNDO CAMBIÓ.
 *
 * POR QUÉ ARCHIVO APARTE Y NO UN CAMPO DE sitios.json. Un timestamp de revisión
 * dentro de sitios.json cambiaría el archivo TODOS LOS DÍAS aunque no hubiera
 * novedades, y costaría las dos propiedades que más trabajo costó ganar:
 *   1. idempotencia byte a byte (`shasum` igual entre corridas sin novedades), y
 *   2. un `git diff` diario que solo muestra cambios SIGNIFICATIVOS — la
 *      herramienta de revisión de la persona mantenedora.
 * Separarlos cuesta un archivo de ~20 líneas y los conserva los dos.
 *
 * QUIÉN LO ESCRIBE. Solo `build-data.ts` (`npm run build:data`), una vez por
 * corrida, al final y solo después de que `validate` pasó: el latido afirma
 * "revisé las fuentes y el resultado es válido", así que no se escribe sobre un
 * archivo que no valida. Las fases sueltas (`geocode`, `scrape`…) no lo tocan.
 *
 * QUIÉN LO LEE. `/web` en build time, con su propio tipo duplicado a propósito
 * (regla de oro: las dos mitades del repo solo se hablan por /data). La web
 * TOLERA que el archivo no exista: si falta, cae al sello de sitios.json. Por
 * eso este módulo puede aterrizar sin coordinación de despliegue.
 */
import { z } from 'zod';
import { timestampBogota } from './schema.js';
import { escribirJsonAtomico } from './lib/sitios-file.js';
import { RUTA_ESTADO_PIPELINE } from './lib/paths.js';

/**
 * Versión de la FORMA del archivo. La web lo lee con un tipo duplicado a mano;
 * si algún día este schema cambia de forma, este número sube y quien lee puede
 * detectarlo sin adivinar. Agregar un campo nuevo no es cambio de forma.
 */
export const VERSION_LATIDO = 1 as const;

/** Una fase del pipeline y si terminó bien. `scrape` puede fallar sin tumbar la corrida. */
export const FaseSchema = z.strictObject({
  nombre: z.string().min(1),
  ok: z.boolean(),
});

/**
 * El latido completo. strictObject igual que el schema de sitios: una clave
 * desconocida (un typo en una edición a mano) falla en vez de pasar callada.
 */
export const EstadoPipelineSchema = z.strictObject({
  version: z.literal(VERSION_LATIDO),

  /**
   * CUÁNDO SE REVISARON LAS FUENTES en esta corrida. Es el campo que da sentido
   * a todo el archivo y el único que la web exige. Se sella en el INSTANTE DE
   * ESCRIBIR (final de la corrida), no al arrancar: así nunca queda por detrás
   * de `ultimoCambio`, que lo estampan fases que corren después del arranque
   * (geocode es un subproceso con su propio reloj). "El dato cambió después de
   * la revisión que lo trajo" sería incoherente a simple vista.
   */
  ultimaRevision: timestampBogota,

  /**
   * ¿Esta corrida modificó /data/sitios.json? Se calcula comparando el archivo
   * BYTE A BYTE antes y después (build-data.ts), que es la misma verdad que
   * verá `git diff` en el commit: no hay forma de que el latido diga una cosa
   * y el historial otra.
   */
  huboCambios: z.boolean(),

  /**
   * CUÁNDO CAMBIARON LOS DATOS por última vez = el sello `actualizado` del
   * sitios.json ya validado de esta corrida. No se arrastra a mano del latido
   * anterior: ese sello YA ES el valor arrastrado (el pipeline solo lo mueve
   * cuando hubo cambios), y derivarlo de una sola fuente tiene tres ventajas
   * duras: no puede desincronizarse del dato publicado, no retrocede, y recoge
   * también las ediciones a mano (`/estado`, `/nuevo-sitio`) que cambian los
   * datos sin pasar por el pipeline — el caso más frecuente de la emergencia.
   * nullable por contrato con quien lee (la web lo trata como opcional);
   * en la práctica siempre viene poblado.
   */
  ultimoCambio: timestampBogota.nullable(),

  // ── Diagnóstico (la web los ignora; son para la persona mantenedora) ──

  /** Sitios publicados al cerrar la corrida. */
  totalSitios: z.number().int().min(0),

  /**
   * Las fuentes que la corrida INTENTA consultar en cada pasada (la hoja
   * comunitaria + las claves de src/sources.ts). Deliberadamente NO se llama
   * "consultadas" ni lleva un ok por fuente: `import:sheet` puede caer al
   * snapshot CSV versionado sin tocar la red, y `scrape` es all-or-nothing
   * (si una fuente falla no se escribe staging), así que un ok por fuente
   * afirmaría algo que esta capa no sabe. El estado real vive en `fases`.
   */
  fuentes: z.array(z.string().min(1)),

  /** Cómo le fue a cada fase del pipeline, en orden de ejecución. */
  fases: z.array(FaseSchema).min(1),

  /** Avisos de la corrida (p. ej. "scrape FALLÓ: se siguió con el staging previo"). */
  avisos: z.array(z.string()),
});

export type Fase = z.infer<typeof FaseSchema>;
export type EstadoPipeline = z.infer<typeof EstadoPipelineSchema>;

/**
 * Orden determinista de las claves (mismo criterio que sitios-file.ts): el
 * literal fija el orden de serialización y obliga —por tipado exhaustivo— a
 * tocar esta función si el schema gana un campo. El diff diario de este archivo
 * tiene que ser de UNA línea (`ultimaRevision`) en un día sin novedades.
 */
function ordenarEstado(e: EstadoPipeline): EstadoPipeline {
  return {
    version: e.version,
    ultimaRevision: e.ultimaRevision,
    huboCambios: e.huboCambios,
    ultimoCambio: e.ultimoCambio,
    totalSitios: e.totalSitios,
    fuentes: e.fuentes,
    fases: e.fases.map((f) => ({ nombre: f.nombre, ok: f.ok })),
    avisos: e.avisos,
  };
}

/**
 * Escribe el latido por el camino obligatorio del proyecto: zod → orden
 * determinista → escritura atómica (tmp + rename, reutilizando el helper de
 * lib/sitios-file.ts). Lanza ZodError si el dato no valida, y en ese caso NO
 * toca el archivo existente.
 */
export function escribirEstadoPipeline(
  dato: unknown,
  ruta: string = RUTA_ESTADO_PIPELINE,
): EstadoPipeline {
  const valido = EstadoPipelineSchema.parse(dato);
  const ordenado = ordenarEstado(valido);
  escribirJsonAtomico(ruta, ordenado);
  return ordenado;
}
