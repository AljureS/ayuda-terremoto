import type { SitioVista } from "@/lib/tipos";
import { Descripcion } from "./Descripcion";
import { Riel, RielVacio } from "./Riel";
import { VerContacto } from "./VerContacto";
import {
  Badges,
  CLASE_BTN_PRIMARIO,
  CLASE_BTN_SECUNDARIO,
  EstadoChip,
  MetaFuente,
} from "./piezas";

/**
 * Tarjeta de sitio — jerarquía exacta de DESIGN.md §3:
 * nombre → estado → [riel] → categorías → qué reciben → dirección/horario →
 * acciones → fuente y frescura. La tarjeta ES el detalle: no hay página de
 * sitio.
 */
export function TarjetaSitio({
  sitio,
  mostrarCiudad = false,
  riel,
}: {
  sitio: SitioVista;
  mostrarCiudad?: boolean;
  /**
   * Distancia y rumbo YA CALCULADOS en el cliente (W4). La tarjeta recibe el
   * resultado, nunca la posición del usuario: no hay forma de que una
   * coordenada del usuario llegue a este componente ni al DOM.
   */
  riel?: { metros: number; rumbo: number };
}) {
  const lineaDireccion = [
    sitio.direccion,
    sitio.localidad,
    mostrarCiudad ? sitio.ciudadNombre : "",
  ]
    .filter(Boolean)
    .join(", ");

  /**
   * "LLAMAR" TOMA EL ESTILO PRIMARIO CUANDO QUEDA SOLA (DESIGN.md §3, W6/P5).
   * Sin "Cómo llegar" —o sea en todo estado ≠ `activo`— llamar no es la
   * segunda acción: es la única, y además la correcta para estos estados
   * (confirmar antes de desplazarte con una caja). Ninguna tarjeta muestra su
   * única acción en estilo secundario.
   */
  const llamarEsUnica = !sitio.comoLlegar;

  return (
    <article className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <div className="flex items-start justify-between gap-2">
        {/*
         * `min-w-0` es obligatorio, no cosmético (fix W6/P3): como flex item, el
         * h3 hereda `min-width: auto`, o sea "no me encojas por debajo de mi
         * palabra más larga". `break-words` NO reduce ese mínimo — solo permite
         * partir la palabra cuando ya no cabe en la línea —, así que con el
         * riel al lado la tarjeta se desbordaba a partir de ~230 px CSS: el
         * celular de 390 px con zoom de página al 200 % (195 px CSS), justo la
         * persona de baja visión. Con `min-w-0` la columna del nombre cede el
         * ancho y `break-words` parte la palabra.
         */}
        <h3 className="min-w-0 break-words text-tarjeta font-semibold">
          {sitio.nombre}
        </h3>
        {/*
         * Columna del RIEL DE RUMBO (elemento distintivo aprobado, DESIGN.md
         * §4): reservada desde W2 para que la geometría de la tarjeta no
         * cambie al llenarse. Antes del permiso de ubicación —y en los sitios
         * sin coordenadas— el riel va vacío por diseño.
         */}
        {riel ? (
          <Riel metros={riel.metros} rumbo={riel.rumbo} />
        ) : (
          <RielVacio />
        )}
      </div>
      <div className="mt-1.5">
        <EstadoChip estado={sitio.estado} />
      </div>
      <div className="mt-2.5">
        <Badges categorias={sitio.categorias} />
      </div>
      <div className="mt-2.5">
        <Descripcion texto={sitio.descripcion} />
      </div>
      {(lineaDireccion || sitio.horario) && (
        <div className="mt-2.5 break-words text-sec text-secundario">
          {lineaDireccion && <p>{lineaDireccion}</p>}
          {sitio.horario && <p>{sitio.horario}</p>}
        </div>
      )}
      {(sitio.comoLlegar || sitio.telefonoHref) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {sitio.comoLlegar && (
            <a
              className={CLASE_BTN_PRIMARIO}
              href={sitio.comoLlegar}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cómo llegar
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
        <MetaFuente sitio={sitio} />
      </div>
    </article>
  );
}
