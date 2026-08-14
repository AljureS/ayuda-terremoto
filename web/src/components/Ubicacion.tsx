"use client";

import { useEffect, useState } from "react";

import {
  CLAVE_UBICACION,
  borrar as borrarClave,
  escribir,
  leer,
} from "@/lib/almacen";
import { redondearPosicion, type Posicion } from "@/lib/geo";
import {
  EVENTO_BORRADO,
  MENSAJE_FALLO,
  OPCIONES_GEO,
  TEXTO_ALMACEN_BLOQUEADO,
  TEXTO_PREPERMISO,
  TEXTO_RECORDAR_UBICACION,
  falloDeCodigo,
  type FalloUbicacion,
} from "@/lib/ubicacion";
import { CLASE_BTN_PRIMARIO, CLASE_BTN_SECUNDARIO } from "./piezas";

/**
 * Bloque de ubicación — TODO el trato con `navigator.geolocation` del sitio
 * ocurre en este archivo (grep de auditoría: un solo punto de entrada).
 *
 * FRONTERA DE CONFIANZA (architecture.md §4, la promesa del banner es
 * literal): la posición nace en la callback del navegador, se redondea a ~11 m
 * y sube por `onPos` al estado de React de ListaFiltrada. De ahí sale
 * únicamente hacia el cálculo de Haversine/rumbo, que se pinta en la pantalla
 * de la propia persona. NO se envía por red (no hay backend ni un solo fetch
 * en `src/`), NO entra a la URL ni al history (el `replaceState` de W2 solo
 * conoce filtros), NO se loguea y NO se pasa a terceros (no hay terceros).
 * A localStorage solo llega si la persona marca el opt-in.
 */
