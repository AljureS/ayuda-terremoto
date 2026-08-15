import { Encabezado, PieDatos } from "@/components/Encabezado";
import { CLASE_BTN_SECUNDARIO } from "@/components/piezas";
import { TarjetaCampana } from "@/components/TarjetaCampana";
import { prepararDatos } from "@/lib/datos";
import { metadatosRuta } from "@/lib/seo";

// La description de W2 medía 116 caracteres: se recortó a 87 en W5 bajo la
// misma disciplina de DESIGN.md §6 (≤ 90) y cerrando con "Sin rastreo.", igual
// que la home. Es la ruta que más se reenvía por WhatsApp: el preview manda.
export const metadata = metadatosRuta(
  "/campanas/",
  "Campañas nacionales — Mapa de Ayuda",
  "Dona desde cualquier lugar: campañas de dinero y convocatorias nacionales. Sin rastreo.",
);

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

        {/*
          Estado vacío (fix W6/P8): con el dataset sin campañas la página
          quedaba en "Dona desde cualquier lugar (0)" y nada más — un título
          que promete algo que no está. Regla estructural de DESIGN.md §3:
          sección sin elementos no se dibuja; ninguna sección con elementos ⇒
          estado vacío de la página. Copy y acción LITERALES de §6 (fila
          "Campañas vacías", ratificada por design-director en W6).
        */}
        {datos.campanas.length === 0 && (
          <div className="mt-5 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
            <p className="text-sec text-secundario">
              Todavía no hay campañas nacionales publicadas. Los puntos de ayuda
              con dirección siguen en la lista.
            </p>
            <div className="mt-3">
              <a className={CLASE_BTN_SECUNDARIO} href="/">
                Ver puntos de ayuda
              </a>
            </div>
          </div>
        )}

        {dinero.length > 0 && (
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
        )}

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
