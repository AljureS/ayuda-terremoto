"use client";

import dynamic from "next/dynamic";

import type { SitioVista } from "@/lib/tipos";

/**
 * Frontera de carga del mapa (W3). Este módulo sí vive en el bundle inicial,
 * pero pesa ~1 KB: el peso real (Leaflet + react-leaflet + CSS) queda en el
 * chunk async de Mapa.tsx, que webpack solo descarga cuando este componente
 * se RENDERIZA — es decir, cuando la persona abre el mapa (toggle en móvil,
 * "Ver mapa" en desktop). `ssr: false` porque Leaflet toca `window`.
 *
 * El placeholder de carga llena el MISMO alto que el mapa (el wrapper padre
 * fija la altura; ambos son h-full): cero layout shift. Estado de carga como
 * texto — cero spinners decorativos (DESIGN.md §8).
 */
const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-superficie">
      <p className="text-sec text-secundario">Cargando el mapa…</p>
    </div>
  ),
});

export function PanelMapa(props: {
  sitios: SitioVista[];
  onVolverALista?: () => void;
}) {
  return <Mapa {...props} />;
}
