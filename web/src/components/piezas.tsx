import { CATEGORIA_INFO, ESTADO_INFO } from "@/lib/categorias";
import type { Categoria, Estado, SitioVista } from "@/lib/tipos";

/** Chip de estado: punto ● + palabra SIEMPRE — el color nunca es el único canal. */
export function EstadoChip({ estado }: { estado: Estado }) {
  const info = ESTADO_INFO[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-sec font-medium ${info.chip}`}
    >
      <span className="sr-only">Estado: </span>
      {info.punto && (
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${info.punto}`}
        />
      )}
      {info.texto}
    </span>
  );
}

/** Badges de categoría: color + etiqueta visible siempre (DESIGN.md §5). */
export function Badges({ categorias }: { categorias: Categoria[] }) {
  return (
    <p className="flex flex-wrap gap-1.5">
      {categorias.map((c) => (
        <span
          key={c}
          className={`rounded-chip px-2 py-0.5 text-meta font-medium ${CATEGORIA_INFO[c].badge}`}
        >
          {CATEGORIA_INFO[c].etiqueta}
        </span>
      ))}
    </p>
  );
}

/**
 * Pie de tarjeta: fuente (trazabilidad pública del proyecto), frescura del
 * dato y contactos institucionales como links de navegación por click.
 * Todos los links externos: target _blank + rel="noopener noreferrer".
 */
export function MetaFuente({ sitio }: { sitio: SitioVista }) {
  const enlaceMeta =
    "inline-flex min-h-tap items-center text-accion underline underline-offset-2";
  return (
    <p className="-my-1.5 flex flex-wrap items-center gap-x-3 text-meta text-secundario">
      <a
        className={enlaceMeta}
        href={sitio.fuente}
        target="_blank"
        rel="noopener noreferrer"
      >
        Fuente ↗
      </a>
      {sitio.instagram && (
        <a
          className={enlaceMeta}
          href={sitio.instagram}
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram ↗
        </a>
      )}
      {sitio.web && (
        <a
          className={enlaceMeta}
          href={sitio.web}
          target="_blank"
          rel="noopener noreferrer"
        >
          Sitio web ↗
        </a>
      )}
      {sitio.mailto && (
        <a className={enlaceMeta} href={sitio.mailto}>
          Correo ↗
        </a>
      )}
      {sitio.hace && <span>{sitio.hace}</span>}
      {!sitio.verificado && <span>Reporte de la comunidad — sin confirmar</span>}
    </p>
  );
}

/** Botón/enlace primario (una sola acción primaria por tarjeta). */
export const CLASE_BTN_PRIMARIO =
  "inline-flex min-h-tap items-center justify-center rounded-tarjeta bg-accion px-4 font-medium text-white";

/** Botón/enlace secundario. */
export const CLASE_BTN_SECUNDARIO =
  "inline-flex min-h-tap items-center justify-center rounded-tarjeta border border-borde bg-superficie px-4 font-medium text-accion";
