import { Encabezado, PieDatos } from "@/components/Encabezado";
import { ListaFiltrada } from "@/components/ListaFiltrada";
import { prepararDatos } from "@/lib/datos";
import { DESC_HOME, metadatosRuta, TITULO_HOME } from "@/lib/seo";

/** Textos literales de DESIGN.md §6 (37/60 y 88/90). */
export const metadata = metadatosRuta("/", TITULO_HOME, DESC_HOME);

/**
 * Home — server component: lee /data/sitios.json EN BUILD TIME (única
 * frontera con el resto del monorepo) y entrega la lista ya preparada al
 * client component. El HTML del build sale con la vista por defecto completa
 * (Bogotá, solo activos) pre-renderizada: útil al primer byte, incluso sin JS.
 */
export default function Home() {
  const datos = prepararDatos();
  return (
    <>
      {/* El aviso de actualización (W8) va aquí, junto al banner de privacidad
          y NO en el pie: es contexto para decidir a dónde ir. Por eso el pie
          de ESTA página no repite el "hace N h" — ver PieDatos. */}
      <Encabezado
        h1="Mapa de Ayuda"
        frescura={{
          hace: datos.actualizadoHace,
          horas: datos.actualizadoHoras,
          iso: datos.actualizadoIso,
        }}
      />
      <main className="flex-1">
        <ListaFiltrada
          sitios={datos.geograficos}
          ciudades={datos.ciudades}
          nCampanas={datos.campanas.length}
        />
      </main>
      <PieDatos />
    </>
  );
}
