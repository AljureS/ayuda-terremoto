"use client";

import { useState } from "react";

/**
 * "Qué reciben" — 15 px, máximo 2 líneas (jerarquía de tarjeta, DESIGN.md §3).
 * Como la tarjeta ES el detalle (no hay página de sitio), un texto largo no se
 * puede perder: "Ver más" quita el clamp. El umbral se decide por longitud
 * (sin medir el DOM: cero layout thrash en una lista de 60+ tarjetas).
 */
export function Descripcion({ texto }: { texto: string }) {
  const [expandida, setExpandida] = useState(false);
  const esLarga = texto.length > 120 || (texto.match(/\n/g)?.length ?? 0) >= 2;
  if (!texto) return null;
  return (
    <div>
      <p
        className={`break-words whitespace-pre-line text-sec text-secundario ${
          esLarga && !expandida ? "line-clamp-2" : ""
        }`}
      >
        {texto}
      </p>
      {esLarga && (
        <button
          type="button"
          className="-my-2 inline-flex min-h-tap items-center text-sec font-medium text-accion"
          aria-expanded={expandida}
          onClick={() => setExpandida(!expandida)}
        >
          {expandida ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
