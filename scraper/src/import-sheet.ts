/**
 * `npm run import:sheet` — F2 (Fase 0 del contrato): importa el Google Sheet
 * comunitario a /data/sitios.json con el mapeo APROBADO en la parada de
 * contrato 2b (docs/PLAN_SCRAPPER.md). Este archivo es ese mapeo hecho código:
 * si la hoja cambia de formato, falla con mensaje claro y no corrompe nada.
 *
 * Comportamiento:
 *   1. Intenta descargar el CSV fresco de cada pestaña aprobada (URL export →
 *      fallback gviz) con User-Agent identificable y 2 s entre requests. Si la
 *      red o el formato fallan, usa el CSV local de /data/import/ (snapshot de
 *      2a) y lo dice en el reporte. Un CSV fresco válido se guarda en
 *      /data/import/ sobreescribiendo el del mismo gid.
 *   2. Convierte según el mapeo aprobado (ver convertir*() por pestaña).
 *   3. MERGE contra el sitios.json existente — nunca un reemplazo: jamás toca
 *      registros manual:true, conserva ids ya publicados (identidad = pestaña
 *      + nombre + ciudad + dirección normalizados) y no elimina registros que
 *      la hoja ya no traiga (los reporta).
 *   4. Valida TODO con zod y escribe por el único camino permitido
 *      (lib/sitios-file.ts: zod → orden determinista → escritura atómica).
 *
 * Pestañas EXCLUIDAS a propósito (decisión 2b): Salud Mental (1512882424),
 * Personas Desaparecidas (720541266) y Otros Recursos (1698408580) — recursos
 * virtuales o agregadores, no puntos de ayuda.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { ZodError } from 'zod';
import { CATEGORIAS, ArchivoSitiosSchema } from './schema.js';
import type { ArchivoSitios, Categoria, Contacto, Estado, Sitio } from './schema.js';
import { normalizarTexto } from './lib/normalize.js';
import { slugify } from './lib/slug.js';
import { ahoraBogota } from './lib/time.js';
import { RUTA_DATA_IMPORT, RUTA_SITIOS_JSON } from './lib/paths.js';
import { escribirSitios } from './lib/sitios-file.js';

// ───────────────────────── Configuración (aprobada en 2b) ─────────────────────────

const SHEET_ID = '106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U';
const USER_AGENT = 'MapaAyudaBogota/1.0 (contacto: saidsimon2@gmail.com)';
const DELAY_ENTRE_REQUESTS_MS = 2000;
const TIMEOUT_MS = 30_000;

type TabId = 'especie' | 'sangre' | 'voluntariados' | 'dinero';

interface Pestana {
  tab: TabId;
  gid: string;
  /** Nombre del archivo local en /data/import/ (mismo que dejó 2a). */
  archivo: string;
  /** Primera columna del header real, para saltar el preámbulo. */
  claveEncabezado: 'ciudad' | 'organizacion';
  /**
   * Columnas del mapeo aprobado en 2b (claves normalizadas). La hoja anunció
   * "nuevo formato" para el 12-ago: si a un CSV fresco le falta alguna, la
   * pestaña cambió de formato y NO se convierte con el mapeo viejo — se usa
   * el snapshot local original y se reporta la discrepancia.
   */
  columnas: string[];
}

const PESTANAS: Pestana[] = [
  {
    tab: 'especie',
    gid: '140042907',
    archivo: 'sheet-gid-140042907-especie.csv',
    claveEncabezado: 'ciudad',
    columnas: ['ciudad', 'organizacion', 'detalle', 'que se necesita', 'contacto'],
  },
  {
    tab: 'sangre',
    gid: '136153026',
    archivo: 'sheet-gid-136153026-sangre.csv',
    claveEncabezado: 'ciudad',
    columnas: ['ciudad', 'organizacion', 'punto de entrega', 'detalle', 'que se necesita', 'contacto'],
  },
  {
    tab: 'voluntariados',
    gid: '887290939',
    archivo: 'sheet-gid-887290939-voluntariados.csv',
    claveEncabezado: 'ciudad',
    columnas: ['ciudad', 'organizacion', 'direccion', 'que se necesita', 'contacto'],
  },
  {
    tab: 'dinero',
    gid: '1375250837',
    archivo: 'sheet-gid-1375250837-dinero.csv',
    claveEncabezado: 'organizacion',
    columnas: ['organizacion', 'punto de entrega', 'detalle', 'que se necesita', 'contacto'],
  },
];

/** Columnas del mapeo aprobado que el encabezado dado no trae. */
function columnasFaltantes(encabezado: string[], columnas: string[]): string[] {
  return columnas.filter((c) => !encabezado.some((celda) => normalizarTexto(celda).includes(c)));
}

