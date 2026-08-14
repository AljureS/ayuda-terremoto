import { direccionCardinal, distanciaHablada, formatoDistancia } from "@/lib/geo";

/**
 * EL RIEL DE RUMBO — elemento distintivo aprobado (DESIGN.md §4).
 *
 * Columna derecha fija de la tarjeta, en mono: la flecha del rumbo geográfico
 * REAL (bearing inicial usuario→sitio, norte arriba — el mismo marco del mapa)
 * sobre la distancia. Aparece SOLO cuando la persona ejerce la acción privada
 * de compartir su ubicación: es la recompensa visible de que la promesa de
 * privacidad es real. Sin ubicación, la columna sigue reservada y vacía
 * (`RielVacio`), así la geometría de la tarjeta nunca salta.
 *
 * Cuesta 0 KB de assets: un SVG propio de 1 path + el mono del sistema.
 * La cifra siempre manda; la flecha solo acompaña (DESIGN.md §4, riesgo
 * asumido y mitigado con el texto para lectores de pantalla).
 */

/** Ancho reservado desde W2: 56 px (`w-14`). Con distancias largas la columna
 * crece (min-w) en vez de partir la cifra; el nombre usa `break-words`. */
const CLASE_COLUMNA = "flex min-w-14 shrink-0 flex-col items-end";

export function Riel({ metros, rumbo }: { metros: number; rumbo: number }) {
  return (
    <p
      className={`${CLASE_COLUMNA} whitespace-nowrap`}
      data-riel
      title="Dirección desde tu ubicación, norte arriba"
    >
      {/* Un solo texto para lectores de pantalla — "a 1,2 kilómetros,
          dirección noreste" (DESIGN.md §8); las piezas visuales van
          aria-hidden para no leerlas dos veces. */}
      <span className="sr-only">
        {distanciaHablada(metros)}, dirección {direccionCardinal(rumbo)}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        className="riel-flecha fill-current"
        /* Rotación = rumbo real. Es el único estilo inline del sistema: el
           valor es un dato por tarjeta, no un color (DESIGN.md §9 prohíbe
           hex inline, no geometría calculada). */
        style={{ transform: `rotate(${rumbo.toFixed(1)}deg)` }}
      >
        <path d="M12 2.5 18.5 20.5 12 16.4 5.5 20.5Z" />
      </svg>
      <span
        aria-hidden="true"
        className="font-mono text-tarjeta font-semibold tabular-nums"
      >
        {formatoDistancia(metros)}
      </span>
    </p>
  );
}

/** La columna reservada mientras no hay ubicación (idéntica a W2). */
export function RielVacio() {
  return <span aria-hidden="true" className={CLASE_COLUMNA} data-riel />;
}
