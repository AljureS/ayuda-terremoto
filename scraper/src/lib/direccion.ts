/**
 * Normalización de direcciones PARA COMPARAR — la usa el dedupe de F5
 * (src/merge.ts). Convierte dos redacciones distintas de la misma dirección
 * bogotana en la misma cadena canónica:
 *
 *   "Carrera 4 # 22-61 (Universidad Jorge Tadeo Lozano)"  → "cra 4 22 61"
 *   "carrera Cuarta #22-61"                               → "cra 4 22 61"
 *   "Av. Carrera 68 # 68B-31"                             → "cra 68 68b 31"
 *   "Carrera 13B # 161-85, Piso 2, Torre H"               → "cra 13b 161 85"
 *
 * Reutiliza el CONCEPTO de abreviación del geocodificador (contrato F3:
 * Carrera→Cra, Calle→Cl, Avenida→Av, Transversal→Tv, Diagonal→Dg, sin "#"),
 * pero es deliberadamente una función aparte y más agresiva: el geocodificador
 * preserva la fidelidad de la consulta (no puede convertir "Primera" en "1"
 * ni recortar "Torre H" sin cambiar lo que Nominatim responde); aquí solo se
 * compara texto contra texto y nunca se sale a la red, así que se canonicaliza
 * al máximo. La tabla no se importa de geocode.ts porque ese módulo ejecuta
 * main() al cargarse (mismo precedente documentado que PALABRAS_VIA duplicada
 * en scrape.ts).
 *
 * Riesgo aceptado y documentado: el colapso de números idénticos consecutivos
 * ("Avenida Primera 1 #9-85" → "av 1 9 85") podría, en teoría, igualar dos
 * placas distintas del mismo frente de manzana. El dedupe nunca fusiona solo
 * por dirección: exige además categoría o token de nombre en común (criterio c
 * del contrato), así que el riesgo real es mínimo.
 */
import { quitarTildes, normalizarTexto } from './normalize.js';

const RE_URL = /https?:\/\/\S+/gi;

/** Vías → forma canónica corta (sobre texto ya en minúsculas y sin tildes). */
const ABREVIATURAS: [RegExp, string][] = [
  [/\b(?:carrera|kra|cra)\b\.?/g, 'cra'],
  [/\b(?:calle|cll|cl)\b\.?/g, 'cl'],
  [/\b(?:avenida|av)\b\.?/g, 'av'],
  [/\b(?:transversal|transv|tv)\b\.?/g, 'tv'],
  [/\b(?:diagonal|diag|dg)\b\.?/g, 'dg'],
];

/**
 * Ordinales FEMENINOS escritos → dígito ("carrera Cuarta" → "cra 4"), más
 * "primero" ("Avenida Primero de Mayo"). Los masculinos de piso ("segundo",
 * "tercer") NO se convierten: son descriptores de interior y los corta JUNK.
 */
const ORDINALES: [RegExp, string][] = [
  [/\bprimera\b|\bprimero\b/g, '1'],
  [/\bsegunda\b/g, '2'],
  [/\btercera\b/g, '3'],
  [/\bcuarta\b/g, '4'],
  [/\bquinta\b/g, '5'],
  [/\bsexta\b/g, '6'],
  [/\bseptima\b/g, '7'],
  [/\boctava\b/g, '8'],
  [/\bnovena\b/g, '9'],
  [/\bdecima\b/g, '10'],
];

/** Palabras de vía canónicas: "Av. Carrera 68" ≡ "Carrera 68" al comparar. */
const VIAS_CANONICAS = new Set(['cra', 'cl', 'tv', 'dg']);

/** Descriptores de interior: desde aquí en adelante se recorta (solo si ya
 *  apareció un token con dígito — "Edificio Morros 1" no debe quedar vacío). */
const JUNK = new Set([
  'piso', 'pisos', 'apto', 'apartamento', 'oficina', 'ofc', 'local', 'torre',
  'bloque', 'bodega', 'sotano', 'etapa', 'interior', 'int', 'edificio', 'salon',
  'modulo', 'consultorio', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto',
]);

/**
 * Dirección → cadena canónica de comparación. "" si no queda nada útil.
 * Idempotente y determinista.
 */
export function normalizarDireccionDedupe(direccion: string): string {
  let t = quitarTildes(direccion.toLowerCase());
  t = t.replace(RE_URL, ' ');
  t = t.replace(/\([^)]*\)/g, ' '); // paréntesis y su contenido (aclaraciones)
  t = t.replace(/\b(?:ubicacion(?: principal)?|direccion)\s*:/g, ' '); // rótulos
  t = t.replace(/\b(?:no|nro)\b\.?\s*/g, ' ').replace(/n[°º]\s*/g, ' ');
  t = t.replace(/#/g, ' ');
  for (const [re, sub] of ABREVIATURAS) t = t.replace(re, sub);
  for (const [re, sub] of ORDINALES) t = t.replace(re, sub);
  t = normalizarTexto(t); // resto de puntuación → espacio, colapsar

  let tokens = t.split(' ').filter(Boolean);

  // "av cra 68" → "cra 68": la Avenida Carrera N y la Carrera N son la misma
  // vía; las fuentes alternan libremente entre ambas formas.
  tokens = tokens.filter((tok, i) => !(tok === 'av' && VIAS_CANONICAS.has(tokens[i + 1] ?? '')));

  // Recorte de descriptores de interior tras el primer token con dígito.
  let vistoDigito = false;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (/\d/.test(tok)) {
      vistoDigito = true;
    } else if (vistoDigito && JUNK.has(tok)) {
      tokens = tokens.slice(0, i);
      break;
    }
  }

  // Números idénticos consecutivos → uno ("av 1 1 9 85" → "av 1 9 85":
  // ordinal escrito + dígito repetido en la fuente).
  tokens = tokens.filter((tok, i) => !(i > 0 && /\d/.test(tok) && tok === tokens[i - 1]));

  return tokens.join(' ');
}
