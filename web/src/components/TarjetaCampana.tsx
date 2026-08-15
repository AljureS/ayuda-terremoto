import { hrefDonar } from "@/lib/donar";
import type { SitioVista } from "@/lib/tipos";
import { Descripcion } from "./Descripcion";
import { VerContacto } from "./VerContacto";
import {
  Badges,
  CLASE_BTN_PRIMARIO,
  CLASE_BTN_SECUNDARIO,
  EstadoChip,
  MetaFuente,
} from "./piezas";

/**
 * Tarjeta de campaña nacional (DESIGN.md §3): sin dirección, sin distancia,
 * sin riel — la ayuda se da desde cualquier lugar. Acción única: "Dona aquí".
 */
export function TarjetaCampana({ sitio }: { sitio: SitioVista }) {
  // `hrefDonar` ya aplica la compuerta de estado (solo `activo`, DESIGN.md §3):
  // una campaña que hoy no recibe no ofrece "Dona aquí".
  const donar = hrefDonar(sitio);
  /**
   * "Llamar" toma el estilo primario cuando queda sola (DESIGN.md §3, W6/P5):
   * sin "Dona aquí" es la única acción de la tarjeta, y ninguna tarjeta
   * muestra su única acción en estilo secundario.
   */
  const llamarEsUnica = !donar;
  // No repetir como link de pie lo que ya es la acción principal.
  const sitioMeta: SitioVista = {
    ...sitio,
    web: sitio.web === donar ? undefined : sitio.web,
    instagram: sitio.instagram === donar ? undefined : sitio.instagram,
  };

  return (
    <article className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <h3 className="break-words text-tarjeta font-semibold">{sitio.nombre}</h3>
      <div className="mt-1.5">
        <EstadoChip estado={sitio.estado} />
      </div>
      <div className="mt-2.5">
        <Badges categorias={sitio.categorias} />
      </div>
      <div className="mt-2.5">
        <Descripcion texto={sitio.descripcion} />
      </div>
      {(donar || sitio.telefonoHref) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {donar && (
            <a
              className={CLASE_BTN_PRIMARIO}
              href={donar}
              target="_blank"
              rel="noopener noreferrer"
            >
              Dona aquí
            </a>
          )}
          {sitio.telefonoHref && (
            <a
              className={
                llamarEsUnica ? CLASE_BTN_PRIMARIO : CLASE_BTN_SECUNDARIO
              }
              href={sitio.telefonoHref}
            >
              Llamar
            </a>
          )}
        </div>
      )}
      {sitio.telefonoTexto && (
        <p className="mt-2 break-words font-mono text-meta tabular-nums text-secundario">
          {sitio.telefonoTexto}
        </p>
      )}
      {sitio.contactoPersonalB64 && (
        <div className="mt-3.5">
          <VerContacto
            b64={sitio.contactoPersonalB64}
            esVoluntariado={sitio.categorias.includes("voluntariado")}
          />
        </div>
      )}
      <div className="mt-3.5">
        <MetaFuente sitio={sitioMeta} />
      </div>
    </article>
  );
}
