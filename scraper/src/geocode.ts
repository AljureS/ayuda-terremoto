/**
 * `npm run geocode` — F3: geocodifica con Nominatim (OpenStreetMap) los sitios
 * de /data/sitios.json que tienen dirección y ciudad pero aún no tienen
 * coordenadas. Re-ejecutable por la persona mantenedora cuantas veces haga
 * falta: todo lo ya consultado sale de la caché (0 requests).
 *
 * Reglas del contrato (docs/MASTER_PROMPT.md · docs/PLAN_SCRAPPER.md F3):
 *   · ≤ 1 request/segundo (espera ≥ 1100 ms entre requests) + User-Agent con
 *     correo de contacto. Proyecto humanitario: se comporta como tal.
 *   · Caché OBLIGATORIA en /scraper/cache/geocode.json, versionada en git,
 *     con clave = dirección normalizada + ciudad. Guarda también los fallos
 *     (marcador negativo) para no re-consultar lo que ya falló.
 *   · Escalera de normalización (para en el primer acierto):
 *       e1  dirección original + ", <ciudad>, Colombia"
 *       e2  depurada: Carrera→Cra, Calle→Cl, Avenida→Av, Transversal→Tv,
 *           Diagonal→Dg; sin "#" (rompe a Nominatim), sin "No."/"N°", sin
 *           paréntesis/URLs, y sin colas tipo "Local 1" / "piso 2" / "Torre H".
 *           Si la celda mezcla texto, se geocodifica solo la parte que parece
 *           dirección; si no hay vía, se consulta como nombre de lugar (POI).
 *       e3  solo vía principal ("Cra 4, Bogotá, Colombia") → SIEMPRE precisión
 *           baja: se guarda en la caché como pista, JAMÁS se escribe al JSON
 *           (una vía entera puede quedar a kilómetros — peor que null).
 *   · Sanidad geográfica: bbox de Colombia; para ciudad Bogotá, bbox de
 *     Bogotá; y el display_name debe contener la ciudad esperada. Un
 *     resultado a nivel ciudad/barrio, o a nivel calle en un escalón
 *     "completo", NO es un acierto. Jamás se inventan coordenadas.
 *   · Fallos → lat/lng quedan null (sin tocar timestamps) + lista "para
 *     ubicar a mano". manual:true jamás se toca (ni siquiera para poner
 *     coordenadas): se reporta y decide la persona mantenedora.
 *   · UNA sola escritura al final por lib/sitios-file (zod → orden
 *     determinista → atómica), y solo si algo cambió (idempotencia sin churn).
 *
 * Uso:
 *   npm run geocode              corrida normal
 *   npm run geocode -- --dry-run muestra la escalera de consultas de cada
 *                                dirección pendiente, sin red y sin escribir
 *
 * La caché es editable a mano: si una dirección falló y la persona
 * mantenedora conoce las coordenadas, puede poner resultado:"ok" con lat/lng
 * en la entrada (se re-verifica el bbox al leer) o, mejor, editar el sitio
 * directamente en sitios.json.
 */
import fs from 'node:fs';
import { ZodError } from 'zod';
import { ArchivoSitiosSchema } from './schema.js';
import type { ArchivoSitios, Sitio } from './schema.js';
import { normalizarTexto } from './lib/normalize.js';
import { ahoraBogota } from './lib/time.js';
import { RUTA_CACHE_GEOCODE, RUTA_SITIOS_JSON } from './lib/paths.js';
import { escribirJsonAtomico, escribirSitios } from './lib/sitios-file.js';

// ───────────────────────── Configuración ─────────────────────────

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'MapaAyudaBogota/1.0 (contacto: saidsimon2@gmail.com)';
/** ≥ 1100 ms entre inicios de request (contrato: máx. 1 req/s con margen). */
const ESPERA_ENTRE_REQUESTS_MS = 1100;
const TIMEOUT_MS = 30_000;
/** Direcciones seguidas con error de red antes de abortar la corrida. */
const MAX_ERRORES_RED_SEGUIDOS = 3;

interface Bbox { latMin: number; latMax: number; lngMin: number; lngMax: number }
const BBOX_COLOMBIA: Bbox = { latMin: -4.3, latMax: 13.5, lngMin: -82, lngMax: -66 };
const BBOX_BOGOTA: Bbox = { latMin: 3.7, latMax: 5.0, lngMin: -74.6, lngMax: -73.8 };

