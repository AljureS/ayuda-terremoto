import { BorrarDatos } from "@/components/BorrarDatos";
import { Encabezado, PieDatos } from "@/components/Encabezado";
import { prepararDatos } from "@/lib/datos";
import { mailtoReporte, metadatosRuta } from "@/lib/seo";
import { CLASE_BTN_PRIMARIO } from "@/components/piezas";

export const metadata = metadatosRuta(
  "/acerca/",
  "Acerca de — Mapa de Ayuda",
  "Qué es este sitio, de dónde salen los datos y por qué tu ubicación no sale de tu celular.",
);

/**
 * /acerca — el contenido fijo que exige el contrato (MASTER_PROMPT Parte 2,
 * "Contenido fijo"): qué es esto, disclaimer, cómo reportar un cambio,
 * créditos a las fuentes, atribución de OpenStreetMap y privacidad.
 *
 * 100 % server component: sale entera pre-renderizada y se lee completa SIN
 * JavaScript. El único componente cliente es "Borrar mis datos" — y sin JS
 * este sitio tampoco escribe nada que borrar.
 *
 * Las cifras de "Los datos, en números" se calculan EN BUILD desde
 * /data/sitios.json (`prepararDatos()`): números reales que envejecen con el
 * dataset, nunca escritos a mano.
 */

/** Enlace externo: siempre `noopener noreferrer` (arquitectura §4). */
function Externo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="text-accion underline underline-offset-2"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-4 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta"
    >
      <h2 className="text-seccion font-bold">{titulo}</h2>
      <div className="mt-3 space-y-3 text-base">{children}</div>
    </section>
  );
}

/**
 * Créditos a las fuentes. El texto de cada una se escribe aquí (es contenido);
 * el CONTEO sale del dataset por host de `fuente`, así que nunca miente.
 */
const FUENTES = [
  {
    host: "bogota.gov.co",
    nombre: "Alcaldía Mayor de Bogotá",
    url: "https://bogota.gov.co/mi-ciudad/seguridad/puntos-de-donacion-en-bogota-para-damnificados-terremoto-en-colombia",
    que: "Listados oficiales de puntos de acopio, de donación de sangre y de acopio para animales.",
  },
  {
    host: "cruzrojacolombiana.org",
    nombre: "Cruz Roja Colombiana",
    url: "https://www.cruzrojacolombiana.org/cruz-roja-colombiana-despliega-capacidades-para-dar-respuesta-tras-las-afectaciones-por-sismo-en-colombia/",
    que: "Sedes que reciben donaciones y despliegue de respuesta tras el sismo.",
  },
  {
    host: "docs.google.com",
    nombre: "Hoja comunitaria (Google Sheets)",
    url: "https://docs.google.com/spreadsheets/d/106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U/edit?gid=1375250837",
    que: "Recopilación colaborativa abierta, llenada a mano por muchas personas.",
  },
];

