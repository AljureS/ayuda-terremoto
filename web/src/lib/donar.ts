import type { SitioVista } from "./tipos";

/** Primera URL http(s) dentro de un texto libre (descripciones de la hoja). */
export const RE_URL = /https?:\/\/[^\s)]+/;

/**
 * URL de donación de una campaña de dinero: web → instagram → URL dentro de
 * la descripción. Módulo puro (sin datos): lo usan build y componentes.
 */
export function hrefDonar(s: SitioVista): string | undefined {
  if (!s.categorias.includes("dinero")) return undefined;
  return s.web ?? s.instagram ?? s.descripcion.match(RE_URL)?.[0];
}
