import type { MetadataRoute } from "next";

import { ACTUALIZADO_ISO } from "@/lib/datos";
import { SITIO_URL } from "@/lib/seo";

// `output: "export"` exige declararlo explícitamente: sin esto la build
// falla al recolectar esta ruta de metadata.
export const dynamic = "force-static";

/**
 * sitemap.xml — las tres rutas del sitio, con slash final (es lo que se sirve
 * con `trailingSlash: true`).
 *
 * `lastModified` sale del campo `actualizado` de /data/sitios.json, no del
 * momento de la build: lo que cambia para un buscador es el dato, no que
 * hayamos recompilado.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(ACTUALIZADO_ISO);
  return [
    {
      url: `${SITIO_URL}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITIO_URL}/campanas/`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITIO_URL}/acerca/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
