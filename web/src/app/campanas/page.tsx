import type { Metadata } from "next";

import { Encabezado, PieDatos } from "@/components/Encabezado";
import { TarjetaCampana } from "@/components/TarjetaCampana";
import { prepararDatos } from "@/lib/datos";

export const metadata: Metadata = {
  title: "Campañas nacionales — Mapa de Ayuda",
  description:
    "Dona desde cualquier lugar: campañas de dinero y convocatorias nacionales para ayudar tras el terremoto en Colombia.",
};

/**
 * /campanas — los 49 sitios sin ciudad ni punto físico (46 campañas de dinero
 * + 3 convocatorias de voluntariado nacional). Ruta propia, jamás mezclados
 * con la lista geográfica "cerca de ti". 100 % pre-renderizada en build.
 */
export default function Campanas() {
  const datos = prepararDatos();
  const dinero = datos.campanas.filter((s) => s.categorias.includes("dinero"));
  const otras = datos.campanas.filter((s) => !s.categorias.includes("dinero"));

  return (
    <>
      <Encabezado h1="Campañas y convocatorias nacionales" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4">
        <a
          className="inline-flex min-h-tap items-center font-medium text-accion"
          href="/"
        >
          ← Volver a la lista de puntos
        </a>
        <p className="mt-2 text-sec text-secundario">
          Esta ayuda se da desde cualquier lugar: no necesita punto físico ni
          desplazamiento.
        </p>

        <section className="mt-5">
          <h2 className="text-seccion font-bold">
            Dona desde cualquier lugar{" "}
            <span className="font-mono text-sec font-normal tabular-nums text-secundario">
              ({dinero.length})
            </span>
          </h2>
          <ul className="mt-3 space-y-3">
            {dinero.map((s) => (
              <li key={s.id}>
                <TarjetaCampana sitio={s} />
              </li>
            ))}
          </ul>
        </section>

        {otras.length > 0 && (
          <section className="mt-7">
            <h2 className="text-seccion font-bold">
              Voluntariado nacional{" "}
              <span className="font-mono text-sec font-normal tabular-nums text-secundario">
                ({otras.length})
              </span>
            </h2>
            <ul className="mt-3 space-y-3">
              {otras.map((s) => (
                <li key={s.id}>
                  <TarjetaCampana sitio={s} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <PieDatos actualizadoHace={datos.actualizadoHace} />
    </>
  );
}
