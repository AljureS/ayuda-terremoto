/**
 * Carga y preparación de datos EN BUILD TIME.
 *
 * SOLO SERVER (convención estricta, sin dependencia extra de `server-only`):
 * este módulo lo importan únicamente los server components (`src/app/⋯/page.tsx`).
 * Importarlo desde un client component metería el dataset completo también en
 * el bundle JS — no lo hagas.
 *
 * Única frontera con el resto del monorepo (regla de oro, architecture.md §2):
 * el import estático de /data/sitios.json de la línea siguiente. La web
 * compila aunque /scraper no exista; el JSON existe siempre.
 */
import crudos from "../../../data/sitios.json";

import {
  cedulaEtiquetada,
  documentoAmbiguo,
  esNombrePersonal,
  esTelefonoPersonal,
  ofuscarPersonas,
  parsearPersonas,
  regexNumero,
  sanearTextoLibre,
  telHref,
} from "./contacto";
import { hrefDonar } from "./donar";
import { fechaBogota, haceTexto, slugCiudad } from "./texto";
import type {
  Categoria,
  CiudadOpcion,
  DatosCrudos,
  PersonaContacto,
  SitioCrudo,
  SitioVista,
} from "./tipos";

const datos = crudos as DatosCrudos;

/** Momento de la build: de aquí salen todos los "hace X h" (sin relojes en cliente). */
const AHORA_BUILD = new Date();

/** Sello del dataset (campo `actualizado`). Lo usa el `lastModified` del sitemap. */
export const ACTUALIZADO_ISO = datos.actualizado;

/** ¿El campo web es en realidad un correo? (pasa en la hoja comunitaria) */
function esCorreo(s: string): boolean {
  return /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(s.trim());
}

