import type { Metadata } from "next";

import "./globals.css";

// Título y description exactos de DESIGN.md §6 (verificados en caracteres:
// 37/60 y 88/90). Tipografía: system stack — cero requests externos.
export const metadata: Metadata = {
  title: "Mapa de Ayuda — Terremoto en Colombia",
  description:
    "Encuentra el punto de ayuda más cercano: donaciones, sangre y voluntariado. Sin rastreo.",
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
