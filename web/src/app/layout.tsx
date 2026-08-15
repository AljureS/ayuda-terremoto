import type { Metadata, Viewport } from "next";

import { DESC_HOME, NOMBRE_SITIO, SITIO_URL, TITULO_HOME } from "@/lib/seo";

import "./globals.css";

/**
 * Metadata compartida por todas las rutas. Cada `page.tsx` añade la suya con
 * `metadatosRuta()` (título, description, canónica y Open Graph propios).
 *
 * `metadataBase` es lo que vuelve absolutas la `og:image` y las canónicas:
 * WhatsApp y Facebook descartan una `og:image` relativa, así que sin esto no
 * hay preview. Ver `src/lib/seo.ts` para de dónde sale el dominio.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITIO_URL),
  title: TITULO_HOME,
  description: DESC_HOME,
  applicationName: NOMBRE_SITIO,
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

/**
 * `themeColor` y `colorScheme` van en el export `viewport` (Next 15 avisa en
 * build si se quedan en `metadata`).
 *
 * - `themeColor` = `--color-fondo` (#EFF2F5, DESIGN.md §1/§9): la barra del
 *   navegador continúa el fondo de la página en vez de cortarlo.
 * - `colorScheme: "light"`: DESIGN.md §1 decide que no hay modo oscuro en v1;
 *   declararlo evita que el navegador fuerce un oscurecido automático sobre
 *   una paleta calculada para máximo contraste a pleno sol.
 */
export const viewport: Viewport = {
  themeColor: "#EFF2F5",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
