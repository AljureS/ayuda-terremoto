"use client";

import { useState } from "react";

import type { PersonaContacto } from "@/lib/tipos";
import { CLASE_BTN_SECUNDARIO } from "./piezas";

/**
 * Contacto con nombre de persona — "revelado al tocar" (DESIGN.md §7,
 * decisión aprobada). El nombre y el celular llegan OFUSCADOS (base64) desde
 * el build y solo se decodifican aquí, en el dispositivo, cuando la persona
 * toca "Ver contacto". Así no quedan en claro en el HTML estático (ni
 * indexables ni cosechables con un curl), pero la utilidad humana — "pregunta
 * por Carolina" — se conserva a un tap de distancia.
 */
export function VerContacto({
  b64,
  esVoluntariado,
}: {
  b64: string;
  esVoluntariado: boolean;
}) {
  const [revelado, setRevelado] = useState(false);
  const [personas, setPersonas] = useState<PersonaContacto[] | null>(null);

  function alternar() {
    if (!revelado && personas === null) {
      try {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        setPersonas(JSON.parse(new TextDecoder().decode(bytes)));
      } catch {
        setPersonas([]);
      }
    }
    setRevelado(!revelado);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sec text-secundario">
        {esVoluntariado
          ? "Contacto de voluntariado disponible"
          : "Contacto disponible"}
      </p>
      <button
        type="button"
        className={CLASE_BTN_SECUNDARIO}
        aria-expanded={revelado}
        onClick={alternar}
      >
        {revelado ? "Ocultar contacto" : "Ver contacto"}
      </button>
      {revelado && personas && (
        <ul className="flex w-full flex-col gap-2">
          {personas.length === 0 && (
            <li className="text-sec text-secundario">
              No se pudo mostrar el contacto.
            </li>
          )}
          {personas.map((p) => (
            <li
              key={`${p.nombre}-${p.telTexto}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="text-sec">
                Pregunta por <strong className="font-semibold">{p.nombre}</strong>
                {p.telTexto && (
                  <span className="font-mono tabular-nums text-secundario">
                    {" · "}
                    {p.telTexto}
                  </span>
                )}
              </span>
              {p.telHref && (
                <a className={CLASE_BTN_SECUNDARIO} href={p.telHref}>
                  Llamar
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
