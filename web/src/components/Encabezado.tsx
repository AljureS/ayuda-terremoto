import { Fragment } from "react";

import { construirAviso, type Frescura } from "@/lib/aviso";

import { BorrarDatos } from "./BorrarDatos";

/**
 * Aviso de actualización (W8, reescrito en W9) — el ritmo, los sellos reales y
 * el llamado a verificar, en un bloque de contexto.
 *
 * QUÉ CAMBIÓ EN W9. El aviso de W8 se derivaba de un solo sello, el
 * `actualizado` de sitios.json. Pero el pipeline es IDEMPOTENTE: si las
 * fuentes no traen novedades no reescribe el archivo, así que ese sello se
 * congela, y tras tres días tranquilos la portada decía "pero la última fue
 * hace 3 días" — que se lee como abandono cuando la verdad es que las fuentes
 * se revisaron esta mañana y no había nada nuevo. Ahora el aviso separa las
 * dos verdades (revisión ≠ cambio) leyendo el latido del pipeline. La lógica
 * de qué frase decir vive en `lib/aviso.ts`, PURA y probable con fixtures; este
 * componente solo la dibuja.
 *
 * DÓNDE Y POR QUÉ (decisión de W8, intacta): en el encabezado, pegado al
 * banner de privacidad. Los dos son avisos permanentes que enmarcan la lista
 * sin competir con ella (DESIGN.md §0: "es contexto, no alarma"), y comparten
 * forma —ⓘ + texto secundario— para que se lean como lo que son. La otra sede
 * candidata era junto al conteo honesto, y se descartó por una razón medible:
 * en móvil la vista mapa esconde TODO ese bloque (`enMapaMovil ? "hidden
 * lg:block"` en ListaFiltrada), así que el aviso desaparecería justo cuando la
 * persona está eligiendo un punto en el mapa. Aquí se ve en las dos vistas, en
 * móvil y en escritorio, y no toca el `aria-live` del conteo.
 *
 * COSTO: 0 B de JS. Es un server component puro; todo esto se resuelve en la
 * build y viaja como texto en el HTML.
 *
 * SIN MONO, a propósito: DESIGN.md §2 reserva el mono para cifras operativas y
 * cierra con "si aparece en prosa, es un error de implementación". Esto es
 * prosa. Los `<time>` no cambian un píxel: llevan el instante absoluto en el
 * atributo, que —a diferencia del texto relativo, congelado en la build— no
 * envejece.
 */
export function AvisoActualizacion(frescura: Frescura) {
  const aviso = construirAviso(frescura);
  return (
    <p
      data-aviso="actualizacion"
      // La rama elegida, legible desde fuera: las pruebas de las cuatro (seis)
      // ramas y la auditoría afirman sobre este atributo y no sobre la prosa,
      // así que reescribir el copy no rompe una prueba de lógica. Son 30 B de
      // HTML estático, sin JS.
      data-caso={aviso.caso}
      className="mt-2 flex items-start gap-1.5 text-sec text-secundario"
    >
      {/* El ícono es decoración: `aria-hidden` y jamás canal único — todo lo
          que informa está en el texto (DESIGN.md §8). Y NO lleva role="alert":
          esto es contexto permanente, no una interrupción. */}
      <span aria-hidden="true">ⓘ</span>
      <span>
        {aviso.segmentos.map((s, i) =>
          typeof s === "string" ? (
            <Fragment key={i}>{s}</Fragment>
          ) : (
            <time key={i} dateTime={s.iso}>
              {s.hace}
            </time>
          ),
        )}{" "}
        {/* DESVIACIÓN DECLARADA de DESIGN.md §6, para el director (heredada de
            W8): la cadena canónica es "Verifica el punto antes de desplazarte:
            los horarios y las necesidades cambian rápido." Aquí va SIN la cola
            explicativa. La razón es medida, no estética: con la cola, el aviso
            gana una línea a 320 px y empuja la primera tarjeta otros 22 px
            hacia abajo. La cola explica POR QUÉ hay que verificar; la orden
            está entera en la mitad que se conserva, y la frase completa sigue
            literal en /acerca, que es a quien §6 se la asigna. */}
        <strong className="font-medium text-tinta">{aviso.orden}</strong>
      </span>
    </p>
  );
}

