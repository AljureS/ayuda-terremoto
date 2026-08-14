/**
 * Geometría de ubicación — funciones PURAS que corren 100 % en el cliente.
 *
 * Arquitectura §4 (frontera de confianza): la promesa del banner es literal
 * porque es estructural — la posición del usuario entra a estas funciones
 * desde la memoria de React y el resultado (distancia, rumbo) se pinta en su
 * propia pantalla. No hay red, no hay URL, no hay logs, no hay terceros.
 */

/**
 * Posición del usuario. Vive SOLO en memoria de React (estado de
 * ListaFiltrada) y, únicamente con el opt-in "recordar mi ubicación", en
 * localStorage (src/lib/almacen.ts). Nada más la ve.
 */
export interface Posicion {
  lat: number;
  lng: number;
}

/**
 * Redondeo de privacidad: 4 decimales ≈ 11 m. Se aplica en el instante en que
 * el navegador entrega el fix (src/components/Ubicacion.tsx): el
 * `GeolocationPosition` completo existe solo dentro de esa callback y no se
 * retiene en ninguna parte — lo único que se guarda en estado (y, con opt-in,
 * en localStorage) es este par redondeado. Para ordenar puntos de acopio a
 * escala de ciudad, ±11 m es precisión de sobra.
 */
export function redondearPosicion(lat: number, lng: number): Posicion {
  const r = (v: number) => Math.round(v * 10_000) / 10_000;
  return { lat: r(lat), lng: r(lng) };
}

/** Radio medio terrestre (IUGG) en metros. */
const RADIO_TIERRA_M = 6_371_008.8;

const rad = (grados: number) => (grados * Math.PI) / 180;

/** Distancia Haversine en metros entre la posición del usuario y un sitio. */
export function distanciaM(p: Posicion, lat: number, lng: number): number {
  const dLat = rad(lat - p.lat);
  const dLng = rad(lng - p.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(p.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(Math.min(1, s)));
}

/**
 * Rumbo geográfico inicial usuario→sitio en grados [0, 360): 0 = norte,
 * sentido horario — el mismo marco norte-arriba del mapa (DESIGN.md §4).
 */
export function rumboGrados(p: Posicion, lat: number, lng: number): number {
  const f1 = rad(p.lat);
  const f2 = rad(lat);
  const dLng = rad(lng - p.lng);
  const y = Math.sin(dLng) * Math.cos(f2);
  const x =
    Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Formato de distancia del riel (DESIGN.md §4): menos de 1 km en metros
 * ("850 m"); desde 1 km, kilómetros con 1 decimal y coma decimal ("1,2 km").
 */
export function formatoDistancia(m: number): string {
  const metros = Math.round(m);
  if (metros < 1000) return `${metros} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Versión hablada para aria-label: "a 850 metros" / "a 1,2 kilómetros". */
export function distanciaHablada(m: number): string {
  const metros = Math.round(m);
  if (metros < 1000) return `a ${metros} metros`;
  return `a ${(m / 1000).toFixed(1).replace(".", ",")} kilómetros`;
}

/** 8 sectores de 45° centrados en cada punto cardinal, para el aria-label
 * del riel ("dirección noreste" — DESIGN.md §8). */
const CARDINALES = [
  "norte",
  "noreste",
  "este",
  "sureste",
  "sur",
  "suroeste",
  "oeste",
  "noroeste",
] as const;

export function direccionCardinal(grados: number): string {
  return CARDINALES[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
}
