/**
 * Clasificación y preparación de contactos telefónicos.
 *
 * Decisión aprobada (DESIGN.md §7, "revelado al tocar"): todo
 * `contacto.telefono` que contenga NOMBRE DE PERSONA sale del HTML inicial.
 * La regla es general — se detecta por heurística, no por lista fija de 5,
 * porque el pipeline puede traer contactos personales nuevos en cualquier
 * corrida.
 *
 * Heurística: un teléfono es "personal" si, tras quitar las palabras técnicas
 * (Cel, Tel, ext, WhatsApp, y, …), quedan palabras alfabéticas — en los datos
 * reales esas palabras son siempre nombres propios ("Sergio Mosquera
 * +573058954149", "Cel. 3113069085 (Nicole González)"). Un teléfono
 * institucional solo tiene números, separadores y palabras técnicas
 * ("601 343 6600, ext. 1224", "Cel.: 3116258815").
 */

import { sinTildes } from "./texto";
import type { PersonaContacto } from "./tipos";

/** Palabras que NO son nombre de persona en un campo de teléfono. */
const PALABRAS_TECNICAS = new Set([
  "cel",
  "tel",
  "ext",
  "exts",
  "whatsapp",
  "y",
  "o",
  "al",
  "linea",
  "línea",
  "opcion",
  "opción",
  "llamar",
]);

/**
 * Vocabulario INSTITUCIONAL (endurecimiento W6, hallazgo BAJA-3 de la
 * auditoría): con una sola palabra ya no se puede distinguir "Camilo" de
 * "Fundación" por la forma, así que se decide por lista. La primera mitad sale
 * de los nombres reales del dataset (frecuencia sobre los 204 `nombre`:
 * fundacion 38, banco 23, cruz/roja 21, alcaldia 14, universidad 11,
 * hospital 9…); la segunda es el vocabulario de servicio con el que una hoja
 * comunitaria rotula un teléfono ("Contacto: 601…", "Portería 601…").
 *
 * Se compara sin tildes y en minúsculas. Ante la duda la palabra NO va aquí:
 * dejarla fuera solo cuesta un recorte de más (y un tap en "Ver contacto");
 * meterla de más es publicar el nombre de una persona.
 */
const PALABRAS_INSTITUCIONALES = new Set([
  // organizaciones (derivadas del dataset real)
  "fundacion",
  "corporacion",
  "asociacion",
  "banco",
  "cruz",
  "roja",
  "alcaldia",
  "gobernacion",
  "universidad",
  "hospital",
  "clinica",
  "colegio",
  "iglesia",
  "parroquia",
  "arquidiocesis",
  "colectivo",
  "sociedad",
  "empresa",
  "cooperativa",
  "ong",
  "defensa",
  "civil",
  "bomberos",
  "ejercito",
  "policia",
  // vocabulario de servicio de un campo "teléfono"
  "contacto",
  "contactos",
  "informacion",
  "informes",
  "atencion",
  "recepcion",
  "porteria",
  "administracion",
  "coordinacion",
  "secretaria",
  "direccion",
  "oficina",
  "sede",
  "punto",
  "puntos",
  "acopio",
  "bodega",
  "urgencias",
  "emergencias",
  "conmutador",
  "fijo",
  "celular",
  "movil",
  "nacional",
  "gratuita",
  "gratis",
  "principal",
  "alterno",
  "alternativo",
  "solo",
  "unicamente",
  "preferiblemente",
  "mensajes",
  "mensaje",
  "llamadas",
  "llamada",
  "horario",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
]);

/**
 * ¿Esta cadena es el NOMBRE DE UNA PERSONA?
 *
 * PREDICADO ÚNICO (endurecimiento W6): antes esta regla vivía duplicada en
 * `sanearTextoPersonal()` y en el assert de `datos.ts`, las dos con `>= 2`
 * palabras. Dos copias de la misma regla es exactamente la clase de bug que
 * encontró la auditoría, así que ahora hay una sola definición y las dos la
 * llaman.
 *
 * Regla: dos o más palabras → persona (conservador: preferimos recortar de
 * más). Una sola palabra → persona salvo que sea vocabulario técnico o
 * institucional. En el dataset de hoy (14 entradas, 10 personas) no hay ni una
 * entrada de una sola palabra: este umbral es blindaje para el dato que venga.
 */
export function esNombrePersonal(nombre: string): boolean {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return false;
  if (palabras.length >= 2) return true;
  const p = sinTildes(palabras[0]);
  return !PALABRAS_INSTITUCIONALES.has(p) && !PALABRAS_TECNICAS.has(p);
}

/** Palabras alfabéticas puras (con tildes/ñ), sin dígitos pegados. */
function palabrasAlfabeticas(texto: string): string[] {
  return texto.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g) ?? [];
}

function palabrasNoTecnicas(texto: string): string[] {
  return palabrasAlfabeticas(texto).filter(
    (p) => !PALABRAS_TECNICAS.has(p.toLowerCase()),
  );
}

