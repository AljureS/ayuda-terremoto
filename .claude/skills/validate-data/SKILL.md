---
name: validate-data
description: Valida /data/sitios.json — schema zod más calidad de datos (ids duplicados, coordenadas nulas o fuera de Colombia, datos con más de 72 h, fuentes vacías, duplicados no fusionados). Úsalo tras cualquier cambio de datos, después de correr el pipeline y como parte de /ship-check.
---

Valida la fuente única de verdad del proyecto (`/data/sitios.json`) en dos capas y presenta un reporte accionable.

## 1. Schema (contrato duro)

- Si el scraper existe: `cd scraper && npm run validate`.
- Si estamos en fase temprana y aún no existe, valida ad hoc con un script corto de node (en el scratchpad): parsea el JSON y verifica campos y enums contra el schema canónico de `docs/MASTER_PROMPT.md` (la semántica de cada campo está en `docs/architecture.md`).
- Cualquier error de schema **bloquea el commit** hasta arreglarlo.

## 2. Calidad (lo que zod no ve)

Con un script corto de node en el scratchpad, reporta:

- `id` duplicados (rompen el contrato de estabilidad).
- Sitios con `lat/lng: null` → lista con nombre y dirección ("para ubicar a mano").
- Coordenadas fuera del bbox de Colombia (lat −4.3…13.5, lng −82…−66) → casi siempre son lat/lng invertidos.
- Sitios de Bogotá fuera de su bbox (lat 3.7…5.0, lng −74.6…−73.8) → sospechosos, listar.
- `ultimaActualizacion` con más de 72 h → lista (dato viejo en emergencia = riesgo).
- `fuente` vacía o que no es URL ni nota de verificación directa.
- Distribución de `estado` (cuántos activo / lleno / pausado / cerrado) y conteo de `manual: true`.
- Pares de sitios a menos de 100 m con categorías en común que **no** fueron fusionados → candidatos a duplicado para revisar.

## Reporte

Tabla resumen + listas de acción concretas. Termina con un veredicto claro: **✅ listo para commit** o **❌ bloqueado por:** (motivos concretos).
