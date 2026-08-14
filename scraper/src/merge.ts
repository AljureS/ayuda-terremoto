/**
 * Dedupe + fusión (F5) — módulo PURO: sin I/O, sin red, sin main(). Lo
 * orquesta build-data.ts; al ser importable, la prueba del invariante de
 * manual:true (obligatoria en el gate de F5) lo ejercita directamente.
 *
 * ── Criterios de "mismo sitio" (contrato + refinamiento aprobado en 2b) ──
 *  (a) nombre normalizado igual Y misma ciudad Y (dirección normalizada igual
 *      o alguna de las dos vacía). El scoping por ciudad/dirección es
 *      OBLIGATORIO: Laika ×8 o Cruz Roja en 12 ciudades son sedes legítimas.
 *  (b) coordenadas a < 100 m (Haversine de lib/) con ≥ 1 categoría en común.
 *  (c) dirección normalizada igual en la misma ciudad aunque el nombre
 *      difiera — fusiona solo si además comparten categoría o un token
 *      significativo del nombre; si no, queda como CANDIDATO en el reporte.
 *  (d) refinamiento de (c) para reconciliar el staging oficial: todos los
 *      tokens significativos (≥ 2) del nombre de un lado están contenidos en
 *      nombre+dirección del otro, misma ciudad y ≥ 1 categoría común, y al
 *      menos uno de los dos es del staging. Cubre "El estadio El Campín" ↔
 *      "… (Estadio Nemesio Camacho el Campín)" y typos de placa
 *      ("# 26-21" vs "# 26-24" del Hospital de la Policía). Se limita al
 *      staging a propósito: entre publicados fusionaría sedes legítimas de
 *      una misma organización.
 *
 * ── Protecciones ──
 *  · manual:true GANA SIEMPRE: un grupo con un manual conserva el manual
 *    byte-idéntico; los duplicados no manuales se descartan y toda diferencia
 *    de contenido se reporta como contradicción (decide el humano). Con DOS
 *    manuales en un grupo no se fusiona nada (se reporta).
 *  · GEMELOS DE PESTAÑA: dos registros PUBLICADOS que cumplen (a) pero con
 *    categorías disjuntas NO se fusionan (se reportan como gemelos
 *    conservados). Son el diseño deliberado de 2b — el mismo lugar anunciado
 *    en pestañas distintas de la hoja (acopio vs voluntariado) con ESTADOS
 *    INDEPENDIENTES: hoy casa-jardin-origen-…-voluntariado está "lleno"
 *    mientras su gemelo de acopio sigue "activo"; fusionarlos perdería esa
 *    señal.
 *
 * ── Precedencia al fusionar (contrato) ──
 *  · id: se conserva el ya publicado (el del staging se descarta). Entre dos
 *    publicados de la misma corrida de importación: el de nombre menos
 *    repetido en el archivo (un nombre-paraguas tipo "Alcaldía de Bogotá /
 *    Cruz Roja" aparece en varios registros y es peor identidad que
 *    "Unicentro"); en empate, orden lexicográfico. Determinista y estable.
 *  · campos: el staging (fuente oficial fresca) gana estado, horario,
 *    descripción, contacto campo a campo y fuente; un campo no vacío NUNCA es
 *    reemplazado por uno vacío (el instagram/web de la hoja sobrevive si el
 *    scraped no trae contacto). verificado = OR. categorias = unión.
 *  · nombre, dirección, ciudad conservan el valor YA PUBLICADO (base). Es una
 *    desviación deliberada de "el más reciente gana" con dos razones duras:
 *    (1) import:sheet identifica sus filas por (pestaña, nombre, ciudad,
 *    dirección) — reescribirlos rompería la re-adopción y generaría altas
 *    fantasma en cada corrida; (2) la caché de geocode está indexada por la
 *    dirección publicada — cambiarla forzaría re-geocodificar el mismo lugar.
 *  · Los timestamps NO se deciden aquí: build-data.ts los restaura o los
 *    avanza comparando contra el estado inicial (idempotencia sin churn).
 */
import { haversineMetros } from './lib/haversine.js';
import { normalizarTexto } from './lib/normalize.js';
import { normalizarDireccionDedupe } from './lib/direccion.js';
import type { Categoria, Sitio } from './schema.js';

