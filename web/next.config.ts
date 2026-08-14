import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sitio 100 % estático (contrato, arquitectura §3.1): la build produce web/out/
  // y no existe servidor que pueda recibir datos del usuario.
  output: "export",
  // Sin optimización de imágenes: el optimizador de next/image necesita un
  // servidor y este sitio no tiene ninguno.
  images: { unoptimized: true },
  // URLs con slash final → cada ruta es una carpeta con index.html en out/
  // (robusto en cualquier hosting estático, incluido Vercel).
  trailingSlash: true,
};

export default nextConfig;
