/**
 * Markers del mapa — L.divIcon con SVG inline (DESIGN.md §5, spec exacto):
 * círculo de 28 px con el SÓLIDO de la categoría, aro blanco de 2 px, sombra
 * 0 1px 2px rgba(16,24,32,0.3), glifo blanco propio por categoría y target
 * táctil efectivo de 44 px (padding invisible del divIcon).
 *
 * NUNCA los íconos default de Leaflet: se rompen con bundlers (rutas de
 * marker-icon.png) y no pertenecen al sistema badge = marker.
 *
 * Este módulo vive en el CHUNK del mapa (solo lo importa Mapa.tsx).
 */
import { divIcon, type DivIcon } from "leaflet";

import { CATEGORIAS, type Categoria, type Estado } from "@/lib/tipos";

/**
 * Color del sólido por categoría, como referencia a los tokens del sistema
 * (regla dura de DESIGN.md §9: ningún hex inline — las CSS vars del bloque
 * @theme de globals.css son la única fuente). Mismo sólido que el texto del
 * badge: sistema badge = marker.
 */
const VAR_CATEGORIA: Record<Categoria, string> = {
  alimentos: "--color-cat-alimentos",
  agua: "--color-cat-agua",
  sangre: "--color-cat-sangre",
  ropa_abrigo: "--color-cat-ropa",
  medicamentos: "--color-cat-medicamentos",
  acopio_general: "--color-cat-acopio",
  construccion: "--color-cat-construccion",
  mascotas: "--color-cat-mascotas",
  voluntariado: "--color-cat-voluntariado",
  dinero: "--color-cat-dinero",
};

/**
 * Glifos blancos (viewBox 0 0 16 16), 10 paths dibujados a mano, ≤ 200 bytes
 * cada uno. Iniciales no sirven: Alimentos/Agua/Acopio colisionan (§5).
 * El blanco del glifo y del aro es spec literal de §5 ("glifo blanco",
 * "aro blanco"), no un hex fuera de tokens.
 */
const GLIFOS: Record<Categoria, string> = {
  // Caja de acopio: tapa + cuerpo.
  acopio_general:
    '<path fill="#fff" d="M2.8 3.4h10.4v3.1H2.8z M3.8 7.5h8.4V13H3.8z"/>',
  // Manzana con hoja.
  alimentos:
    '<path fill="#fff" d="M8 5.4C6.9 4.5 4.9 4.7 4.1 6.3c-.9 1.9.2 5 1.7 6.3.6.5 1.4.6 2.2.2.8.4 1.6.3 2.2-.2 1.5-1.3 2.6-4.4 1.7-6.3-.8-1.6-2.8-1.8-3.9-.9z M8.1 4.9c-.1-1.3.8-2.4 2.2-2.6.1 1.3-.9 2.5-2.2 2.6z"/>',
  // Gota.
  agua: '<path fill="#fff" d="M8 2.3c1.9 2.6 3.7 5.2 3.7 7.2a3.7 3.7 0 1 1-7.4 0c0-2 1.8-4.6 3.7-7.2z"/>',
  // Gota con cruz recortada: se distingue de `agua` sin depender del color.
  sangre:
    '<path fill="#fff" fill-rule="evenodd" d="M8 2.3c1.9 2.6 3.7 5.2 3.7 7.2a3.7 3.7 0 1 1-7.4 0c0-2 1.8-4.6 3.7-7.2zM7.3 7.2h1.4v1.6h1.6v1.4H8.7v1.6H7.3v-1.6H5.7V8.8h1.6z"/>',
  // Cruz.
  medicamentos:
    '<path fill="#fff" d="M6.2 2.6h3.6v3.6h3.6v3.6H9.8v3.6H6.2V9.8H2.6V6.2h3.6z"/>',
  // Muro de ladrillos.
  construccion:
    '<path fill="#fff" d="M2.6 4.2h5v3h-5z M8.4 4.2h5v3h-5z M2.6 8h2.2v3H2.6z M5.6 8h4.8v3H5.6z M11.2 8h2.2v3h-2.2z"/>',
  // Camiseta.
  ropa_abrigo:
    '<path fill="#fff" d="M5.6 2.9 8 4l2.4-1.1 3 2.1-1.2 2.2-1.4-.7v6.4H5.2V6.5l-1.4.7L2.6 5z"/>',
  // Persona (cabeza + torso).
  voluntariado:
    '<path fill="#fff" d="M8 2.8a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z M3.4 13.2c.3-3.1 2.1-4.6 4.6-4.6s4.3 1.5 4.6 4.6z"/>',
  // Billete con círculo recortado.
  dinero:
    '<path fill="#fff" fill-rule="evenodd" d="M2.2 4.6h11.6v6.8H2.2zM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/>',
  // Huella: almohadilla + 4 dedos.
  mascotas:
    '<path fill="#fff" d="M8 8.2c1.7 0 3.1 1.2 3.1 2.6 0 1-.7 1.6-1.6 1.6-.5 0-1-.3-1.5-.3s-1 .3-1.5.3c-.9 0-1.6-.6-1.6-1.6 0-1.4 1.4-2.6 3.1-2.6z"/><circle fill="#fff" cx="4.2" cy="6.4" r="1.2"/><circle fill="#fff" cx="6.7" cy="4.6" r="1.2"/><circle fill="#fff" cx="9.3" cy="4.6" r="1.2"/><circle fill="#fff" cx="11.8" cy="6.4" r="1.2"/>',
};

/**
 * Regla del marker para sitios multi-categoría: manda la PRIMERA categoría en
 * el ORDEN DEL ENUM (CATEGORIAS de tipos.ts). En el dataset actual coincide
 * con la primera del array en los 111 sitios multi-categoría (verificado
 * 2026-08-14), pero el enum es la regla estable ante datos futuros
 * desordenados. El popup siempre lista todas como badges (§5).
 */
export function primeraCategoriaEnum(cats: Categoria[]): Categoria {
  let mejor: Categoria | null = null;
  let mejorIdx: number = CATEGORIAS.length;
  for (const c of cats) {
    const i = CATEGORIAS.indexOf(c);
    if (i !== -1 && i < mejorIdx) {
      mejorIdx = i;
      mejor = c;
    }
  }
  return mejor ?? "acopio_general";
}

/** 10 categorías × 2 variantes (activo / desaturado): se memoizan. */
const cache = new Map<string, DivIcon>();

export function iconoSitio(categoria: Categoria, estado: Estado): DivIcon {
  const activo = estado === "activo";
  const clave = `${categoria}:${activo ? "a" : "g"}`;
  const memo = cache.get(clave);
  if (memo) return memo;

  // Estado ≠ activo en el mapa: marker desaturado a --color-pausado-punto
  // (#85929D, DESIGN.md §5); el popup muestra el chip de estado.
  const color = activo
    ? `var(${VAR_CATEGORIA[categoria]})`
    : "var(--color-pausado-punto)";

  const icono = divIcon({
    // className propio: evita el fondo blanco con borde del
    // `.leaflet-div-icon` default. Estilos en mapa.css.
    className: "mk-sitio",
    html: `<span class="mk-circulo" style="background:${color}"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${GLIFOS[categoria]}</svg></span>`,
    // 44 × 44: target táctil efectivo ≥ 44 px con círculo visible de 28 px.
    iconSize: [44, 44],
    // Marker circular: ancla en su centro (no hay punta de pin).
    iconAnchor: [22, 22],
    popupAnchor: [0, -20],
  });
  cache.set(clave, icono);
  return icono;
}
