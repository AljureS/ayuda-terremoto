/**
 * Normalización de texto — utilidades puras.
 *
 * Base compartida por la generación de slugs (lib/slug.ts) y por el dedupe
 * por nombre (F5). Nota: aquí NO se quitan muletillas tipo "punto de acopio";
 * eso es una regla específica del dedupe y vivirá en F5, encima de esto.
 */

/** Quita tildes y diacríticos: "Bogotá" → "Bogota", "Peñalosa" → "Penalosa" (ñ → n). */
export function quitarTildes(texto: string): string {
  // NFD separa cada letra de sus diacríticos; \p{M} (categoría Mark de
  // Unicode) elimina las marcas combinantes resultantes (tilde, diéresis,
  // virgulilla…), dejando la letra base.
  return texto.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Minúsculas, sin tildes, sin puntuación (reemplazada por espacio),
 * espacios colapsados. Idempotente.
 *
 *   "Cruz Roja — Sede Ppal. (Cra. 4 #22-61)" → "cruz roja sede ppal cra 4 22 61"
 */
export function normalizarTexto(texto: string): string {
  return quitarTildes(texto.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