/** ¿El campo teléfono contiene nombre de persona? */
export function esTelefonoPersonal(telefono: string): boolean {
  return palabrasNoTecnicas(telefono).length > 0;
}

/** Primer número telefónico del texto, como href `tel:` normalizado. */
export function telHref(texto: string): string | undefined {
  const m = texto.match(/\+?\d[\d\s.-]{5,}\d/);
  if (!m) return undefined;
  return normalizarTel(m[0]);
}

/**
 * Normaliza a formato marcable: celulares y fijos colombianos de 10 dígitos
 * reciben prefijo +57; lo demás se deja tal cual (fidelidad a la fuente).
 */
function normalizarTel(crudo: string): string {
  const conMas = crudo.trim().startsWith("+");
  const digitos = crudo.replace(/\D/g, "");
  if (conMas) return `tel:+${digitos}`;
  if (digitos.length === 10) return `tel:+57${digitos}`;
  return `tel:${digitos}`;
}

/**
 * Separa un teléfono personal en personas {nombre, número}.
 * Formatos reales: "Sergio Mosquera +573058954149" ·
 * "Gina Rodríguez: +57 313… / Luisa Coral: +57 316… / Gabriel Lozano:+57 319…" ·
 * "Cel. 3113069085 (Nicole González)".
 * Si un segmento no se puede separar con confianza, se conserva el texto tal
 * cual la fuente como nombre (nunca se inventa ni se pierde información).
 */
export function parsearPersonas(telefono: string): PersonaContacto[] {
  const segmentos = telefono
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const personas: PersonaContacto[] = [];
  for (const seg of segmentos) {
    const numero = seg.match(/\+?\d[\d\s.-]{5,}\d/)?.[0]?.trim();
    const nombre = palabrasNoTecnicas(seg).join(" ");
    if (!numero) continue;
    personas.push({
      nombre: nombre || seg,
      telTexto: numero,
      telHref: normalizarTel(numero),
    });
  }
  // Sin ningún número detectable: se muestra el texto crudo al revelar.
  if (personas.length === 0) {
    personas.push({ nombre: telefono, telTexto: "", telHref: "" });
  }
  return personas;
}

/**
 * Ofuscación en build del contacto personal (base64 de JSON UTF-8).
 * HONESTIDAD TÉCNICA: esto NO es cifrado — es ofuscación. Cumple exactamente
 * lo que la decisión §7 pide: el nombre y el celular no quedan en claro en el
 * HTML estático (no indexable por buscadores, no cosechable con un `curl` o
 * grep trivial); se materializan solo cuando la persona toca "Ver contacto".
 * Solo se llama en build time (Node): usa Buffer.
 */
export function ofuscarPersonas(personas: PersonaContacto[]): string {
  return Buffer.from(JSON.stringify(personas), "utf8").toString("base64");
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex flexible que encuentra un número aunque cambien los separadores.
 *
 * Endurecimiento W6 (hallazgo BAJA-3): antes cualquier número de menos de 7
 * dígitos devolvía `undefined` — es decir, ni se recortaba del texto ni lo veía
 * el assert. Ahora el piso baja a 4 dígitos; a cambio, los números cortos
 * exigen que no haya dígitos pegados a los lados, para no marcar cualquier
 * cifra del texto (un año, un número de placa). De 7 dígitos en adelante el
 * comportamiento es idéntico al de W2–W5: se buscan los últimos 10 dígitos (el
 * número nacional, con o sin prefijo 57) sin anclas, porque en el texto real
 * aparecen pegados al indicativo.
 */
const MIN_DIGITOS_NUMERO = 4;

export function regexNumero(telTexto: string): RegExp | undefined {
  const digitos = telTexto.replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS_NUMERO) return undefined;
  const nucleo = digitos.length > 10 ? digitos.slice(-10) : digitos;
  const cuerpo = nucleo.split("").join("[\\s.\\-()]*");
  return nucleo.length < 7
    ? new RegExp(`(?<!\\d)${cuerpo}(?!\\d)`, "g")
    : new RegExp(cuerpo, "g");
}

/* ─── Documentos de identidad en texto libre (endurecimiento W6) ───────────
 *
 * La auditoría encontró una cédula en claro dentro de una descripción
 * ("… Bancolombia: 261-000749-22, CC 25.289.478"): no es nombre ni teléfono,
 * así que ninguna regla del saneador la cubría. Se cubre en dos niveles,
 * porque la ambigüedad es real y desigual:
 *
 *  (1) ETIQUETADA — "CC 25.289.478", "C.C.: 25289478", "cédula 25.289.478".
 *      Inequívoca: se RECORTA del texto visible y, si sobrevive en algún campo,
 *      rompe la build. El dígito obligatorio después de la etiqueta es lo que
 *      distingue una cédula de "C.C. Parque Fabricato" (centro comercial — 3
 *      apariciones reales en el dataset).
 *
 *  (2) SIN ETIQUETA — "25.289.478" suelta. Tiene EXACTAMENTE la misma forma que
 *      un NIT ("Nit. 890.304.900" — 4 casos reales) y que una cifra de dinero
 *      en formato colombiano ("$5.000.000"). No se recorta en silencio (borrar
 *      el NIT de una campaña le quita a la gente cómo verificarla): rompe la
 *      build pidiendo revisión manual, con las dos salidas escritas en el
 *      mensaje. Ver web/README.md, sección de W6.
 */

