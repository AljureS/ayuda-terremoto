"use client";

/**
 * EL CHUNK PESADO DEL MAPA (W3). Leaflet, react-leaflet y su CSS entran aquí
 * y solo aquí; este módulo se importa EXCLUSIVAMENTE vía next/dynamic con
 * `ssr: false` (PanelMapa.tsx). Consecuencias que el resto del código respeta:
 * - Nada de este archivo viaja en el JS inicial ni se referencia en el HTML
 *   del build: se descarga cuando la persona abre el mapa.
 * - Solo corre en cliente: `window` existe siempre.
 * - CSS de Leaflet importado LOCAL desde node_modules — jamás unpkg/CDN.
 *
 * El mapa es mejora progresiva sobre la lista (DESIGN.md §0 y §3): muestra
 * exactamente el conjunto filtrado vigente, dice cuánto de él está ubicado
 * (conteo honesto §6) y, si los tiles fallan, degrada con mensaje — la lista
 * pre-renderizada es siempre el camino resiliente.
 *
 * PRIVACIDAD: aquí no hay geolocalización (llega en W4, solo en memoria). El
 * único host de red de todo el sitio es tile.openstreetmap.org, y solo se
 * contacta cuando el usuario abre el mapa.
 */
import "leaflet/dist/leaflet.css";
import "./mapa.css";

import { latLngBounds, type LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";

import type { SitioVista } from "@/lib/tipos";
import { Badges, CLASE_BTN_PRIMARIO, EstadoChip } from "../piezas";
import { iconoSitio, primeraCategoriaEnum } from "./iconos";

/** Encuadre de respaldo cuando el conjunto filtrado no tiene ningún punto
 * con coordenadas: Colombia entera (no hay centros por ciudad en el dato). */
const BOUNDS_COLOMBIA: LatLngBoundsExpression = [
  [-4.3, -79.1],
  [12.6, -66.9],
];

/** Las animaciones de Leaflet se apagan bajo `prefers-reduced-motion`
 * (DESIGN.md §8) — además el reset global de globals.css mata las
 * transiciones CSS de las que dependen, así que apagarlas evita zooms
 * colgados a media transición. */
function animar(): boolean {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** fit-bounds del conjunto filtrado cada vez que cambia (filtros vivos). */
function Encuadre({ ubicados }: { ubicados: SitioVista[] }) {
  const map = useMap();
  // Clave estable del conjunto: re-encuadra solo cuando cambian los puntos.
  const clave = ubicados.map((s) => s.id).join("|");
  const ref = useRef(ubicados);
  ref.current = ubicados;
  useEffect(() => {
    const puntos = ref.current;
    const animate = animar();
    if (puntos.length === 0) {
      map.fitBounds(BOUNDS_COLOMBIA, { animate });
      return;
    }
    const bounds = latLngBounds(
      puntos.map((s) => [s.lat!, s.lng!] as [number, number]),
    );
    // maxZoom 15: un solo marker no se encuadra a nivel de andén (z19).
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate });
  }, [map, clave]);
  return null;
}

