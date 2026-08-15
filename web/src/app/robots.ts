import type { MetadataRoute } from "next";

import { SITIO_URL } from "@/lib/seo";

// `output: "export"` exige declararlo explícitamente: sin esto la build
// falla al recolectar esta ruta de metadata.
export const dynamic = "force-static";

/**
 * robots.txt — se genera como archivo estático en `out/`.
 * Todo es público e indexable: el objetivo del sitio es que la gente lo
 * encuentre. No hay rutas privadas porque no hay nada privado que servir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITIO_URL}/sitemap.xml`,
  };
}
