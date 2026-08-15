/**
 * SEO / Open Graph — metadata pensada para el preview chico de WhatsApp.
 *
 * SOLO SERVER (igual que datos.ts): lo importan los `page.tsx` / `layout.tsx`
 * y las rutas de metadata. Nada de esto viaja al cliente.
 *
 * Los textos de la home son LITERALES de docs/DESIGN.md §6 (verificados en
 * caracteres: título 37/60, description 88/90). Los de /campanas y /acerca se
 * escribieron en W5 en la misma voz y bajo la misma disciplina (≤ 60 / ≤ 90).
 */
import type { Metadata } from "next";

/**
 * URL pública del sitio. La necesitan `metadataBase` (para volver absolutas la
 * og:image y las canónicas — WhatsApp y Facebook exigen URL absoluta), el
 * sitemap y el manifest.
 *
 * Precedencia:
 *  1. `SITIO_URL` — la fija el mantenedor cuando el dominio final exista (W7).
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — la inyecta Vercel en cada build con el
 *     dominio de producción del proyecto (viene sin protocolo).
 *  3. El provisional de abajo, para builds locales.
 *
 * PROVISIONAL: el dominio real se decide en el primer deploy (W7). Mientras
 * tanto (2) hace que un deploy en Vercel salga correcto solo. Si el proyecto
 * termina con dominio propio, se fija `SITIO_URL` en el dashboard y punto — no
 * hay que tocar código.
 */
function urlDelSitio(): string {
  const propia = process.env.SITIO_URL?.trim();
  if (propia) return propia.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "https://mapa-de-ayuda.vercel.app";
}

export const SITIO_URL = urlDelSitio();
export const NOMBRE_SITIO = "Mapa de Ayuda";

/** Correo del proyecto: el mismo que el scraper publica en su User-Agent. */
export const CORREO_PROYECTO = "saidsimon2@gmail.com";

/** `mailto:` con asunto pre-llenado (urlencoded) para reportar un cambio. */
export function mailtoReporte(asunto: string): string {
  return `mailto:${CORREO_PROYECTO}?subject=${encodeURIComponent(asunto)}`;
}

/**
 * Imagen OG estática y self-hosted (`/public/og.png`, 1200×630).
 * Se genera una sola vez con `node scripts/og.mjs` y se versiona; NO se
 * construye en cada build (ver web/README.md).
 */
const OG_IMAGEN = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Mapa de Ayuda — encuentra el punto de ayuda más cercano. Terremoto en Colombia, agosto de 2026.",
};

/** Título y description de la home: literales de DESIGN.md §6. */
export const TITULO_HOME = "Mapa de Ayuda — Terremoto en Colombia";
export const DESC_HOME =
  "Encuentra el punto de ayuda más cercano: donaciones, sangre y voluntariado. Sin rastreo.";

/**
 * Metadata completa de una ruta.
 *
 * Next hace merge SHALLOW de `metadata`: si una página declara `openGraph`,
 * reemplaza entero el del layout (no lo fusiona). Por eso cada ruta arma aquí
 * su objeto completo — así ninguna se queda sin `og:image` y todas llevan su
 * canónica correcta.
 *
 * `ruta` va con slash final porque el sitio se sirve con `trailingSlash: true`:
 * la canónica debe apuntar a lo que realmente se sirve.
 */
export function metadatosRuta(
  ruta: `/${string}`,
  titulo: string,
  descripcion: string,
): Metadata {
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: NOMBRE_SITIO,
      url: ruta,
      title: titulo,
      description: descripcion,
      images: [OG_IMAGEN],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [OG_IMAGEN.url],
    },
  };
}
