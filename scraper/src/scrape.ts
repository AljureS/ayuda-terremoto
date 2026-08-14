/**
 * `npm run scrape` — F4b: scrapea las fuentes oficiales de src/sources.ts
 * (hub bogota.gov.co + Cruz Roja) con cheerio y escribe los registros a un
 * STAGING versionado: /scraper/cache/scraped.json.
 *
 * ⚠ SEMÁNTICA DE STAGING (decisión de arquitectura, F4b):
 * este comando NO escribe /data/sitios.json. Los puntos del hub (sedes de la
 * Cruz Roja, Palacio de los Deportes, bancos de sangre…) YA existen en
 * sitios.json vía la hoja comunitaria con otros ids — mezclarlos aquí sin
 * dedupe crearía duplicados. El merge con dedupe cross-fuente es
 * responsabilidad de F5 (`npm run build:data`). Cada registro del staging
 * queda validado individualmente contra el schema canónico de sitio.
 *
 * Ética innegociable (contrato docs/MASTER_PROMPT.md — verificable aquí):
 *   · robots.txt de cada dominio se descarga y se respeta ANTES de scrapear
 *     (parser de User-agent/Disallow/Allow/Crawl-delay abajo). Si no se puede
 *     verificar, NO se scrapea ese dominio (fail-closed).
 *   · ≥ 2 s entre requests al mismo dominio (más si robots pide Crawl-delay).
 *   · User-Agent identificable con correo de contacto.
 *   · Solo las URLs de la config (fuentes oficiales); `fuente` = URL exacta
 *     del artículo en cada registro.
 *
 * Tolerancia a cambios (contrato): cada parser está atado a la redacción real
 * del artículo. Si el HTML o la redacción cambian, lanza ErrorDePatron con la
 * URL y el patrón que se rompió; si CUALQUIER fuente falla, no se escribe
 * nada (el staging anterior queda intacto — all-or-nothing). Un mínimo
 * esperado por fuente detecta listas sospechosamente cortas.
 *
 * Re-ejecutable sin churn: si el contenido extraído no cambió, el archivo no
 * se reescribe y los timestamps por registro se conservan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { ZodError } from 'zod';
import { ArchivoSitiosSchema, SitioSchema } from './schema.js';
import type { ArchivoSitios, Categoria, Sitio } from './schema.js';
import { normalizarTexto } from './lib/normalize.js';
import { slugify } from './lib/slug.js';
import { ahoraBogota } from './lib/time.js';
import { RAIZ_REPO, RUTA_SITIOS_JSON } from './lib/paths.js';
import { escribirSitios, ordenarArchivo } from './lib/sitios-file.js';
import { FUENTES, type Fuente, type PatronParser } from './sources.js';

// ───────────────────────── Configuración ─────────────────────────

export const USER_AGENT = 'MapaAyudaBogota/1.0 (contacto: saidsimon2@gmail.com)';
/** Piso del contrato: jamás menos de 2 s entre requests al mismo dominio. */
const DELAY_MINIMO_MS = 2000;
const TIMEOUT_MS = 30_000;

/** Staging versionado (junto a la caché de geocode, que también se versiona). */
export const RUTA_SCRAPED = path.join(RAIZ_REPO, 'scraper', 'cache', 'scraped.json');

// ───────────────────────── Error de patrón (contrato) ─────────────────────────

/**
 * El HTML o la redacción del artículo cambiaron: el parser NO encontró lo que
 * esperaba. El mensaje dice qué patrón se rompió y en qué URL — requisito del
 * contrato: fallar claro, jamás escribir basura.
 */
export class ErrorDePatron extends Error {
  constructor(url: string, patron: string, detalle: string) {
    super(
      `patrón roto en ${url}\n` +
        `      patrón esperado: ${patron}\n` +
        `      qué pasó: ${detalle}\n` +
        `      → El artículo cambió de redacción o de HTML. Revisar la página a mano y actualizar el\n` +
        `        parser correspondiente en src/scrape.ts (y las notas en src/sources.ts).`,
    );
    this.name = 'ErrorDePatron';
  }
}

/** Menos registros que el mínimo de la config = sospecha de cambio → fallo. */
export function verificarMinimo(fuente: Fuente, obtenidos: number): void {
  if (obtenidos < fuente.minimoEsperado) {
    throw new ErrorDePatron(
      fuente.url,
      `al menos ${fuente.minimoEsperado} registro(s) extraíble(s) (mínimo de "${fuente.clave}" en src/sources.ts)`,
      `solo extraje ${obtenidos} — lista sospechosamente corta`,
    );
  }
}

// ───────────────────────── Utilidades de texto ─────────────────────────

/** Colapsa todo espacio en blanco (incluye NBSP y saltos) a un espacio. */
function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** Normalización tipográfica de direcciones: guiones largos → "-", sin punto final. */
function limpiarDireccion(texto: string): string {
  return limpiar(texto).replace(/[–—]/g, '-').replace(/[.,;:]+$/, '');
}

/** "8.00 a. m. a 8.00 p. m" → "8:00 a. m. a 8:00 p. m." (solo tipografía). */
function normalizarHoras(texto: string): string {
  let t = limpiar(texto).replace(/(\d{1,2})\.(\d{2})/g, '$1:$2').replace(/[,;:]+$/, '');
  if (/[ap]\.?\s?m$/i.test(t)) t += '.';
  return t;
}

/**
 * Duplicado deliberado y mínimo de la heurística de vías del importador
 * (import-sheet.ts no es importable: ejecuta main() al cargarse). Solo lo
 * necesario para desambiguar ids: detectar vía inicial y armar su token.
 */
const PALABRAS_VIA = new Set([
  'carrera', 'cra', 'kra', 'calle', 'cl', 'avenida', 'av', 'transversal', 'tv',
  'diagonal', 'dg', 'autopista', 'via', 'km', 'kilometro',
]);

function empiezaConVia(texto: string): boolean {
  const primera = normalizarTexto(texto).split(' ')[0] ?? '';
  return PALABRAS_VIA.has(primera);
}

