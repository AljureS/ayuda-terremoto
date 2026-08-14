"use client";

import { useState } from "react";

import { borrarTodo } from "@/lib/almacen";
import { EVENTO_BORRADO, TEXTO_BORRADO, TEXTO_CONFIRMAR_BORRADO } from "@/lib/ubicacion";
import { CLASE_BTN_PRIMARIO, CLASE_BTN_SECUNDARIO } from "./piezas";

/**
 * "Borrar mis datos" — botón siempre visible en el pie (DESIGN.md §6), en
 * todas las páginas.
 *
 * Borra TODAS las claves del sitio enumerando por el prefijo `ma:` (nunca una
 * lista hardcodeada: una clave futura queda cubierta sola) y avisa a la lista
 * —vía un evento in-document sin datos— para que apague también la ubicación
 * que vive en memoria. La confirmación es in-page con el copy del sistema, no
 * un `confirm()` del navegador (que mostraría chrome del navegador en vez de
 * nuestro texto).
 */
export function BorrarDatos() {
  const [fase, setFase] = useState<"inicial" | "confirmar" | "listo">("inicial");

  function borrar() {
    borrarTodo();
    window.dispatchEvent(new Event(EVENTO_BORRADO));
    setFase("listo");
  }

  if (fase === "confirmar") {
    return (
      <div className="mt-2 max-w-prose rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
        <p className="text-sec">{TEXTO_CONFIRMAR_BORRADO}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={CLASE_BTN_PRIMARIO} onClick={borrar}>
            Borrar
          </button>
          <button
            type="button"
            className={CLASE_BTN_SECUNDARIO}
            onClick={() => setFase("inicial")}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3">
      <button
        type="button"
        className={CLASE_BTN_SECUNDARIO}
        onClick={() => setFase("confirmar")}
      >
        Borrar mis datos
      </button>
      {fase === "listo" && (
        <p className="text-sec text-secundario" role="status">
          {TEXTO_BORRADO}
        </p>
      )}
    </div>
  );
}
