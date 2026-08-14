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
      <h1 className="text-pagina font-bold">{h1}</h1>
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
 * Pie: frescura del dataset (voz mono del conteo honesto) y "Borrar mis
 * datos", siempre visible en todas las páginas (DESIGN.md §6).
 */
export function PieDatos({ actualizadoHace }: { actualizadoHace: string }) {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      <p className="font-mono text-meta tabular-nums text-secundario">
        Datos actualizados {actualizadoHace}.
      </p>
      <BorrarDatos />
    </footer>
  );
}
