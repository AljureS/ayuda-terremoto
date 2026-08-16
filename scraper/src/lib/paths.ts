/**
 * Rutas canónicas del proyecto, resueltas desde la ubicación de este archivo
 * (independientes del cwd — los scripts corren igual desde cualquier parte).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)); // …/scraper/src/lib

/** Raíz del monorepo. */
export const RAIZ_REPO = path.resolve(AQUI, '..', '..', '..');

/** La frontera única entre /scraper y /web (fuente única de verdad). */
export const RUTA_SITIOS_JSON = path.join(RAIZ_REPO, 'data', 'sitios.json');

/** CSVs crudos de entrada (fallback de importación, contrato Fase 0). */
export const RUTA_DATA_IMPORT = path.join(RAIZ_REPO, 'data', 'import');

/**
 * El LATIDO del pipeline: cuándo se revisaron las fuentes por última vez.
 * Vive en /data —lo lee la web en build time— pero es ESTADO DEL SISTEMA, no
 * datos: por eso es un archivo aparte de sitios.json (decisión #13 de
 * docs/architecture.md). Solo build-data.ts lo escribe. SE VERSIONA en git.
 */
export const RUTA_ESTADO_PIPELINE = path.join(RAIZ_REPO, 'data', 'estado-pipeline.json');

/** Caché de geocodificación (F3) — se VERSIONA en git a propósito. */
export const RUTA_CACHE_GEOCODE = path.join(RAIZ_REPO, 'scraper', 'cache', 'geocode.json');