/** "Av. Carrera 68 # 68B-31" → "av-carrera-68" (para sufijos de id). */
function tokenDeVia(direccion: string): string {
  const palabras = normalizarTexto(direccion).split(' ').filter(Boolean);
  const i = palabras.findIndex((p) => PALABRAS_VIA.has(p));
  if (i === -1) return palabras.slice(0, 2).join('-');
  const token = [palabras[i]!];
  let j = i;
  while (j + 1 < palabras.length && PALABRAS_VIA.has(palabras[j + 1]!)) {
    j += 1;
    token.push(palabras[j]!);
  }
  if (j + 1 < palabras.length) token.push(palabras[j + 1]!);
  return token.join('-');
}

// ───────────────────────── robots.txt (ética verificable) ─────────────────────────

export interface GrupoRobots {
  agentes: string[];
  reglas: { tipo: 'allow' | 'disallow'; patron: string }[];
  crawlDelayS: number | null;
}

/** Parser simple del estándar: grupos User-agent con Disallow/Allow/Crawl-delay. */
export function parsearRobots(texto: string): GrupoRobots[] {
  const grupos: GrupoRobots[] = [];
  let actual: GrupoRobots | null = null;
  let anteriorFueAgente = false;
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = (cruda.split('#')[0] ?? '').trim();
    if (!linea) continue;
    const dosPuntos = linea.indexOf(':');
    if (dosPuntos === -1) continue;
    const directiva = linea.slice(0, dosPuntos).trim().toLowerCase();
    const valor = linea.slice(dosPuntos + 1).trim();
    if (directiva === 'user-agent') {
      if (!anteriorFueAgente || actual === null) {
        actual = { agentes: [], reglas: [], crawlDelayS: null };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      anteriorFueAgente = true;
      continue;
    }
    anteriorFueAgente = false;
    if (actual === null) continue; // regla suelta antes de todo User-agent: se ignora (estándar)
    if (directiva === 'disallow' || directiva === 'allow') {
      if (valor !== '') actual.reglas.push({ tipo: directiva, patron: valor });
    } else if (directiva === 'crawl-delay') {
      const s = Number.parseFloat(valor);
      if (Number.isFinite(s) && s > 0) actual.crawlDelayS = Math.max(actual.crawlDelayS ?? 0, s);
    }
  }
  return grupos;
}

