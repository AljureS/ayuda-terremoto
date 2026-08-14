/**
 * Copy y semántica de fallos de geolocalización — microcopy EXACTO de
 * DESIGN.md §6 (ley para la UI). Módulo sin JSX a propósito: los textos y el
 * mapeo de errores se pueden verificar directamente, sin montar la UI.
 */

/**
 * Los CUATRO fallos que exige el contrato, mapeados a los TRES textos que
 * DESIGN.md §6 define (lectura deliberada, no una omisión):
 *
 * | Causa real                                    | Detección                      | Fallo           |
 * |-----------------------------------------------|--------------------------------|-----------------|
 * | permiso denegado (PERMISSION_DENIED = 1)      | error.code === 1               | "denegado"      |
 * | timeout (TIMEOUT = 3)                         | error.code === 3               | "no-disponible" |
 * | posición no disponible (POSITION_UNAVAILABLE) | error.code === 2               | "no-disponible" |
 * | no soportado                                  | !navigator.geolocation         | "no-soportado"  |
 * | contexto inseguro (http)                      | !window.isSecureContext        | "no-soportado"  |
 *
 * DESIGN da una sola cadena para "Contexto inseguro / sin soporte" y una sola
 * para "Ubicación no disponible / timeout": son el mismo mensaje útil para la
 * persona (uno dice "este navegador no puede", el otro "intenta con mejor
 * señal"). Las CUATRO causas se detectan por separado; los textos son tres.
 */
export type FalloUbicacion = "denegado" | "no-disponible" | "no-soportado";

/** GeolocationPositionError.code → fallo. Cualquier code desconocido cae en
 * "no-disponible" (el mensaje reintentable, nunca el que culpa al permiso). */
export function falloDeCodigo(code: number): FalloUbicacion {
  if (code === 1) return "denegado";
  return "no-disponible";
}

export const MENSAJE_FALLO: Record<FalloUbicacion, string> = {
  denegado:
    "Sin el permiso, la lista no se puede ordenar por cercanía — pero sigue completa. Busca por dirección o localidad, o activa la ubicación para este sitio en la configuración del navegador.",
  "no-disponible":
    "No se pudo obtener tu ubicación. Intenta de nuevo donde haya mejor señal.",
  "no-soportado":
    "Este navegador no permite usar la ubicación aquí. La lista completa sigue disponible.",
};

/** Pre-permiso: se muestra ANTES del prompt del navegador (nunca al cargar). */
export const TEXTO_PREPERMISO =
  "Para ordenar los puntos del más cercano al más lejano, el navegador va a pedir permiso de ubicación. El cálculo ocurre en tu teléfono: la ubicación no se envía a ningún servidor, no se guarda sin tu permiso y nunca aparece en el enlace.";

export const TEXTO_RECORDAR_UBICACION =
  "Recordar mi ubicación en este dispositivo";

export const TEXTO_RECORDAR_FILTROS = "Recordar mis filtros en este dispositivo";

export const TEXTO_ALMACEN_BLOQUEADO =
  "El navegador no permite guardar preferencias en este dispositivo. Todo funciona igual; los filtros no se recordarán.";

export const TEXTO_CONFIRMAR_BORRADO =
  "Se borrarán los filtros guardados y la ubicación recordada de este dispositivo. El sitio sigue funcionando normal.";

export const TEXTO_BORRADO = "Datos borrados.";

/**
 * Opciones de `getCurrentPosition`. `enableHighAccuracy: false` es coherente
 * con el redondeo a ~11 m (geo.ts) y da un fix mucho más rápido en un Android
 * de gama media; `maximumAge` de 1 min evita re-encender el GPS si el sistema
 * ya tiene un fix reciente.
 */
export const OPCIONES_GEO: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 60_000,
};

/**
 * Evento in-document que dispara "Borrar mis datos" (vive en el pie, fuera del
 * árbol de ListaFiltrada). No transporta ningún dato: es una señal para que la
 * lista apague la ubicación que tiene en memoria. Nunca sale del documento.
 */
export const EVENTO_BORRADO = "ma:datos-borrados";