/** `fuente` de cada sitio: deep link a su pestaña en la hoja (trazabilidad). */
function fuenteDePestana(tab: TabId): string {
  const gid = PESTANAS.find((p) => p.tab === tab)!.gid;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${gid}`;
}

/** Sufijo de desambiguación de id cuando la escalera nombre→ciudad→vía se agota
 *  (mismo sitio físico anunciado en dos pestañas). Especie no lleva sufijo: el
 *  punto de acopio físico es el registro "primario" y conserva el id corto. */
const TOKEN_TAB: Record<TabId, string> = { especie: '', sangre: 'sangre', voluntariados: 'voluntariado', dinero: 'dinero' };

// Exclusiones aprobadas en 2b (pestaña Especie).
const CIUDADES_EXCLUIDAS = new Set(['doral fl', 'kissimmee fl', 'nueva york', 'madrid']);
// Celdas de Detalle con varias direcciones que se dividen en un sitio por dirección.
const ORGS_MULTIDIRECCION = new Set(['club activo 20 30', 'pontificia universidad javeriana']);

// ───────────────────────── Utilidades de texto ─────────────────────────

/** Colapsa todo espacio en blanco (incluye saltos de línea) a un espacio. */
function colapsar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** Líneas no vacías de una celda, ya recortadas. */
function lineasDe(texto: string): string[] {
  return texto
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Celda multilínea → una sola línea legible: "a\n\nb" → "a, b". */
function unaLinea(texto: string): string {
  return colapsar(lineasDe(texto).join(', ')).replace(/[\s,;]+$/, '');
}

/** Celda multilínea → texto multilínea compacto (sin líneas vacías). */
function multilinea(texto: string): string {
  return lineasDe(texto).join('\n');
}

// ───────────────────────── CSV: parseo y estructura ─────────────────────────

function parsearCsv(contenido: string): string[][] {
  return parse(contenido, { bom: true, relax_column_count: true, skip_empty_lines: true }) as string[][];
}

/** Índice de la fila de encabezado real (tras el preámbulo), o -1. */
function buscarEncabezado(filas: string[][], clave: 'ciudad' | 'organizacion'): number {
  return filas.findIndex((f) => normalizarTexto(f[0] ?? '').startsWith(clave));
}

/** Índice de la columna cuyo encabezado contiene la clave; error claro si falta. */
function indiceColumna(encabezado: string[], clave: string, pestana: string): number {
  const i = encabezado.findIndex((c) => normalizarTexto(c).includes(clave));
  if (i === -1) {
    throw new Error(
      `pestaña ${pestana}: no encuentro la columna "${clave}" en el encabezado ` +
        `[${encabezado.join(' | ')}]. La hoja cambió de formato: revisar el mapeo (2b).`,
    );
  }
  return i;
}

function esFilaVacia(fila: string[]): boolean {
  return fila.every((c) => !c || !c.trim());
}

/** Fila-sección de departamento: única celda poblada, en MAYÚSCULAS ("CHOCÓ"). */
function esFilaSeccion(fila: string[]): boolean {
  const primera = (fila[0] ?? '').trim();
  if (!primera || !fila.slice(1).every((c) => !c || !c.trim())) return false;
  return /\p{L}/u.test(primera) && primera === primera.toUpperCase();
}

// ───────────────────────── Direcciones ─────────────────────────

const PALABRAS_VIA = new Set([
  'carrera', 'cra', 'kra', 'calle', 'cl', 'avenida', 'av', 'transversal', 'tv',
  'diagonal', 'dg', 'autopista', 'via', 'km', 'kilometro',
]);
const DIRECCIONALES = new Set(['sur', 'norte', 'este', 'oeste', 'bis']);
const PALABRAS_RELLENO = new Set(['de', 'del', 'la', 'el', 'en', 'los', 'las', 'y', 'al']);

/** ¿El texto (normalizado) contiene patrón de dirección: vía + número?
 *  Es la heurística aprobada para Sangre (columnas intercambiadas). */
const RE_DIRECCION = /\b(?:carrera|calle|cra|kra|cl|av|avenida|transversal|tv|diagonal|dg|autopista|km)\b(?:\s+[a-z]+)?\s+\d/;

function pareceDireccion(texto: string): boolean {
  return RE_DIRECCION.test(normalizarTexto(texto));
}

function empiezaConVia(linea: string): boolean {
  const primera = normalizarTexto(linea).split(' ')[0] ?? '';
  return PALABRAS_VIA.has(primera);
}

/**
 * Token de la vía principal para desambiguar ids ("Av. Calle 116 # 18B-42" →
 * "av-calle-116"). Sin vía reconocible: primeras dos palabras significativas
 * ("Edificio Morros 1, …" → "edificio-morros"). '' si no hay dirección.
 */
function tokenDeVia(direccion: string): string {
  const palabras = normalizarTexto(direccion).split(' ').filter(Boolean);
  if (palabras.length === 0) return '';
  const i = palabras.findIndex((p) => PALABRAS_VIA.has(p));
  if (i === -1) {
    return palabras.filter((p) => !PALABRAS_RELLENO.has(p)).slice(0, 2).join('-');
  }
  const token = [palabras[i]!];
  let j = i;
  while (j + 1 < palabras.length && PALABRAS_VIA.has(palabras[j + 1]!)) {
    j += 1;
    token.push(palabras[j]!);
  }
  if (j + 1 < palabras.length) {
    j += 1;
    token.push(palabras[j]!);
    if (j + 1 < palabras.length && DIRECCIONALES.has(palabras[j + 1]!)) token.push(palabras[j + 1]!);
  }
  return token.join('-');
}

/** Divide una celda con varias direcciones (solo orgs aprobadas en 2b):
 *  cada línea que empieza con vía abre un sitio; las demás continúan el anterior. */
function dividirDirecciones(celda: string): string[] {
  const bloques: string[][] = [];
  for (const linea of lineasDe(celda)) {
    if (bloques.length === 0 || empiezaConVia(linea)) bloques.push([linea]);
    else bloques[bloques.length - 1]!.push(linea);
  }
  return bloques.map((b) => unaLinea(b.join(', ')));
}

// ───────────────────────── Categorías (solo Especie) ─────────────────────────

/** Tabla aprobada en 2b. Se aplica sobre "Qué se necesita" normalizado
 *  (minúsculas, sin tildes, sin puntuación). */
const KEYWORDS_CATEGORIA: Partial<Record<Categoria, string[]>> = {
  alimentos: ['aliment', 'comida', 'mercado', 'enlatado', 'grano', 'leche'],
  agua: ['agua', 'hidrat'],
  ropa_abrigo: [
    'ropa', 'calzado', 'zapato', 'cobija', 'manta', 'frazada', 'sabana', 'almohada', 'abrigo',
    'colchoneta', 'saco de dormir', 'sacos para dormir', 'carpa', 'toldillo', 'hamaca',
    'impermeable', 'kit de habitat',
  ],
  mascotas: ['mascota', 'animal', 'concentrado', 'guacal', 'perro', 'gato'],
  construccion: [
    'construccion', 'herramienta', 'material', 'pala', 'pica', 'segueta', 'casco',
    'guantes de carnaza', 'guantes industriales', 'elementos de proteccion', 'chaleco', 'lona',
    'cuerda', 'botas con puntera',
  ],
  medicamentos: [
    'medicament', 'medicina', 'primeros auxilios', 'botiquin', 'insumos medicos',
    'material de curacion', 'gasa', 'venda', 'suero', 'yeso', 'solucion salina', 'alcohol',
    'acetaminofen', 'ibuprofeno',
  ],
  acopio_general: [
    'primera necesidad', 'kit', 'aseo', 'higiene', 'panal', 'toalla higienica', 'linterna',
    'pila', 'bateria', 'power bank', 'cargador', 'radio', 'bebe', 'ninos', 'enseres', 'utensilios',
  ],
};

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Keywords de la tabla 2b que son raíces a propósito (matchean cualquier
 *  terminación): "aliment" → alimentos/alimentación, "hidrat" → hidratación/
 *  hidratantes, "medicament" → medicamento(s). */
const KEYWORDS_RAIZ = new Set(['aliment', 'hidrat', 'medicament']);

/**
 * Keyword → regex sobre el texto normalizado. Palabras completas con plural
 * flexible ("pila" matchea "pilas" pero no "pilar"; "gato" no matchea
 * "gatorade"; "agua" no matchea "aguacate"); "kit de habitat" matchea "kits
 * de hábitat". Las raíces de KEYWORDS_RAIZ quedan abiertas por la derecha.
 * Excepción: "material" (construccion) no dispara dentro de "material de
 * curación", que ya es keyword de medicamentos (verificado con el lote real).
 */
function regexDeKeyword(keyword: string): RegExp {
  if (KEYWORDS_RAIZ.has(keyword)) return new RegExp(`\\b${escaparRegex(keyword)}`);
  if (keyword === 'material') return /\bmateriale?s?\b(?!\s+de\s+curacion)/;
  const cuerpo = keyword
    .split(' ')
    .map((p) => `${escaparRegex(p)}(?:es|s)?`)
    .join('\\s+');
  return new RegExp(`\\b${cuerpo}\\b`);
}

const REGLAS_CATEGORIA: [Categoria, RegExp[]][] = CATEGORIAS.filter((c) => KEYWORDS_CATEGORIA[c]).map(
  (c) => [c, KEYWORDS_CATEGORIA[c]!.map(regexDeKeyword)],
);

function derivarCategorias(descripcion: string): { categorias: Categoria[]; sinMatch: boolean } {
  const texto = normalizarTexto(descripcion);
  const encontradas = REGLAS_CATEGORIA.filter(([, regexes]) => regexes.some((r) => r.test(texto))).map(
    ([c]) => c,
  );
  if (encontradas.length === 0) return { categorias: ['acopio_general'], sinMatch: true };
  // Regla aprobada: 4+ categorías distintas = también es punto de acopio general.
  if (encontradas.length >= 4 && !encontradas.includes('acopio_general')) encontradas.push('acopio_general');
  return { categorias: encontradas, sinMatch: false };
}

// ───────────────────────── Contacto ─────────────────────────

const RE_URL = /https?:\/\/[^\s"']+/g;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Patrones aprobados: Tel./Cel./+57 (más celular colombiano suelto y WhatsApp). */
const RE_TELEFONO = /\b(?:tel|cel)s?\s*[.:]|whatsapp\s*:|\+57|\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/i;
const RE_DOMINIO_SUELTO = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?[;.,]?$/i;

function agregarUnico(lista: string[], valor: string): void {
  if (valor && !lista.includes(valor)) lista.push(valor);
}

/**
 * Clasifica la(s) celda(s) de "Contacto / Más información" (regla 2b):
 * URLs con instagram.com → instagram · otras URLs, dominios sueltos y correos
 * → web · líneas con Tel./Cel./+57 → telefono. Varios se unen con " / ".
 * Rótulos sueltos sin dato ("Info:") se descartan.
 */
function parsearContacto(celdas: string[]): Contacto {
  const texto = celdas.filter((c) => c && c.trim()).join('\n');
  const instagram: string[] = [];
  const web: string[] = [];
  const telefono: string[] = [];

  let resto = texto;
  for (const cruda of texto.match(RE_URL) ?? []) {
    const url = cruda.replace(/[),.;:]+$/, '');
    resto = resto.replace(cruda, ' ');
    agregarUnico(url.includes('instagram.com') ? instagram : web, url);
  }
  const correos: string[] = [];
  for (const correo of resto.match(RE_EMAIL) ?? []) {
    resto = resto.replace(correo, ' ');
    agregarUnico(correos, correo);
  }
  for (const linea of lineasDe(resto)) {
    if (RE_TELEFONO.test(linea)) {
      agregarUnico(telefono, colapsar(linea.replace(/^[-•*\s]+/, '')));
    } else if (RE_DOMINIO_SUELTO.test(linea)) {
      agregarUnico(web, linea.replace(/[;,.]+$/, ''));
    }
  }
  for (const correo of correos) agregarUnico(web, correo);

  return { telefono: telefono.join(' / '), web: web.join(' / '), instagram: instagram.join(' / ') };
}

// ───────────────────────── Conversión por pestaña ─────────────────────────

interface Candidato {
  tab: TabId;
  nombre: string;
  ciudad: string;
  direccion: string;
  descripcion: string;
  horario: string;
  categorias: Categoria[];
  estado: Estado;
  contacto: Contacto;
  /** true = ninguna keyword aplicó y quedó en acopio_general (revisar a mano). */
  sinMatchCategorias?: boolean;
}

interface StatsPestana {
  tab: TabId;
  origen: string;
  avisos: string[];
  filasDatos: number;
  secciones: string[];
  vacias: number;
  descartes: { fila: string; motivo: string }[];
  notas: string[];
  convertidas: number;
}

function statsVacias(tab: TabId): StatsPestana {
  return { tab, origen: '', avisos: [], filasDatos: 0, secciones: [], vacias: 0, descartes: [], notas: [], convertidas: 0 };
}

function convertirEspecie(filas: string[][], enc: number, stats: StatsPestana): Candidato[] {
  const encabezado = filas[enc]!;
  const iCiudad = indiceColumna(encabezado, 'ciudad', 'Especie');
  const iOrg = indiceColumna(encabezado, 'organizacion', 'Especie');
  const iDetalle = indiceColumna(encabezado, 'detalle', 'Especie');
  const iQue = indiceColumna(encabezado, 'que se necesita', 'Especie');
  const iContacto = indiceColumna(encabezado, 'contacto', 'Especie');

  interface FilaSitio { nombre: string; ciudad: string; direccion: string; ques: string[]; contactos: string[] }
  const porIdentidad = new Map<string, FilaSitio>();
  const orden: FilaSitio[] = [];

  for (let f = enc + 1; f < filas.length; f++) {
    const fila = filas[f]!;
    if (esFilaVacia(fila)) { stats.vacias += 1; continue; }
    if (esFilaSeccion(fila)) { stats.secciones.push((fila[0] ?? '').trim()); continue; }
    stats.filasDatos += 1;

    const ciudad = (fila[iCiudad] ?? '').trim();
    const nombre = colapsar(fila[iOrg] ?? '');
    if (CIUDADES_EXCLUIDAS.has(normalizarTexto(ciudad))) {
      stats.descartes.push({ fila: `${nombre || '(sin organización)'} — ${ciudad}`, motivo: 'punto en el extranjero (excluido en 2b)' });
      continue;
    }
    if (normalizarTexto(nombre) === 'varios') {
      stats.descartes.push({ fila: `Varios — ${ciudad}`, motivo: 'fila agregador con link a otro directorio (excluida en 2b)' });
      continue;
    }
    if (!nombre) {
      stats.descartes.push({ fila: `fila de datos ${stats.filasDatos} (${ciudad})`, motivo: 'sin organización: no se puede generar id' });
      continue;
    }

    const celdaDetalle = fila[iDetalle] ?? '';
    const direcciones = ORGS_MULTIDIRECCION.has(normalizarTexto(nombre))
      ? dividirDirecciones(celdaDetalle)
      : [unaLinea(celdaDetalle)];
    if (direcciones.length > 1) {
      stats.notas.push(`"${nombre}" → ${direcciones.length} sitios (varias direcciones en una celda)`);
    }

    for (const direccion of direcciones) {
      const clave = [normalizarTexto(nombre), normalizarTexto(ciudad), normalizarTexto(direccion)].join('|');
      const previo = porIdentidad.get(clave);
      const que = (fila[iQue] ?? '').replace(/\r/g, '').trim();
      const contacto = fila[iContacto] ?? '';
      if (previo) {
        previo.ques.push(que);
        previo.contactos.push(contacto);
        stats.notas.push(`"${nombre}" (${direccion}): filas repetidas fusionadas en un sitio con ambas descripciones`);
      } else {
        const nueva: FilaSitio = { nombre, ciudad, direccion, ques: [que], contactos: [contacto] };
        porIdentidad.set(clave, nueva);
        orden.push(nueva);
      }
    }
  }

  return orden.map((s) => {
    const descripcion = s.ques.filter(Boolean).join('\n\n');
    const { categorias, sinMatch } = derivarCategorias(descripcion);
    return {
      tab: 'especie' as const,
      nombre: s.nombre,
      ciudad: s.ciudad,
      direccion: s.direccion,
      descripcion,
      horario: '',
      categorias,
      estado: 'activo' as const,
      contacto: parsearContacto(s.contactos),
      sinMatchCategorias: sinMatch,
    };
  });
}

/** Textos genéricos de la pestaña Sangre que no aportan información. */
const GENERICOS_SANGRE = new Set(['punto de donacion de sangre', 'banco de sangre', 'donacion de sangre']);

function esGenericoSangre(texto: string): boolean {
  return GENERICOS_SANGRE.has(normalizarTexto(texto));
}

function convertirSangre(filas: string[][], enc: number, stats: StatsPestana): Candidato[] {
  const encabezado = filas[enc]!;
  const iCiudad = indiceColumna(encabezado, 'ciudad', 'Sangre');
  const iOrg = indiceColumna(encabezado, 'organizacion', 'Sangre');
  const iPunto = indiceColumna(encabezado, 'punto de entrega', 'Sangre');
  const iDetalle = indiceColumna(encabezado, 'detalle', 'Sangre');
  const iQue = indiceColumna(encabezado, 'que se necesita', 'Sangre');
  const iContacto = indiceColumna(encabezado, 'contacto', 'Sangre');

  const candidatos: Candidato[] = [];
  for (let f = enc + 1; f < filas.length; f++) {
    const fila = filas[f]!;
    if (esFilaVacia(fila)) { stats.vacias += 1; continue; }
    if (esFilaSeccion(fila)) { stats.secciones.push((fila[0] ?? '').trim()); continue; }
    stats.filasDatos += 1;

    const nombre = colapsar(fila[iOrg] ?? '');
    if (!nombre) {
      stats.descartes.push({ fila: `fila de datos ${stats.filasDatos}`, motivo: 'sin organización: no se puede generar id' });
      continue;
    }

    // Heurística anti-intercambio (2b): dirección/detalle vienen cruzadas según
    // la sección. La celda con patrón de dirección es la dirección; la otra va a
    // descripción salvo que sea el texto genérico.
    const punto = fila[iPunto] ?? '';
    const detalle = fila[iDetalle] ?? '';
    const puntoEsDir = pareceDireccion(punto);
    const detalleEsDir = pareceDireccion(detalle);
    let direccion = '';
    let restantes: string[] = [];
    if (detalleEsDir && !puntoEsDir) {
      direccion = detalle;
      restantes = [punto];
    } else if (puntoEsDir && !detalleEsDir) {
      direccion = punto;
      restantes = [detalle];
    } else if (puntoEsDir && detalleEsDir) {
      // Ambas parecen dirección: gana la columna rotulada "Detalle (dirección…)".
      direccion = detalle;
      restantes = [punto];
    } else {
      // Ninguna parece dirección (caso UdeA itinerante): todo a descripción.
      restantes = [punto, detalle];
    }

    const piezas = restantes
      .filter((c) => c.trim() && !esGenericoSangre(c))
      .map((c) => multilinea(c));
    const que = fila[iQue] ?? '';
    if (que.trim() && !esGenericoSangre(que)) piezas.push(multilinea(que));

    candidatos.push({
      tab: 'sangre',
      nombre,
      ciudad: (fila[iCiudad] ?? '').trim(),
      direccion: unaLinea(direccion),
      descripcion: piezas.join('\n'),
      horario: '',
      categorias: ['sangre'],
      estado: 'activo',
      contacto: parsearContacto([fila[iContacto] ?? '']),
    });
  }
  stats.convertidas = candidatos.length;
  return candidatos;
}

const RE_LINEA_HORARIO = /\d{1,2}:\d{2}/;

function convertirVoluntariados(filas: string[][], enc: number, stats: StatsPestana): Candidato[] {
  const encabezado = filas[enc]!;
  const iCiudad = indiceColumna(encabezado, 'ciudad', 'Voluntariados');
  const iOrg = indiceColumna(encabezado, 'organizacion', 'Voluntariados');
  const iDireccion = indiceColumna(encabezado, 'direccion', 'Voluntariados');
  const iQue = indiceColumna(encabezado, 'que se necesita', 'Voluntariados');
  const iContacto = indiceColumna(encabezado, 'contacto', 'Voluntariados');

  const candidatos: Candidato[] = [];
  for (let f = enc + 1; f < filas.length; f++) {
    const fila = filas[f]!;
    if (esFilaVacia(fila)) { stats.vacias += 1; continue; }
    if (esFilaSeccion(fila)) { stats.secciones.push((fila[0] ?? '').trim()); continue; }
    stats.filasDatos += 1;

    const nombre = colapsar(fila[iOrg] ?? '');
    if (!nombre) {
      stats.descartes.push({ fila: `fila de datos ${stats.filasDatos}`, motivo: 'sin organización: no se puede generar id' });
      continue;
    }

    // Convocatorias "Nacional" sin lugar físico: ciudad vacía (aprobado 2b).
    const ciudadCruda = (fila[iCiudad] ?? '').trim();
    const ciudad = normalizarTexto(ciudadCruda) === 'nacional' ? '' : ciudadCruda;

    // La celda Dirección mezcla dirección, horario y avisos "Llenos…" (2b):
    // horario = líneas con hora; "Llenos…" fija estado lleno y no se guarda
    // (la descripción de la fuente ya lo dice); "N/A" = sin dirección.
    const lineasDireccion: string[] = [];
    const lineasHorario: string[] = [];
    let lleno = false;
    for (const linea of lineasDe(fila[iDireccion] ?? '')) {
      const norm = normalizarTexto(linea);
      if (RE_LINEA_HORARIO.test(linea)) lineasHorario.push(linea);
      else if (norm.startsWith('lleno')) lleno = true;
      else if (norm === 'n a') continue;
      else lineasDireccion.push(linea);
    }
    if (lleno) stats.notas.push(`"${nombre}": la fuente dice "Llenos…" → estado: lleno`);

    candidatos.push({
      tab: 'voluntariados',
      nombre,
      ciudad,
      direccion: colapsar(lineasDireccion.join(', ')),
      descripcion: (fila[iQue] ?? '').replace(/\r/g, '').trim(),
      horario: lineasHorario.join('; '),
      categorias: ['voluntariado'],
      estado: lleno ? 'lleno' : 'activo',
      contacto: parsearContacto([fila[iContacto] ?? '']),
    });
  }
  stats.convertidas = candidatos.length;
  return candidatos;
}

function convertirDinero(filas: string[][], enc: number, stats: StatsPestana): Candidato[] {
  const encabezado = filas[enc]!;
  const iOrg = indiceColumna(encabezado, 'organizacion', 'Dinero');
  const iPunto = indiceColumna(encabezado, 'punto de entrega', 'Dinero');
  const iDetalle = indiceColumna(encabezado, 'detalle', 'Dinero');
  const iQue = indiceColumna(encabezado, 'que se necesita', 'Dinero');
  const iContacto = indiceColumna(encabezado, 'contacto', 'Dinero');

  interface Organizacion { nombre: string; ques: string[]; canales: string[]; contactos: string[] }
  const organizaciones: Organizacion[] = [];
  let continuaciones = 0;

  for (let f = enc + 1; f < filas.length; f++) {
    const fila = filas[f]!;
    if (esFilaVacia(fila)) { stats.vacias += 1; continue; }
    if (esFilaSeccion(fila)) { stats.secciones.push((fila[0] ?? '').trim()); continue; }
    stats.filasDatos += 1;

    const nombre = colapsar(fila[iOrg] ?? '');
    let actual = organizaciones[organizaciones.length - 1];
    if (nombre) {
      actual = { nombre, ques: [], canales: [], contactos: [] };
      organizaciones.push(actual);
    } else if (!actual) {
      stats.descartes.push({ fila: `fila de datos ${stats.filasDatos}`, motivo: 'fila de continuación sin organización previa' });
      continue;
    } else {
      continuaciones += 1;
    }

    // Cada fila es un canal de donación: "Canal: detalle" en la descripción.
    const canal = colapsar(fila[iPunto] ?? '');
    const detalle = unaLinea(fila[iDetalle] ?? '');
    const lineaCanal = canal && detalle ? `${canal}: ${detalle}` : canal || detalle;
    if (lineaCanal) actual.canales.push(lineaCanal);

    const que = (fila[iQue] ?? '').replace(/\r/g, '').trim();
    if (que) actual.ques.push(que);
    const contacto = fila[iContacto] ?? '';
    if (contacto.trim()) actual.contactos.push(contacto);
  }

  if (continuaciones > 0) {
    stats.notas.push(`${continuaciones} filas de continuación fusionadas como canales de su organización`);
  }

  const candidatos = organizaciones.map((o): Candidato => ({
    tab: 'dinero',
    nombre: o.nombre,
    ciudad: '', // campañas sin punto físico (aprobado 2b): solo aparecen en la lista
    direccion: '',
    descripcion: [...o.ques, ...o.canales].join('\n'),
    horario: '',
    categorias: ['dinero'],
    estado: 'activo',
    contacto: parsearContacto(o.contactos),
  }));
  stats.convertidas = candidatos.length;
  return candidatos;
}

// ───────────────────────── Ids estables ─────────────────────────

/** Pestaña de origen de un sitio ya publicado (para la clave de identidad). */
function tabDeSitio(s: Sitio): TabId {
  if (s.categorias.length === 1) {
    if (s.categorias[0] === 'sangre') return 'sangre';
    if (s.categorias[0] === 'voluntariado') return 'voluntariados';
    if (s.categorias[0] === 'dinero') return 'dinero';
  }
  return 'especie';
}

function claveIdentidad(tab: TabId, nombre: string, ciudad: string, direccion: string): string {
  return [tab, normalizarTexto(nombre), normalizarTexto(ciudad), normalizarTexto(direccion)].join('|');
}

interface AsignacionPendiente { c: Candidato; id: string; etapa: number }

/**
 * Escalera aprobada en 2b, determinista desde (nombre, ciudad, dirección,
 * pestaña): slug(nombre) → +ciudad → +token de vía → +pestaña (mismo sitio
 * físico en dos pestañas). Un candidato cuya identidad ya existe en
 * sitios.json ADOPTA su id publicado (los ids no se regeneran jamás).
 */
function asignarIds(
  candidatos: Candidato[],
  existentes: Map<string, Sitio>,
): { ids: Map<Candidato, string>; adopciones: number; avisos: string[] } {
  const avisos: string[] = [];
  const ids = new Map<Candidato, string>();
  const tomados = new Set(existentes.keys());

  const porIdentidad = new Map<string, string>();
  for (const [id, s] of existentes) {
    porIdentidad.set(claveIdentidad(tabDeSitio(s), s.nombre, s.ciudad, s.direccion), id);
  }

  let adopciones = 0;
  const adoptadosEstaCorrida = new Set<string>();
  const pendientes: AsignacionPendiente[] = [];
  for (const c of candidatos) {
    const idPublicado = porIdentidad.get(claveIdentidad(c.tab, c.nombre, c.ciudad, c.direccion));
    if (idPublicado !== undefined && !adoptadosEstaCorrida.has(idPublicado)) {
      ids.set(c, idPublicado);
      adoptadosEstaCorrida.add(idPublicado);
      adopciones += 1;
      continue;
    }
    const base = slugify(c.nombre);
    if (!base) throw new Error(`el nombre "${c.nombre}" no produce slug utilizable`);
    pendientes.push({ c, id: base, etapa: 0 });
  }

  const sufijoDeEtapa = (a: AsignacionPendiente): string => {
    if (a.etapa === 1) {
      const ciudad = slugify(a.c.ciudad);
      // Un sufijo redundante no desambigua: "banco-de-alimentos-de-bogota"
      // no gana nada con "-bogota"; se salta directo a la etapa de vía.
      if (ciudad && `-${a.id}-`.includes(`-${ciudad}-`)) return '';
      return ciudad;
    }
    if (a.etapa === 2) return tokenDeVia(a.c.direccion);
    if (a.etapa === 3) return TOKEN_TAB[a.c.tab];
    return '';
  };

  const gruposEnConflicto = (): AsignacionPendiente[][] => {
    const porId = new Map<string, AsignacionPendiente[]>();
    for (const a of pendientes) {
      const grupo = porId.get(a.id);
      if (grupo) grupo.push(a);
      else porId.set(a.id, [a]);
    }
    return [...porId.entries()]
      .filter(([id, grupo]) => grupo.length > 1 || tomados.has(id))
      .map(([, grupo]) => grupo);
  };

  // Fase de escalera: cada miembro en conflicto avanza etapas hasta aportar sufijo.
  for (let pasada = 0; pasada < 4; pasada++) {
    const grupos = gruposEnConflicto();
    if (grupos.length === 0) break;
    let avanzo = false;
    for (const grupo of grupos) {
      for (const a of grupo) {
        while (a.etapa < 3) {
          a.etapa += 1;
          const sufijo = sufijoDeEtapa(a);
          if (sufijo) {
            a.id = `${a.id}-${sufijo}`;
            avanzo = true;
            break;
          }
        }
      }
    }
    if (!avanzo) break;
  }

  // Fase numérica (no debería ocurrir con el lote 2b — queda como red de seguridad).
  for (const grupo of gruposEnConflicto()) {
    const desde = tomados.has(grupo[0]!.id) ? 0 : 1;
    for (let i = desde; i < grupo.length; i++) {
      const a = grupo[i]!;
      const ocupados = new Set([...tomados, ...pendientes.map((p) => p.id)]);
      let n = 2;
      while (ocupados.has(`${a.id}-${n}`)) n += 1;
      avisos.push(`colisión de id irresoluble con la escalera: "${a.c.nombre}" (${a.c.tab}) → "${a.id}-${n}" — revisar`);
      a.id = `${a.id}-${n}`;
    }
  }

  for (const a of pendientes) ids.set(a.c, a.id);

  const unicos = new Set(ids.values());
  if (unicos.size !== ids.size) throw new Error('bug: la asignación de ids produjo duplicados');
  return { ids, adopciones, avisos };
}

// ───────────────────────── Merge con lo existente ─────────────────────────

function aSitio(c: Candidato, id: string, ahora: string): Sitio {
  return {
    id,
    nombre: c.nombre,
    categorias: c.categorias,
    descripcion: c.descripcion,
    direccion: c.direccion,
    ciudad: c.ciudad,
    localidad: '',
    lat: null, // las coordenadas llegan en F3 (geocode) — jamás se inventan
    lng: null,
    horario: c.horario,
    contacto: c.contacto,
    fuente: fuenteDePestana(c.tab),
    estado: c.estado,
    verificado: false, // dato comunitario sin confirmar (contrato Fase 0)
    manual: false,
    ultimaActualizacion: ahora,
  };
}

const CAMPOS_COMPARABLES = [
  'nombre', 'categorias', 'descripcion', 'direccion', 'ciudad', 'localidad',
  'lat', 'lng', 'horario', 'contacto', 'fuente', 'estado', 'verificado', 'manual',
] as const;

function camposDistintos(a: Sitio, b: Sitio, campos: readonly (keyof Sitio)[]): string[] {
  return campos.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

interface ResultadoMerge {
  archivo: ArchivoSitios;
  altas: string[];
  modificados: { id: string; campos: string[] }[];
  manualesRespetados: string[];
  contradicciones: { id: string; campos: string[] }[];
  noEnHoja: string[];
}

function fusionarConExistente(
  existente: ArchivoSitios,
  candidatos: Candidato[],
  ids: Map<Candidato, string>,
  ahora: string,
): ResultadoMerge {
  const porId = new Map(existente.sitios.map((s) => [s.id, s]));
  const resultado = new Map(porId); // merge, no reemplazo: nada se elimina
  const altas: string[] = [];
  const modificados: { id: string; campos: string[] }[] = [];
  const manualesRespetados: string[] = [];
  const contradicciones: { id: string; campos: string[] }[] = [];
  const idsDeHoja = new Set<string>();

  for (const c of candidatos) {
    const id = ids.get(c)!;
    idsDeHoja.add(id);
    const nuevo = aSitio(c, id, ahora);
    const previo = porId.get(id);
    if (!previo) {
      resultado.set(id, nuevo);
      altas.push(id);
      continue;
    }
    if (previo.manual) {
      // Regla de oro: el pipeline jamás modifica un registro manual. Si la hoja
      // lo trae distinto, se reporta y la persona mantenedora decide.
      manualesRespetados.push(id);
      const campos = camposDistintos(previo, nuevo, ['nombre', 'direccion', 'ciudad', 'descripcion', 'horario', 'estado']);
      if (campos.length > 0) contradicciones.push({ id, campos });
      continue;
    }
    // El importador no puede saber coordenadas ni localidad, y no puede
    // "des-verificar": esos campos se conservan del registro existente.
    const fusionado: Sitio = {
      ...nuevo,
      lat: previo.lat,
      lng: previo.lng,
      localidad: nuevo.localidad || previo.localidad,
      verificado: previo.verificado || nuevo.verificado,
    };
    const campos = camposDistintos(previo, fusionado, CAMPOS_COMPARABLES);
    if (campos.length === 0) {
      resultado.set(id, previo); // sin cambios reales: ni el timestamp se toca
      continue;
    }
    resultado.set(id, fusionado);
    modificados.push({ id, campos });
  }

  const noEnHoja = [...porId.values()].filter((s) => !idsDeHoja.has(s.id) && !s.manual).map((s) => s.id);
  const huboCambios = altas.length > 0 || modificados.length > 0;
  return {
    archivo: { actualizado: huboCambios ? ahora : existente.actualizado, sitios: [...resultado.values()] },
    altas,
    modificados,
    manualesRespetados,
    contradicciones,
    noEnHoja,
  };
}

// ───────────────────────── Descarga (ética del proyecto) ─────────────────────────

async function dormir(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

let requestsHechos = 0;

/** 2 s entre requests al mismo dominio, siempre (ética innegociable). */
async function turnoDeRed(): Promise<void> {
  if (requestsHechos > 0) await dormir(DELAY_ENTRE_REQUESTS_MS);
  requestsHechos += 1;
}

async function descargar(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv,text/plain,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const texto = await res.text();
  if (texto.trimStart().startsWith('<')) throw new Error('la respuesta es HTML, no CSV (¿hoja ya no pública?)');
  return texto;
}

interface CsvObtenido { filas: string[][]; encabezado: number; origen: string; avisos: string[] }

/** Export fresco → fallback gviz → fallback CSV local de /data/import/. */
async function obtenerPestana(p: Pestana): Promise<CsvObtenido> {
  const avisos: string[] = [];
  const intentos: [string, string][] = [
    ['export', `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${p.gid}`],
    ['gviz', `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${p.gid}`],
  ];
  let formatoCambio = false;

  for (const [nombre, url] of intentos) {
    let texto: string;
    try {
      await turnoDeRed();
      texto = await descargar(url);
    } catch (e) {
      avisos.push(`descarga ${nombre} falló: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const filas = parsearCsv(texto);
    const encabezado = buscarEncabezado(filas, p.claveEncabezado);
    // La hoja anunció "nuevo formato" (12-ago): antes de aceptar (y de
    // sobreescribir el snapshot local) se verifica el encabezado COMPLETO del
    // mapeo aprobado en 2b. Si difiere, no se convierte con el mapeo viejo.
    const faltantes = encabezado === -1 ? null : columnasFaltantes(filas[encabezado]!, p.columnas);
    if (encabezado === -1 || (faltantes !== null && faltantes.length > 0)) {
      const detalle =
        encabezado === -1
          ? 'ya no tiene el encabezado aprobado en 2b'
          : `ya no trae las columnas [${faltantes!.join(' · ')}] del mapeo aprobado en 2b`;
      avisos.push(
        `el CSV fresco (${nombre}) ${detalle} — LA PESTAÑA CAMBIÓ DE FORMATO; se usa el CSV local original sin sobreescribirlo`,
      );
      formatoCambio = true;
      break;
    }
    fs.mkdirSync(RUTA_DATA_IMPORT, { recursive: true });
    fs.writeFileSync(path.join(RUTA_DATA_IMPORT, p.archivo), texto, 'utf8');
    return { filas, encabezado, origen: `descarga fresca (${nombre})`, avisos };
  }

  const rutaLocal = path.join(RUTA_DATA_IMPORT, p.archivo);
  if (!fs.existsSync(rutaLocal)) {
    throw new Error(
      `no pude descargar la pestaña ${p.tab} (gid ${p.gid}) y no existe el CSV local.\n` +
        `  Descarga la hoja como CSV y ponla EXACTAMENTE en: ${rutaLocal}\n` +
        `  URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${p.gid}`,
    );
  }
  const filas = parsearCsv(fs.readFileSync(rutaLocal, 'utf8'));
  const encabezado = buscarEncabezado(filas, p.claveEncabezado);
  if (encabezado === -1) {
    throw new Error(`el CSV local ${rutaLocal} tampoco tiene el encabezado esperado ("${p.claveEncabezado}…")`);
  }
  const faltanLocal = columnasFaltantes(filas[encabezado]!, p.columnas);
  if (faltanLocal.length > 0) {
    throw new Error(
      `el CSV local ${rutaLocal} no trae las columnas [${faltanLocal.join(' · ')}] del mapeo aprobado en 2b — revisar el snapshot`,
    );
  }
  if (!formatoCambio) avisos.push('sin red utilizable: se usó el CSV local de /data/import/');
  return { filas, encabezado, origen: 'CSV local (/data/import/)', avisos };
}