export default function Acerca() {
  const datos = prepararDatos();
  const sinCoords = datos.totalSitios - datos.totalConCoords;

  return (
    <>
      <Encabezado h1="Acerca de este sitio" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4">
        <a
          className="inline-flex min-h-tap items-center font-medium text-accion"
          href="/"
        >
          ← Volver a la lista de puntos
        </a>

        <Seccion id="que-es" titulo="Qué es esto">
          <p>
            Mapa de Ayuda reúne en un solo lugar los puntos que reciben ayuda
            tras el terremoto del 10 de agosto de 2026 en el occidente de
            Colombia: acopio de alimentos, agua, ropa, medicamentos y
            materiales, donación de sangre, voluntariado y campañas de dinero.
          </p>
          <p>
            Es para quien ya decidió ayudar y solo necesita saber a dónde ir.
            Abre la lista, filtra por lo que vas a donar, mira cuál te queda más
            cerca y sal.
          </p>
          <p>
            Este no es un sitio oficial de ninguna entidad. Es un directorio:
            recopila lo que otros publican, lo ordena y siempre enlaza a la
            fuente para que puedas confirmarlo tú.
          </p>
        </Seccion>

        {/* Disclaimer del contrato — texto literal de DESIGN.md §6. */}
        <section
          id="verifica"
          className="mt-4 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta"
        >
          <h2 className="text-tarjeta font-semibold">
            Verifica el punto antes de desplazarte: los horarios y las
            necesidades cambian rápido.
          </h2>
          <p className="mt-2 text-sec text-secundario">
            Un punto puede llenarse o cerrar el mismo día en que aquí figura
            como activo. Llama antes de salir o abre la fuente de la tarjeta.
            Cada tarjeta dice hace cuánto se actualizó ese dato.
          </p>
        </section>

        <Seccion id="datos" titulo="Los datos, en números">
          <ul className="space-y-2">
            <li>
              <b className="font-mono tabular-nums">{datos.totalSitios}</b>{" "}
              puntos en total.
            </li>
            <li>
              <b className="font-mono tabular-nums">
                {datos.geograficos.length}
              </b>{" "}
              con dirección, en{" "}
              <b className="font-mono tabular-nums">{datos.ciudades.length}</b>{" "}
              ciudades.
            </li>
            <li>
              <b className="font-mono tabular-nums">{datos.campanas.length}</b>{" "}
              campañas y convocatorias que no necesitan punto físico, en{" "}
              <a
                className="text-accion underline underline-offset-2"
                href="/campanas/"
              >
                Campañas nacionales
              </a>
              .
            </li>
            <li>
              <b className="font-mono tabular-nums">{datos.totalConCoords}</b>{" "}
              ubicados en el mapa con coordenadas exactas. Los otros{" "}
              <b className="font-mono tabular-nums">{sinCoords}</b> están en la
              lista, con su dirección: en Colombia muchas direcciones no se
              pueden convertir en un punto automáticamente, y preferimos una
              dirección cierta a un pin inventado.
            </li>
          </ul>
          {/* Los dos sellos, separados (W9). Antes había una sola línea
              —"Última actualización"— que colapsaba dos hechos distintos y
              hacía imposible distinguir "nadie revisó" de "no había novedades".
              La segunda línea solo existe si el pipeline dejó su latido. */}
          {datos.revisionFecha && (
            <p className="text-sec text-secundario">
              Última revisión de las fuentes:{" "}
              <span className="font-mono tabular-nums">
                {datos.revisionFecha}
              </span>{" "}
              (hora de Bogotá) — {datos.frescura.revision?.hace}.
            </p>
          )}
          <p className="text-sec text-secundario">
            Último cambio en los datos:{" "}
            <span className="font-mono tabular-nums">
              {datos.actualizadoFecha}
            </span>{" "}
            (hora de Bogotá) — {datos.actualizadoHace}.
          </p>
        </Seccion>

        {/* Reescrita en W8 (el ritmo automático) y ajustada en W9 con la
            distinción que la portada solo puede insinuar en una línea: revisar
            no es cambiar. Este es el lugar donde cabe el párrafo completo —el
            aviso de la portada tiene que caber sobre el pliegue de un celular
            de 320 px—. El resto —correr a mano, el archivo, la recarga, las
            72 h— sigue siendo cierto y se conserva. */}
        <Seccion id="frecuencia" titulo="Cada cuánto se actualiza">
          <p>
            Una vez al día, un proceso automático revisa las fuentes: vuelve a
            leer los listados oficiales y la hoja comunitaria, compara lo que
            dicen con lo que hay publicado aquí y, si algo cambió, actualiza el
            archivo de datos y vuelve a publicar el sitio. Corre solo, sin que
            nadie tenga que acordarse.
          </p>
          <p>
            <b className="font-semibold">Revisar no es lo mismo que cambiar.</b>{" "}
            Muchos días la revisión no encuentra nada nuevo y los datos quedan
            igual: eso no es descuido, es que las fuentes no publicaron
            novedades. Por eso la portada las dice por separado: cuándo se
            revisaron las fuentes y, cuando llevan días sin traer nada, desde
            cuándo no cambia nada. Un dato que lleva días quieto puede estar
            perfectamente vigilado.
          </p>
          <p>
            Y si la revisión se detiene —porque el proceso automático falla o
            nadie lo corre—, la portada lo dice con todas las letras: desde
            cuándo no se revisan las fuentes y que por eso los datos pueden
            estar viejos. Es la señal de que algo se rompió, y preferimos darla
            a que todo parezca normal.
          </p>
          <p>
            No hay servidor ni base de datos: los datos son un archivo que se
            edita y se publica. Por eso quien mantiene el sitio puede correr ese
            mismo proceso a mano cuando quiera, o editar el archivo directamente,
            si llega un cambio que no puede esperar a mañana: un punto que se
            llenó, un horario nuevo, una sede que cerró.
          </p>
          <p>
            Lo que ves es exactamente lo que había en la última construcción del
            sitio, y no cambia solo mientras tienes la página abierta: recárgala
            para traer lo último.
          </p>
          <p>
            La regla que nos ponemos: un dato con más de{" "}
            <span className="font-mono tabular-nums">72</span> horas se marca
            como viejo en la revisión. En emergencia, dato viejo es dato
            peligroso.
          </p>
        </Seccion>

        <Seccion id="reportar" titulo="Cómo reportar un cambio">
          <p>
            ¿Un punto cerró, se llenó, cambió de horario o falta en esta lista?
            Escribe. Es la vía más rápida para corregirlo.
          </p>
          <p>
            <a
              className={CLASE_BTN_PRIMARIO}
              href={mailtoReporte("Mapa de Ayuda — reportar un cambio")}
            >
              Reportar un cambio
            </a>
          </p>
          <p>
            Cuenta el nombre del punto, la dirección y de dónde sacaste el dato:
            un enlace, una foto del aviso o con quién hablaste. Sin fuente no se
            puede publicar.
          </p>
        </Seccion>

        <Seccion id="fuentes" titulo="De dónde salen los datos">
          <p>
            Los datos oficiales llegan del hub distrital de la Alcaldía de
            Bogotá y de los comunicados de las entidades; los comunitarios, de
            una hoja colaborativa abierta que mucha gente llena a mano.
          </p>
          <ul className="space-y-3">
            {FUENTES.map((f) => {
              const n = datos.sitiosPorFuente[f.host] ?? 0;
              return (
                <li key={f.host}>
                  <Externo href={f.url}>{f.nombre} ↗</Externo>
                  {n > 0 && (
                    <span className="font-mono text-sec tabular-nums text-secundario">
                      {" "}
                      · {n} {n === 1 ? "punto" : "puntos"}
                    </span>
                  )}
                  <span className="block text-sec text-secundario">{f.que}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sec text-secundario">
            Los puntos de donación de sangre del IDCBIS — Hemocentro Distrital
            llegan a través del hub de la Alcaldía. Y a quien sostiene la hoja
            comunitaria: la mayor parte de lo que ves aquí es su trabajo.
          </p>
        </Seccion>

        <Seccion id="mapa" titulo="El mapa">
          <p>
            El mapa usa mosaicos de OpenStreetMap, y las direcciones se
            convierten en coordenadas con Nominatim, el geocodificador del mismo
            proyecto. Sin llaves de API y sin Google Maps.
          </p>
          <p>
            © OpenStreetMap contributors — datos disponibles bajo la{" "}
            <Externo href="https://opendatacommons.org/licenses/odbl/">
              Open Database License (ODbL) ↗
            </Externo>
            .{" "}
            <Externo href="https://www.openstreetmap.org/copyright">
              Términos de atribución ↗
            </Externo>
          </p>
        </Seccion>

        <Seccion id="privacidad" titulo="Privacidad">
          <p>
            Este sitio no tiene servidor. Son archivos estáticos: no hay a dónde
            enviar tus datos, ni aunque quisiéramos. La promesa no depende de
            nuestra buena voluntad — depende de que no existe la máquina que los
            recibiría.
          </p>

          <h3 className="pt-1 text-tarjeta font-semibold">Qué no hacemos</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Ni una cookie.</li>
            <li>Sin analytics, sin píxeles, sin rastreadores de terceros.</li>
            <li>Sin cuentas, sin registro, sin formularios.</li>
            <li>
              Sin tipografías, scripts ni imágenes de otros dominios. El único
              servidor externo que toca tu navegador es el de los mosaicos del
              mapa (
              {/* `wrap-anywhere`: estos tres identificadores técnicos son
                  palabras sin espacios de hasta 22 caracteres; a 195 px CSS
                  (zoom 200 %) sacaban la página entera al scroll horizontal.
                  Solo parten cuando no caben — a ancho normal se ven igual. */}
              <span className="font-mono text-sec wrap-anywhere">
                tile.openstreetmap.org
              </span>
              ), y solo si abres el mapa.
            </li>
          </ul>

          <h3 className="pt-1 text-tarjeta font-semibold">Tu ubicación</h3>
          <p>
            Se pide solo cuando tocas «Usar mi ubicación», nunca al abrir la
            página. La distancia y el rumbo se calculan en tu teléfono, con la
            coordenada redondeada a unos{" "}
            <span className="font-mono tabular-nums">11</span> metros. Esa
            coordenada vive en la memoria de la pestaña: no viaja por la red, no
            entra en el enlace que compartes, no queda en el historial y no se
            registra en ninguna parte.
          </p>
          <p>
            Cuando tocas «Cómo llegar» sales a Google Maps con la coordenada del
            punto —un dato público—, nunca con la tuya.
          </p>

          <h3 className="pt-1 text-tarjeta font-semibold">
            Qué se guarda, solo si lo pides
          </h3>
          <p>
            Por defecto este sitio no escribe nada en tu dispositivo. Si marcas
            la casilla correspondiente, tu navegador recuerda:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-mono text-sec wrap-anywhere">ma:filtros</span>{" "}
              — la
              ciudad, las categorías y el filtro de estado que elegiste. Lo que
              escribes en el buscador no se guarda ni entra en el enlace que
              compartes.
            </li>
            <li>
              <span className="font-mono text-sec wrap-anywhere">
                ma:ubicacion
              </span>{" "}
              — tu
              última posición aproximada, solo si marcaste «Recordar mi
              ubicación en este dispositivo».
            </li>
          </ul>
          <p>
            Las dos viven en el almacenamiento local de tu navegador, en tu
            dispositivo, y las borras cuando quieras:
          </p>
          <BorrarDatos />
        </Seccion>
      </main>
      <PieDatos actualizadoHace={datos.actualizadoHace} />
    </>
  );
}
