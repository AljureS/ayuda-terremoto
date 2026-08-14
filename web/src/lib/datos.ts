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
  esTelefonoPersonal,
  ofuscarPersonas,
  parsearPersonas,
  regexNumero,
  sanearTextoPersonal,
  telHref,
} from "./contacto";
import { hrefDonar } from "./donar";
import { haceTexto, slugCiudad } from "./texto";
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
 * En estado `lleno`/`cerrado` no hay link: no se invita a ir a donde no
 * reciben (DESIGN.md §3).
 */
function hrefComoLlegar(s: SitioCrudo): string | undefined {
  if (s.estado === "lleno" || s.estado === "cerrado") return undefined;
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
  if (tel) {
    if (esTelefonoPersonal(tel)) {
      // Nombre + celular de persona: FUERA del HTML inicial (DESIGN.md §7).
      // Ni siquiera viaja como prop en claro: solo la versión ofuscada.
      const personas = parsearPersonas(tel);
      v.contactoPersonalB64 = ofuscarPersonas(personas);
      colectorPersonas.push(...personas);
      // El mismo dato personal a veces se repite dentro del texto libre de la
      // hoja comunitaria ("Enviar comprobante a {nombre}: {celular}"): se
      // recorta del texto visible — ya vive en el revelado.
      v.descripcion = sanearTextoPersonal(v.descripcion, personas);
      v.direccion = sanearTextoPersonal(v.direccion, personas);
      v.horario = sanearTextoPersonal(v.horario, personas);
    } else {
      v.telefonoTexto = tel;
      v.telefonoHref = telHref(tel);
    }
  }
  const web = normalizarWeb(s.contacto.web);
  if (web) v.web = web;
  if (esCorreo(s.contacto.web)) v.mailto = `mailto:${s.contacto.web.trim()}`;
  const ig = s.contacto.instagram.trim();
  if (ig && /^https?:\/\//i.test(ig)) v.instagram = ig;

  // Si la descripción de una campaña trae la misma URL que la acción "Dona
  // aquí", no se imprime dos veces.
  const donar = hrefDonar(v);
  if (donar) v.descripcion = limpiarDescripcion(s.descripcion, donar);
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
}

/**
 * GARANTÍA ESTRUCTURAL del gate de privacidad (mejor una build rota que una
 * fuga silenciosa): tras preparar todo, se verifica que ningún nombre ni
 * número de contacto personal quede EN CLARO en lo que viaja al cliente.
 * Cubre también datos futuros del pipeline: si mañana la hoja mete un nombre
 * personal en otra descripción, la build FALLA aquí con el sitio señalado.
 */
function verificarSinDatosPersonales(
  vistas: SitioVista[],
  personas: PersonaContacto[],
): void {
  const claro = JSON.stringify(vistas, (clave, valor) =>
    clave === "contactoPersonalB64" ? undefined : valor,
  );
  for (const p of personas) {
    if (p.nombre.trim().split(/\s+/).length >= 2 && claro.includes(p.nombre)) {
      throw new Error(
        `[privacidad] El nombre personal "${p.nombre}" aparece en claro en el payload. ` +
          `Revisa sanearTextoPersonal() en src/lib/contacto.ts.`,
      );
    }
    const rn = regexNumero(p.telTexto);
    if (rn?.test(claro)) {
      throw new Error(
        `[privacidad] El número personal "${p.telTexto}" aparece en claro en el payload. ` +
          `Revisa sanearTextoPersonal() en src/lib/contacto.ts.`,
      );
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

  return {
    geograficos,
    campanas,
    ciudades,
    totalSitios: datos.sitios.length,
    totalConCoords: datos.sitios.filter((s) => s.lat != null && s.lng != null)
      .length,
    actualizadoHace: haceTexto(datos.actualizado, AHORA_BUILD),
  };
}

export type { Categoria, CiudadOpcion, SitioVista };