const DRY_RUN = process.argv.includes('--dry-run');

// ───────────────────────── Limpieza de direcciones ─────────────────────────

const RE_URL = /https?:\/\/\S+/gi;

/** Abreviaturas del contrato (aplican también a la palabra ya con punto). */
const ABREVIATURAS: [RegExp, string][] = [
  [/\bcarrera\b\.?/gi, 'Cra'],
  [/\bkra\b\.?/gi, 'Cra'],
  [/\bcalle\b\.?/gi, 'Cl'],
  [/\bavenida\b\.?/gi, 'Av'],
  [/\btransversal\b\.?/gi, 'Tv'],
  [/\bdiagonal\b\.?/gi, 'Dg'],
];

/** Palabras que abren una vía (sobre texto normalizado). */
const PALABRAS_VIA = new Set([
  'carrera', 'cra', 'kra', 'calle', 'cl', 'avenida', 'av', 'transversal', 'tv',
  'diagonal', 'dg', 'autopista', 'via', 'km', 'kilometro',
]);
const DIRECCIONALES = new Set(['sur', 'norte', 'este', 'oeste', 'oriente', 'occidente', 'bis']);

/** Primer token (normalizado) de un segmento que lo delata como NO-dirección:
 *  descriptores de interior ("Local 1", "piso 2") o referencias relativas
 *  ("al lado del hotel…", "en oficina de administración"). */
const JUNK_INICIO = new Set([
  'piso', 'pisos', 'apto', 'apartamento', 'oficina', 'ofc', 'local', 'torre', 'bloque',
  'bodega', 'sotano', 'etapa', 'casa', 'interior', 'int', 'salon', 'sede', 'esquina',
  'en', 'al', 'sobre', 'frente', 'detras', 'junto', 'segundo', 'tercer', 'primer',
  'cuarto', 'quinto',
]);

/** Corta descriptores de interior al final del segmento de vía elegido:
 *  "Cl 35 24-40 Apto 201" → "Cl 35 24-40". Nunca corta al inicio. */
const RE_JUNK_COLA =
  /[,;]?\s+(?:piso|pisos|apto|apartamento|oficina|ofc|local|torre|bloque|bodega|s[oó]tano|etapa|interior|int\.?|casa|sal[oó]n|edificios?)\b.*$/i;

function colapsar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** ¿El segmento tiene palabra de vía Y algún dígito? (candidato a dirección) */
function esSegmentoVia(seg: string): boolean {
  if (!/\d/.test(seg)) return false;
  return normalizarTexto(seg).split(' ').some((t) => PALABRAS_VIA.has(t));
}

function esSegmentoJunk(seg: string): boolean {
  const primera = normalizarTexto(seg).split(' ')[0] ?? '';
  return JUNK_INICIO.has(primera);
}

/**
 * ¿La dirección de vía trae número de cruce/placa además de la vía?
 * "Cra 44D 30-42" (dos tokens con dígito) o "Autopista Norte 123-60"
 * (compuesto NN-NN) → completa. "Km 8" o "Cl 89 Tv" → solo nivel vía.
 */
function precisionDeSegmentoVia(seg: string): 'completa' | 'via' {
  const tokens = seg.split(/\s+/);
  const conDigito = tokens.filter((t) => /\d/.test(t));
  if (conDigito.length >= 2) return 'completa';
  if (conDigito.some((t) => /^\d+[A-Za-z]{0,2}-\d/.test(t))) return 'completa';
  return 'via';
}

type Modo = 'completa' | 'via';

interface Consulta {
  /** Texto completo enviado a Nominatim: "<dirección>, <ciudad>, Colombia". */
  q: string;
  escalon: 1 | 2 | 3;
  /** 'via' = aunque acierte, el resultado es precisión baja (no se escribe). */
  modo: Modo;
}

/**
 * Construye la escalera de consultas de una dirección (contrato F3).
 * Deduplica: si un escalón produce el mismo texto que otro anterior, se salta
 * (no se gasta un request en repetir la misma consulta).
 */
