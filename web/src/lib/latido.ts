/**
 * El LATIDO del pipeline — leído EN BUILD TIME (W9).
 *
 * QUÉ RESUELVE. `sitios.json` trae un solo sello (`actualizado`) y el pipeline
 * es IDEMPOTENTE: si las fuentes no traen novedades no reescribe el archivo, así
 * que ese sello se congela. Derivar de él la frase "la última actualización fue
 * hace N días" hace que tres días tranquilos se lean como abandono, cuando la
 * verdad es que las fuentes se revisaron esta mañana y no había nada nuevo. El
 * latido es un archivo aparte que el pipeline escribe CADA VEZ QUE CORRE (haya
 * o no cambios), y separa las dos verdades: cuándo se revisó y cuándo cambió.
 *
 * SOLO SERVER, como `datos.ts`: este módulo usa `node:fs` y lo importa
 * únicamente `src/lib/datos.ts`, que a su vez solo importan los server
 * components. Si algo del grafo de cliente lo arrastrara, el bundle del
 * navegador fallaría al resolver `fs` — es intencional que falle ruidoso.
 *
 * POR QUÉ `fs` Y NO UN `import` ESTÁTICO. El archivo puede no existir todavía
 * (lo aterriza otro agente, y la web debe compilar igual — regla de oro: /web
 * compila aunque el resto del monorepo no esté). Un `import` estático de un
 * archivo ausente es un error de resolución en tiempo de compilación: rompe la
 * build. `readFileSync` en try/catch degrada a `null` y el aviso vuelve exacto
 * a su comportamiento anterior (derivado del sello de `sitios.json`).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato del archivo `/data/estado-pipeline.json`, DUPLICADO A PROPÓSITO
 * aquí (misma regla que `tipos.ts`: /web no importa nada de /scraper, ni
 * siquiera un tipo). Si el pipeline cambia el schema, se actualiza a mano.
 *
 * Todos los campos se validan en runtime de build antes de usarse: este tipo
 * describe lo que ESPERAMOS, no lo que garantiza el archivo.
 */
export interface EstadoPipeline {
  /** ISO CON offset: cuándo se revisaron las fuentes por última vez. */
  ultimaRevision: string;
  /** ¿Esa última revisión encontró novedades? */
  huboCambios: boolean;
  /** ISO CON offset: cuándo cambiaron los datos por última vez. */
  ultimoCambio: string | null;
}

/**
 * Rutas candidatas, en orden. `next build` corre con cwd = /web (no hay
 * package.json en la raíz del repo, así que no hay otra forma de invocarlo),
 * pero el segundo candidato cubre una build disparada desde la raíz sin costar
 * nada. Misma frontera que el import de `sitios.json`: /data en build time.
 */
const CANDIDATOS = [
  resolve(process.cwd(), "..", "data", "estado-pipeline.json"),
  resolve(process.cwd(), "data", "estado-pipeline.json"),
];

/**
 * ISO con zona horaria explícita (offset o `Z`).
 *
 * El offset NO es un detalle de formato: `new Date("2026-08-15T05:20:00")` —sin
 * offset— se interpreta en la hora LOCAL de la máquina que construye. En el
 * portátil de Bogotá daría una cosa y en el runner de Vercel (UTC) otra, con 5 h
 * de diferencia en un número que la portada imprime como verdad. Un sello así se
 * trata como ausente: preferimos caer al comportamiento anterior antes que
 * publicar un "hace 2 h" que en realidad son 7.
 */
const ISO_CON_ZONA =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function selloValido(v: unknown): v is string {
  return (
    typeof v === "string" &&
    ISO_CON_ZONA.test(v) &&
    !Number.isNaN(Date.parse(v))
  );
}

/**
 * Lee el latido, o `null` si no existe / no es utilizable.
 *
 * NUNCA lanza: un archivo ausente, ilegible, con JSON inválido o con un sello
 * sin zona horaria degrada al mismo `null`. La diferencia es el ruido: el caso
 * "todavía no existe" es normal y calla; el caso "existe pero no sirve" avisa
 * por consola una sola línea, porque si no la persona mantenedora tendría un
 * archivo que cree que funciona y una portada que lo ignora en silencio.
 */
let memo: { valor: EstadoPipeline | null } | undefined;

export function leerLatido(): EstadoPipeline | null {
  // Memoizado por proceso: `prepararDatos()` corre una vez por página (4 rutas)
  // y el archivo no cambia a mitad de una build. De paso, el aviso de archivo
  // inservible se imprime una vez y no cuatro.
  if (!memo) memo = { valor: leerLatidoDelDisco() };
  return memo.valor;
}

function leerLatidoDelDisco(): EstadoPipeline | null {
  const ruta = CANDIDATOS.find((p) => existsSync(p));
  if (!ruta) return null; // Normal mientras el pipeline no lo publique.

  let crudo: unknown;
  try {
    crudo = JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(
      `[latido] ${ruta} existe pero no se pudo leer (${(e as Error).message}). ` +
        `El aviso de la portada usa el sello de sitios.json.`,
    );
    return null;
  }

  if (typeof crudo !== "object" || crudo === null) return null;
  const o = crudo as Record<string, unknown>;

  if (!selloValido(o.ultimaRevision)) {
    console.warn(
      `[latido] ${ruta} no trae un 'ultimaRevision' ISO con zona horaria ` +
        `(recibido: ${JSON.stringify(o.ultimaRevision)}). El aviso de la ` +
        `portada usa el sello de sitios.json.`,
    );
    return null;
  }

  return {
    ultimaRevision: o.ultimaRevision,
    huboCambios: o.huboCambios === true,
    // `ultimoCambio` es OPCIONAL para nosotros: si falta o viene sin zona, el
    // sello `actualizado` de sitios.json dice exactamente lo mismo —el pipeline
    // solo lo reescribe cuando hubo cambios (scraper/src/import-sheet.ts:866,
    // `actualizado: huboCambios ? ahora : existente.actualizado`)—, así que
    // datos.ts cae a él sin perder ninguna verdad.
    ultimoCambio: selloValido(o.ultimoCambio) ? o.ultimoCambio : null,
  };
}
