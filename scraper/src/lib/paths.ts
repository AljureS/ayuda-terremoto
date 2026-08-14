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

/** Caché de geocodificación (F3) — se VERSIONA en git a propósito. */
export const RUTA_CACHE_GEOCODE = path.join(RAIZ_REPO, 'scraper', 'cache', 'geocode.json');