export const UMBRAL_FUSION_METROS = 100;

// ───────────────────────── Normalización de nombres ─────────────────────────

/** Muletillas del contrato: no identifican el lugar, solo lo describen. */
const MULETILLAS = [
  'punto de acopio', 'centro de acopio', 'punto de donacion', 'punto de recoleccion',
  'punto de entrega', 'centro comercial',
];

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'u', 'a', 'al', 'en',
  'con', 'para', 'por', 'sobre', 'entre',
]);

/** Sufijos societarios (ya normalizados, como secuencia de tokens). */
const SUFIJOS_SOCIETARIOS: string[][] = [
  ['s', 'a', 's'], ['s', 'a'], ['s', 'en', 'c'], ['e', 's', 'e'], ['e', 's', 'p'],
  ['sas', ], ['ltda'], ['e', 'u'],
];

/**
 * Nombre → forma canónica de comparación del dedupe: minúsculas, sin tildes,
 * sin puntuación, sin muletillas, sin sufijo societario final, sin stopwords.
 *   "Clínica Colsanitas S.A."  → "clinica colsanitas"
 *   "Hospital Central de la Policía Nacional" → "hospital central policia nacional"
 *   "Centro Comercial Unicentro" → "unicentro"
 */
export function normalizarNombreDedupe(nombre: string): string {
  let t = normalizarTexto(nombre);
  for (const m of MULETILLAS) t = t.replace(new RegExp(`\\b${m}\\b`, 'g'), ' ');
  let tokens = t.split(/\s+/).filter(Boolean);
  for (const suf of SUFIJOS_SOCIETARIOS) {
    if (tokens.length > suf.length && suf.every((p, i) => tokens[tokens.length - suf.length + i] === p)) {
      tokens = tokens.slice(0, tokens.length - suf.length);
      break;
    }
  }
  return tokens.filter((tok) => !STOPWORDS.has(tok)).join(' ');
}

/**
 * Tokens que en ESTE dataset no identifican un lugar: aparecen en decenas de
 * registros (organizaciones paraguas, rubros, formas institucionales). Un
 * token significativo es lo que queda al quitarlos.
 */
const GENERICOS = new Set([
  'punto', 'puntos', 'acopio', 'acopios', 'donacion', 'donaciones', 'centro',
  'centros', 'comercial', 'sede', 'sedes', 'banco', 'bancos', 'sangre',
  'fundacion', 'hospital', 'clinica', 'universidad', 'instituto', 'distrital',
  'nacional', 'colombia', 'colombiana', 'colombiano', 'bogota', 'salud',
  'alcaldia', 'cruz', 'roja',
]);

/** Tokens significativos del nombre (≥ 3 letras, ni stopword ni genérico). */
export function tokensSignificativos(nombre: string): Set<string> {
  return new Set(
    normalizarNombreDedupe(nombre)
      .split(' ')
      .filter((tok) => tok.length >= 3 && !GENERICOS.has(tok)),
  );
}

// ───────────────────────── Resultado ─────────────────────────

export interface Fusion {
  conservado: string;
  descartado: string;
  nombreDescartado: string;
  fuenteDescartada: string;
  criterio: string;
}

export interface ResultadoFusion {
  /** Lista final (sin ordenar: escribirSitios ordena; sin timestamps decididos). */
  sitios: Sitio[];
  /** Registros del staging aplicados sobre su MISMO id publicado (campos que cambiaron). */
  overlays: { id: string; campos: string[] }[];
  /** id conservado ← id descartado, con criterio. */
  fusiones: Fusion[];
  /** Ids del staging que entran como sitios netos nuevos. */
  altas: string[];
  /** Posibles duplicados NO fusionados: los revisa un humano. */
  candidatos: { a: string; b: string; motivo: string }[];
  /** Pares (a)-idénticos publicados con categorías disjuntas, conservados a propósito. */
  gemelosConservados: { a: string; b: string }[];
  /** La fuente (staging/hoja) contradice a un registro manual:true. */
  contradiccionesManual: { id: string; origen: string; campos: string[] }[];
}

// ───────────────────────── Fusión de campos ─────────────────────────

