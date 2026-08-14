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

/** Regex flexible que encuentra un número aunque cambien los separadores. */
export function regexNumero(telTexto: string): RegExp | undefined {
  const digitos = telTexto.replace(/\D/g, "");
  // Los últimos 10 dígitos (el número nacional, con o sin prefijo 57).
  const nacional = digitos.slice(-10);
  if (nacional.length < 7) return undefined;
  return new RegExp(nacional.split("").join("[\\s.\\-()]*"), "g");
}

/**
 * Sanea un texto libre (descripción, horario, dirección): si contiene el
 * nombre o el número de una persona del contacto del sitio — pasa en la hoja
 * comunitaria: "… - Enviar comprobante a Gina Rodríguez: +57 313…" — la
 * cláusula se recorta del texto visible. El dato no se pierde: ya vive en el
 * revelado "Ver contacto". Regla: en cada línea afectada se conserva lo
 * anterior al último separador fuerte antes de la ocurrencia; si no queda
 * nada, la línea entera se va. Ante la duda se recorta de más, nunca de menos.
 */
export function sanearTextoPersonal(
  texto: string,
  personas: PersonaContacto[],
): string {
  if (!texto) return texto;
  const objetivos: RegExp[] = [];
  for (const p of personas) {
    if (p.nombre.trim().split(/\s+/).length >= 2) {
      objetivos.push(new RegExp(escaparRegex(p.nombre), "g"));
    }
    const rn = regexNumero(p.telTexto);
    if (rn) objetivos.push(rn);
  }
  if (objetivos.length === 0) return texto;

  return texto
    .split("\n")
    .map((linea) => {
      let primera = -1;
      for (const re of objetivos) {
        re.lastIndex = 0;
        const m = re.exec(linea);
        if (m && (primera === -1 || m.index < primera)) primera = m.index;
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
