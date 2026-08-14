/**
 * Slugs estables kebab-case para el campo `id`.
 *
 * Regla del contrato: el id, una vez publicado, NO se regenera nunca.
 * Esta función solo produce el candidato inicial; la desambiguación
 * (agregar la ciudad) y el chequeo de colisiones contra los ids ya
 * publicados son responsabilidad del llamador (importador F2 / merge F5),
 * porque dependen del contexto.
 */
import { normalizarTexto } from './normalize.js';

/**
 * "Cruz Roja — Sede Centro (Cra. 4 #22-61)" → "cruz-roja-sede-centro-cra-4-22-61"
 *
 * Puede devolver "" si el texto no contiene letras ni dígitos: el llamador
 * debe tratarlo como error (un sitio sin nombre utilizable no genera id).
 */
export function slugify(texto: string): string {
  return normalizarTexto(texto).replace(/ /g, '-');
}