function unionCategorias(a: readonly Categoria[], b: readonly Categoria[]): Categoria[] {
  return [...new Set<Categoria>([...a, ...b])];
}

/** Par de coordenadas atómico: solo se toma completo. */
function coordsDe(base: Sitio, otro: Sitio): { lat: number | null; lng: number | null } {
  if (base.lat !== null && base.lng !== null) return { lat: base.lat, lng: base.lng };
  if (otro.lat !== null && otro.lng !== null) return { lat: otro.lat, lng: otro.lng };
  return { lat: null, lng: null };
}

/** El staging oficial fresco se aplica SOBRE un registro publicado (base). */
function aplicarStaging(base: Sitio, st: Sitio): Sitio {
  return {
    ...base,
    categorias: unionCategorias(base.categorias, st.categorias),
    descripcion: st.descripcion || base.descripcion,
    horario: st.horario || base.horario,
    estado: st.estado,
    contacto: {
      telefono: st.contacto.telefono || base.contacto.telefono,
      web: st.contacto.web || base.contacto.web,
      instagram: st.contacto.instagram || base.contacto.instagram,
    },
    fuente: st.fuente,
    verificado: base.verificado || st.verificado,
    localidad: base.localidad || st.localidad,
    ...coordsDe(base, st),
  };
}

/** Un duplicado del MISMO nivel de confianza solo rellena vacíos de la base. */
function rellenarDesde(base: Sitio, otro: Sitio): Sitio {
  return {
    ...base,
    categorias: unionCategorias(base.categorias, otro.categorias),
    descripcion: base.descripcion || otro.descripcion,
    horario: base.horario || otro.horario,
    contacto: {
      telefono: base.contacto.telefono || otro.contacto.telefono,
      web: base.contacto.web || otro.contacto.web,
      instagram: base.contacto.instagram || otro.contacto.instagram,
    },
    verificado: base.verificado || otro.verificado,
    localidad: base.localidad || otro.localidad,
    ...coordsDe(base, otro),
  };
}

const CAMPOS_INFORMATIVOS = [
  'nombre', 'direccion', 'ciudad', 'localidad', 'categorias', 'descripcion',
  'horario', 'estado', 'contacto',
] as const;