/** Regla robots → regex: `*` comodín, `$` ancla final, el resto literal. */
function reglaARegex(patron: string): RegExp {
  const anclaFinal = patron.endsWith('$');
  const cuerpo = anclaFinal ? patron.slice(0, -1) : patron;
  const escapado = cuerpo.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escapado}${anclaFinal ? '$' : ''}`);
}

export interface VeredictoRobots {
  permitido: boolean;
  /** La regla que decidió (para el reporte), o null si ninguna aplicó. */
  regla: string | null;
  crawlDelayS: number | null;
}

/**
 * Evalúa una ruta contra los grupos: aplican los grupos específicos de nuestro
 * UA si existen, si no los de `*` (estándar). Gana la regla más larga que
 * matchee; en empate gana Allow.
 */
export function evaluarRobots(grupos: GrupoRobots[], userAgent: string, ruta: string): VeredictoRobots {
  const uaMin = userAgent.toLowerCase();
  const especificos = grupos.filter((g) =>
    g.agentes.some((a) => a !== '*' && a !== '' && uaMin.includes(a)),
  );
  const aplicables = especificos.length > 0 ? especificos : grupos.filter((g) => g.agentes.includes('*'));
  let mejor: { tipo: 'allow' | 'disallow'; patron: string } | null = null;
  let crawlDelayS: number | null = null;
  for (const g of aplicables) {
    if (g.crawlDelayS !== null) crawlDelayS = Math.max(crawlDelayS ?? 0, g.crawlDelayS);
    for (const r of g.reglas) {
      if (!reglaARegex(r.patron).test(ruta)) continue;
      if (
        mejor === null ||
        r.patron.length > mejor.patron.length ||
        (r.patron.length === mejor.patron.length && r.tipo === 'allow' && mejor.tipo === 'disallow')
      ) {
        mejor = r;
      }
    }
  }
  return {
    permitido: mejor === null || mejor.tipo === 'allow',
    regla: mejor ? `${mejor.tipo === 'allow' ? 'Allow' : 'Disallow'}: ${mejor.patron}` : null,
    crawlDelayS,
  };
}

// ───────────────────────── Red (rate limit por dominio) ─────────────────────────

let requestsReales = 0;
const ultimoRequestPorHost = new Map<string, number>();
const esperaPorHost = new Map<string, number>();

async function dormir(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Garantiza la espera del dominio (≥ 2 s; más si su robots pidió Crawl-delay). */
async function turnoDeRed(host: string): Promise<void> {
  const espera = esperaPorHost.get(host) ?? DELAY_MINIMO_MS;
  const previo = ultimoRequestPorHost.get(host);
  if (previo !== undefined) {
    const transcurrido = Date.now() - previo;
    if (transcurrido < espera) await dormir(espera - transcurrido);
  }
  ultimoRequestPorHost.set(host, Date.now());
}

async function descargar(url: string, host: string): Promise<Response> {
  await turnoDeRed(host);
  requestsReales += 1;
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
}

interface RobotsDeHost {
  grupos: GrupoRobots[];
  nota: string; // qué decía (para el reporte)
}

/**
 * Descarga y parsea el robots.txt del dominio. 404/410 = sin reglas (estándar).
 * Cualquier otra falla = NO se puede verificar → no se scrapea el dominio
 * (fail-closed: la ética no se asume, se comprueba).
 */
async function obtenerRobots(origen: string, host: string): Promise<RobotsDeHost> {
  const url = `${origen}/robots.txt`;
  let res: Response;
  try {
    res = await descargar(url, host);
  } catch (e) {
    throw new Error(
      `no pude descargar ${url} (${e instanceof Error ? e.message : String(e)}) — sin verificar robots.txt NO se scrapea ${host}`,
    );
  }
  if (res.status === 404 || res.status === 410) {
    return { grupos: [], nota: `sin robots.txt (HTTP ${res.status}) → sin restricciones` };
  }
  if (!res.ok) {
    throw new Error(`${url} respondió HTTP ${res.status} — sin verificar robots.txt NO se scrapea ${host}`);
  }
  const grupos = parsearRobots(await res.text());
  const disallows = grupos
    .filter((g) => g.agentes.includes('*'))
    .flatMap((g) => g.reglas.filter((r) => r.tipo === 'disallow').map((r) => r.patron));
  const delay = grupos.find((g) => g.crawlDelayS !== null)?.crawlDelayS ?? null;
  const resumen = disallows.length === 0 ? 'sin Disallow para *' : `Disallow (*): ${disallows.slice(0, 6).join(', ')}${disallows.length > 6 ? ` … (${disallows.length} reglas)` : ''}`;
  return { grupos, nota: `${resumen}${delay !== null ? ` · Crawl-delay ${delay}s` : ' · sin Crawl-delay'}` };
}

// ───────────────────────── Parsers por patrón de redacción ─────────────────────────

/** Registro tal como sale del artículo (scrape.ts lo completa a Sitio). */
export interface RegistroCrudo {
  nombre: string;
  direccion: string;
  localidad: string;
  horario: string;
  descripcion: string;
  /** Derivadas del texto; se unen con las categoriasBase de la fuente. */
  categorias: Categoria[];
  telefono: string;
}

export interface ResultadoParser {
  registros: RegistroCrudo[];
  /** Observaciones no fatales (para el reporte). */
  avisos: string[];
}

type Parser = ($: CheerioAPI, fuente: Fuente) => ResultadoParser;

function registroBase(): Omit<RegistroCrudo, 'nombre' | 'direccion'> {
  return { localidad: '', horario: '', descripcion: '', categorias: [], telefono: '' };
}

/** Cuerpo de artículo Drupal de bogota.gov.co: `.field--name-body > div`. */
function cuerpoArticuloBogota($: CheerioAPI, url: string): Element[] {
  const campo = $('.field--name-body').first();
  if (campo.length === 0) {
    throw new ErrorDePatron(url, 'contenedor Drupal `.field--name-body` con el cuerpo del artículo', 'el selector no existe en la página (cambió la plantilla del sitio)');
  }
  const cuerpo = campo.children('div').first();
  const hijos = cuerpo.length > 0 ? cuerpo.children().toArray() : [];
  if (hijos.filter((el) => el.tagName === 'p').length === 0) {
    throw new ErrorDePatron(url, '`.field--name-body > div` con párrafos <p>', 'el contenedor del cuerpo está vacío o sin párrafos (cambió la plantilla)');
  }
  return hijos;
}

/**
 * Reglas de la lista "¿Qué donar?" del artículo de acopio → categorías del
 * enum + rótulo para la descripción (sobre texto normalizado, sin tildes).
 * "aseo/higiene" no tiene categoría propia: mapea a acopio_general (contrato).
 */
const REGLAS_DONAR: { categoria: Categoria; re: RegExp; rubro: string }[] = [
  { categoria: 'agua', re: /\bagua (?:potable|embotellada)\b/, rubro: 'agua potable embotellada' },
  { categoria: 'ropa_abrigo', re: /\bcobijas?\b|\bmantas?\b|\bcolchonetas?\b|\balmohadas?\b|\btoldillos?\b|\bcarpas?\b|\bropa\b/, rubro: 'cobijas, mantas y colchonetas' },
  { categoria: 'alimentos', re: /alimentos no perecederos|\barroz\b|\benlatados?\b|\bpanela\b|\bgranos?\b/, rubro: 'alimentos no perecederos' },
  { categoria: 'medicamentos', re: /primeros auxilios|\bgasas?\b|\balcohol\b|\btapabocas\b|\bmedicamentos?\b/, rubro: 'suministros de primeros auxilios' },
  { categoria: 'acopio_general', re: /higiene personal|\bjabon\b|\bpanales?\b|papel higienico|\baseo\b/, rubro: 'artículos de higiene personal' },
];

/**
 * Patrón acopio-alcaldia (ruta 1 del contrato). Redacción real al 13-ago-2026:
 *   · ancla: <p> "…realízala en los siguientes puntos de acopio de la Cruz Roja…"
 *   · <ul> siguiente: <li> "Nombre, en la dirección" / "Nombre, ubicado en la
 *     dirección" / "Dirección en Localidad" (li de solo-dirección).
 *   · Palacio de los Deportes en <p> aparte "…ubicado en la calle 63 #59A-06…".
 *   · horario global en <p> "Los horarios de atención…" con excepciones.
 *   · categorías derivadas de las listas bajo el <h3> "¿Qué…donar?".
 */
const parseAcopio: Parser = ($, fuente) => {
  const url = fuente.url;
  const avisos: string[] = [];
  const hijos = cuerpoArticuloBogota($, url);
  const textoDe = (el: Element): string => limpiar($(el).text());
  const esHeading = (el: Element): boolean => /^h[23]$/.test(el.tagName);

  // 1 · Párrafo ancla + su <ul> de puntos.
  const iAncla = hijos.findIndex((el) => el.tagName === 'p' && /siguientes puntos de acopio/i.test(textoDe(el)));
  if (iAncla === -1) {
    throw new ErrorDePatron(url, 'párrafo ancla "…los siguientes puntos de acopio…" seguido de la lista <ul>', 'ningún <p> del artículo tiene esa redacción');
  }
  const operadorCruzRoja = /cruz roja/i.test(textoDe(hijos[iAncla]!));
  if (!operadorCruzRoja) avisos.push('el párrafo ancla ya no menciona a la Cruz Roja: revisar quién opera los puntos');
  const iHeadingTrasAncla = hijos.findIndex((el, i) => i > iAncla && esHeading(el));
  const iUl = hijos.findIndex((el, i) => i > iAncla && (el.tagName === 'ul' || el.tagName === 'ol'));
  if (iUl === -1 || (iHeadingTrasAncla !== -1 && iUl > iHeadingTrasAncla)) {
    throw new ErrorDePatron(url, '<ul> de puntos entre el párrafo ancla y el siguiente subtítulo', 'la lista de puntos ya no está donde el patrón la espera');
  }

  interface PuntoAcopio { nombre: string; direccion: string; localidad: string; horario: string; extra: string }
  const puntos: PuntoAcopio[] = [];
  $(hijos[iUl]!)
    .children('li')
    .each((j, li) => {
      const texto = limpiar($(li).text()).replace(/\.\s*$/, '');
      if (!texto) return;
      const m = texto.match(/^(.+?),\s*(?:que\s+)?(?:est[aá]\s+)?(?:ubicad[oa]s?\s+)?en\s+(?:la|el|los|las)?\s*(.+)$/i);
      if (m) {
        // "Nombre, en la dirección[, con <nota>]"
        const nombre = limpiar(m[1]!);
        const [dir, ...notas] = m[2]!.split(/,\s*con\s+/i);
        const nota = limpiar(notas.join(', '));
        puntos.push({
          nombre,
          direccion: limpiarDireccion(dir ?? ''),
          localidad: '',
          horario: /24\s*horas/i.test(nota) ? 'Las 24 horas' : '',
          extra: nota && !/24\s*horas/i.test(nota) ? nota : '',
        });
        return;
      }
      if (empiezaConVia(texto)) {
        // "Dirección en Localidad" (punto sin nombre de sede).
        const mLoc = texto.match(/^(.+?)\s+en\s+([A-ZÁÉÍÓÚÑ][\p{L}\s]{2,30})$/u);
        const direccion = limpiarDireccion(mLoc ? mLoc[1]! : texto);
        const localidad = mLoc ? limpiar(mLoc[2]!) : '';
        const sufijo = localidad || direccion;
        puntos.push({
          nombre: `Punto de acopio ${operadorCruzRoja ? 'Cruz Roja ' : ''}— ${sufijo}`,
          direccion,
          localidad,
          horario: '',
          extra: '',
        });
        return;
      }
      throw new ErrorDePatron(
        url,
        '<li> "Nombre, en la dirección" · "Nombre, ubicado en la dirección" · "Dirección en Localidad"',
        `el ítem ${j + 1} de la lista no sigue ninguno: "${texto}"`,
      );
    });
  if (puntos.length === 0) {
    throw new ErrorDePatron(url, '<ul> de puntos con al menos un <li>', 'la lista de puntos está vacía');
  }

  // 2 · Palacio de los Deportes (párrafo aparte; agregado in-place el 12-ago).
  //     Si el artículo deja de mencionarlo → se omite (retiro legítimo);
  //     si lo menciona pero la redacción de la dirección cambió → fallo.
  const textoCuerpo = limpiar(hijos.map(textoDe).join(' '));
  let palacio: PuntoAcopio | null = null;
  if (/Palacio de los Deportes/i.test(textoCuerpo)) {
    const m = textoCuerpo.match(/Palacio de los Deportes(?: de Bogot[aá])?,\s*ubicado en la\s+([^,]+)/i);
    if (!m) {
      throw new ErrorDePatron(url, 'párrafo "…el Palacio de los Deportes…, ubicado en la <dirección>…"', 'el artículo menciona el Palacio de los Deportes pero la redacción de su dirección cambió');
    }
    palacio = { nombre: 'Palacio de los Deportes', direccion: limpiarDireccion(m[1]!), localidad: '', horario: '', extra: '' };
  } else {
    avisos.push('el artículo ya no menciona el Palacio de los Deportes: punto retirado de la fuente');
  }

  // 3 · Horario: párrafo global con excepciones.
  const elHorario = hijos.find((el) => el.tagName === 'p' && /horarios de atenci/i.test(textoDe(el)));
  let horarioGlobal = '';
  let parrafoAmbiguo: string | null = null;
  let textoExcepcion = '';
  let horarioPalacio = '';
  if (elHorario) {
    const t = textoDe(elHorario);
    const g = t.match(/de\s+(\d{1,2}[:.]\d{2}\s*a\.?\s*m\.?\s*a\s+\d{1,2}[:.]\d{2}\s*p\.?\s*m\.?)\s+de\s+lunes\s+a\s+domingo/i);
    if (g) {
      horarioGlobal = `${normalizarHoras(g[1]!)}, lunes a domingo`;
    } else {
      parrafoAmbiguo = t;
      avisos.push('párrafo de horarios presente pero con redacción no reconocida → va completo a la descripción');
    }
    const iExc = normalizarTexto(t).indexOf('con excepcion');
    textoExcepcion = iExc >= 0 ? normalizarTexto(t).slice(iExc) : '';
    const p = t.match(/Palacio de los Deportes,?\s*que tiene atenci[oó]n de\s+(.+?)$/i);
    if (p) horarioPalacio = normalizarHoras(p[1]!);
  } else {
    avisos.push('el artículo no trae párrafo de horarios → horario vacío');
  }

  // 4 · Categorías: derivadas de las listas bajo "¿Qué…donar?". Se leen solo
  //     los <ul> de la sección y los <p> introductorios (terminan en ":").
  const iDonar = hijos.findIndex((el) => esHeading(el) && /qu[eé].*donar/i.test(textoDe(el)));
  if (iDonar === -1) {
    throw new ErrorDePatron(url, 'subtítulo "¿Qué elementos o alimentos donar?" con sus listas', 'no existe ese subtítulo — sin él no puedo derivar las categorías del punto');
  }
  const iFinDonar = hijos.findIndex((el, i) => i > iDonar && esHeading(el));
  const seccion = hijos
    .slice(iDonar + 1, iFinDonar === -1 ? hijos.length : iFinDonar)
    .filter((el) => el.tagName === 'ul' || el.tagName === 'ol' || (el.tagName === 'p' && textoDe(el).endsWith(':')))
    .map(textoDe)
    .join(' ');
  const textoDonar = normalizarTexto(seccion);
  const reglasActivas = REGLAS_DONAR.filter((r) => r.re.test(textoDonar));
  if (reglasActivas.length < 2) {
    throw new ErrorDePatron(
      url,
      'listas de "¿Qué donar?" con rubros reconocibles (agua, cobijas, alimentos, primeros auxilios, higiene…)',
      `solo derivé ${reglasActivas.length} categoría(s) de la sección — la lista cambió demasiado para confiar en ella`,
    );
  }
  const categorias = reglasActivas.map((r) => r.categoria);
  const rubros = reglasActivas.map((r) => r.rubro).join('; ');

  // 5 · Armar registros.
  const descBase =
    `Punto de acopio de donaciones y ayudas humanitarias para damnificados del terremoto` +
    `${operadorCruzRoja ? ', operado con la Cruz Roja Colombiana Seccional Bogotá' : ''}. Se recibe: ${rubros}.`;
  const registros: RegistroCrudo[] = [];
  const armar = (p: PuntoAcopio, descripcion: string): void => {
    const enExcepcion = textoExcepcion !== '' && textoExcepcion.includes(normalizarTexto(p.nombre));
    let horario = p.horario; // lo dicho en el propio <li> (p. ej. 24 horas) manda
    let desc = descripcion;
    if (p.extra) desc += ` ${p.extra}.`;
    if (!horario) {
      if (parrafoAmbiguo !== null) {
        desc += ` Horarios según la fuente: ${parrafoAmbiguo}`;
      } else if (enExcepcion) {
        // El párrafo lo exceptúa pero no pudimos extraer su horario específico.
        desc += elHorario ? ` Horario con excepción según la fuente: ${textoDe(elHorario)}` : '';
        avisos.push(`"${p.nombre}" está en las excepciones de horario pero sin horario propio extraíble → va a descripción`);
      } else {
        horario = horarioGlobal;
      }
    }
    registros.push({ ...registroBase(), nombre: p.nombre, direccion: p.direccion, localidad: p.localidad, horario, descripcion: desc, categorias });
  };
  for (const p of puntos) armar(p, descBase);
  if (palacio) {
    if (horarioPalacio) palacio.horario = horarioPalacio;
    armar(
      palacio,
      `Centro de acopio habilitado por Bogotá en el Palacio de los Deportes; las donaciones se destinan ` +
        `a la atención de personas afectadas por el terremoto en poblaciones de Chocó. Se recibe: ${rubros}.`,
    );
  }
  return { registros, avisos };
};

/**
 * Patrón sangre-alcaldia. Redacción real al 13-ago-2026: bajo el <h2>
 * "Puntos permanentes de bancos de sangre…", cada banco es un <h3> con el
 * nombre seguido de un <ul> con "Dirección: X" y "Teléfono/Celular: Y".
 * La sección termina en el siguiente <h2>. (El punto temporal de la SDS de
 * ese <h2> siguiente NO se extrae — decisión documentada en sources.ts.)
 */
const parseSangre: Parser = ($, fuente) => {
  const url = fuente.url;
  const avisos: string[] = [];
  const hijos = cuerpoArticuloBogota($, url);
  const textoDe = (el: Element): string => limpiar($(el).text());

  const recomienda = /comunicarse con el banco de sangre/i.test(limpiar(hijos.map(textoDe).join(' ')));
  const descripcion =
    'Banco de sangre habilitado para donación tras el terremoto.' +
    (recomienda ? ' La fuente recomienda comunicarse antes de acudir para confirmar horarios, disponibilidad y condiciones para la donación.' : '');

  const registros: RegistroCrudo[] = [];
  let dentro = false;
  let encontroAncla = false;
  let nombreActual: string | null = null;
  for (const el of hijos) {
    const tag = el.tagName;
    if (tag === 'h2') {
      if (nombreActual !== null) {
        throw new ErrorDePatron(url, 'cada <h3> de banco seguido de su <ul> con "Dirección: …"', `el banco "${nombreActual}" quedó sin lista de dirección al cerrar la sección`);
      }
      dentro = /puntos permanentes de bancos de sangre/i.test(textoDe(el));
      if (dentro) encontroAncla = true;
      continue;
    }
    if (!dentro) continue;
    if (tag === 'h3') {
      if (nombreActual !== null) {
        throw new ErrorDePatron(url, 'cada <h3> de banco seguido de su <ul> con "Dirección: …"', `el banco "${nombreActual}" no tiene lista antes del siguiente subtítulo`);
      }
      nombreActual = textoDe(el);
      continue;
    }
    if ((tag === 'ul' || tag === 'ol') && nombreActual !== null) {
      let direccion = '';
      const telefonos: string[] = [];
      $(el)
        .children('li')
        .each((_, li) => {
          const t = limpiar($(li).text());
          const mDir = t.match(/^direcci[oó]n\s*:?\s*(.+)$/i);
          const mTel = t.match(/^(?:tel[eé]fonos?|celular(?:es)?)\s*:?\s*(.+)$/i);
          if (mDir) direccion = limpiarDireccion(mDir[1]!);
          else if (mTel) telefonos.push(limpiar(mTel[1]!).replace(/[.,;]+$/, ''));
          else if (t) avisos.push(`línea no reconocida bajo "${nombreActual}": "${t}" (ignorada)`);
        });
      if (!direccion) {
        throw new ErrorDePatron(url, '<li> "Dirección: <dirección>" dentro de la lista de cada banco', `el banco "${nombreActual}" no trae línea de Dirección`);
      }
      registros.push({ ...registroBase(), nombre: nombreActual, direccion, descripcion, telefono: telefonos.join(' / ') });
      nombreActual = null;
    }
  }
  if (!encontroAncla) {
    throw new ErrorDePatron(url, '<h2> "Puntos permanentes de bancos de sangre de Bogotá…"', 'no existe ese subtítulo — cambió la estructura del artículo');
  }
  if (registros.length === 0) {
    throw new ErrorDePatron(url, 'bancos <h3> + <ul> dentro de la sección de puntos permanentes', 'la sección existe pero no extraje ningún banco');
  }
  return { registros, avisos };
};

/**
 * Patrón articulo-unico-mascotas (Corferias / IDPYBA). Redacción real al
 * 13-ago-2026: "…el arco de Corferias, ubicado en la carrera 37 # 24-67…" y
 * horario "Asiste con tu donación de 10:00 a. m. a 6:00 p. m., … del jueves
 * 13 al lunes 17 de agosto de 2026."
 */
const parseMascotas: Parser = ($, fuente) => {
  const url = fuente.url;
  const avisos: string[] = [];
  const hijos = cuerpoArticuloBogota($, url);
  const textoDe = (el: Element): string => limpiar($(el).text());
  const textoCuerpo = limpiar(hijos.map(textoDe).join(' '));

  const mDir = textoCuerpo.match(/arco de Corferias,\s*ubicado en la\s+([^,]+)/i);
  if (!mDir) {
    throw new ErrorDePatron(url, 'redacción "…el arco de Corferias, ubicado en la <dirección>…"', 'no encuentro la dirección del punto — cambió la redacción del artículo');
  }
  const pHorario = hijos.find((el) => el.tagName === 'p' && /^asiste con tu donaci[oó]n de\s+/i.test(textoDe(el)));
  let horario = '';
  if (pHorario) {
    horario = normalizarHoras(textoDe(pHorario).replace(/^asiste con tu donaci[oó]n de\s+/i, '').replace(/\.\s*$/, ''));
  } else {
    avisos.push('sin párrafo de horario reconocible ("Asiste con tu donación de…") → horario vacío');
  }

  const partes = ['Centro de acopio para ayudar a los animales afectados por el terremoto'];
  if (/instituto distrital de protecci[oó]n y bienestar animal|idpyba/i.test(textoCuerpo)) {
    partes[0] += ', campaña del Instituto Distrital de Protección y Bienestar Animal (IDPYBA)';
  } else {
    avisos.push('el artículo ya no menciona al IDPYBA: revisar quién opera la campaña');
  }
  if (/expopet/i.test(textoCuerpo)) partes[0] += ', en el marco de la feria ExpoPet 2026';
  if (hijos.some((el) => /^h[23]$/.test(el.tagName) && /que se pueden donar/i.test(textoDe(el)))) {
    partes.push('Se reciben alimento y elementos para mascotas, y medicamentos e insumos veterinarios');
  }
  if (/no es necesario ingresar/i.test(textoCuerpo)) partes.push('No es necesario ingresar al centro de eventos');

  return {
    registros: [{
      ...registroBase(),
      nombre: 'Arco de Corferias — acopio para animales',
      direccion: limpiarDireccion(mDir[1]!),
      horario,
      descripcion: `${partes.join('. ')}.`,
    }],
    avisos,
  };
};

/**
 * Patrón cruz-roja-sangre (comunicado nacional en WordPress). Redacción real
 * al 13-ago-2026: ancla "…llamado urgente a donación de sangre…" y sedes como
 * <li> "Ciudad: dirección. Cel: número". Solo se toman los de Bogotá; el DOM
 * duplica cada <li> (versión móvil/escritorio) → dedupe por texto.
 */
const parseCruzRoja: Parser = ($, fuente) => {
  const url = fuente.url;
  const ancla = $('li, p')
    .filter((_, el) => /llamado urgente a (?:la )?donaci[oó]n de sangre/i.test($(el).text()))
    .first();
  if (ancla.length === 0) {
    throw new ErrorDePatron(
      url,
      'texto ancla "…llamado urgente a donación de sangre…" antes de la lista de sedes',
      'no aparece — sin él no puedo asegurar que la lista de sedes siga siendo de donación de sangre',
    );
  }
  const descripcion = limpiar(ancla.text());

  const registros: RegistroCrudo[] = [];
  const vistos = new Set<string>();
  $('li').each((_, el) => {
    const texto = limpiar($(el).text());
    const m = texto.match(/^Bogot[aá]\s*:\s*(.+)$/i);
    if (!m) return;
    const claveDedupe = normalizarTexto(texto);
    if (vistos.has(claveDedupe)) return; // duplicado del DOM
    vistos.add(claveDedupe);
    const m2 = m[1]!.match(/^(.+?)(?:\.\s*Cel\s*\.?\s*:?\s*([\d\s.-]+))?\.?$/i);
    if (!m2) {
      throw new ErrorDePatron(url, '<li> "Bogotá: <dirección>. Cel: <número>"', `el ítem de Bogotá no sigue el patrón: "${texto}"`);
    }
    registros.push({
      ...registroBase(),
      nombre: 'Cruz Roja Colombiana — donación de sangre',
      direccion: limpiarDireccion(m2[1]!),
      descripcion,
      telefono: m2[2] ? `Cel: ${limpiar(m2[2])}` : '',
    });
  });
  if (registros.length === 0) {
    throw new ErrorDePatron(url, '<li> "Bogotá: <dirección>…" en las listas de sedes', 'ningún ítem de la página es de Bogotá');
  }
  return { registros, avisos: [] };
};

export const PARSERS: Record<PatronParser, Parser> = {
  'acopio-alcaldia': parseAcopio,
  'sangre-alcaldia': parseSangre,
  'articulo-unico-mascotas': parseMascotas,
  'cruz-roja-sangre': parseCruzRoja,
};

// ───────────────────────── Ids estables dentro del staging ─────────────────────────

/**
 * Ids deterministas con la escalera existente: slug(nombre) → +ciudad →
 * +token de vía. Son la identidad provisional del staging: en F5 el dedupe
 * decide si el punto ya existía en sitios.json (y ahí se conserva el id más
 * antiguo, regla del contrato). Colisión irresoluble = artículo con dos
 * puntos indistinguibles → fallo explícito.
 */
export function asignarIds(pares: { crudo: RegistroCrudo; fuente: Fuente }[]): Map<RegistroCrudo, string> {
  interface Pendiente { crudo: RegistroCrudo; fuente: Fuente; id: string; etapa: number }
  const pendientes: Pendiente[] = pares.map(({ crudo, fuente }) => {
    const base = slugify(crudo.nombre);
    if (!base) throw new Error(`el nombre "${crudo.nombre}" (${fuente.clave}) no produce slug utilizable`);
    return { crudo, fuente, id: base, etapa: 0 };
  });

  const enConflicto = (): Pendiente[][] => {
    const porId = new Map<string, Pendiente[]>();
    for (const p of pendientes) {
      const grupo = porId.get(p.id);
      if (grupo) grupo.push(p);
      else porId.set(p.id, [p]);
    }
    return [...porId.values()].filter((g) => g.length > 1);
  };

  for (let pasada = 0; pasada < 2; pasada++) {
    const grupos = enConflicto();
    if (grupos.length === 0) break;
    for (const grupo of grupos) {
      for (const p of grupo) {
        p.etapa += 1;
        const sufijo = p.etapa === 1 ? slugify('Bogotá') : tokenDeVia(p.crudo.direccion);
        if (sufijo && !`-${p.id}-`.includes(`-${sufijo}-`)) p.id = `${p.id}-${sufijo}`;
      }
    }
  }
  const restantes = enConflicto();
  if (restantes.length > 0) {
    const detalle = restantes
      .map((g) => g.map((p) => `"${p.crudo.nombre}" (${p.fuente.clave}, ${p.crudo.direccion})`).join(' vs '))
      .join(' · ');
    throw new Error(`colisión de ids irresoluble en el staging (¿puntos duplicados en el artículo?): ${detalle}`);
  }
  return new Map(pendientes.map((p) => [p.crudo, p.id]));
}

// ───────────────────────── Staging (cache/scraped.json) ─────────────────────────

function aSitio(crudo: RegistroCrudo, id: string, fuente: Fuente, ahora: string): Sitio {
  return {
    id,
    nombre: crudo.nombre,
    categorias: [...new Set<Categoria>([...fuente.categoriasBase, ...crudo.categorias])],
    descripcion: crudo.descripcion,
    direccion: crudo.direccion,
    ciudad: 'Bogotá',
    localidad: crudo.localidad,
    lat: null, // las coordenadas las pone geocode dentro del pipeline (F5)
    lng: null,
    horario: crudo.horario,
    contacto: { telefono: crudo.telefono, web: '', instagram: '' },
    fuente: fuente.url,
    estado: 'activo',
    verificado: true, // fuente oficial (a diferencia de los datos comunitarios de la hoja)
    manual: false,
    ultimaActualizacion: ahora,
  };
}

function cargarStagingPrevio(avisos: string[]): ArchivoSitios | null {
  if (!fs.existsSync(RUTA_SCRAPED)) return null;
  try {
    const parseado = ArchivoSitiosSchema.safeParse(JSON.parse(fs.readFileSync(RUTA_SCRAPED, 'utf8')));
    if (parseado.success) return parseado.data;
    avisos.push(`el staging previo ${RUTA_SCRAPED} no valida contra el schema: se reescribe completo`);
  } catch {
    avisos.push(`el staging previo ${RUTA_SCRAPED} no es JSON válido: se reescribe completo`);
  }
  return null;
}

function igualesSalvoTimestamp(a: Sitio, b: Sitio): boolean {
  const claves = Object.keys(a) as (keyof Sitio)[];
  return claves.every((k) => k === 'ultimaActualizacion' || JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

// ───────────────────────── Solapamientos (informativo para F5) ─────────────────────────

/** Compara el staging contra /data/sitios.json SOLO en lectura: la lista de
 *  posibles duplicados que el dedupe de F5 tendrá que resolver. */
function detectarSolapamientos(sitios: Sitio[]): string[] {
  if (!fs.existsSync(RUTA_SITIOS_JSON)) return ['(no existe /data/sitios.json todavía)'];
  let publicados: ArchivoSitios;
  try {
    const parseado = ArchivoSitiosSchema.safeParse(JSON.parse(fs.readFileSync(RUTA_SITIOS_JSON, 'utf8')));
    if (!parseado.success) return ['(el /data/sitios.json actual no valida: no se pudo comparar)'];
    publicados = parseado.data;
  } catch {
    return ['(el /data/sitios.json actual no es JSON válido: no se pudo comparar)'];
  }
  const porId = new Map(publicados.sitios.map((s) => [s.id, s]));
  const porNombre = new Map(publicados.sitios.map((s) => [normalizarTexto(s.nombre), s]));
  const lineas: string[] = [];
  for (const s of sitios) {
    const mismoId = porId.get(s.id);
    if (mismoId) {
      lineas.push(`${s.id} → id YA publicado (${mismoId.manual ? 'manual:true — F5 no debe tocarlo' : `"${mismoId.nombre}"`})`);
      continue;
    }
    const mismoNombre = porNombre.get(normalizarTexto(s.nombre));
    if (mismoNombre) lineas.push(`${s.id} → mismo nombre normalizado que el publicado "${mismoNombre.id}"`);
  }
  return lineas;
}

// ───────────────────────── Programa principal ─────────────────────────

interface ResultadoFuente {
  fuente: Fuente;
  registros?: RegistroCrudo[];
  avisos: string[];
  robots?: string;
  error?: string;
}

async function main(): Promise<void> {
  const inicioMs = Date.now();
  console.log('scrape — F4b (fuentes oficiales → STAGING cache/scraped.json; NO toca /data/sitios.json)');
  console.log(`  User-Agent: ${USER_AGENT} · ≥ ${DELAY_MINIMO_MS} ms entre requests por dominio\n`);

  const robotsPorHost = new Map<string, RobotsDeHost>();
  const resultados: ResultadoFuente[] = [];

  for (const [n, fuente] of FUENTES.entries()) {
    const rotulo = `[${n + 1}/${FUENTES.length}] ${fuente.clave}`;
    const r: ResultadoFuente = { fuente, avisos: [] };
    resultados.push(r);
    try {
      const u = new URL(fuente.url);

      // 1 · robots.txt del dominio (una vez por host; fail-closed).
      let robots = robotsPorHost.get(u.host);
      if (!robots) {
        robots = await obtenerRobots(u.origin, u.host);
        robotsPorHost.set(u.host, robots);
      }
      const veredicto = evaluarRobots(robots.grupos, USER_AGENT, u.pathname + u.search);
      // El Crawl-delay aplicado es el de los grupos aplicables a NUESTRO User-Agent
      // (hallazgo de auditoría F6: tomar el del primer grupo del archivo sub-aplicaría
      // el delay con robots.txt multi-grupo). El piso de DELAY_MINIMO_MS siempre rige.
      if (veredicto.crawlDelayS !== null) {
        esperaPorHost.set(u.host, Math.max(DELAY_MINIMO_MS, veredicto.crawlDelayS * 1000));
      }
      r.robots = `${robots.nota} → ${u.pathname} ${veredicto.permitido ? 'PERMITIDO' : 'PROHIBIDO'}${veredicto.regla ? ` (regla: ${veredicto.regla})` : ''}`;
      if (!veredicto.permitido) {
        throw new Error(`robots.txt de ${u.host} prohíbe ${u.pathname} (${veredicto.regla ?? 'regla'}) — no se scrapea: la ética del proyecto no se negocia`);
      }

      // 2 · Descargar y parsear.
      const res = await descargar(fuente.url, u.host);
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el artículo`);
      const html = await res.text();
      const { registros, avisos } = PARSERS[fuente.parser](load(html), fuente);
      verificarMinimo(fuente, registros.length);
      r.registros = registros;
      r.avisos = avisos;

      console.log(`✓ ${rotulo} → ${registros.length} registro(s) (mínimo esperado: ${fuente.minimoEsperado})`);
      console.log(`    robots.txt ${u.host}: ${r.robots}`);
      for (const reg of registros) console.log(`    · ${reg.nombre} — ${reg.direccion}`);
      for (const a of avisos) console.log(`    ⚠ ${a}`);
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e);
      console.error(`✗ ${rotulo} → ${r.error}`);
    }
  }

  const sep = '─'.repeat(72);
  const fallos = resultados.filter((x) => x.error !== undefined);
  if (fallos.length > 0) {
    console.error(`\n${sep}`);
    console.error(`✗ ${fallos.length} de ${FUENTES.length} fuente(s) fallaron — NO se escribió ${RUTA_SCRAPED}.`);
    console.error('  El staging anterior queda intacto (all-or-nothing: un artículo caído o cambiado');
    console.error('  no debe borrar puntos del staging ni dejar pasar datos a medias).');
    for (const f of fallos) console.error(`  · ${f.fuente.clave}: ${f.error}`);
    process.exit(1);
  }

  // 3 · Ids + registros completos, validados individualmente contra el schema.
  const ahora = ahoraBogota();
  const pares = resultados.flatMap((x) => x.registros!.map((crudo) => ({ crudo, fuente: x.fuente })));
  const ids = asignarIds(pares);
  const sitios: Sitio[] = [];
  for (const { crudo, fuente } of pares) {
    const sitio = aSitio(crudo, ids.get(crudo)!, fuente, ahora);
    try {
      sitios.push(SitioSchema.parse(sitio));
    } catch (e) {
      if (e instanceof ZodError) {
        console.error(`\n✗ registro extraído INVÁLIDO (bug del parser ${fuente.clave}) — no se escribió nada:`);
        console.error(`  registro: "${crudo.nombre}" (${fuente.url})`);
        for (const issue of e.issues) console.error(`  ✗ ${issue.path.map(String).join('.')}: ${issue.message}`);
        process.exit(1);
      }
      throw e;
    }
  }

  // 4 · Staging sin churn: timestamps preservados si el registro no cambió;
  //     si nada cambió, el archivo ni se toca. La comparación se hace sobre la
  //     forma CANÓNICA (ordenarArchivo) — el archivo previo ya está canónico y
  //     compararlo contra la forma recién construida (p. ej. categorías en
  //     orden de derivación) produciría churn eterno de timestamps.
  const avisosStaging: string[] = [];
  const previo = cargarStagingPrevio(avisosStaging);
  const nuevo = ordenarArchivo({ actualizado: ahora, sitios });
  if (previo) {
    const previosPorId = new Map(previo.sitios.map((s) => [s.id, s]));
    for (const s of nuevo.sitios) {
      const v = previosPorId.get(s.id);
      if (v && igualesSalvoTimestamp(s, v)) s.ultimaActualizacion = v.ultimaActualizacion;
    }
  }
  const sinCambios =
    previo !== null && JSON.stringify(nuevo.sitios) === JSON.stringify(ordenarArchivo(previo).sitios);
  if (!sinCambios) {
    // Mismo camino que sitios.json: zod → orden determinista → escritura atómica.
    escribirSitios(RUTA_SCRAPED, nuevo);
  }

  // ── Reporte ──
  const seg = ((Date.now() - inicioMs) / 1000).toFixed(0);
  console.log(`\n${sep}`);
  console.log('RESULTADO');
  console.log(`  registros en staging: ${sitios.length} (validación individual zod: ${sitios.length}/${sitios.length} ✓)`);
  for (const x of resultados) {
    console.log(`    ${x.fuente.clave.padEnd(20)} ${String(x.registros!.length).padStart(2)} (mínimo ${x.fuente.minimoEsperado})`);
  }
  for (const a of avisosStaging) console.log(`  ⚠ ${a}`);
  const solapamientos = detectarSolapamientos(sitios);
  console.log(`  posibles solapamientos con /data/sitios.json — los resuelve el dedupe de F5 (${solapamientos.length}):`);
  for (const l of solapamientos) console.log(`    · ${l}`);
  console.log(`  requests reales: ${requestsReales} · duración: ${seg} s`);
  if (sinCambios) {
    console.log(`\n✓ Sin cambios en lo extraído — ${RUTA_SCRAPED} no se reescribió (timestamps intactos).`);
  } else {
    console.log(`\n✓ Escrito y validado ${RUTA_SCRAPED} (actualizado: ${ahora}).`);
    console.log('  Este archivo es STAGING: el merge a /data/sitios.json con dedupe es F5 (npm run build:data).');
  }
}

// Ejecutar solo cuando se corre como script (los parsers se importan en tests).
const esEjecucionDirecta =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esEjecucionDirecta) {
  main().catch((e: unknown) => {
    console.error(`\n✗ scrape abortó: ${e instanceof Error ? e.message : String(e)}`);
    console.error(`  Ni ${RUTA_SCRAPED} ni /data/sitios.json fueron tocados por este error.`);
    process.exit(1);
  });
}