/** Etiqueta de documento seguida de dígitos (nivel 1). */
const CEDULA_ETIQUETADA =
  /\b(?:c\.?\s?c\.?|c[ée]dulas?|documento(?:\s+de\s+identidad)?)\s*(?:n[°º.]?\s*)?[:#-]?\s*\d[\d.\s-]{5,}/gi;

/** Cifra con forma de documento: 25.289.478 (también los 3 últimos grupos de
 * una cédula de 10 dígitos, 1.098.765.432) — nivel 2. */
const NUMERO_PUNTEADO = /\d{1,3}\.\d{3}\.\d{3}/g;

/** ¿La cifra viene rotulada como NIT/RUT, o sea identificación de una
 * ORGANIZACIÓN? Tolera las cuatro formas que trae el dataset real:
 * "NIT: 890.480.468-0", "Nit:860.007.627-1", "Nit 890.311.346",
 * "Nit. 890.304.900". */
function rotuladaComoNit(texto: string, indice: number): boolean {
  const antes = texto.slice(Math.max(0, indice - 16), indice);
  return /\b(?:nit|rut)\b[\s.:#°º-]*$/i.test(antes);
}

/** Índice de la primera cédula ETIQUETADA de la línea, o -1. */
function indiceCedulaEtiquetada(linea: string): number {
  CEDULA_ETIQUETADA.lastIndex = 0;
  return CEDULA_ETIQUETADA.exec(linea)?.index ?? -1;
}

/**
 * Primera cifra con forma de documento SIN etiqueta de NIT/RUT, o `undefined`.
 * Solo la usa el assert de build: aquí no se recorta nada en silencio.
 */
export function documentoAmbiguo(texto: string): string | undefined {
  NUMERO_PUNTEADO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMERO_PUNTEADO.exec(texto)) !== null) {
    if (!rotuladaComoNit(texto, m.index)) return m[0];
  }
  return undefined;
}

/** Primera cédula ETIQUETADA del texto, o `undefined` (para el assert). */
export function cedulaEtiquetada(texto: string): string | undefined {
  CEDULA_ETIQUETADA.lastIndex = 0;
  return CEDULA_ETIQUETADA.exec(texto)?.[0];
}

/**
 * Sanea un texto libre (descripción, horario, dirección). Recorta dos cosas:
 *
 * 1. El nombre o el número de una persona del contacto del sitio — pasa en la
 *    hoja comunitaria: "… - Enviar comprobante a Gina Rodríguez: +57 313…".
 *    El dato no se pierde: ya vive en el revelado "Ver contacto".
 * 2. Cualquier documento de identidad ETIQUETADO ("CC 25.289.478"), venga o no
 *    de un contacto personal — por eso se llama para TODOS los sitios, también
 *    los que solo tienen teléfono institucional (endurecimiento W6).
 *
 * Regla de recorte: en cada línea afectada se conserva lo anterior al último
 * separador fuerte antes de la ocurrencia; si no queda nada, la línea entera se
 * va. Ante la duda se recorta de más, nunca de menos.
 */
export function sanearTextoLibre(
  texto: string,
  personas: PersonaContacto[] = [],
): string {
  if (!texto) return texto;
  // Un detector devuelve el índice de la primera ocurrencia prohibida de la
  // línea, o -1. Se usan índices (no solo un booleano) porque el recorte
  // necesita saber DÓNDE empieza la cláusula que sobra.
  const detectores: ((linea: string) => number)[] = [indiceCedulaEtiquetada];
  for (const p of personas) {
    if (esNombrePersonal(p.nombre)) {
      const re = new RegExp(escaparRegex(p.nombre), "g");
      detectores.push((linea) => {
        re.lastIndex = 0;
        return re.exec(linea)?.index ?? -1;
      });
    }
    const rn = regexNumero(p.telTexto);
    if (rn) {
      detectores.push((linea) => {
        rn.lastIndex = 0;
        return rn.exec(linea)?.index ?? -1;
      });
    }
  }

  return texto
    .split("\n")
    .map((linea) => {
      let primera = -1;
      for (const detectar of detectores) {
        const i = detectar(linea);
        if (i !== -1 && (primera === -1 || i < primera)) primera = i;
      }
      if (primera === -1) return linea;
      // Último separador fuerte antes de la ocurrencia; de ahí al final, fuera.
      const antes = linea.slice(0, primera);
      const sep = Math.max(
        antes.lastIndexOf("."),
        antes.lastIndexOf(","),
        antes.lastIndexOf(";"),
        antes.lastIndexOf(" - "),
        antes.lastIndexOf("—"),
      );
      return sep > 0
        ? linea.slice(0, sep).replace(/[\s,;:.-]+$/, "")
        : "";
    })
    .filter((l) => l.trim() !== "")
    .join("\n");
}