export function Ubicacion({
  pos,
  onPos,
}: {
  pos: Posicion | null;
  onPos: (p: Posicion | null) => void;
}) {
  /** "inicial" → "pre" (microcopy previo al prompt) → "pidiendo". */
  const [fase, setFase] = useState<"inicial" | "pre" | "pidiendo">("inicial");
  const [fallo, setFallo] = useState<FalloUbicacion | null>(null);
  const [recordar, setRecordar] = useState(false);
  const [almacenBloqueado, setAlmacenBloqueado] = useState(false);
  /** La posición vigente viene de una sesión anterior de este dispositivo. */
  const [restaurada, setRestaurada] = useState(false);

  // Al cargar: si la persona pidió recordar, se restaura el riel SIN volver a
  // pedir permiso — es un dato local suyo, no una lectura nueva del sensor.
  // (La presencia de la clave ES el opt-in: no existe ningún flag aparte.)
  useEffect(() => {
    const guardada = leer(CLAVE_UBICACION);
    if (!guardada) return;
    try {
      const p = JSON.parse(guardada) as Partial<Posicion>;
      if (typeof p.lat === "number" && typeof p.lng === "number") {
        onPos(redondearPosicion(p.lat, p.lng));
        setRecordar(true);
        setRestaurada(true);
      } else {
        borrarClave(CLAVE_UBICACION);
      }
    } catch {
      borrarClave(CLAVE_UBICACION);
    }
    // Solo al montar: `onPos` es estable (setState de ListaFiltrada).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Borrar mis datos" vive en el pie, fuera de este árbol: se comunica con un
  // evento in-document que no transporta ningún dato (ver lib/ubicacion.ts).
  useEffect(() => {
    const apagar = () => {
      onPos(null);
      setRecordar(false);
      setRestaurada(false);
      setFallo(null);
      setFase("inicial");
    };
    window.addEventListener(EVENTO_BORRADO, apagar);
    return () => window.removeEventListener(EVENTO_BORRADO, apagar);
  }, [onPos]);

  function guardarSiRecuerda(p: Posicion, quiere: boolean) {
    if (!quiere) {
      borrarClave(CLAVE_UBICACION);
      return;
    }
    const ok = escribir(CLAVE_UBICACION, JSON.stringify(p));
    setAlmacenBloqueado(!ok);
  }

  /** Único punto del sitio que toca el sensor. Solo se llega aquí con un tap
   * dentro del panel de pre-permiso: jamás al cargar la página. */
  function pedirUbicacion() {
    setFallo(null);
    // Contexto inseguro (http) y navegador sin soporte se detectan ANTES de
    // llamar: así la persona recibe el mensaje útil en vez de un prompt que
    // no puede funcionar.
    // `!navigator.geolocation` y no `"geolocation" in navigator`: hay
    // navegadores (y políticas de permisos) donde la propiedad existe en el
    // prototipo pero vale undefined — con `in` pasaríamos el check y
    // reventaríamos al llamar getCurrentPosition.
    if (
      typeof window === "undefined" ||
      !window.isSecureContext ||
      !navigator.geolocation
    ) {
      setFallo("no-soportado");
      setFase("inicial");
      return;
    }
    setFase("pidiendo");
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        // El GeolocationPosition completo muere en esta callback: lo único que
        // sale de aquí es el par redondeado a ~11 m.
        const p = redondearPosicion(fix.coords.latitude, fix.coords.longitude);
        onPos(p);
        setRestaurada(false);
        setFase("inicial");
        guardarSiRecuerda(p, recordar);
      },
      (err) => {
        // El error NO se loguea: en algunos navegadores su `message` incluye
        // detalles del proveedor de ubicación.
        setFallo(falloDeCodigo(err.code));
        setFase("inicial");
      },
      OPCIONES_GEO,
    );
  }

  function quitarUbicacion() {
    onPos(null);
    setRestaurada(false);
    setRecordar(false);
    borrarClave(CLAVE_UBICACION);
  }

  function alternarRecordar(quiere: boolean) {
    setRecordar(quiere);
    if (pos) guardarSiRecuerda(pos, quiere);
    else if (!quiere) borrarClave(CLAVE_UBICACION);
  }

  const casillaRecordar = (
    <label className="flex min-h-tap cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        className="size-5 accent-accion"
        checked={recordar}
        onChange={(e) => alternarRecordar(e.target.checked)}
      />
      <span className="text-sec">{TEXTO_RECORDAR_UBICACION}</span>
    </label>
  );

  // ── Ubicación activa: el riel ya está encendido en la lista ──────────────
  if (pos) {
    return (
      <div className="mt-2">
        <p className="text-sec text-secundario">
          {restaurada
            ? "Ubicación recordada en este dispositivo. La lista está ordenada del punto más cercano al más lejano."
            : "Lista ordenada del punto más cercano al más lejano."}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {casillaRecordar}
          <button
            type="button"
            className={CLASE_BTN_SECUNDARIO}
            onClick={quitarUbicacion}
          >
            Quitar mi ubicación
          </button>
        </div>
        {almacenBloqueado && <AvisoAlmacen />}
      </div>
    );
  }

  // ── Panel de pre-permiso: SIEMPRE antes del prompt del navegador ─────────
  if (fase === "pre") {
    return (
      <div className="mt-2 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
        <p className="text-sec">{TEXTO_PREPERMISO}</p>
        <div className="mt-2">{casillaRecordar}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={CLASE_BTN_PRIMARIO}
            onClick={pedirUbicacion}
          >
            Usar mi ubicación
          </button>
          <button
            type="button"
            className={CLASE_BTN_SECUNDARIO}
            onClick={() => setFase("inicial")}
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  // ── Estado inicial: el botón invita, y nada más ha pasado ────────────────
  return (
    <div className="mt-2">
      <button
        type="button"
        className={CLASE_BTN_SECUNDARIO}
        disabled={fase === "pidiendo"}
        onClick={() => setFase("pre")}
      >
        {fase === "pidiendo" ? "Buscando tu ubicación…" : "📍 Usar mi ubicación"}
      </button>
      {fallo && (
        <p
          className="mt-2 max-w-prose text-sec text-secundario"
          role="status"
          data-fallo={fallo}
        >
          {MENSAJE_FALLO[fallo]}
        </p>
      )}
      {almacenBloqueado && <AvisoAlmacen />}
    </div>
  );
}

/** Safari en modo privado (y cookies bloqueadas) lanzan al escribir: la app
 * sigue funcionando y lo dice (microcopy DESIGN.md §6). */
function AvisoAlmacen() {
  return (
    <p className="mt-2 max-w-prose text-sec text-secundario" role="status">
      {TEXTO_ALMACEN_BLOQUEADO}
    </p>
  );
}