/**
 * Encabezado del sitio (1 sola vez por página, no sticky — DESIGN.md §3) con
 * el banner de privacidad permanente que exige el contrato.
 *
 * El texto del banner es LITERAL y sigue siendo cierto tras W4: la posición
 * del usuario solo existe en memoria (y en su propio localStorage si él lo
 * pide); no hay ninguna ruta de código que la envíe a un servidor.
 *
 * `frescura` (W8) lo pasa SOLO la portada: es la página donde se decide a
 * dónde ir. /campanas, /acerca y la 404 no lo pasan y el aviso no se dibuja.
 * El tipo lo define `lib/aviso.ts`, no este archivo: aquí solo se dibuja.
 */
export function Encabezado({
  h1,
  frescura,
}: {
  h1: string;
  frescura?: Frescura;
}) {
  return (
    <header className="mx-auto w-full max-w-6xl px-4 pb-4 pt-6">
      {/* `break-words`: sin él, "Campañas y convocatorias nacionales" a 28 px
          desbordaba la página entera por debajo de ~230 px CSS (390 px con
          zoom al 200 %) — la misma clase de bug que P3, encontrada al extender
          esa medición a las otras rutas. A ancho normal no cambia nada. */}
      <h1 className="text-pagina font-bold break-words">{h1}</h1>
      <p className="mt-1 text-sec text-secundario">
        Terremoto en Colombia · Agosto 2026
      </p>
      <p className="mt-3 flex items-start gap-1.5 text-meta text-secundario">
        <span aria-hidden="true">ⓘ</span>
        <span>
          Tu ubicación se usa solo en tu dispositivo y nunca se envía a ningún
          servidor.
        </span>
      </p>
      {frescura && <AvisoActualizacion {...frescura} />}
    </header>
  );
}

/**
 * Pie: frescura del dataset (voz mono del conteo honesto), acceso a "Acerca
 * de" y "Borrar mis datos", siempre visible en todas las páginas
 * (DESIGN.md §6).
 *
 * El enlace a /acerca es la única incorporación de W5 a la UI existente: ahí
 * viven el disclaimer del contrato, los créditos a las fuentes, la atribución
 * de OpenStreetMap y la explicación de privacidad. El disclaimer NO se replica
 * aquí — DESIGN.md §6 le asigna esa cadena a "Acerca de".
 *
 * `actualizadoHace` es OPCIONAL desde W8, y la portada es la única página que
 * no lo pasa: el aviso del encabezado ya dice ese mismo "hace N h" arriba, con
 * su contexto. Decirlo dos veces en la misma página es la repetición torpe que
 * el handoff pedía resolver; se elige conservar la de arriba —donde la persona
 * decide— y soltar el eco del pie. /campanas, /acerca y la 404 lo siguen
 * pasando: ahí sigue siendo la única mención de la frescura del dataset.
 *
 * Nota para el director: esta línea del pie NO está en la tabla de §6 (que le
 * asigna "hace 3 h" al pie de TARJETA y al pie de sitio solo "Borrar mis
 * datos"), así que quitarla de una página es una decisión de implementación
 * reversible en una línea, no una desviación del sistema.
 */
export function PieDatos({ actualizadoHace }: { actualizadoHace?: string }) {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      {actualizadoHace && (
        <p className="font-mono text-meta tabular-nums text-secundario">
          Datos actualizados {actualizadoHace}.
        </p>
      )}
      <p>
        <a
          className="inline-flex min-h-tap items-center text-accion underline underline-offset-2"
          href="/acerca/"
        >
          Acerca de este sitio
        </a>
      </p>
      <BorrarDatos />
    </footer>
  );
}
