/**
 * Timestamps con offset fijo de Bogotá (UTC−05:00, Colombia no tiene DST).
 */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

/**
 * Ahora (o la fecha dada) como ISO 8601 con offset −05:00, sin milisegundos:
 * "2026-08-12T09:30:00-05:00". Formato exigido por el schema para
 * `actualizado` y `ultimaActualizacion`.
 */
export function ahoraBogota(fecha: Date = new Date()): string {
  const desplazada = new Date(fecha.getTime() - OFFSET_BOGOTA_MS);
  return `${desplazada.toISOString().slice(0, 19)}-05:00`;
}
