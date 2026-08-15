"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CLAVE_FILTROS,
  borrar as borrarClave,
  escribir,
  leer,
} from "@/lib/almacen";
import { CATEGORIA_INFO, ORDEN_CHIPS } from "@/lib/categorias";
import { distanciaM, rumboGrados, type Posicion } from "@/lib/geo";
import { sinTildes } from "@/lib/texto";
import type { Categoria, CiudadOpcion, SitioVista } from "@/lib/tipos";
import {
  EVENTO_BORRADO,
  TEXTO_ALMACEN_BLOQUEADO,
  TEXTO_RECORDAR_FILTROS,
} from "@/lib/ubicacion";
import { PanelMapa } from "./mapa/PanelMapa";
import { TarjetaSitio } from "./TarjetaSitio";
import { Ubicacion } from "./Ubicacion";
import { CLASE_BTN_PRIMARIO, CLASE_BTN_SECUNDARIO } from "./piezas";

/**
 * Toda la interactividad de la home vive aquí, ENCIMA de una lista que ya
 * viene pre-renderizada en el HTML del build con el estado por defecto
 * (Bogotá, solo activos): sin JS la página sigue siendo útil.
 *
 * Filtros compartibles por URL (?cat=sangre&ciudad=cali&ver=todos) con
 * replaceState — arquitectura §3.11. PROHIBIDO por contrato que cualquier
 * dato de ubicación del usuario toque la URL: el efecto de sincronización de
 * abajo depende SOLO de los filtros ([inicializado, cats, ciudad, verTodos])
 * y `pos` no aparece en él ni en su cuerpo. La posición del usuario (W4)
 * vive únicamente en el estado `pos` de este componente.
 *
 * Lo que la persona ESCRIBE en el buscador tampoco sale de su dispositivo
 * (W6/BAJA-1): ni a localStorage ni a la URL. Ver el efecto 2).
 */

/** Una fila de la lista: el sitio y, si hay ubicación y coordenadas, el
 * resultado YA CALCULADO del riel. La posición del usuario nunca baja a las
 * tarjetas. */
interface Fila {
  sitio: SitioVista;
  riel?: { metros: number; rumbo: number };
}

const CIUDAD_DEFAULT = "bogota";
const TODAS = "todas";

function esCategoria(v: string): v is Categoria {
  return (ORDEN_CHIPS as string[]).includes(v);
}

