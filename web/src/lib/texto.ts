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
 * Fecha y hora legibles en hora de Bogotá ("13 de agosto de 2026, 7:16 p. m.").
 * Solo para "Acerca de", donde el dato exacto importa más que el "hace X h".
 * Se calcula EN BUILD: la zona se fija a America/Bogota para que el texto no
 * dependa de dónde corra la build.
 */
export function fechaBogota(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  });
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