export default function Mapa({
  sitios,
  onVolverALista,
}: {
  /** El conjunto filtrado vigente (categorías + estado + búsqueda + ciudad). */
  sitios: SitioVista[];
  /** Solo en móvil: los tiles caídos ofrecen "Volver a la lista". */
  onVolverALista?: () => void;
}) {
  // Sitios sin coordenadas JAMÁS rompen el mapa: se filtran aquí y el conteo
  // honesto declara cuántos quedaron fuera.
  const ubicados = useMemo(
    () => sitios.filter((s) => s.lat != null && s.lng != null),
    [sitios],
  );

  // Tiles caídos: si fallan varios tiles sin que ninguno haya cargado, se
  // muestra el mensaje de DESIGN.md §6 (nunca pantalla rota). Si después
  // alguno carga (volvió la señal), el mapa se recupera solo.
  const [tilesCaidos, setTilesCaidos] = useState(false);
  const fallos = useRef(0);
  const cargoAlguno = useRef(false);

  const [anim] = useState(animar);

  // Ancho de popup que SIEMPRE cabe en el mapa (el contenedor descuenta los
  // px-4 del layout): en 320 px un maxWidth fijo de 280 se recortaría contra
  // el borde. Solo-cliente (ssr:false): window existe.
  const [anchoPopup] = useState(() =>
    Math.max(200, Math.min(280, window.innerWidth - 96)),
  );

  const resto = sitios.length - ubicados.length;
  const conteo =
    `${ubicados.length} de ${sitios.length} ${
      sitios.length === 1 ? "punto ubicado" : "puntos ubicados"
    } en el mapa.` + (resto > 0 ? " El resto está en la lista." : "");

  return (
    <div className="relative h-full w-full">
      <MapContainer
        className="h-full w-full"
        center={[4.65, -74.1]}
        zoom={5}
        minZoom={4}
        maxZoom={19}
        attributionControl={false}
        zoomControl={false}
        zoomAnimation={anim}
        fadeAnimation={anim}
        markerZoomAnimation={anim}
      >
        {/* Controles ABAJO a la derecha (atribución al fondo, zoom encima):
            el borde superior queda libre para los popups — los controles de
            Leaflet siempre flotan encima de los panes (stacking context del
            map-pane) y en un mapa angosto taparían el título del popup. De
            paso, el zoom queda al alcance del pulgar. En .leaflet-bottom el
            primer control montado queda al fondo. */}
        {/* prefix={false}: fuera el link default a leafletjs.com — la única
            atribución es la obligatoria de OSM. */}
        <AttributionControl position="bottomright" prefix={false} />
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution="© OpenStreetMap contributors"
          eventHandlers={{
            tileerror: () => {
              fallos.current += 1;
              if (!cargoAlguno.current && fallos.current >= 3) {
                setTilesCaidos(true);
              }
            },
            tileload: () => {
              cargoAlguno.current = true;
              setTilesCaidos(false);
            },
          }}
        />
        <Encuadre ubicados={ubicados} />
        {ubicados.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat!, s.lng!]}
            icon={iconoSitio(primeraCategoriaEnum(s.categorias), s.estado)}
            title={s.nombre}
            alt={s.nombre}
          >
            {/* Popup (DESIGN.md §5): nombre, estado, TODAS las categorías
                como badges, dirección y "Cómo llegar" con la coordenada DEL
                SITIO (dato público) — jamás la del usuario. */}
            <Popup
              maxWidth={anchoPopup}
              minWidth={Math.min(220, anchoPopup)}
              autoPanPadding={[12, 12]}
            >
              <div>
                <h3 className="pr-8 text-tarjeta font-semibold break-words">
                  {s.nombre}
                </h3>
                <div className="mt-1.5">
                  <EstadoChip estado={s.estado} />
                </div>
                <div className="mt-2">
                  <Badges categorias={s.categorias} />
                </div>
                {(s.direccion || s.localidad) && (
                  <p className="mt-2 text-sec break-words text-secundario">
                    {[s.direccion, s.localidad].filter(Boolean).join(", ")}
                  </p>
                )}
                {s.comoLlegar && (
                  <div className="mt-3">
                    <a
                      className="mapa-como-llegar"
                      href={s.comoLlegar}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cómo llegar
                    </a>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Conteo honesto del mapa (DESIGN.md §6): siempre visible en la vista
          mapa, en la esquina, en mono. pointer-events-none: no roba gestos. */}
      {!tilesCaidos && ubicados.length > 0 && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] max-w-[70%] rounded-tarjeta border border-borde bg-superficie px-2.5 py-1.5 font-mono text-meta tabular-nums shadow-tarjeta">
          {conteo}
        </p>
      )}

      {/* Conjunto filtrado sin ningún punto con coordenadas: el mapa queda en
          Colombia y lo dice; la lista sigue completa. */}
      {!tilesCaidos && ubicados.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="max-w-sm rounded-tarjeta border border-borde bg-superficie p-4 text-center shadow-tarjeta">
            <p className="font-mono text-sec tabular-nums">
              Ningún punto ubicado en el mapa para este filtro.
            </p>
            <p className="mt-1 text-sec text-secundario">
              La lista tiene la información completa.
            </p>
          </div>
        </div>
      )}

      {/* Tiles caídos — microcopy exacto de DESIGN.md §6. La lista es el
          camino: en móvil con botón; en desktop está al lado. */}
      {tilesCaidos && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-fondo p-4">
          <div className="max-w-sm text-center">
            <p>
              El mapa no cargó. Revisa tu conexión o vuelve a la lista: tiene
              la misma información.
            </p>
            {onVolverALista && (
              <button
                type="button"
                className={`${CLASE_BTN_PRIMARIO} mt-3`}
                onClick={onVolverALista}
              >
                Volver a la lista
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