function camposDistintos(a: Sitio, b: Sitio, campos: readonly (keyof Sitio)[]): string[] {
  return campos.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

// ───────────────────────── Emparejamiento ─────────────────────────

interface Miembro {
  sitio: Sitio;
  clase: 'publicado' | 'staging';
  nombreNorm: string;
  dirNorm: string;
  ciudadNorm: string;
  tokensNombre: Set<string>;
  /** Tokens del nombre de la PROPIA ciudad: jamás cuentan como evidencia
   *  ("Alcaldía de Santiago de Cali" y "Banco Regional Cali" comparten "cali"
   *  solo porque están en Cali — eso no los hace el mismo sitio). */
  tokensCiudad: Set<string>;
  /** nombre + dirección normalizados, para el criterio (d). */
  tokensNombreDir: Set<string>;
  cats: Set<Categoria>;
}

function aMiembro(sitio: Sitio, clase: Miembro['clase']): Miembro {
  const nombreNorm = normalizarNombreDedupe(sitio.nombre);
  const dirNorm = normalizarDireccionDedupe(sitio.direccion);
  return {
    sitio,
    clase,
    nombreNorm,
    dirNorm,
    ciudadNorm: normalizarTexto(sitio.ciudad),
    tokensNombre: tokensSignificativos(sitio.nombre),
    tokensCiudad: new Set(normalizarTexto(sitio.ciudad).split(' ').filter(Boolean)),
    tokensNombreDir: new Set([...nombreNorm.split(' '), ...dirNorm.split(' ')].filter(Boolean)),
    cats: new Set(sitio.categorias),
  };
}

function compartenCategoria(x: Miembro, y: Miembro): boolean {
  return [...x.cats].some((c) => y.cats.has(c));
}

function compartenToken(x: Miembro, y: Miembro): boolean {
  return [...x.tokensNombre].some(
    (t) => y.tokensNombre.has(t) && !x.tokensCiudad.has(t) && !y.tokensCiudad.has(t),
  );
}

/** ≥ 2 tokens significativos de `x` (sin contar nombres de ciudad) y todos
 *  contenidos en nombre+dirección de `y`. */
function nombreContenido(x: Miembro, y: Miembro): boolean {
  const tokens = [...x.tokensNombre].filter((t) => !x.tokensCiudad.has(t) && !y.tokensCiudad.has(t));
  if (tokens.length < 2) return false;
  return tokens.every((t) => y.tokensNombreDir.has(t));
}

type Veredicto =
  | { tipo: 'fusionar'; criterio: string }
  | { tipo: 'candidato'; motivo: string }
  | { tipo: 'gemelo' }
  | null;

function evaluarPar(x: Miembro, y: Miembro): Veredicto {
  const ambosPublicados = x.clase === 'publicado' && y.clase === 'publicado';
  const cat = compartenCategoria(x, y);

  // (a) nombre + ciudad + dirección (o una vacía)
  const matchA =
    x.nombreNorm !== '' &&
    x.nombreNorm === y.nombreNorm &&
    x.ciudadNorm === y.ciudadNorm &&
    (x.dirNorm === y.dirNorm || x.dirNorm === '' || y.dirNorm === '');
  if (matchA) {
    if (ambosPublicados && !cat) return { tipo: 'gemelo' }; // gemelos de pestaña (2b)
    return { tipo: 'fusionar', criterio: 'a: mismo nombre y ciudad (dirección igual o vacía)' };
  }

  // (b) < 100 m con categoría común
  if (
    x.sitio.lat !== null && x.sitio.lng !== null &&
    y.sitio.lat !== null && y.sitio.lng !== null &&
    cat &&
    haversineMetros(x.sitio.lat, x.sitio.lng, y.sitio.lat, y.sitio.lng) < UMBRAL_FUSION_METROS
  ) {
    return { tipo: 'fusionar', criterio: 'b: a menos de 100 m con categoría común' };
  }

  // (c) misma dirección no vacía en la misma ciudad, nombre distinto
  if (x.dirNorm !== '' && x.dirNorm === y.dirNorm && x.ciudadNorm !== '' && x.ciudadNorm === y.ciudadNorm) {
    if (cat || compartenToken(x, y)) {
      return { tipo: 'fusionar', criterio: 'c: misma dirección con categoría o token de nombre común' };
    }
    return {
      tipo: 'candidato',
      motivo: 'misma dirección normalizada pero sin categoría ni token de nombre en común',
    };
  }

  // (d) nombre de uno contenido en nombre+dirección del otro (solo staging)
  if (
    !ambosPublicados &&
    cat &&
    x.ciudadNorm !== '' && x.ciudadNorm === y.ciudadNorm &&
    (nombreContenido(x, y) || nombreContenido(y, x))
  ) {
    return { tipo: 'fusionar', criterio: 'd: nombre contenido en nombre+dirección con categoría común' };
  }

  // Candidato por contención de dirección: una dirección completa contenida en
  // la otra (p. ej. "…Ubicación principal: Av. Carrera 68 # 68B-31" ⊃
  // "Carrera 68 # 68B-31") con categoría común. Nunca se fusiona solo: revisa el humano.
  if (
    cat &&
    x.ciudadNorm !== '' && x.ciudadNorm === y.ciudadNorm &&
    x.dirNorm !== y.dirNorm && x.dirNorm !== '' && y.dirNorm !== ''
  ) {
    const [corta, larga] = x.dirNorm.length <= y.dirNorm.length ? [x.dirNorm, y.dirNorm] : [y.dirNorm, x.dirNorm];
    const tokensCorta = corta.split(' ');
    const numericos = tokensCorta.filter((t) => /\d/.test(t)).length;
    if (tokensCorta.length >= 3 && numericos >= 2 && ` ${larga} `.includes(` ${corta} `)) {
      return { tipo: 'candidato', motivo: 'una dirección está contenida en la otra y comparten categoría' };
    }
  }

  return null;
}

// ───────────────────────── Union-find ─────────────────────────

class UnionFind {
  private padre: number[];
  constructor(n: number) {
    this.padre = Array.from({ length: n }, (_, i) => i);
  }
  raiz(i: number): number {
    let r = i;
    while (this.padre[r] !== r) r = this.padre[r]!;
    // compresión de camino
    let c = i;
    while (this.padre[c] !== r) {
      const siguiente = this.padre[c]!;
      this.padre[c] = r;
      c = siguiente;
    }
    return r;
  }
  unir(a: number, b: number): void {
    const ra = this.raiz(a);
    const rb = this.raiz(b);
    // raíz determinista: siempre la menor (independiente del orden de llegada)
    if (ra < rb) this.padre[rb] = ra;
    else if (rb < ra) this.padre[ra] = rb;
  }
}

// ───────────────────────── Fusión principal ─────────────────────────

function compararIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Fusiona el staging del scraper con los sitios publicados aplicando el dedupe
 * completo (también entre publicados: duplicados intra-hoja). Pura: no muta
 * las entradas, no escribe, no decide timestamps.
 */
export function fusionarConStaging(publicados: readonly Sitio[], staging: readonly Sitio[]): ResultadoFusion {
  const overlays: ResultadoFusion['overlays'] = [];
  const fusiones: Fusion[] = [];
  const candidatos: ResultadoFusion['candidatos'] = [];
  const gemelos: ResultadoFusion['gemelosConservados'] = [];
  const contradicciones: ResultadoFusion['contradiccionesManual'] = [];

  // ── Fase A: staging con id YA publicado → overlay sobre ese registro ──
  const porId = new Map<string, Sitio>(publicados.map((s) => [s.id, { ...s }]));
  const pendientes: Sitio[] = [];
  for (const st of [...staging].sort((a, b) => compararIds(a.id, b.id))) {
    const pub = porId.get(st.id);
    if (!pub) {
      pendientes.push(st);
      continue;
    }
    if (pub.manual) {
      // Regla de oro: jamás se modifica un manual; la contradicción se reporta.
      const campos = camposDistintos(pub, st, CAMPOS_INFORMATIVOS);
      if (campos.length > 0) contradicciones.push({ id: pub.id, origen: st.fuente, campos });
      continue;
    }
    // Defensa ante colisión de slug entre sitios distintos: mismo id pero sin
    // NINGUNA evidencia de ser el mismo lugar → no se toca, revisa el humano.
    const mx = aMiembro(pub, 'publicado');
    const my = aMiembro(st, 'staging');
    const mismaEvidencia =
      compartenCategoria(mx, my) || compartenToken(mx, my) ||
      (mx.dirNorm !== '' && mx.dirNorm === my.dirNorm);
    if (!mismaEvidencia) {
      candidatos.push({
        a: pub.id,
        b: `(staging) ${st.id}`,
        motivo: 'mismo id pero sin categoría, token ni dirección en común — posible colisión de slug',
      });
      continue;
    }
    const aplicado = aplicarStaging(pub, st);
    const campos = camposDistintos(pub, aplicado, [...CAMPOS_INFORMATIVOS, 'fuente', 'verificado']);
    if (campos.length > 0) overlays.push({ id: pub.id, campos });
    porId.set(pub.id, aplicado);
  }

  // ── Fase B: dedupe por pares sobre publicados (post-overlay) + pendientes ──
  const miembros: Miembro[] = [
    ...[...porId.values()].sort((a, b) => compararIds(a.id, b.id)).map((s) => aMiembro(s, 'publicado' as const)),
    ...pendientes.map((s) => aMiembro(s, 'staging' as const)),
  ];

  // Frecuencia de cada nombre normalizado entre los publicados: un nombre
  // repetido ("Alcaldía de Bogotá / Cruz Roja" ×4) es peor identidad que uno
  // único ("Unicentro") al elegir qué id sobrevive.
  const frecuenciaNombre = new Map<string, number>();
  for (const m of miembros) {
    if (m.clase === 'publicado') {
      frecuenciaNombre.set(m.nombreNorm, (frecuenciaNombre.get(m.nombreNorm) ?? 0) + 1);
    }
  }

  const uf = new UnionFind(miembros.length);
  const criterioPar = new Map<string, string>(); // "i|j" → criterio de la arista
  const candidatosCrudos: { i: number; j: number; motivo: string }[] = [];

  for (let i = 0; i < miembros.length; i++) {
    for (let j = i + 1; j < miembros.length; j++) {
      const v = evaluarPar(miembros[i]!, miembros[j]!);
      if (v === null) continue;
      if (v.tipo === 'fusionar') {
        uf.unir(i, j);
        criterioPar.set(`${i}|${j}`, v.criterio);
      } else if (v.tipo === 'gemelo') {
        gemelos.push({ a: miembros[i]!.sitio.id, b: miembros[j]!.sitio.id });
      } else {
        candidatosCrudos.push({ i, j, motivo: v.motivo });
      }
    }
  }

  const grupos = new Map<number, number[]>();
  miembros.forEach((_, i) => {
    const r = uf.raiz(i);
    const g = grupos.get(r);
    if (g) g.push(i);
    else grupos.set(r, [i]);
  });

  const criterioDe = (indice: number, grupo: number[]): string => {
    for (const otro of grupo) {
      const clave = otro < indice ? `${otro}|${indice}` : `${indice}|${otro}`;
      const c = criterioPar.get(clave);
      if (c !== undefined) return c;
    }
    return 'transitivo (unido a través de otro miembro del grupo)';
  };

  // ── Resolución de cada grupo ──
  const finales: Sitio[] = [];
  const altas: string[] = [];
  /** Miembro → id bajo el que quedó su contenido (para remapear candidatos). */
  const idFinalDe = new Map<number, string>();

  for (const [, grupo] of [...grupos.entries()].sort(([a], [b]) => a - b)) {
    if (grupo.length === 1) {
      const m = miembros[grupo[0]!]!;
      if (m.clase === 'staging') {
        altas.push(m.sitio.id);
      }
      finales.push(m.sitio);
      idFinalDe.set(grupo[0]!, m.sitio.id);
      continue;
    }

    const delGrupo = grupo.map((i) => ({ indice: i, m: miembros[i]! }));
    const manuales = delGrupo.filter(({ m }) => m.sitio.manual);

    if (manuales.length >= 2) {
      // Dos manuales que parecen el mismo sitio: no se fusiona nada, decide el humano.
      for (let x = 0; x < manuales.length; x++) {
        for (let y = x + 1; y < manuales.length; y++) {
          candidatos.push({
            a: manuales[x]!.m.sitio.id,
            b: manuales[y]!.m.sitio.id,
            motivo: 'ambos son manual:true y parecen el mismo sitio — el pipeline no toca manuales',
          });
        }
      }
      for (const { indice, m } of delGrupo) {
        if (m.sitio.manual || m.clase === 'publicado') {
          finales.push(m.sitio); // sin precedencia clara: no se toca nada
          idFinalDe.set(indice, m.sitio.id);
        } else {
          // los staging del grupo se descartan (no crear duplicados nuevos)
          idFinalDe.set(indice, manuales[0]!.m.sitio.id);
          candidatos.push({
            a: manuales[0]!.m.sitio.id,
            b: `(staging) ${m.sitio.id}`,
            motivo: 'staging descartado: duplica un grupo con varios manual:true — decide el humano',
          });
        }
      }
      continue;
    }

    if (manuales.length === 1) {
      // El manual gana SIEMPRE y queda byte-idéntico; los demás se descartan.
      const manual = manuales[0]!;
      finales.push(manual.m.sitio);
      for (const { indice, m } of delGrupo) {
        idFinalDe.set(indice, manual.m.sitio.id);
        if (m === manual.m) continue;
        const campos = camposDistintos(manual.m.sitio, m.sitio, CAMPOS_INFORMATIVOS);
        if (campos.length > 0) {
          contradicciones.push({ id: manual.m.sitio.id, origen: m.sitio.fuente, campos });
        }
        fusiones.push({
          conservado: manual.m.sitio.id,
          descartado: m.sitio.id,
          nombreDescartado: m.sitio.nombre,
          fuenteDescartada: m.sitio.fuente,
          criterio: `${criterioDe(indice, grupo)} · manual:true gana siempre`,
        });
      }
      continue;
    }

    // Sin manuales: sobrevive el id publicado; entre publicados, el de nombre
    // menos repetido y luego el lexicográficamente menor. Grupo solo-staging:
    // el id lexicográficamente menor.
    const publicadosG = delGrupo.filter(({ m }) => m.clase === 'publicado');
    const stagingG = delGrupo.filter(({ m }) => m.clase === 'staging');
    const ordenSupervivencia = (
      p: { indice: number; m: Miembro },
      q: { indice: number; m: Miembro },
    ): number =>
      (frecuenciaNombre.get(p.m.nombreNorm) ?? 0) - (frecuenciaNombre.get(q.m.nombreNorm) ?? 0) ||
      compararIds(p.m.sitio.id, q.m.sitio.id);

    const base = publicadosG.length > 0
      ? [...publicadosG].sort(ordenSupervivencia)[0]!
      : [...stagingG].sort((p, q) => compararIds(p.m.sitio.id, q.m.sitio.id))[0]!;

    let resultado = base.m.sitio;
    // Primero los publicados perdedores (rellenan vacíos)…
    for (const { m } of [...publicadosG].sort((p, q) => compararIds(p.m.sitio.id, q.m.sitio.id))) {
      if (m === base.m) continue;
      resultado = rellenarDesde(resultado, m.sitio);
    }
    // …después el staging (gana estado/horario/descripcion/contacto/fuente).
    // También cuando la base es staging: en la corrida siguiente el
    // sobreviviente ya estará publicado y recibirá overlay de cada registro
    // del staging en este mismo orden — aplicar la misma regla HOY es lo que
    // hace la fusión convergente (el archivo no cambia entre corridas).
    for (const { m } of [...stagingG].sort((p, q) => compararIds(p.m.sitio.id, q.m.sitio.id))) {
      if (m === base.m) continue;
      resultado = aplicarStaging(resultado, m.sitio);
    }
    finales.push(resultado);
    if (base.m.clase === 'staging') altas.push(resultado.id);

    for (const { indice, m } of delGrupo) {
      idFinalDe.set(indice, resultado.id);
      if (m === base.m) continue;
      // Si el descartado traía OTRO estado, avisar fuerte: el estado del
      // sobreviviente manda y esa señal merece revisión humana.
      const avisoEstado =
        m.sitio.estado !== resultado.estado
          ? ` · ⚠ estados distintos: descartado "${m.sitio.estado}" vs conservado "${resultado.estado}"`
          : '';
      fusiones.push({
        conservado: resultado.id,
        descartado: m.sitio.id,
        nombreDescartado: m.sitio.nombre,
        fuenteDescartada: m.sitio.fuente,
        criterio: criterioDe(indice, grupo) + avisoEstado,
      });
    }
  }

  // Candidatos de la fase B: solo pares que NO terminaron en el mismo grupo,
  // remapeados al id bajo el que quedó cada contenido, sin repetidos.
  const candidatosVistos = new Set<string>();
  for (const c of candidatosCrudos) {
    const a = idFinalDe.get(c.i) ?? miembros[c.i]!.sitio.id;
    const b = idFinalDe.get(c.j) ?? miembros[c.j]!.sitio.id;
    if (a === b) continue;
    const [menor, mayor] = a < b ? [a, b] : [b, a];
    const clave = `${menor}|${mayor}|${c.motivo}`;
    if (candidatosVistos.has(clave)) continue;
    candidatosVistos.add(clave);
    candidatos.push({ a: menor, b: mayor, motivo: c.motivo });
  }

  // Defensa final: las altas del staging no pueden chocar con ids existentes
  // (la fase A ya absorbió los ids repetidos; esto atraparía un bug).
  const vistos = new Set<string>();
  for (const s of finales) {
    if (vistos.has(s.id)) throw new Error(`bug del merge: id duplicado "${s.id}" en el resultado final`);
    vistos.add(s.id);
  }

  return {
    sitios: finales,
    overlays,
    fusiones: fusiones.sort((a, b) => compararIds(a.conservado, b.conservado) || compararIds(a.descartado, b.descartado)),
    altas: altas.sort(compararIds),
    candidatos,
    gemelosConservados: gemelos.sort((a, b) => compararIds(a.a, b.a)),
    contradiccionesManual: contradicciones,
  };
}
