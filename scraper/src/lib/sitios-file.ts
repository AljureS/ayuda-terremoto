/**
 * Escritura de /data/sitios.json — EL ÚNICO camino para escribir el archivo.
 *
 * Contrato (docs/architecture.md, decisión #8): cada escritura es
 *   validar con zod → orden determinista → escritura atómica (tmp + rename)
 * para que el diff diario de git sea la herramienta de revisión del humano.
 *
 * Orden determinista:
 *   · sitios ordenados por `id` (comparación por code points, estable entre máquinas)
 *   · claves de cada objeto en el orden canónico del schema
 *   · categorias en el orden del enum CATEGORIAS, sin repetidos
 *   · indentación de 2 espacios + newline final
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ArchivoSitiosSchema,
  CATEGORIAS,
  type ArchivoSitios,
  type Categoria,
  type Sitio,
} from '../schema.js';

const ORDEN_CATEGORIA = new Map<Categoria, number>(CATEGORIAS.map((c, i) => [c, i]));

/** Comparación por code points (NO localeCompare: el orden dependería del locale). */
function compararIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Reconstruye un sitio con las claves en el orden canónico del contrato. */
function ordenarSitio(s: Sitio): Sitio {
  // El literal garantiza el orden de claves en la serialización JSON y obliga
  // (por tipado exhaustivo) a tocar esta función si el schema gana un campo.
  return {
    id: s.id,
    nombre: s.nombre,
    categorias: [...new Set(s.categorias)].sort(
      (a, b) => (ORDEN_CATEGORIA.get(a) ?? 0) - (ORDEN_CATEGORIA.get(b) ?? 0),
    ),
    descripcion: s.descripcion,
    direccion: s.direccion,
    ciudad: s.ciudad,
    localidad: s.localidad,
    lat: s.lat,
    lng: s.lng,
    horario: s.horario,
    contacto: {
      telefono: s.contacto.telefono,
      web: s.contacto.web,
      instagram: s.contacto.instagram,
    },
    fuente: s.fuente,
    estado: s.estado,
    verificado: s.verificado,
    manual: s.manual,
    ultimaActualizacion: s.ultimaActualizacion,
  };
}

/** Copia del archivo con orden determinista (pura: no muta la entrada). */
export function ordenarArchivo(archivo: ArchivoSitios): ArchivoSitios {
  return {
    actualizado: archivo.actualizado,
    sitios: [...archivo.sitios].sort((a, b) => compararIds(a.id, b.id)).map(ordenarSitio),
  };
}

/**
 * Escritura atómica genérica: serializa a un archivo temporal en el MISMO
 * directorio (rename entre volúmenes no es atómico) y luego renombra.
 * Un proceso interrumpido jamás deja un JSON a medio escribir.
 */
export function escribirJsonAtomico(ruta: string, dato: unknown): void {
  const dir = path.dirname(ruta);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(ruta)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(dato, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, ruta);
  } finally {
    // Si algo falló entre write y rename, no dejar residuos.
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
  }
}

/**
 * Escribe /data/sitios.json siguiendo el camino obligatorio del contrato:
 * zod → orden determinista → atómico. Lanza ZodError si el dato no valida
 * (y en ese caso NO toca el archivo existente).
 */
export function escribirSitios(rutaArchivo: string, dato: unknown): ArchivoSitios {
  const valido = ArchivoSitiosSchema.parse(dato);
  const ordenado = ordenarArchivo(valido);
  escribirJsonAtomico(rutaArchivo, ordenado);
  return ordenado;
}
