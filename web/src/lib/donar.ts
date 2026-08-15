import type { SitioVista } from "./tipos";

/** Primera URL http(s) dentro de un texto libre (descripciones de la hoja). */
export const RE_URL = /https?:\/\/[^\s)]+/;

/**
 * URL de donación de una campaña de dinero: web → instagram → URL dentro de
 * la descripción. Módulo puro (sin datos): lo usan build y componentes.
 *
 * MISMA COMPUERTA QUE "Cómo llegar" (DESIGN.md §3/§11, W6/P5): la acción
 * primaria existe solo en `estado: activo`. Aquí lo que se pierde cuando una
 * campaña cerrada sigue ofreciendo "Dona aquí" es dinero de la gente. La
 * campaña no desaparece de /campanas: se queda completa, sin el botón.
 *
 * Efecto deliberado en build: `datos.ts` usa este mismo resultado para no
 * imprimir dos veces la URL de donación. Sin botón, la URL se queda una sola
 * vez dentro del texto de la descripción — se sigue viendo exactamente una vez.
 */
export function hrefDonar(s: SitioVista): string | undefined {
  if (s.estado !== "activo") return undefined;
  if (!s.categorias.includes("dinero")) return undefined;
  return s.web ?? s.instagram ?? s.descripcion.match(RE_URL)?.[0];
}