export function construirEscalera(direccion: string, ciudad: string): Consulta[] {
  const consultas: Consulta[] = [];
  const vistas = new Set<string>();
  const agregar = (texto: string, escalon: 1 | 2 | 3, modo: Modo): void => {
    const limpio = colapsar(texto).replace(/[\s,;.]+$/, '');
    if (!limpio) return;
    const q = `${limpio}, ${ciudad}, Colombia`;
    // Dedupe por texto LITERAL: "Calle 10 # 18-75" y "Cl 10 18-75" son
    // consultas distintas para Nominatim (el "#" cambia el resultado).
    if (vistas.has(q)) return;
    vistas.add(q);
    consultas.push({ q, escalon, modo });
  };

  // e1 — dirección original tal cual (contrato).
  agregar(direccion, 1, 'completa');

  // e2 — depurada.
  let t = direccion.replace(RE_URL, ' ');
  t = t.replace(/\([^)]*\)/g, ' '); // paréntesis y su contenido
  t = t.replace(/\b(?:No|Nro)\b\.?\s*/gi, ' ').replace(/N[°º]\s*/g, ' ');
  t = t.replace(/#/g, ' '); // el "#" rompe el parser de Nominatim
  for (const [re, sub] of ABREVIATURAS) t = t.replace(re, sub);
  t = t.replace(/\b(Cra|Cl|Av|Tv|Dg|Km)\.(?=[\s\d]|$)/gi, '$1');
  // "1 - 26" / "18A - 12" / "23 Norte - 60" → "1-26" / "18A-12" /
  // "23 Norte-60" (número de placa partido por el guion)
  t = t.replace(/(\d[A-Za-z]?)\s*-\s*(\d)/g, '$1-$2');
  t = t.replace(/\b(norte|sur|este|oeste|bis)\s*-\s*(\d)/gi, '$1-$2');
  // "52.20" → "52-20" (punto usado como guion de placa; "Km 1.5" queda intacto)
  t = t.replace(/(\d{2,})\.(\d{2,})/g, '$1-$2');

  // Segmentos: comas, ". ", " - " (que no unía números) y ";".
  const segmentos = t
    .split(/\s*,\s*|\.\s+|\s+[-–]\s+|\s*;\s*/)
    .map((s) => colapsar(s).replace(/^(?:[^:]{1,40}:\s*)+/, '')) // "Ubicación principal: …" → "…"
    .map(colapsar)
    .filter(Boolean);

  const viaSeg = segmentos.find(esSegmentoVia);
  if (viaSeg) {
    // La parte que parece dirección, sin descriptores de interior al final.
    const cortado = colapsar(viaSeg.replace(RE_JUNK_COLA, ''));
    const elegido = esSegmentoVia(cortado) ? cortado : viaSeg;
    agregar(elegido, 2, precisionDeSegmentoVia(elegido));

    // e3 — solo vía principal: hasta el primer token con dígito
    // (+ direccional pegado: "Cl 39 Sur"). Siempre precisión baja.
    const tokens = elegido.split(/\s+/);
    const i = tokens.findIndex((tk) => /\d/.test(tk));
    if (i >= 0) {
      let fin = i + 1;
      if (fin < tokens.length && DIRECCIONALES.has(normalizarTexto(tokens[fin] ?? ''))) fin += 1;
      agregar(tokens.slice(0, fin).join(' '), 3, 'via');
    }
  } else {
    // Sin vía reconocible: consulta tipo POI con los segmentos que informan
    // ("Centro Comercial Bazaar Chía" sí; "en oficina de administración" no).
    const utiles = segmentos.filter((s) => !esSegmentoJunk(s));
    if (utiles.length > 0) agregar(utiles.join(', '), 2, 'completa');
  }

  return consultas;
}

// ───────────────────────── Cliente Nominatim ─────────────────────────

interface ResultadoNominatim {
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  type?: string;
  addresstype?: string;
}

/** Se lanza cuando hay que parar TODA la corrida (rate limit del servicio). */
class AbortarCorrida extends Error {}

let ultimoRequestMs = 0;
let requestsReales = 0;