function normalizarWeb(s: string): string | undefined {
  const w = s.trim();
  if (!w || esCorreo(w)) return undefined;
  if (/^https?:\/\//i.test(w)) return w;
  return `https://${w}`;
}

/**
 * "Cómo llegar" — deep links SIN API key, iniciados por el usuario (decisión
 * del contrato + W2): navegan a Google Maps con datos PÚBLICOS del sitio
 * (jamás la ubicación del usuario, que en W2 ni siquiera existe).
 * - Con coordenadas: /maps/dir con destination=lat,lng.
 * - Sin coordenadas pero con dirección: /maps/search con la dirección + ciudad
 *   urlencodeadas — mantiene la acción útil para los 135 sitios geográficos
 *   que aún no tienen coordenadas exactas.
 *
 * LA ACCIÓN PRIMARIA EXISTE SOLO EN `activo` (DESIGN.md §3, invariante
 * reescrito en W6/P5). Se escribe como regla y no como lista de estados a
 * propósito: la redacción anterior enumeraba `lleno`/`cerrado` y por eso dejó
 * fuera `pausado` —el estado que se agregó después— invitando a viajar con una
 * caja a un punto que hoy no recibe. Así formulada sobrevive a cualquier
 * estado futuro. Informar no es invitar: la tarjeta sigue completa, lo único
 * que se retira es el botón que empuja a moverse.
 */
function hrefComoLlegar(s: SitioCrudo): string | undefined {
  if (s.estado !== "activo") return undefined;
  if (s.lat != null && s.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  }
  if (s.direccion && s.ciudad) {
    const consulta = `${s.direccion}, ${s.ciudad}, Colombia`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
  }
  return undefined;
}

/** Quita del texto visible una URL que ya se convirtió en la acción principal. */
function limpiarDescripcion(desc: string, urlAccion?: string): string {
  let d = desc;
  if (urlAccion && d.includes(urlAccion)) {
    d = d.replace(urlAccion, "");
    d = d.replace(/en\s+l[ií]nea:\s*$/im, "");
  }
  return d.replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

function aVista(s: SitioCrudo, colectorPersonas: PersonaContacto[]): SitioVista {
  const v: SitioVista = {
    id: s.id,
    nombre: s.nombre,
    categorias: s.categorias,
    descripcion: s.descripcion,
    direccion: s.direccion,
    ciudadSlug: s.ciudad ? slugCiudad(s.ciudad) : "",
    ciudadNombre: s.ciudad,
    localidad: s.localidad,
    lat: s.lat,
    lng: s.lng,
    horario: s.horario,
    fuente: s.fuente,
    estado: s.estado,
    verificado: s.verificado,
    hace: haceTexto(s.ultimaActualizacion, AHORA_BUILD),
    comoLlegar: hrefComoLlegar(s),
  };

  const tel = s.contacto.telefono.trim();
  let personas: PersonaContacto[] = [];
  if (tel) {
    if (esTelefonoPersonal(tel)) {
      // Nombre + celular de persona: FUERA del HTML inicial (DESIGN.md §7).
      // Ni siquiera viaja como prop en claro: solo la versión ofuscada.
      personas = parsearPersonas(tel);
      v.contactoPersonalB64 = ofuscarPersonas(personas);
      colectorPersonas.push(...personas);
    } else {
      v.telefonoTexto = tel;
      v.telefonoHref = telHref(tel);
    }
  }
  // El texto libre se sanea SIEMPRE, tenga o no contacto personal (W6): el
  // mismo dato personal a veces se repite dentro de la descripción de la hoja
  // comunitaria ("Enviar comprobante a {nombre}: {celular}") — ya vive en el
  // revelado — y un documento de identidad etiquetado ("CC 25.289.478") puede
  // aparecer en cualquier sitio, también en los que solo tienen conmutador.
  v.descripcion = sanearTextoLibre(v.descripcion, personas);
  v.direccion = sanearTextoLibre(v.direccion, personas);
  v.horario = sanearTextoLibre(v.horario, personas);
  const web = normalizarWeb(s.contacto.web);
  if (web) v.web = web;
  if (esCorreo(s.contacto.web)) v.mailto = `mailto:${s.contacto.web.trim()}`;
  const ig = s.contacto.instagram.trim();
  if (ig && /^https?:\/\//i.test(ig)) v.instagram = ig;

  // Si la descripción de una campaña trae la misma URL que la acción "Dona
  // aquí", no se imprime dos veces. OJO: se parte de `v.descripcion` (la YA
  // saneada), no de `s.descripcion`. Con el texto crudo, un sitio que fuera
  // campaña de dinero Y tuviera contacto personal recuperaba aquí la línea que
  // el saneador acababa de recortar (hoy lo atrapaba el assert rompiendo la
  // build; con el texto saneado el problema no existe).
  const donar = hrefDonar(v);
  if (donar) v.descripcion = limpiarDescripcion(v.descripcion, donar);
  return v;
}

/** Orden estable de lista (W2, sin ubicación aún): activos primero, luego
 * verificados, luego alfabético es-CO. En W4 la cercanía reordena encima. */
function ordenLista(a: SitioVista, b: SitioVista): number {
  const peso = (e: SitioVista) =>
    e.estado === "activo" ? 0 : e.estado === "cerrado" ? 2 : 1;
  if (peso(a) !== peso(b)) return peso(a) - peso(b);
  if (a.verificado !== b.verificado) return a.verificado ? -1 : 1;
  return a.nombre.localeCompare(b.nombre, "es");
}

export interface DatosPreparados {
  /** Sitios con ciudad (155): la lista geográfica de la home. */
  geograficos: SitioVista[];
  /** Sitios sin ciudad ni punto físico (49): viven SOLO en /campanas. */
  campanas: SitioVista[];
  /** Ciudades con conteo total, ordenadas por número de sitios. */
  ciudades: CiudadOpcion[];
  totalSitios: number;
  totalConCoords: number;
  /** "hace X h" del campo `actualizado` del dataset, calculado en build. */
  actualizadoHace: string;
  /** Fecha exacta del dataset en hora de Bogotá (para "Acerca de"). */
  actualizadoFecha: string;
  /**
   * Cuántos sitios aporta cada host de `fuente`. Alimenta los créditos de
   * "Acerca de" con números REALES del dataset en vez de cifras escritas a
   * mano que envejecen mal (honestidad del dato, DESIGN.md §4 candidato C).
   */
  sitiosPorFuente: Record<string, number>;
}

/** Host de una URL de `fuente`, sin "www." (para agrupar los créditos). */
function hostFuente(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Campos de TEXTO HUMANO de una vista: lo que una persona escribió en la
 * hoja comunitaria y lo que la tarjeta imprime. El barrido de documentos de
 * identidad se hace sobre estos y no sobre el JSON entero para no chocar con
 * dígitos que viven legítimamente dentro de una URL (un `id` numérico, una IP)
 * y que no son texto que nadie lea. */
const CAMPOS_TEXTO = [
  "nombre",
  "descripcion",
  "direccion",
  "localidad",
  "horario",
  "telefonoTexto",
] as const;

/**
 * GARANTÍA ESTRUCTURAL del gate de privacidad (mejor una build rota que una
 * fuga silenciosa): tras preparar todo, se verifica que ningún nombre, número
 * ni documento de identidad quede EN CLARO en lo que viaja al cliente.
 * Cubre también datos futuros del pipeline: si mañana la hoja mete un nombre
 * personal en otra descripción, la build FALLA aquí con el sitio señalado.
 *
 * Endurecimiento W6 (hallazgos BAJA-3 de la auditoría de privacidad):
 * - El umbral de "esto es un nombre de persona" ya no vive duplicado aquí:
 *   es `esNombrePersonal()` de contacto.ts, el MISMO predicado que usa el
 *   saneador (antes las dos copias decían `>= 2 palabras` y un nombre de una
 *   sola palabra pasaba por los dos).
 * - Los números de menos de 7 dígitos ya no son invisibles (`regexNumero`).
 * - Se añade el barrido de documentos de identidad, que ninguna regla cubría:
 *   la auditoría encontró una cédula en claro dentro de una descripción.
 */
function verificarSinDatosPersonales(
  vistas: SitioVista[],
  personas: PersonaContacto[],
): void {
  const claro = JSON.stringify(vistas, (clave, valor) =>
    clave === "contactoPersonalB64" ? undefined : valor,
  );
  for (const p of personas) {
    if (esNombrePersonal(p.nombre) && claro.includes(p.nombre)) {
      throw new Error(
        `[privacidad] El nombre personal "${p.nombre}" aparece en claro en el payload. ` +
          `Revisa sanearTextoLibre() en src/lib/contacto.ts.`,
      );
    }
    const rn = regexNumero(p.telTexto);
    if (rn?.test(claro)) {
      throw new Error(
        `[privacidad] El número personal "${p.telTexto}" aparece en claro en el payload. ` +
          `Revisa sanearTextoLibre() en src/lib/contacto.ts.`,
      );
    }
  }

  for (const v of vistas) {
    for (const campo of CAMPOS_TEXTO) {
      const texto = v[campo];
      if (!texto) continue;
      const etiquetada = cedulaEtiquetada(texto);
      if (etiquetada) {
        throw new Error(
          `[privacidad] El sitio "${v.id}" publica un documento de identidad ` +
            `("${etiquetada.trim()}") en el campo ${campo}. ` +
            `Debería haberlo recortado sanearTextoLibre() en src/lib/contacto.ts: ` +
            `revisa por qué no lo hizo antes de publicar.`,
        );
      }
      const ambiguo = documentoAmbiguo(texto);
      if (ambiguo) {
        throw new Error(
          `[privacidad] REVISIÓN MANUAL: el sitio "${v.id}" trae la cifra ` +
            `"${ambiguo}" en el campo ${campo} y tiene la forma de una cédula. ` +
            `Si es el NIT de una organización, escríbelo en /data/sitios.json ` +
            `rotulado ("NIT ${ambiguo}") y esta build pasa. Si es una cifra de ` +
            `dinero, escríbela sin puntos o con símbolo ($). Si de verdad es la ` +
            `cédula de una persona, bórrala del dato: no se publica.`,
        );
      }
    }
  }
}

export function prepararDatos(): DatosPreparados {
  const personas: PersonaContacto[] = [];
  const vistas = datos.sitios.map((s) => aVista(s, personas));
  verificarSinDatosPersonales(vistas, personas);
  const geograficos = vistas.filter((s) => s.ciudadNombre).sort(ordenLista);
  const campanas = vistas.filter((s) => !s.ciudadNombre).sort(ordenLista);

  const porCiudad = new Map<string, CiudadOpcion>();
  for (const s of geograficos) {
    const previa = porCiudad.get(s.ciudadSlug);
    if (previa) previa.n += 1;
    else
      porCiudad.set(s.ciudadSlug, {
        slug: s.ciudadSlug,
        nombre: s.ciudadNombre,
        n: 1,
      });
  }
  const ciudades = [...porCiudad.values()].sort(
    (a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"),
  );

  const sitiosPorFuente: Record<string, number> = {};
  for (const s of datos.sitios) {
    const h = hostFuente(s.fuente);
    if (h) sitiosPorFuente[h] = (sitiosPorFuente[h] ?? 0) + 1;
  }

  return {
    geograficos,
    campanas,
    ciudades,
    totalSitios: datos.sitios.length,
    totalConCoords: datos.sitios.filter((s) => s.lat != null && s.lng != null)
      .length,
    actualizadoHace: haceTexto(datos.actualizado, AHORA_BUILD),
    actualizadoFecha: fechaBogota(datos.actualizado),
    sitiosPorFuente,
  };
}

export type { Categoria, CiudadOpcion, SitioVista };
