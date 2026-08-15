import type { MetadataRoute } from "next";

import { DESC_HOME, NOMBRE_SITIO, TITULO_HOME } from "@/lib/seo";

// `output: "export"` exige declararlo explícitamente: sin esto la build
// falla al recolectar esta ruta de metadata.
export const dynamic = "force-static";

/**
 * manifest.webmanifest mínimo — nombre, colores e ícono. SIN service worker
 * (el contrato no lo pide y no hay soporte offline que prometer).
 *
 * `display: "browser"` a propósito: sin service worker, una ventana
 * "standalone" sin red muestra la pantalla de error del navegador en vez de
 * algo útil. El sitio es una pestaña honesta, no una app disfrazada.
 *
 * Colores = `--color-fondo` (#EFF2F5, DESIGN.md §9), los mismos del
 * `themeColor` del layout. Ícono: el pin SVG local de `app/icon.svg`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TITULO_HOME,
    short_name: NOMBRE_SITIO,
    description: DESC_HOME,
    lang: "es",
    start_url: "/",
    display: "browser",
    background_color: "#EFF2F5",
    theme_color: "#EFF2F5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
