import { BorrarDatos } from "./BorrarDatos";

/**
 * Encabezado del sitio (1 sola vez por página, no sticky — DESIGN.md §3) con
 * el banner de privacidad permanente que exige el contrato.
 *
 * El texto del banner es LITERAL y sigue siendo cierto tras W4: la posición
 * del usuario solo existe en memoria (y en su propio localStorage si él lo
 * pide); no hay ninguna ruta de código que la envíe a un servidor.
 */
export function Encabezado({ h1 }: { h1: string }) {
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
 */
export function PieDatos({ actualizadoHace }: { actualizadoHace: string }) {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      <p className="font-mono text-meta tabular-nums text-secundario">
        Datos actualizados {actualizadoHace}.
      </p>
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
