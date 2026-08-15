import type { Metadata } from "next";

import { Encabezado, PieDatos } from "@/components/Encabezado";
import { CLASE_BTN_PRIMARIO, CLASE_BTN_SECUNDARIO } from "@/components/piezas";
import { prepararDatos } from "@/lib/datos";

/**
 * Página 404 (fix W6/P1).
 *
 * Sin este archivo, `output: 'export'` escribe en `out/404.html` la página por
 * defecto de Next: título en inglés ("404: This page could not be found."),
 * cuerpo en inglés dentro de un `<html lang="es">`, cero enlaces —un callejón
 * sin salida— y un `prefers-color-scheme: dark` inline que contradice la
 * decisión de DESIGN.md §1 (no hay modo oscuro en v1). Un enlace viejo
 * reenviado por WhatsApp aterriza justo ahí.
 *
 * Es un server component puro: se lee y se navega SIN JavaScript, igual que la
 * lista y que /acerca. Los enlaces son `<a>` planos (navegación dura a HTML
 * estático), no `<Link>`.
 *
 * `robots: noindex` reemplaza —merge shallow de Next— el `index, follow` del
 * layout: la 404 es la respuesta a cualquier ruta inexistente y no debe
 * indexarse. Sin `openGraph` a propósito: un error no necesita preview.
 */
export const metadata: Metadata = {
  title: "Esta página no existe — Mapa de Ayuda",
  // 37/60 y 84/90 — la disciplina de DESIGN.md §6 para el preview de WhatsApp.
  description:
    "El enlace no lleva a ninguna página de este sitio. Ve a la lista de puntos de ayuda.",
  robots: { index: false, follow: false },
};

export default function NoEncontrada() {
  const datos = prepararDatos();

  return (
    <>
      <Encabezado h1="Esta página no existe" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4">
        <div className="rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
          <p className="text-sec text-secundario">
            El enlace que abriste no lleva a ninguna página de este sitio. Pudo
            cambiar, o pudo copiarse incompleto al compartirlo. La información
            sigue disponible:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className={CLASE_BTN_PRIMARIO} href="/">
              Ver puntos de ayuda
            </a>
            <a className={CLASE_BTN_SECUNDARIO} href="/campanas/">
              Ver campañas
            </a>
            <a className={CLASE_BTN_SECUNDARIO} href="/acerca/">
              Acerca de este sitio
            </a>
          </div>
        </div>
      </main>
      <PieDatos actualizadoHace={datos.actualizadoHace} />
    </>
  );
}
