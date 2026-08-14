/**
 * Utilidades de texto puras (sin datos, sin efectos). Se usan tanto en build
 * time (server) como en el cliente (búsqueda sin tildes).
 */

/** Minúsculas y sin tildes/diacríticos: "Bogotá" → "bogota". */
export function sinTildes(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Slug estable para URLs: "Santa Marta" → "santa-marta". */
export function slugCiudad(nombre: string): string {
  return sinTildes(nombre.trim()).replace(/[^a-z0-9]+/g, "-");
}

/**
 * "hace 3 h" / "hace 2 días" (microcopy DESIGN.md §6), calculado EN BUILD
 * respecto del momento de la build — en W2 no hay relojes en el cliente.
 */
export function haceTexto(iso: string, ahora: Date): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const horas = Math.max(0, Math.floor((ahora.getTime() - t) / 3_600_000));
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 48) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} días`;
}
