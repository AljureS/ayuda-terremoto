import type { Categoria, Estado } from "./tipos";

/**
 * Etiquetas y clases por categoría (sistema badge = marker, DESIGN.md §5).
 * Las clases van como LITERALES COMPLETOS a propósito: el scanner de Tailwind
 * v4 solo detecta clases escritas enteras en el código fuente — nada de
 * `bg-cat-${cat}-tinte` dinámico.
 */
export const CATEGORIA_INFO: Record<
  Categoria,
  { etiqueta: string; badge: string }
> = {
  alimentos: {
    etiqueta: "Alimentos",
    badge: "bg-cat-alimentos-tinte text-cat-alimentos",
  },
  agua: { etiqueta: "Agua", badge: "bg-cat-agua-tinte text-cat-agua" },
  sangre: { etiqueta: "Sangre", badge: "bg-cat-sangre-tinte text-cat-sangre" },
  ropa_abrigo: {
    etiqueta: "Ropa y abrigo",
    badge: "bg-cat-ropa-tinte text-cat-ropa",
  },
  medicamentos: {
    etiqueta: "Medicamentos",
    badge: "bg-cat-medicamentos-tinte text-cat-medicamentos",
  },
  acopio_general: {
    etiqueta: "Acopio",
    badge: "bg-cat-acopio-tinte text-cat-acopio",
  },
  construccion: {
    etiqueta: "Construcción",
    badge: "bg-cat-construccion-tinte text-cat-construccion",
  },
  mascotas: {
    etiqueta: "Mascotas",
    badge: "bg-cat-mascotas-tinte text-cat-mascotas",
  },
  voluntariado: {
    etiqueta: "Voluntariado",
    badge: "bg-cat-voluntariado-tinte text-cat-voluntariado",
  },
  dinero: { etiqueta: "Dinero", badge: "bg-cat-dinero-tinte text-cat-dinero" },
};

/** Chip de estado: tinte + punto ● + palabra SIEMPRE (el color nunca va solo). */
export const ESTADO_INFO: Record<
  Estado,
  { texto: string; chip: string; punto: string | null }
> = {
  activo: {
    texto: "Activo",
    chip: "bg-activo-tinte text-activo",
    punto: "bg-activo-punto",
  },
  lleno: {
    texto: "Lleno — ya no recibe",
    chip: "bg-lleno-tinte text-lleno",
    punto: "bg-lleno-punto",
  },
  pausado: {
    texto: "Pausado",
    chip: "bg-pausado-tinte text-pausado",
    punto: "bg-pausado-punto",
  },
  // Chip invertido, sin punto: se lee "apagado" (DESIGN.md §1).
  cerrado: { texto: "Cerrado", chip: "bg-cerrado text-white", punto: null },
};

/** Orden de los chips de filtro (DESIGN.md §3: Alimentos, Agua, Sangre, Ropa…). */
export const ORDEN_CHIPS: Categoria[] = [
  "alimentos",
  "agua",
  "sangre",
  "ropa_abrigo",
  "medicamentos",
  "acopio_general",
  "construccion",
  "mascotas",
  "voluntariado",
  "dinero",
];