export function ListaFiltrada({
  sitios,
  ciudades,
  nCampanas,
}: {
  sitios: SitioVista[];
  ciudades: CiudadOpcion[];
  nCampanas: number;
}) {
  const [ciudad, setCiudad] = useState(
    ciudades.some((c) => c.slug === CIUDAD_DEFAULT)
      ? CIUDAD_DEFAULT
      : (ciudades[0]?.slug ?? TODAS),
  );
  const [cats, setCats] = useState<ReadonlySet<Categoria>>(new Set());
  const [verTodos, setVerTodos] = useState(false);
  const [q, setQ] = useState("");
  const [inicializado, setInicializado] = useState(false);

  /**
   * POSICIÓN DEL USUARIO — vive aquí y en ningún otro lugar (arquitectura §4).
   * Es estado de React puro: memoria del dispositivo. De aquí sale solo hacia
   * el useMemo de distancias, cuyo resultado se pinta en la pantalla de la
   * propia persona. Nunca a red, URL, history, logs ni a terceros.
   */
  const [pos, setPos] = useState<Posicion | null>(null);

  /** Opt-in de filtros: la PRESENCIA de la clave `ma:filtros` es el opt-in
   * (no existe ningún flag adicional guardado). */
  const [recordarFiltros, setRecordarFiltros] = useState(false);
  const [almacenBloqueado, setAlmacenBloqueado] = useState(false);

  /**
   * Vista mapa (W3) — el mapa carga SOLO por acción del usuario, nunca al
   * cargar la página (el chunk de Leaflet es aparte; en 3G la lista no lo
   * paga). La vista se queda fuera de la URL a propósito: un link compartido
   * SIEMPRE abre en lista (el camino resiliente y pre-renderizado).
   */
  const [vistaMovil, setVistaMovil] = useState<"lista" | "mapa">("lista");
  const [mapaDesktop, setMapaDesktop] = useState(false);
  // Un solo Leaflet vivo a la vez: el mapa se monta en el hueco móvil O en el
  // aside desktop según el breakpoint real, nunca en ambos.
  const [esDesktop, setEsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const aplicar = () => setEsDesktop(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  // 1) Al cargar: aplicar los filtros que vengan en la URL compartida y, solo
  //    si no vino ninguno, los que la persona haya pedido recordar.
  //    PRECEDENCIA: la URL SIEMPRE gana. Un link de WhatsApp tiene que abrir
  //    la vista que quiso quien lo compartió, no las preferencias de quien lo
  //    recibe (si no, W2 se rompería en silencio).
  useEffect(() => {
    const busqueda = window.location.search;
    const p = new URLSearchParams(busqueda);
    const catParam = (p.get("cat") ?? "").split(",").filter(esCategoria);
    if (catParam.length) setCats(new Set(catParam));
    const ciudadParam = p.get("ciudad");
    if (
      ciudadParam &&
      (ciudadParam === TODAS || ciudades.some((c) => c.slug === ciudadParam))
    ) {
      setCiudad(ciudadParam);
    }
    if (p.get("ver") === "todos") setVerTodos(true);
    // `?q=` se LEE (un enlace viejo o escrito a mano sigue funcionando) pero
    // nunca se escribe: el efecto 2) lo borra de la barra de direcciones en el
    // primer render. Ver la nota de W6/BAJA-1 ahí.
    const qParam = p.get("q");
    if (qParam) setQ(qParam);

    if (!busqueda) {
      const guardado = leer(CLAVE_FILTROS);
      if (guardado) {
        setRecordarFiltros(true);
        try {
          const f = JSON.parse(guardado) as {
            cat?: string[];
            ciudad?: string;
            ver?: boolean;
          };
          const cs = (f.cat ?? []).filter(esCategoria);
          if (cs.length) setCats(new Set(cs));
          if (
            f.ciudad &&
            (f.ciudad === TODAS || ciudades.some((c) => c.slug === f.ciudad))
          ) {
            setCiudad(f.ciudad);
          }
          if (f.ver === true) setVerTodos(true);
        } catch {
          borrarClave(CLAVE_FILTROS);
          setRecordarFiltros(false);
        }
      }
    }
    setInicializado(true);
  }, [ciudades]);

  // 1b) Guardar los filtros SOLO con opt-in. La búsqueda libre (`q`) queda
  //     fuera a propósito: es texto que la persona escribió (a veces su propia
  //     dirección) y nadie quiere reabrir el sitio con una búsqueda vieja.
  useEffect(() => {
    if (!inicializado || !recordarFiltros) return;
    const ok = escribir(
      CLAVE_FILTROS,
      JSON.stringify({
        cat: ORDEN_CHIPS.filter((c) => cats.has(c)),
        ciudad,
        ver: verTodos,
      }),
    );
    if (!ok) setAlmacenBloqueado(true);
  }, [inicializado, recordarFiltros, cats, ciudad, verTodos]);

  // 1c) "Borrar mis datos" (pie, fuera de este árbol) apaga también el opt-in
  //     de filtros. La ubicación en memoria la apaga <Ubicacion> con onPos.
  useEffect(() => {
    const alBorrar = () => {
      setRecordarFiltros(false);
      setAlmacenBloqueado(false);
    };
    window.addEventListener(EVENTO_BORRADO, alBorrar);
    return () => window.removeEventListener(EVENTO_BORRADO, alBorrar);
  }, []);

  // 2) Al cambiar filtros: reflejarlos con replaceState (URL compartible por
  //    WhatsApp, sin ensuciar el historial). Solo filtros: nunca ubicación.
  //
  //    LA BÚSQUEDA LIBRE (`q`) NO SE ESCRIBE EN LA URL (fix W6/BAJA-1). W4 ya
  //    la había dejado fuera de localStorage por ser "texto que la persona
  //    escribió, a veces su propia dirección"; la URL es el artefacto MÁS
  //    expuesto de los dos: se comparte por WhatsApp, se pega en un chat y
  //    queda en el historial del teléfono. Lo que la gente comparte de verdad
  //    —"sangre en Bogotá"— son la categoría y la ciudad, y siguen viajando.
  //    Se sigue LEYENDO `?q=` al cargar (arriba) para no romper un enlace ya
  //    compartido; como este efecto usa replaceState, ese `q` heredado
  //    desaparece de la barra de direcciones y de la entrada del historial en
  //    cuanto la página monta. Por eso `q` tampoco está en las dependencias:
  //    si estuviera, cada tecla reescribiría la URL sin necesidad.
  useEffect(() => {
    if (!inicializado) return;
    const p = new URLSearchParams();
    if (cats.size) {
      p.set("cat", ORDEN_CHIPS.filter((c) => cats.has(c)).join(","));
    }
    if (ciudad !== CIUDAD_DEFAULT) p.set("ciudad", ciudad);
    if (verTodos) p.set("ver", "todos");
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [inicializado, cats, ciudad, verTodos]);

  const qNorm = sinTildes(q.trim());

  // Sitios de la ciudad elegida que pasan el filtro de estado (la base del
  // conteo honesto "X de Y").
  const base = useMemo(
    () =>
      sitios.filter(
        (s) =>
          (ciudad === TODAS || s.ciudadSlug === ciudad) &&
          (verTodos || s.estado === "activo"),
      ),
    [sitios, ciudad, verTodos],
  );

  const visibles = useMemo(
    () =>
      base.filter((s) => {
        if (cats.size && !s.categorias.some((c) => cats.has(c))) return false;
        if (
          qNorm &&
          !sinTildes(s.nombre).includes(qNorm) &&
          !sinTildes(s.direccion).includes(qNorm) &&
          !sinTildes(s.localidad).includes(qNorm)
        ) {
          return false;
        }
        return true;
      }),
    [base, cats, qNorm],
  );

  /**
   * ORDEN POR CERCANÍA (W4) — Haversine + rumbo geográfico, 100 % en el
   * cliente (arquitectura §4). Sin ubicación: exactamente el orden de W2, una
   * sola lista y riel vacío. Con ubicación: los sitios con coordenadas van del
   * más cercano al más lejano, y los que no tienen coordenadas NO fingen — se
   * agrupan al final tras el separador honesto (DESIGN.md §4).
   */
  const { cercanos, sinCoords } = useMemo(() => {
    if (!pos) {
      return {
        cercanos: visibles.map((s): Fila => ({ sitio: s })),
        sinCoords: [] as SitioVista[],
      };
    }
    const con: { sitio: SitioVista; riel: NonNullable<Fila["riel"]> }[] = [];
    const sin: SitioVista[] = [];
    for (const s of visibles) {
      if (s.lat != null && s.lng != null) {
        con.push({
          sitio: s,
          riel: {
            metros: distanciaM(pos, s.lat, s.lng),
            rumbo: rumboGrados(pos, s.lat, s.lng),
          },
        });
      } else {
        sin.push(s);
      }
    }
    con.sort((a, b) => a.riel.metros - b.riel.metros);
    return { cercanos: con as Fila[], sinCoords: sin };
  }, [visibles, pos]);

  /** El mapa hereda el mismo conjunto filtrado, en el orden vigente. NO
   * recibe la posición del usuario: en el mapa no hay marker de "yo" (W4). */
  const paraMapa = useMemo(
    () => [...cercanos.map((f) => f.sitio), ...sinCoords],
    [cercanos, sinCoords],
  );

  function alternarRecordarFiltros(quiere: boolean) {
    setRecordarFiltros(quiere);
    if (!quiere) {
      borrarClave(CLAVE_FILTROS);
      setAlmacenBloqueado(false);
    }
  }

  function alternarCategoria(c: Categoria) {
    setCats((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  }

  function quitarFiltros() {
    setCats(new Set());
    setQ("");
    setVerTodos(false);
  }

  const hayFiltrosFinos = cats.size > 0 || qNorm !== "";
  const nombreCiudad =
    ciudad === TODAS
      ? `${ciudades.length} ciudades`
      : (ciudades.find((c) => c.slug === ciudad)?.nombre ?? ciudad);
  const puntos = (n: number) => (n === 1 ? "1 punto" : `${n} puntos`);
  const conteo = hayFiltrosFinos
    ? `${visibles.length} de ${puntos(base.length)} en ${nombreCiudad}`
    : `${puntos(visibles.length)} en ${nombreCiudad}`;

  // Conteo honesto del mapa (DESIGN.md §6), sobre el conjunto filtrado.
  const enMapa = useMemo(
    () => visibles.filter((s) => s.lat != null && s.lng != null).length,
    [visibles],
  );
  const enMapaMovil = !esDesktop && vistaMovil === "mapa";

  return (
    <div className="w-full">
      {/* BARRA STICKY de 56 px (DESIGN.md §3): ciudad + búsqueda + toggle
          [Mapa] (W3, solo móvil — en desktop el mapa vive en el aside). */}
      <div className="sticky top-0 z-20 border-b border-borde bg-superficie">
        <div className="mx-auto flex h-barra max-w-6xl items-center gap-2 px-4">
          <label className="sr-only" htmlFor="filtro-ciudad">
            Ciudad
          </label>
          {/*
            `borde-control` (#78848F, 3.82 sobre `superficie`) y no `borde`
            (1.40) — W6/P6, DESIGN.md §1/§9. La regla: si el borde es lo único
            que dice "aquí se escribe", tiene que verse. Este `<select>` y el
            campo de búsqueda de abajo son los ÚNICOS dos controles que aceptan
            entrada; su contenido es dato de la persona, no una etiqueta que
            los nombre. Botones y chips se quedan con `borde` como trim: llevan
            su propia palabra a 6.75:1 y al activarse se rellenan sólidos.
          */}
          <select
            id="filtro-ciudad"
            className="h-tap w-2/5 max-w-52 min-w-0 rounded-tarjeta border border-borde-control bg-superficie px-2 text-base"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
          >
            {ciudades.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre} ({c.n})
              </option>
            ))}
            <option value={TODAS}>Todas las ciudades ({sitios.length})</option>
          </select>
          <label className="sr-only" htmlFor="filtro-busqueda">
            Buscar por nombre, dirección o localidad
          </label>
          <input
            id="filtro-busqueda"
            type="search"
            className="h-tap min-w-0 flex-1 rounded-tarjeta border border-borde-control bg-superficie px-3 text-base"
            placeholder="Buscar…"
            enterKeyHint="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {/* Toggle lista/mapa: button con aria-pressed (DESIGN.md §8). La
              lista es SIEMPRE la vista por defecto; Leaflet se descarga
              recién en el primer toque. */}
          <button
            type="button"
            aria-pressed={vistaMovil === "mapa"}
            onClick={() =>
              setVistaMovil((v) => (v === "mapa" ? "lista" : "mapa"))
            }
            className={`inline-flex h-tap shrink-0 items-center rounded-tarjeta border px-3 font-medium transition-colors duration-120 lg:hidden ${
              vistaMovil === "mapa"
                ? "border-accion bg-accion text-white"
                : "border-borde bg-superficie text-accion"
            }`}
          >
            Mapa
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {/* Chips de categorías: multiselección, scroll horizontal en móvil. */}
        <div className="pt-3 lg:flex lg:flex-wrap lg:items-center lg:gap-x-4">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {ORDEN_CHIPS.map((c) => {
              const activo = cats.has(c);
              return (
                <li key={c} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={activo}
                    onClick={() => alternarCategoria(c)}
                    className={`inline-flex min-h-tap items-center rounded-chip border px-4 font-medium whitespace-nowrap transition-colors duration-120 ${
                      activo
                        ? "border-accion bg-accion text-white"
                        : "border-borde bg-superficie text-tinta"
                    }`}
                  >
                    {CATEGORIA_INFO[c].etiqueta}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Filtro de estado: por defecto SOLO activo (contrato). */}
          <label className="mt-1 flex min-h-tap w-fit cursor-pointer items-center gap-2.5 lg:mt-0">
            <input
              type="checkbox"
              className="size-5 accent-accion"
              checked={verTodos}
              onChange={(e) => setVerTodos(e.target.checked)}
            />
            <span className="text-sec">Incluir llenos y cerrados</span>
          </label>
        </div>

        <div className="mt-3 lg:grid lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div>
            {/* Vista mapa móvil (W3): reemplaza la lista SOLO en pantalla —
                el HTML del build siempre trae la lista (vista default). El
                alto fijo del wrapper lo comparten placeholder y mapa: cero
                layout shift. */}
            {enMapaMovil && (
              <div className="panel-mapa-entrada h-[70dvh] overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-tarjeta lg:hidden">
                <PanelMapa
                  sitios={paraMapa}
                  onVolverALista={() => setVistaMovil("lista")}
                />
              </div>
            )}

            <div className={enMapaMovil ? "hidden lg:block" : undefined}>
            {/* Los 49 sin punto físico viven en /campanas, jamás mezclados
                con la lista local. <a> plano (no <Link>): navegación dura a
                HTML estático = funciona aunque el JS no haya cargado. */}
            {nCampanas > 0 && (
              <a
                href="/campanas/"
                className="block rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta"
              >
                <span className="font-semibold text-accion">
                  ▸ Campañas y convocatorias nacionales ({nCampanas})
                </span>{" "}
                <span className="text-sec text-secundario">
                  — ayuda desde cualquier lugar
                </span>
              </a>
            )}

            {/*
              Línea de conteo honesto (mono — DESIGN.md §4C/§6) y, desde W6,
              el ENCABEZADO DE SECCIÓN de la lista.

              Por qué h2 (fix W6/P2): la home encadenaba h1 → 67 h3 sin un solo
              h2, el único audit de accesibilidad en rojo. De las dos salidas
              (bajar las tarjetas a h2 o meter un h2 de sección) se elige esta:
              deja la home con la MISMA cadena que /campanas y /acerca
              (h1 → h2 de sección → h3 de tarjeta), el nombre del sitio sigue
              siendo h3 en las dos tarjetas del proyecto, y quien navegue por
              encabezados cae en la frase que dice cuántos puntos hay y dónde.
              El tamaño no cambia: el reset de Tailwind hereda font-size y
              font-weight en los encabezados, así que las clases mandan.
            */}
            <h2
              className="mt-4 font-mono text-sec tabular-nums"
              aria-live="polite"
            >
              {conteo}
            </h2>

            {/* Ubicación: SOLO on-tap, nunca al cargar (contrato). */}
            <Ubicacion pos={pos} onPos={setPos} />

            {visibles.length > 0 ? (
              <>
                {/* space-y (no flex): un li flex item hereda min-width:auto y una
                    palabra no partible (números de cuenta, URLs) ensancharía el
                    layout entero en 320 px. */}
                <ul className="mt-3 space-y-3">
                  {cercanos.map((f) => (
                    <li key={f.sitio.id}>
                      <TarjetaSitio
                        sitio={f.sitio}
                        mostrarCiudad={ciudad === TODAS}
                        riel={f.riel}
                      />
                    </li>
                  ))}
                </ul>
                {sinCoords.length > 0 && (
                  <>
                    {/* Separador honesto (DESIGN.md §4/§6): los sitios sin
                        coordenadas no fingen una distancia; se agrupan al
                        final con su conteo real del conjunto filtrado. */}
                    <p className="mt-5 text-center font-mono text-sec tabular-nums text-secundario">
                      — Sin ubicación exacta todavía ({sinCoords.length}) —
                    </p>
                    <ul className="mt-3 space-y-3">
                      {sinCoords.map((s) => (
                        <li key={s.id}>
                          <TarjetaSitio
                            sitio={s}
                            mostrarCiudad={ciudad === TODAS}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <EstadoVacio
                sinDatos={sitios.length === 0}
                soloCategoria={cats.size > 0 && !qNorm && ciudad !== TODAS}
                nombreCiudad={nombreCiudad}
                hayCampanas={nCampanas > 0}
                onQuitarFiltros={quitarFiltros}
              />
            )}

            {/* Preferencias de este dispositivo: el opt-in de filtros vive
                aquí, al final del contenido, para no estorbar la acción
                principal (DESIGN.md §0). El opt-in de ubicación va en el
                pre-permiso (§6) y "Borrar mis datos" en el pie. */}
            <div className="mt-6 border-t border-borde pt-2">
              <label className="flex min-h-tap w-fit cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  className="size-5 accent-accion"
                  checked={recordarFiltros}
                  onChange={(e) => alternarRecordarFiltros(e.target.checked)}
                />
                <span className="text-sec text-secundario">
                  {TEXTO_RECORDAR_FILTROS}
                </span>
              </label>
              {almacenBloqueado && (
                <p
                  className="max-w-prose text-sec text-secundario"
                  role="status"
                >
                  {TEXTO_ALMACEN_BLOQUEADO}
                </p>
              )}
            </div>
            </div>
          </div>

          {/* Aside desktop (≥1024): el mapa vive aquí, sticky, pero se monta
              SOLO al tocar "Ver mapa" — no al entrar al breakpoint. Decisión
              W3 (documentada en el README): el chunk de Leaflet + los tiles
              costarían ~50 KB gz de JS + ~200–400 KB de imágenes en el load
              de cada visita desktop, para un mapa que hoy ubica 20 de 204
              puntos; con el botón, quien lo quiere lo paga en ~1 s y quien
              no, paga 0. IntersectionObserver no difiere nada: el aside
              sticky ya es visible al cargar. */}
          <aside className="hidden lg:sticky lg:top-20 lg:block">
            {esDesktop && mapaDesktop ? (
              <div className="panel-mapa-entrada h-[70vh] overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-tarjeta">
                <PanelMapa sitios={paraMapa} />
              </div>
            ) : (
              <div className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded-tarjeta border border-borde bg-superficie p-6 text-center shadow-tarjeta">
                <p className="font-mono text-sec tabular-nums">
                  {enMapa} de {puntos(visibles.length)} ubicados en el mapa.
                </p>
                <p className="max-w-xs text-sec text-secundario">
                  El resto está en la lista.
                </p>
                <button
                  type="button"
                  className={CLASE_BTN_PRIMARIO}
                  onClick={() => setMapaDesktop(true)}
                >
                  Ver mapa
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * Estados vacíos — microcopy exacto de DESIGN.md §6.
 *
 * `hayCampanas` (W6/P8): §6 fija que **las campañas se mencionan solo si
 * existen**. Con 0 campañas, la frase que manda a las campañas nacionales
 * afirma algo falso y además enlaza a una página vacía (§10), así que la frase
 * y la acción [Ver campañas] desaparecen enteras — no se reescriben en
 * negativo. Es la misma regla que ya gobierna la tarjeta de acceso de arriba
 * (`nCampanas > 0`) y las secciones de /campanas.
 */
function EstadoVacio({
  sinDatos,
  soloCategoria,
  nombreCiudad,
  hayCampanas,
  onQuitarFiltros,
}: {
  sinDatos: boolean;
  soloCategoria: boolean;
  nombreCiudad: string;
  hayCampanas: boolean;
  onQuitarFiltros: () => void;
}) {
  const verCampanas = hayCampanas ? (
    <a className={CLASE_BTN_SECUNDARIO} href="/campanas/">
      Ver campañas
    </a>
  ) : null;

  if (sinDatos) {
    return (
      <div className="mt-3 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
        {/*
          HECHO + SALIDA, la gramática de los estados vacíos de DESIGN.md §6.
          Con campañas, la salida son las campañas. SIN campañas —dataset
          entero vacío— este estado se quedaba en el hecho y sin ninguna
          salida, que era la pregunta abierta que W6 dejó al director. La
          salida es /acerca: es la única página que sigue siendo útil sin un
          solo dato, porque explica qué es el sitio y cómo reportar un cambio.
          Una sola acción canónica, como pide §6: la de /acerca aparece
          únicamente cuando [Ver campañas] no existe.
        */}
        <p className="text-sec text-secundario">
          No hay puntos disponibles por ahora.{" "}
          {hayCampanas
            ? "Las campañas nacionales reciben ayuda desde cualquier lugar."
            : "Mira qué es este sitio y cómo reportar un cambio."}
        </p>
        <div className="mt-3">
          {verCampanas ?? (
            <a className={CLASE_BTN_SECUNDARIO} href="/acerca/">
              Acerca de este sitio
            </a>
          )}
        </div>
      </div>
    );
  }
  if (soloCategoria) {
    return (
      <div className="mt-3 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
        <p className="text-sec text-secundario">
          Todavía no hay puntos de esta categoría en {nombreCiudad}.{" "}
          {hayCampanas
            ? "Mira las campañas nacionales o revisa otra ciudad."
            : "Revisa otra ciudad."}
        </p>
        {verCampanas && <div className="mt-3">{verCampanas}</div>}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta">
      <p className="text-sec text-secundario">
        Ningún punto coincide con esta búsqueda. Quita algún filtro o revisa
        otra categoría.
        {hayCampanas &&
          " Las campañas nacionales reciben ayuda desde cualquier lugar."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={CLASE_BTN_SECUNDARIO}
          onClick={onQuitarFiltros}
        >
          Quitar filtros
        </button>
        {verCampanas}
      </div>
    </div>
  );
}