async function dormir(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Garantiza ≥ ESPERA_ENTRE_REQUESTS_MS entre inicios de request. */
async function turnoDeRed(): Promise<void> {
  const transcurrido = Date.now() - ultimoRequestMs;
  if (ultimoRequestMs > 0 && transcurrido < ESPERA_ENTRE_REQUESTS_MS) {
    await dormir(ESPERA_ENTRE_REQUESTS_MS - transcurrido);
  }
  ultimoRequestMs = Date.now();
}

/**
 * Una consulta a Nominatim. Devuelve el mejor resultado, null si no hay,
 * o 'error-red' si la red falló (NO se cachea: no es un fallo de la
 * dirección). 429/403 reintenta una vez con pausa larga y si persiste aborta
 * la corrida completa: seguir insistiendo violaría la política de uso.
 */
async function consultarNominatim(q: string): Promise<ResultadoNominatim | null | 'error-red'> {
  for (let intento = 1; intento <= 2; intento++) {
    await turnoDeRed();
    requestsReales += 1;
    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'co');
      url.searchParams.set('accept-language', 'es');
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 || res.status === 403) {
        if (intento === 2) {
          throw new AbortarCorrida(
            `Nominatim respondió HTTP ${res.status} dos veces seguidas: se detiene la corrida (política de uso). Reintentar más tarde.`,
          );
        }
        await dormir(10_000);
        continue;
      }
      if (!res.ok) {
        if (intento === 2) return 'error-red';
        await dormir(5_000);
        continue;
      }
      const cuerpo = (await res.json()) as ResultadoNominatim[];
      return cuerpo[0] ?? null;
    } catch (e) {
      if (e instanceof AbortarCorrida) throw e;
      if (intento === 2) return 'error-red';
      await dormir(5_000);
    }
  }
  return 'error-red';
}

// ───────────────────────── Sanidad geográfica ─────────────────────────

function dentroDe(bbox: Bbox, lat: number, lng: number): boolean {
  return lat >= bbox.latMin && lat <= bbox.latMax && lng >= bbox.lngMin && lng <= bbox.lngMax;
}

/** Tipos de resultado que significan "solo encontré la ciudad / el barrio":
 *  un no-resultado para una dirección concreta (error de cientos de metros
 *  o kilómetros presentado como acierto). */
const NIVEL_CIUDAD = new Set([
  'city', 'town', 'village', 'hamlet', 'municipality', 'county', 'state', 'region',
  'province', 'district', 'state_district', 'borough', 'suburb', 'neighbourhood',
  'quarter', 'postcode', 'country', 'administrative',
]);

type Evaluacion =
  | { tipo: 'ok'; lat: number; lng: number; display: string }
  | { tipo: 'via'; lat: number; lng: number; display: string }
  | { tipo: 'rechazo'; clase: 'bbox' | 'ciudad' | 'granularidad'; motivo: string };