// ───────────────────────── Reporte ─────────────────────────

const RE_FECHA_CIERRE = /\b(?:hasta el|a partir del|para el)\b.{0,45}?\bagosto\b|\ba partir del \d{1,2}\b/;

function fechaDeCierre(c: Candidato): string | null {
  const texto = normalizarTexto(`${c.descripcion} ${c.horario}`);
  const m = texto.match(RE_FECHA_CIERRE);
  return m ? m[0] : null;
}

function distribucionCategorias(sitios: Sitio[]): [Categoria, number][] {
  return CATEGORIAS.map((cat): [Categoria, number] => [
    cat,
    sitios.filter((s) => s.categorias.includes(cat)).length,
  ]).filter(([, n]) => n > 0);
}

function topCiudades(sitios: Sitio[], n: number): [string, number][] {
  const conteo = new Map<string, number>();
  for (const s of sitios) {
    const clave = s.ciudad || '(sin ciudad — solo lista)';
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
}

// ───────────────────────── Programa principal ─────────────────────────

async function main(): Promise<void> {
  const ahora = ahoraBogota();
  console.log('import:sheet — F2 Fase 0 (mapeo aprobado en 2b)\n');

  // 0. Archivo existente: el merge parte de él y lo protege.
  let existente: ArchivoSitios = { actualizado: ahora, sitios: [] };
  if (fs.existsSync(RUTA_SITIOS_JSON)) {
    const crudo: unknown = JSON.parse(fs.readFileSync(RUTA_SITIOS_JSON, 'utf8'));
    const parseado = ArchivoSitiosSchema.safeParse(crudo);
    if (!parseado.success) {
      console.error('✗ el /data/sitios.json actual NO valida contra el schema; no toco nada.');
      for (const issue of parseado.error.issues) {
        console.error(`  ✗ ${issue.path.map(String).join('.')}: ${issue.message}`);
      }
      process.exit(1);
    }
    existente = parseado.data;
  }

  // 1 y 2. Obtener CSVs y convertir con el mapeo aprobado.
  const statsPorTab: StatsPestana[] = [];
  const candidatos: Candidato[] = [];
  for (const p of PESTANAS) {
    const stats = statsVacias(p.tab);
    const csv = await obtenerPestana(p);
    stats.origen = csv.origen;
    stats.avisos = csv.avisos;
    let convertidos: Candidato[];
    if (p.tab === 'especie') convertidos = convertirEspecie(csv.filas, csv.encabezado, stats);
    else if (p.tab === 'sangre') convertidos = convertirSangre(csv.filas, csv.encabezado, stats);
    else if (p.tab === 'voluntariados') convertidos = convertirVoluntariados(csv.filas, csv.encabezado, stats);
    else convertidos = convertirDinero(csv.filas, csv.encabezado, stats);
    stats.convertidas = convertidos.length;
    statsPorTab.push(stats);
    candidatos.push(...convertidos);
  }

  // 3. Ids estables + merge que respeta manual:true.
  const existentesPorId = new Map(existente.sitios.map((s) => [s.id, s]));
  const { ids, adopciones, avisos: avisosIds } = asignarIds(candidatos, existentesPorId);
  const merge = fusionarConExistente(existente, candidatos, ids, ahora);

  // 4. Validar TODO y escribir por el único camino permitido (zod → atómico).
  try {
    escribirSitios(RUTA_SITIOS_JSON, merge.archivo);
  } catch (e) {
    if (e instanceof ZodError) {
      console.error(`✗ VALIDACIÓN FALLIDA — no se escribió nada. ${e.issues.length} problema(s):`);
      for (const issue of e.issues) {
        console.error(`  ✗ ${issue.path.map(String).join('.')}: ${issue.message}`);
      }
      process.exit(1);
    }
    throw e;
  }

  // ── Reporte ──
  const sep = '─'.repeat(72);
  console.log(sep);
  console.log('POR PESTAÑA');
  for (const s of statsPorTab) {
    const leidas = s.filasDatos + s.secciones.length + s.vacias;
    console.log(`\n  ${s.tab}  ·  origen: ${s.origen}`);
    for (const a of s.avisos) console.log(`    ⚠ ${a}`);
    console.log(
      `    filas leídas: ${leidas} (datos ${s.filasDatos} · secciones ${s.secciones.length} · vacías ${s.vacias}) → sitios: ${s.convertidas}`,
    );
    if (s.descartes.length > 0) {
      console.log(`    descartadas (${s.descartes.length}):`);
      for (const d of s.descartes) console.log(`      · ${d.fila} — ${d.motivo}`);
    }
    for (const n of s.notas) console.log(`    nota: ${n}`);
  }

  console.log(`\n${sep}`);
  console.log('MERGE');
  console.log(`  altas: ${merge.altas.length} · modificados: ${merge.modificados.length} · ids adoptados de sitios ya publicados: ${adopciones}`);
  for (const m of merge.modificados) console.log(`    ~ ${m.id}: ${m.campos.join(', ')}`);
  console.log(`  manual:true respetados: ${merge.manualesRespetados.length}`);
  for (const c of merge.contradicciones) {
    console.log(`    ⚠ la hoja CONTRADICE al registro manual "${c.id}" en: ${c.campos.join(', ')} — decide la persona mantenedora`);
  }
  if (merge.noEnHoja.length > 0) {
    console.log(`  existentes que la hoja ya no trae (conservados): ${merge.noEnHoja.join(', ')}`);
  }
  for (const a of avisosIds) console.log(`  ⚠ ${a}`);

  const sitios = merge.archivo.sitios;
  console.log(`\n${sep}`);
  console.log(`TOTAL: ${sitios.length} sitios escritos en ${RUTA_SITIOS_JSON}`);
  console.log('  por categoría:');
  for (const [cat, n] of distribucionCategorias(sitios)) console.log(`    ${cat.padEnd(16)} ${n}`);
  console.log('  ciudades (top 5):');
  for (const [ciudad, n] of topCiudades(sitios, 5)) console.log(`    ${ciudad.padEnd(24)} ${n}`);

  console.log(`\n${sep}`);
  console.log('PARA REVISAR POR EL HUMANO');
  const conFecha = candidatos
    .map((c) => ({ id: ids.get(c)!, fecha: fechaDeCierre(c) }))
    .filter((x): x is { id: string; fecha: string } => x.fecha !== null);
  console.log(`  fechas de cierre en el texto (${conFecha.length}) — NO se infirió ningún estado:`);
  for (const x of conFecha) console.log(`    · ${x.id}: "…${x.fecha}…"`);
  const sinMatch = candidatos.filter((c) => c.sinMatchCategorias).map((c) => ids.get(c)!);
  console.log(`  sin match de keywords → quedaron en acopio_general (${sinMatch.length}):`);
  for (const id of sinMatch) console.log(`    · ${id}`);
  const sinDireccion = candidatos.filter((c) => c.direccion === '' && c.tab !== 'dinero').map((c) => ids.get(c)!);
  console.log(`  sin dirección — ubicar a mano (${sinDireccion.length}):`);
  for (const id of sinDireccion) console.log(`    · ${id}`);
  const virtuales = candidatos.filter((c) => c.tab === 'dinero').length;
  console.log(`  (aparte: ${virtuales} campañas de dinero sin punto físico por diseño — solo lista, no mapa)`);

  console.log(`\n✓ Escrito y validado. Siguiente paso: npm run validate y revisar el diff de git.`);
}

main().catch((e: unknown) => {
  console.error(`\n✗ import:sheet abortó: ${e instanceof Error ? e.message : String(e)}`);
  console.error('  No se escribió nada en /data/sitios.json.');
  process.exit(1);
});
