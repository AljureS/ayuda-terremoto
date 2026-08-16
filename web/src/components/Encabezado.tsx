import { BorrarDatos } from "./BorrarDatos";

/**
 * La promesa del ritmo: el pipeline corre UNA VEZ AL DÍA por GitHub Actions y
 * publica solo. Si el sello del dataset es más viejo que eso, la promesa no se
 * cumplió y el aviso lo dice — nunca al revés (W8).
 */
const HORAS_DE_PROMESA = 24;

/** Frescura del dataset, calculada EN BUILD (`prepararDatos()`). */
export interface Frescura {
  /** "hace 3 h" / "hace 2 días" — el mismo `haceTexto()` de las tarjetas. */
  hace: string;
  /** Horas crudas: eligen la frase, para que el texto no pueda desmentir al dato. */
  horas: number;
  /** Sello ISO del dataset (atributo `datetime`, no texto visible). */
  iso: string;
}

/**
 * Aviso de actualización (W8) — el ritmo, el dato duro y el llamado a
 * verificar, en una sola línea de contexto.
 *
 * DÓNDE Y POR QUÉ: en el encabezado, pegado al banner de privacidad. Los dos
 * son avisos permanentes que enmarcan la lista sin competir con ella
 * (DESIGN.md §0: "es contexto, no alarma"), y comparten forma —ⓘ + texto
 * secundario— para que se lean como lo que son. La otra sede candidata era
 * junto al conteo honesto, y se descartó por una razón medible: en móvil la
 * vista mapa esconde TODO ese bloque (`enMapaMovil ? "hidden lg:block"` en
 * ListaFiltrada), así que el aviso desaparecería justo cuando la persona está
 * eligiendo un punto en el mapa. Aquí se ve en las dos vistas, en móvil y en
 * escritorio, y no toca el `aria-live` del conteo.
 *
 * QUÉ DICE Y POR QUÉ NO MIENTE: la frase se DERIVA de `horas`, nunca de una
 * constante. Con el dato al día recita el ritmo; con el archivo más viejo que
 * la promesa, el "pero" antepone la realidad al ritmo. No hay redacción
 * posible de este componente que diga "actualizado hoy" sobre un archivo de
 * hace tres días.
 *
 * SIN MONO, a propósito: DESIGN.md §2 reserva el mono para cifras operativas y
 * cierra con "si aparece en prosa, es un error de implementación". Esto es
 * prosa. El `<time>` no cambia un píxel: lleva el instante absoluto en el
 * atributo, que —a diferencia del texto relativo, congelado en la build— no
 * envejece.
 */
export function AvisoActualizacion({ hace, horas, iso }: Frescura) {
  const desfasado = horas > HORAS_DE_PROMESA;
  return (
    <p
      data-aviso="actualizacion"
      className="mt-2 flex items-start gap-1.5 text-sec text-secundario"
    >
      {/* El ícono es decoración: `aria-hidden` y jamás canal único — todo lo
          que informa está en el texto (DESIGN.md §8). Y NO lleva role="alert":
          esto es contexto permanente, no una interrupción. */}
      <span aria-hidden="true">ⓘ</span>
      <span>
        Esta lista se actualiza sola una vez al día
        {desfasado ? ", pero la última fue " : "; la última fue "}
        <time dateTime={iso}>{hace}</time>.{" "}
        {/* DESVIACIÓN DECLARADA de DESIGN.md §6, para el director: la cadena
            canónica es "Verifica el punto antes de desplazarte: los horarios y
            las necesidades cambian rápido." Aquí va SIN la cola explicativa.
            La razón es medida, no estética: con la cola, el aviso ocupa 5
            líneas (110 px) a 320 px y 4 (88 px) a 390 px, y empuja la primera
            tarjeta 22 px más abajo en las dos. La cola explica POR QUÉ hay que
            verificar; la orden está entera en la mitad que se conserva, y la
            frase completa sigue literal en /acerca, que es a quien §6 se la
            asigna. Si el director prefiere la cadena entera, es un cambio de
            una línea: cuesta esos 22 px. */}
        <strong className="font-medium text-tinta">
          Verifica el punto antes de desplazarte.
        </strong>
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
