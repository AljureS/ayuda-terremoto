/**
 * Tipos de /web.
 *
 * DUPLICACIÓN DELIBERADA (regla de oro del proyecto, docs/architecture.md §2–3):
 * `/web` no importa nada de `/scraper` — ni siquiera el tipo. El schema canónico
 * vive en docs/MASTER_PROMPT.md y su única definición ejecutable está en
 * /scraper/src/schema.ts (zod); aquí se duplica a mano el espejo TypeScript.
 * La única frontera entre las dos mitades del repo es /data/sitios.json,
 * leído EXCLUSIVAMENTE en build time (src/lib/datos.ts).
 * Si el schema cambia, se actualiza este archivo a mano.
 */

export const CATEGORIAS = [
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
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type Estado = "activo" | "lleno" | "pausado" | "cerrado";

/** Espejo 1:1 de un registro de /data/sitios.json (schema canónico). */
export interface SitioCrudo {
  id: string;
  nombre: string;
  categorias: Categoria[];
  descripcion: string;
  direccion: string;
  ciudad: string;
  localidad: string;
  lat: number | null;
  lng: number | null;
  horario: string;
  contacto: { telefono: string; web: string; instagram: string };
  fuente: string;
  estado: Estado;
  verificado: boolean;
  manual: boolean;
  ultimaActualizacion: string;
}

export interface DatosCrudos {
  actualizado: string;
  sitios: SitioCrudo[];
}

/**
 * Lo que la UI necesita de un sitio, preparado en build time (src/lib/datos.ts).
 * Solo campos que se renderizan: nada de `manual` ni timestamps crudos en el
 * payload del cliente.
 */
export interface SitioVista {
  id: string;
  nombre: string;
  categorias: Categoria[];
  descripcion: string;
  direccion: string;
  ciudadSlug: string;
  ciudadNombre: string;
  localidad: string;
  lat: number | null;
  lng: number | null;
  horario: string;
  /** Teléfono INSTITUCIONAL (conmutadores, líneas de organización): visible directo. */
  telefonoTexto?: string;
  /** href `tel:` del primer número institucional detectado. */
  telefonoHref?: string;
  web?: string;
  instagram?: string;
  /** El campo web traía a veces un correo: se rinde como mailto. */
  mailto?: string;
  fuente: string;
  estado: Estado;
  verificado: boolean;
  /** "hace 3 h" / "hace 2 días" — calculado en build (sin relojes en cliente en W2). */
  hace: string;
  /**
   * Contacto con NOMBRE DE PERSONA (DESIGN.md §7, decisión aprobada "revelado
   * al tocar"): JAMÁS viaja en claro en el HTML/payload inicial. Va ofuscado
   * (base64 de un JSON PersonaContacto[]) y el cliente lo decodifica solo
   * cuando la persona toca "Ver contacto". Ver src/lib/contacto.ts.
   */
  contactoPersonalB64?: string;
  /** href de "Cómo llegar" (coords o dirección), calculado en build. */
  comoLlegar?: string;
}

/** Estructura que se ofusca en base64 dentro de contactoPersonalB64. */
export interface PersonaContacto {
  nombre: string;
  /** Texto del número tal como lo publicó la fuente. */
  telTexto: string;
  /** href tel: normalizado. */
  telHref: string;
}

export interface CiudadOpcion {
  slug: string;
  nombre: string;
  /** Total de sitios de la ciudad en el dataset (todos los estados). */
  n: number;
}