function recortar(texto: string, max = 90): string {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

/**
 * Evalúa un resultado de Nominatim contra las reglas de sanidad del contrato.
 *   · bbox Colombia (y bbox Bogotá si la ciudad es Bogotá) → si no, rechazo.
 *   · display_name debe contener la ciudad esperada (normalizada) → si no,
 *     sospechoso: rechazo.
 *   · resultado a nivel ciudad/barrio → rechazo por granularidad.
 *   · resultado a nivel calle (highway/road) → precisión 'via' aunque el
 *     escalón fuera completo: la escalera puede seguir buscando algo mejor.
 */
function evaluar(res: ResultadoNominatim, ciudad: string, modo: Modo): Evaluacion {
  const lat = Number.parseFloat(res.lat);
  const lng = Number.parseFloat(res.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { tipo: 'rechazo', clase: 'bbox', motivo: 'lat/lon no numéricos en la respuesta' };
  }
  if (!dentroDe(BBOX_COLOMBIA, lat, lng)) {
    return { tipo: 'rechazo', clase: 'bbox', motivo: `fuera del bbox de Colombia (${lat}, ${lng})` };
  }
  if (normalizarTexto(ciudad) === 'bogota' && !dentroDe(BBOX_BOGOTA, lat, lng)) {
    return { tipo: 'rechazo', clase: 'bbox', motivo: `fuera del bbox de Bogotá (${lat}, ${lng})` };
  }
  if (!normalizarTexto(res.display_name).includes(normalizarTexto(ciudad))) {
    return {
      tipo: 'rechazo',
      clase: 'ciudad',
      motivo: `el resultado no menciona "${ciudad}": ${recortar(res.display_name)}`,
    };
  }
  const addresstype = res.addresstype ?? '';
  const esNivelCiudad =
    NIVEL_CIUDAD.has(addresstype) ||
    (res.category === 'boundary' && res.type === 'administrative') ||
    (res.category === 'place' && NIVEL_CIUDAD.has(res.type ?? ''));
  if (esNivelCiudad) {
    return {
      tipo: 'rechazo',
      clase: 'granularidad',
      motivo: `solo encontró la ciudad/el barrio (${addresstype || res.type}): ${recortar(res.display_name, 60)}`,
    };
  }
  const esNivelCalle = res.category === 'highway' || addresstype === 'road';
  if (modo === 'via' || esNivelCalle) {
    return { tipo: 'via', lat, lng, display: res.display_name };
  }
  return { tipo: 'ok', lat, lng, display: res.display_name };
}

// ───────────────────────── Caché versionada ─────────────────────────

/**
 * Entrada de /scraper/cache/geocode.json (clave = dirección normalizada +
 * "|" + ciudad normalizada).
 *   resultado 'ok'    → coordenadas confiables (se escriben al JSON).
 *   resultado 'via'   → precisión baja (pista para el humano; NO se escribe).
 *   resultado 'fallo' → marcador negativo: no volver a consultar Nominatim.
 */
interface EntradaCache {
  direccion: string;
  ciudad: string;
  resultado: 'ok' | 'via' | 'fallo';
  lat: number | null;
  lng: number | null;
  escalon: 1 | 2 | 3 | null;
  consulta: string | null;
  displayName: string | null;
  motivo: string | null;
  fecha: string;
}

type Cache = Record<string, EntradaCache>;

function claveCache(direccion: string, ciudad: string): string {
  return `${normalizarTexto(direccion)}|${normalizarTexto(ciudad)}`;
}

function cargarCache(): Cache {
  if (!fs.existsSync(RUTA_CACHE_GEOCODE)) return {};
  try {
    return JSON.parse(fs.readFileSync(RUTA_CACHE_GEOCODE, 'utf8')) as Cache;
  } catch (e) {
    console.error(`✗ la caché ${RUTA_CACHE_GEOCODE} no es JSON válido: ${e instanceof Error ? e.message : String(e)}`);
    console.error('  Arréglala o bórrala (borrarla re-consulta todo a Nominatim).');
    process.exit(1);
  }
}

/** Guarda la caché con claves ordenadas y campos en orden fijo (diffs legibles). */
function guardarCache(cache: Cache): void {
  const ordenada: Cache = {};
  for (const clave of Object.keys(cache).sort()) {
    const e = cache[clave]!;
    ordenada[clave] = {
      direccion: e.direccion,
      ciudad: e.ciudad,
      resultado: e.resultado,
      lat: e.lat,
      lng: e.lng,
      escalon: e.escalon,
      consulta: e.consulta,
      displayName: e.displayName,
      motivo: e.motivo,
      fecha: e.fecha,
    };
  }
  escribirJsonAtomico(RUTA_CACHE_GEOCODE, ordenada);
}

// ───────────────────────── Resolución de una dirección ─────────────────────────

interface Intento { escalon: 1 | 2 | 3; nota: string }

/** Corre la escalera completa contra Nominatim y produce la entrada de caché. */
async function resolverDireccion(
  direccion: string,
  ciudad: string,
): Promise<{ entrada: EntradaCache; intentos: Intento[]; huboErrorRed: boolean }> {
  const intentos: Intento[] = [];
  let pistaVia: { lat: number; lng: number; escalon: 1 | 2 | 3; consulta: string; display: string } | null = null;
  let huboErrorRed = false;

  for (const c of construirEscalera(direccion, ciudad)) {
    const res = await consultarNominatim(c.q);
    if (res === 'error-red') {
      intentos.push({ escalon: c.escalon, nota: 'error de red (no se cachea como fallo)' });
      huboErrorRed = true;
      continue;
    }
    if (res === null) {
      intentos.push({ escalon: c.escalon, nota: 'sin resultados' });
      continue;
    }
    const ev = evaluar(res, ciudad, c.modo);
    if (ev.tipo === 'ok') {
      return {
        entrada: {
          direccion, ciudad,
          resultado: 'ok',
          lat: ev.lat, lng: ev.lng,
          escalon: c.escalon,
          consulta: c.q,
          displayName: recortar(ev.display, 140),
          motivo: null,
          fecha: ahoraBogota(),
        },
        intentos,
        huboErrorRed,
      };
    }
    if (ev.tipo === 'via') {
      intentos.push({ escalon: c.escalon, nota: 'acierto de precisión baja (nivel vía) — no se escribe' });
      if (!pistaVia) pistaVia = { lat: ev.lat, lng: ev.lng, escalon: c.escalon, consulta: c.q, display: ev.display };
      continue;
    }
    intentos.push({ escalon: c.escalon, nota: `rechazo (${ev.clase}): ${ev.motivo}` });
  }

  const motivo = intentos.map((i) => `e${i.escalon}: ${i.nota}`).join(' · ') || 'la dirección no produjo ninguna consulta';
  if (pistaVia) {
    return {
      entrada: {
        direccion, ciudad,
        resultado: 'via',
        lat: pistaVia.lat, lng: pistaVia.lng,
        escalon: pistaVia.escalon,
        consulta: pistaVia.consulta,
        displayName: recortar(pistaVia.display, 140),
        motivo: recortar(`solo precisión de vía: ${motivo}`, 500),
        fecha: ahoraBogota(),
      },
      intentos,
      huboErrorRed,
    };
  }
  return {
    entrada: {
      direccion, ciudad,
      resultado: 'fallo',
      lat: null, lng: null,
      escalon: null,
      consulta: null,
      displayName: null,
      motivo: recortar(motivo, 500),
      fecha: ahoraBogota(),
    },
    intentos,
    huboErrorRed,
  };
}

// ───────────────────────── Programa principal ─────────────────────────

interface Trabajo { clave: string; direccion: string; ciudad: string; sitios: Sitio[] }

function leerArchivo(): ArchivoSitios {
  if (!fs.existsSync(RUTA_SITIOS_JSON)) {
    console.error(`✗ no existe ${RUTA_SITIOS_JSON} — corre primero: npm run import:sheet`);
    process.exit(1);
  }
  const crudo: unknown = JSON.parse(fs.readFileSync(RUTA_SITIOS_JSON, 'utf8'));
  const parseado = ArchivoSitiosSchema.safeParse(crudo);
  if (!parseado.success) {
    console.error('✗ el /data/sitios.json actual NO valida contra el schema; no toco nada.');
    for (const issue of parseado.error.issues) {
      console.error(`  ✗ ${issue.path.map(String).join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parseado.data;
}

async function main(): Promise<void> {
  const inicioMs = Date.now();
  console.log(`geocode — F3 (Nominatim, ≤1 req/s, caché en ${RUTA_CACHE_GEOCODE})${DRY_RUN ? '  [DRY-RUN]' : ''}\n`);

  const archivo = leerArchivo();
  const cache = cargarCache();
  const entradasCacheInicial = Object.keys(cache).length;

  // Clasificación de sitios.
  const saltados = { conCoords: [] as Sitio[], manuales: [] as Sitio[], sinCiudad: [] as Sitio[], sinDireccion: [] as Sitio[] };
  const trabajos = new Map<string, Trabajo>();
  for (const s of archivo.sitios) {
    if (s.lat !== null && s.lng !== null) { saltados.conCoords.push(s); continue; }
    if (s.manual) { saltados.manuales.push(s); continue; } // jamás se modifica un manual
    if (!s.ciudad.trim()) { saltados.sinCiudad.push(s); continue; }
    if (!s.direccion.trim()) { saltados.sinDireccion.push(s); continue; }
    const clave = claveCache(s.direccion, s.ciudad);
    const t = trabajos.get(clave);
    if (t) t.sitios.push(s);
    else trabajos.set(clave, { clave, direccion: colapsar(s.direccion), ciudad: s.ciudad.trim(), sitios: [s] });
  }

  const listaTrabajos = [...trabajos.values()].sort((a, b) => (a.clave < b.clave ? -1 : 1));
  const totalSitiosPendientes = listaTrabajos.reduce((n, t) => n + t.sitios.length, 0);
  console.log(
    `Sitios: ${archivo.sitios.length} · a geocodificar: ${totalSitiosPendientes} ` +
      `(${listaTrabajos.length} direcciones únicas) · saltados: ya con coords ${saltados.conCoords.length}, ` +
      `manual:true ${saltados.manuales.length}, sin ciudad ${saltados.sinCiudad.length}, sin dirección ${saltados.sinDireccion.length}\n`,
  );

  if (DRY_RUN) {
    for (const t of listaTrabajos) {
      const enCache = cache[t.clave];
      console.log(`· ${t.direccion} — ${t.ciudad}${enCache ? `   [caché: ${enCache.resultado}]` : ''}`);
      for (const c of construirEscalera(t.direccion, t.ciudad)) {
        console.log(`    e${c.escalon}${c.modo === 'via' ? ' (precisión baja)' : ''}: ${c.q}`);
      }
    }
    console.log(`\n[DRY-RUN] ${listaTrabajos.length} direcciones · 0 requests · nada se escribió.`);
    return;
  }

  // Resolución: caché primero; Nominatim solo para lo nunca consultado.
  const resueltos = new Map<string, EntradaCache>();
  let desdeCache = 0;
  let erroresRedSeguidos = 0;
  const erroresRed: Trabajo[] = [];
  let abortoPorServicio: string | null = null;

  for (const [n, t] of listaTrabajos.entries()) {
    const previa = cache[t.clave];
    if (previa) {
      resueltos.set(t.clave, previa);
      desdeCache += 1;
      continue;
    }
    if (abortoPorServicio) break;
    const rotulo = `[${String(n + 1).padStart(3)}/${listaTrabajos.length}] ${t.direccion} — ${t.ciudad}`;
    try {
      const { entrada, intentos, huboErrorRed } = await resolverDireccion(t.direccion, t.ciudad);
      if (huboErrorRed && entrada.resultado === 'fallo') {
        // Red caída a mitad de escalera: no se cachea un "fallo" que en
        // realidad fue la red — la próxima corrida lo reintenta.
        erroresRed.push(t);
        erroresRedSeguidos += 1;
        console.log(`✗ ${rotulo} → error de red (se reintentará en la próxima corrida)`);
        if (erroresRedSeguidos >= MAX_ERRORES_RED_SEGUIDOS) {
          abortoPorServicio = `red caída: ${MAX_ERRORES_RED_SEGUIDOS} direcciones seguidas con error de red`;
        }
        continue;
      }
      erroresRedSeguidos = 0;
      cache[t.clave] = entrada;
      resueltos.set(t.clave, entrada);
      guardarCache(cache); // incremental: una interrupción no pierde lo consultado
      const detalle = intentos.length > 0 ? `  [${intentos.map((i) => `e${i.escalon}✗`).join(' ')}]` : '';
      if (entrada.resultado === 'ok') {
        console.log(`✓ ${rotulo} → e${entrada.escalon} (${entrada.lat}, ${entrada.lng})${detalle}`);
      } else if (entrada.resultado === 'via') {
        console.log(`≈ ${rotulo} → solo vía e${entrada.escalon} (precisión baja, NO se escribe)`);
      } else {
        console.log(`✗ ${rotulo} → sin resultado (${recortar(entrada.motivo ?? '', 100)})`);
      }
    } catch (e) {
      if (e instanceof AbortarCorrida) {
        abortoPorServicio = e.message;
        break;
      }
      throw e;
    }
  }

  // Aplicar coordenadas 'ok' a los sitios (verificación de bbox también para
  // entradas venidas de caché: la caché es editable a mano y se re-verifica).
  const ahora = ahoraBogota();
  const cambiados: { id: string; escalon: 1 | 2 | 3 | null }[] = [];
  const cacheInvalida: string[] = [];
  const fallidos: { sitio: Sitio; entrada: EntradaCache }[] = [];

  for (const t of listaTrabajos) {
    const entrada = resueltos.get(t.clave);
    if (!entrada) continue; // error de red o corrida abortada: queda pendiente
    if (entrada.resultado === 'ok' && entrada.lat !== null && entrada.lng !== null) {
      const evCache = dentroDe(BBOX_COLOMBIA, entrada.lat, entrada.lng) &&
        (normalizarTexto(t.ciudad) !== 'bogota' || dentroDe(BBOX_BOGOTA, entrada.lat, entrada.lng));
      if (!evCache) {
        cacheInvalida.push(t.clave);
        for (const s of t.sitios) fallidos.push({ sitio: s, entrada });
        continue;
      }
      for (const s of t.sitios) {
        if (s.lat === entrada.lat && s.lng === entrada.lng) continue; // idempotencia
        s.lat = entrada.lat;
        s.lng = entrada.lng;
        s.ultimaActualizacion = ahora;
        cambiados.push({ id: s.id, escalon: entrada.escalon });
      }
    } else {
      for (const s of t.sitios) fallidos.push({ sitio: s, entrada });
    }
  }

  // UNA sola escritura, solo si algo cambió (sin churn de timestamps).
  if (cambiados.length > 0) {
    const final: ArchivoSitios = { actualizado: ahora, sitios: archivo.sitios };
    try {
      escribirSitios(RUTA_SITIOS_JSON, final);
    } catch (e) {
      if (e instanceof ZodError) {
        console.error(`\n✗ VALIDACIÓN FALLIDA — no se escribió nada. ${e.issues.length} problema(s):`);
        for (const issue of e.issues) console.error(`  ✗ ${issue.path.map(String).join('.')}: ${issue.message}`);
        process.exit(1);
      }
      throw e;
    }
  }

  // ── Reporte ──
  const seg = ((Date.now() - inicioMs) / 1000).toFixed(0);
  const sep = '─'.repeat(72);
  const okPorEscalon = new Map<number, number>();
  for (const t of listaTrabajos) {
    const e = resueltos.get(t.clave);
    if (e?.resultado === 'ok' && e.escalon !== null && !cacheInvalida.includes(t.clave)) {
      okPorEscalon.set(e.escalon, (okPorEscalon.get(e.escalon) ?? 0) + t.sitios.length);
    }
  }
  const sitiosOk = [...okPorEscalon.values()].reduce((a, b) => a + b, 0);
  const soloVia = fallidos.filter((f) => f.entrada.resultado === 'via').length;

  console.log(`\n${sep}`);
  console.log('RESULTADO');
  console.log(`  sitios con coordenadas nuevas: ${cambiados.length} (de ${sitiosOk} resueltos ok)`);
  for (const [e, n] of [...okPorEscalon.entries()].sort()) {
    console.log(`    escalón ${e}: ${n} sitio(s)`);
  }
  console.log(`  direcciones desde caché: ${desdeCache} de ${listaTrabajos.length}`);
  console.log(`  fallidos → para ubicar a mano: ${fallidos.length} sitio(s) (${soloVia} con pista de solo-vía en la caché)`);
  if (erroresRed.length > 0) {
    console.log(`  con error de red (reintentar en la próxima corrida): ${erroresRed.length}`);
  }
  if (cacheInvalida.length > 0) {
    console.log(`  ⚠ entradas de caché con coords fuera de bbox (NO aplicadas): ${cacheInvalida.join(', ')}`);
  }
  if (fallidos.length > 0) {
    console.log('\n  PARA UBICAR A MANO (id · ciudad · dirección):');
    for (const f of fallidos) {
      const pista = f.entrada.resultado === 'via' && f.entrada.lat !== null ? `  [pista solo-vía: ${f.entrada.lat}, ${f.entrada.lng}]` : '';
      console.log(`    · ${f.sitio.id} · ${f.sitio.ciudad} · ${f.sitio.direccion}${pista}`);
    }
  }
  console.log(`\n  requests reales a Nominatim: ${requestsReales} · duración: ${seg} s`);
  console.log(`  caché: ${entradasCacheInicial} → ${Object.keys(cache).length} entradas (${RUTA_CACHE_GEOCODE})`);
  if (cambiados.length > 0) {
    console.log(`\n✓ Escrito y validado ${RUTA_SITIOS_JSON} (actualizado: ${ahora}).`);
    console.log('  Siguiente paso: npm run validate y revisar el diff de git.');
  } else {
    console.log(`\n✓ Sin cambios en ${RUTA_SITIOS_JSON} — no se reescribió (timestamps intactos).`);
  }
  if (abortoPorServicio) {
    console.error(`\n✗ CORRIDA INCOMPLETA: ${abortoPorServicio}`);
    console.error('  Lo ya consultado quedó en caché; re-ejecuta npm run geocode para continuar.');
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error(`\n✗ geocode abortó: ${e instanceof Error ? e.message : String(e)}`);
  console.error('  /data/sitios.json no fue tocado por este error; la caché conserva lo ya consultado.');
  process.exit(1);
});
