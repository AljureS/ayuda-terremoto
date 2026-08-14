/**
 * Config declarativa de fuentes oficiales para `npm run scrape` (F4b).
 *
 * El diseño viene del recon F4a (docs/RECON_FUENTES.md, verificado 12-ago-2026):
 * `bogota.gov.co` actúa como hub único — la Alcaldía publica ahí los listados
 * de todas las categorías, incluidos los puntos operados por Cruz Roja e
 * IDPYBA, y actualiza los artículos IN-PLACE. Por eso el scraper es UN módulo
 * cheerio (src/scrape.ts) parametrizado por esta lista: agregar un artículo
 * nuevo del hub = agregar una entrada aquí (el buscador del sitio está
 * bloqueado por robots.txt, así que los artículos se descubren a mano).
 *
 * Cada parser está atado a la redacción REAL del artículo (patrones descritos
 * en `notas`); si la redacción cambia, scrape.ts falla con mensaje claro en
 * vez de escribir basura (mandato del contrato). PLAYWRIGHT PROHIBIDO: el
 * recon confirmó que toda fuente viable es HTML estático server-rendered.
 */
import type { Categoria } from './schema.js';

/** Patrones de extracción implementados en scrape.ts (PARSERS). */
export type PatronParser =
  | 'acopio-alcaldia'
  | 'sangre-alcaldia'
  | 'articulo-unico-mascotas'
  | 'cruz-roja-sangre';

export interface Fuente {
  /** Clave corta para el reporte y los mensajes de error. */
  clave: string;
  /** URL exacta del artículo. Va TAL CUAL al campo `fuente` de cada registro. */
  url: string;
  /** Patrón de extracción (la redacción concreta está documentada en `notas`). */
  parser: PatronParser;
  /**
   * Categorías garantizadas por la naturaleza de la fuente. El parser puede
   * SUMAR categorías derivadas del texto (p. ej. acopio deriva las suyas de la
   * lista "¿Qué donar?" del artículo y aquí queda vacío a propósito).
   */
  categoriasBase: Categoria[];
  /**
   * Menos registros extraídos que esto = sospecha de cambio de redacción →
   * fallo explícito (no se escribe nada). Calibrado a ~2/3 de lo que el
   * artículo listaba al implementar el parser.
   */
  minimoEsperado: number;
  /** Qué es la fuente, qué patrón usa y qué decisiones se tomaron. */
  notas: string;
}

export const FUENTES: Fuente[] = [
  {
    clave: 'acopio-alcaldia',
    url: 'https://bogota.gov.co/mi-ciudad/seguridad/puntos-de-donacion-en-bogota-para-damnificados-terremoto-en-colombia',
    parser: 'acopio-alcaldia',
    categoriasBase: [],
    minimoEsperado: 5,
    notas:
      'Ruta 1 del contrato. Listado <ul><li> "Nombre, en la dirección" tras el párrafo ancla ' +
      '"…los siguientes puntos de acopio…" (5 puntos Cruz Roja al 13-ago; uno viene como dirección ' +
      'sola + localidad: "Calle 161A #7F-55 en Usaquén"). El Palacio de los Deportes va aparte, en ' +
      'párrafo "…ubicado en la calle 63 #59A-06…" (agregado in-place el 12-ago; si el artículo deja ' +
      'de mencionarlo se omite sin fallar, pero si lo menciona con otra redacción → fallo). Horario ' +
      'en párrafo global con excepciones (sede administrativa 24 h · Palacio 8:00–20:00). Categorías ' +
      'derivadas de las listas bajo "¿Qué elementos o alimentos donar?" (agua, cobijas→ropa_abrigo, ' +
      'alimentos no perecederos, primeros auxilios→medicamentos, higiene/aseo→acopio_general).',
  },
  {
    clave: 'sangre-alcaldia',
    url: 'https://bogota.gov.co/mi-ciudad/salud/puntos-para-donar-sangre-en-bogota-para-atencion-terremoto-2026',
    parser: 'sangre-alcaldia',
    categoriasBase: ['sangre'],
    minimoEsperado: 10,
    notas:
      'Sección <h2> "Puntos permanentes de bancos de sangre…": cada banco es <h3> Nombre + <ul> con ' +
      '"Dirección: X" y "Teléfono/Celular: Y" (16 bancos al 13-ago). DECISIÓN: el punto temporal de ' +
      'la Secretaría Distrital de Salud (sección h2 aparte, vigencia 12–14 ago) NO se extrae — es la ' +
      'misma dirección del IDCBIS (Carrera 32 #12-81), ya listado como banco permanente, y caduca en ' +
      'días; si se volviera permanente, cargarlo con /nuevo-sitio.',
  },
  {
    clave: 'mascotas-corferias',
    url: 'https://bogota.gov.co/mi-ciudad/ambiente/corferias-sera-centro-de-acopio-ayuda-animales-afectados-terremoto',
    parser: 'articulo-unico-mascotas',
    categoriasBase: ['mascotas'],
    minimoEsperado: 1,
    notas:
      'Artículo único (campaña IDPYBA): 1 punto en "…el arco de Corferias, ubicado en la ' +
      'carrera 37 # 24-67…". Horario en párrafo "Asiste con tu donación de 10:00 a. m. a 6:00 p. m., ' +
      '…del jueves 13 al lunes 17 de agosto de 2026" — vigencia limitada visible en el horario; el ' +
      'estado lo decide la persona mantenedora cuando pase la fecha.',
  },
  {
    clave: 'cruz-roja-sangre',
    url: 'https://www.cruzrojacolombiana.org/cruz-roja-colombiana-despliega-capacidades-para-dar-respuesta-tras-las-afectaciones-por-sismo-en-colombia/',
    parser: 'cruz-roja-sangre',
    categoriasBase: ['sangre'],
    minimoEsperado: 1,
    notas:
      'Comunicado nacional (WordPress; el DOM duplica cada <li>, se deduplica por texto). Ancla ' +
      'semántica obligatoria: "…llamado urgente a donación de sangre…" — garantiza que la lista de ' +
      'sedes siga siendo de donación de sangre. Se extraen solo los <li> "Bogotá: <dirección>. ' +
      'Cel: <número>" (otras ciudades fuera de alcance por ahora). La dirección (Av. Carrera 68 ' +
      '#68B-31) coincide con el Banco Nacional de Sangre del hub → duplicado esperado que resuelve ' +
      'el dedupe de F5.',
  },
];

/**
 * RESPALDO (ruta 2 del contrato) — NO se scrapea: el recon verificó que es un
 * snapshot del 10–11 ago redundante con la ruta 1 (mismos 4 puntos iniciales,
 * sin el Palacio). Queda documentada para verificación cruzada manual:
 *
 * { clave: 'acopio-alcaldia-respaldo',
 *   url: 'https://bogota.gov.co/mi-ciudad/ambiente/alcaldia-de-bogota-habilito-cuatro-puntos-de-donaciones-terremoto',
 *   parser: 'acopio-alcaldia', categoriasBase: [], minimoEsperado: 4,
 *   notas: 'Snapshot inicial de la ruta 1; activar solo si la ruta 1 muere.' }
 */
