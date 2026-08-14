/**
 * Schema canónico de /data/sitios.json — ÚNICA definición ejecutable.
 *
 * El contrato vive en docs/MASTER_PROMPT.md; la semántica de los campos de
 * control en docs/architecture.md §2. La web (/web) duplicará su propio tipo
 * `Sitio` a propósito (regla de oro): NUNCA exportar esto para que /web lo
 * importe.
 *
 * Toda escritura de /data/sitios.json pasa por este schema (ver
 * lib/sitios-file.ts). zod valida en el borde de escritura: un dato corrupto
 * no puede entrar al repo.
 */
import { z } from 'zod';

/** Enum cerrado de categorías (contrato). Los filtros, colores de marker y
 *  badges de la web derivan de él — no agregar valores sin cambiar el contrato.
 *  El orden declarado aquí es también el orden canónico de serialización. */
export const CATEGORIAS = [
  'alimentos',
  'agua',
  'ropa_abrigo',
  'mascotas',
  'construccion',
  'medicamentos',
  'sangre',
  'voluntariado',
  'dinero',
  'acopio_general',
] as const;

/** Ciclo de vida de un punto: activo ⇄ lleno ⇄ pausado → cerrado. */
export const ESTADOS = ['activo', 'lleno', 'pausado', 'cerrado'] as const;

/**
 * Timestamp ISO 8601 con offset fijo de Bogotá (−05:00, sin DST).
 * Ej.: "2026-08-12T09:30:00-05:00". El regex exige el offset explícito;
 * el refine descarta fechas imposibles (mes 13, 30 de febrero…).
 */
const timestampBogota = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?-05:00$/,
    'debe ser ISO 8601 con offset de Bogotá, p. ej. "2026-08-12T09:30:00-05:00"',
  )
  .refine((s) => !Number.isNaN(Date.parse(s)), 'fecha inválida (no existe en el calendario)');

/** Contacto del sitio. Campos presentes siempre; cadena vacía = no se conoce. */
export const ContactoSchema = z.strictObject({
  telefono: z.string(),
  web: z.string(),
  instagram: z.string(),
});

/**
 * Un punto de ayuda. strictObject: una clave desconocida (p. ej. un typo en
 * una edición manual) hace fallar la validación en vez de pasar en silencio.
 */
export const SitioSchema = z.strictObject({
  /** Slug kebab-case ESTABLE: una vez publicado, no se regenera nunca. */
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'debe ser slug kebab-case: minúsculas, dígitos y guiones (ej. "cruz-roja-sede-centro")'),
  nombre: z.string().min(1, 'nombre no puede estar vacío'),
  categorias: z.array(z.enum(CATEGORIAS)).min(1, 'todo sitio necesita al menos una categoría'),
  /** Qué reciben o qué se necesita ahí. Vacío permitido (se completa después). */
  descripcion: z.string(),
  direccion: z.string(),
  /**
   * Vacía = registro sin punto físico (campañas de dinero, convocatorias
   * nacionales de voluntariado): aparece solo en la lista, nunca en el mapa.
   * Decisión aprobada en la parada de contrato 2b (F2, docs/PLAN_SCRAPPER.md);
   * antes exigía min(1), lo que contradecía ese mapeo aprobado.
   */
  ciudad: z.string(),
  localidad: z.string(),
  /**
   * null = aún sin geocodificar o geocodificación fallida (JAMÁS inventar).
   * Límites universales de coordenada; la sanidad de bbox Colombia/Bogotá es
   * responsabilidad del geocodificador (F3) y de /validate-data (calidad).
   */
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  horario: z.string(),
  contacto: ContactoSchema,
  /**
   * Trazabilidad pública: siempre poblada. Normalmente una URL oficial;
   * min(1) en vez de .url() para no bloquear registros manuales de emergencia
   * cuya procedencia es p. ej. "verificación telefónica 2026-08-12".
   * La calidad de las fuentes la revisa /validate-data.
   */
  fuente: z.string().min(1, 'fuente siempre debe estar poblada (trazabilidad del dato)'),
  estado: z.enum(ESTADOS),
  /** false = importado de la comunidad sin confirmar; true = confirmado. */
  verificado: z.boolean(),
  /** true = editado por un humano: el pipeline NO lo modifica ni elimina jamás. */
  manual: z.boolean(),
  ultimaActualizacion: timestampBogota,
});

/** Archivo completo /data/sitios.json: { actualizado, sitios }. */
export const ArchivoSitiosSchema = z
  .strictObject({
    actualizado: timestampBogota,
    sitios: z.array(SitioSchema),
  })
  .superRefine((archivo, ctx) => {
    // El id es la identidad del sitio: dos sitios con el mismo id = archivo corrupto.
    const vistos = new Map<string, number>();
    archivo.sitios.forEach((sitio, i) => {
      const previo = vistos.get(sitio.id);
      if (previo !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['sitios', i, 'id'],
          message: `id duplicado "${sitio.id}" (ya aparece en sitios[${previo}])`,
        });
      } else {
        vistos.set(sitio.id, i);
      }
    });
  });

export type Categoria = (typeof CATEGORIAS)[number];
export type Estado = (typeof ESTADOS)[number];
export type Contacto = z.infer<typeof ContactoSchema>;
export type Sitio = z.infer<typeof SitioSchema>;
export type ArchivoSitios = z.infer<typeof ArchivoSitiosSchema>;
