/**
 * Distancia Haversine en METROS — utilidad pura.
 *
 * Uso en el pipeline: regla de dedupe del contrato ("dos registros a < 100 m
 * con una categoría en común son el mismo sitio", F5). La web implementará su
 * propia copia en el cliente (regla de oro: cero código compartido).
 */
const RADIO_TIERRA_M = 6_371_000;

function grados_a_radianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/** Distancia del círculo máximo entre dos coordenadas WGS84, en metros. */
export function haversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = grados_a_radianes(lat2 - lat1);
  const dLng = grados_a_radianes(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(grados_a_radianes(lat1)) * Math.cos(grados_a_radianes(lat2)) * Math.sin(dLng / 2) ** 2;
  // min(1, a) protege a asin/sqrt de errores de redondeo en puntos antipodales.
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(Math.min(1, a)));
}
