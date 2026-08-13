# Plan Scraper — hasta el pipeline en funcionamiento

Plan ejecutable fase por fase hasta que el pipeline de datos completo (`npm run build:data`) corra end-to-end y produzca un `/data/sitios.json` válido. Cada fase tiene responsable, entregables y una puerta de salida verificable.

**Este plan cubre solo el scraper.** El plan de la página web vivirá aparte en `docs/PLAN_WEB.md` cuando arranque esa fase (fase 3 del contrato), y partirá del `sitios.json` real que este plan produce.

Principios que gobiernan todo (de `docs/MASTER_PROMPT.md`): regla de oro (el scraper jamás importa de `/web`; solo se comunican por `sitios.json`) · ética de scraping innegociable · `manual: true` intocable · zod antes de cada escritura · ids estables · simplicidad sobre sofisticación.

## Separación de carpetas (estructura objetivo — innegociable)

```
/scraper   → TODO el código del scraper (Node + TS). Este plan solo construye aquí…
/data      → …y aquí: la frontera. sitios.json (fuente única de verdad)
             + /data/import/ (CSVs crudos de entrada). Compartida por contrato, no por código.
/web       → TODO el código de la página (Next.js). Este plan NO la toca.
             Su plan será docs/PLAN_WEB.md.
```

Reglas de la separación: ningún import cruzado entre `/scraper` y `/web`, jamás — ni tipos, ni utilidades, ni configs. Cada mitad se puede borrar o reescribir sin tocar la otra. Si durante este plan aparece la tentación de "compartir" algo con la futura web, la respuesta es no: se duplica en su momento, documentado.

## Estado

- [ ] F1 — Cimientos: scaffolding + schema + validación
- [ ] F2 — Fase 0: importación del Google Sheet (2a descubrimiento · 2b aprobación del mapeo · 2c conversión)
- [ ] F3 — Geocodificación con Nominatim
- [ ] F4 — Scrapers de fuentes oficiales (4a recon · 4b implementación)
- [ ] F5 — Dedupe + merge + pipeline completo
- [ ] F6 — Auditoría de ética + documentación del scraper → **scraper EN FUNCIONAMIENTO**

## F1 — Cimientos

**Responsable:** agente `data-pipeline`. **Gate:** `npm run validate` en verde sobre un `sitios.json` inicial válido.

Entregables: `/scraper/package.json` (typescript, tsx, zod, cheerio, csv-parse — nada más; cada dependencia justificada) · `tsconfig.json` · `src/schema.ts` (schema zod canónico, única definición, tipo inferido exportado) · `src/lib/` (slug estable, normalización de texto, Haversine, escritura atómica con orden determinista) · `/data/sitios.json` inicial válido (`{ actualizado, sitios: [] }`) · `/data/import/` creada · scripts npm del contrato (`validate` funcional; `import:sheet`, `scrape`, `geocode`, `build:data` como stubs que fallan con mensaje claro de qué fase falta) · `.gitignore`.

## F2 — Fase 0: importar el Google Sheet

**Responsable:** agente `data-pipeline` + skill `/import-sheet`. **Gate:** `/validate-data` verde con los primeros sitios reales.

- **2a Descubrimiento** (paralelizable con F1): descargar los CSV (URL export → fallback gviz), descubrir todos los `gid` vía `/htmlview`, guardar los CSV crudos en `/data/import/`, reportar por pestaña: columnas, filas de muestra, conteo y mapeo propuesto al schema. **Sin convertir.**
- **2b PARADA DE CONTRATO:** presentar el mapeo al usuario y esperar aprobación (requisito explícito del MASTER_PROMPT). Única pausa humana del plan.
- **2c Conversión:** `import-sheet.ts` real con el mapeo aprobado → primer `sitios.json` con datos (`manual: false`, `verificado: false`, `fuente` = URL de la hoja, ids estables, timestamps −05:00).
- Contingencia: si la descarga falla desde este entorno → el importador lee `/data/import/*.csv` y se le pide al usuario el archivo exacto (fallback del contrato).

## F3 — Geocodificación

**Responsable:** agente `data-pipeline`. **Gate:** `/validate-data` verde · 0 coordenadas fuera de bbox · lista de fallidos reportada.

Entregables: `geocode.ts` — Nominatim ≤ 1 req/s, User-Agent con correo de contacto, caché en `/scraper/cache/geocode.json` (versionada), escalera de normalización bogotana (original+ciudad → abreviada sin "#" → solo vía), sanidad de bbox (Colombia y Bogotá). Corre sobre lo importado en F2. Los que fallan: `lat/lng: null` + lista "para ubicar a mano". Jamás inventar coordenadas.

## F4 — Scrapers de fuentes oficiales

**Responsable:** recon con agente de investigación (solo lectura) + implementación con `data-pipeline`. **Gate:** `npm run scrape` produce registros válidos con `fuente` poblada; ética verificable en el código.

- **4a Recon** (paralelizable desde F1): verificar qué páginas oficiales existen HOY con listados de puntos — bogota.gov.co (las 2 rutas del contrato), Cruz Roja, IDIGER, UNGRD, Defensa Civil, Banco de Alimentos, IDPYBA, IDCBIS, campañas "Colombia, un solo corazón" y "El Chocó te Necesita". Clasificar cada una: scrapeable estático / requiere JS / sin listado / muerta. Revisar robots.txt de cada dominio.
- **4b Implementar** scrapers solo de las fuentes viables, con cheerio, ≥ 2 s entre requests, UA identificable, tolerantes a cambios de HTML (fallan con mensaje claro, no corrompen datos). Playwright solo con justificación escrita en el README del scraper (contrato).

## F5 — Dedupe + merge + pipeline completo

**Responsable:** agente `data-pipeline`. **Gate:** skill `/pipeline` corre end-to-end · diff limpio y explicado · ningún `manual: true` tocado (verificado con `git diff`) · `/validate-data` verde.

Entregables: dedupe (nombre normalizado igual **o** < 100 m con categoría común) · precedencia `manual` > más reciente · merge conserva el id más antiguo y une categorías · `build:data` = importar → scrapear → geocodificar → dedupe → merge → validar → escritura atómica · reporte de corrida (nuevos, modificados, sin coords, duplicados no resueltos, contradicciones con manuales).

## F6 — Auditoría y cierre

**Responsables:** `privacy-auditor` (ética: robots.txt, delays, UA, Nominatim, `fuente`, manuales intactos) y `docs-ops` (sección scraper del README con comandos **probados** + runbook diario). **Gate:** veredicto GO del auditor → el scraper queda EN FUNCIONAMIENTO y el terreno listo para `docs/PLAN_WEB.md`.

## Mecánica del loop

Cada iteración: ejecutar la siguiente fase pendiente con su responsable → verificar su gate con el skill correspondiente → marcar el checkbox aquí y en `CLAUDE.md` → re-armar el heartbeat. Las notificaciones de los agentes en background avanzan el plan entre latidos. La única espera humana es 2b.

## Riesgos y respuestas

| Riesgo | Respuesta (ya prevista por el contrato) |
|---|---|
| El Sheet no se puede descargar desde este entorno | Fallback `/data/import/*.csv` + pedir el archivo exacto al usuario |
| Fuentes oficiales muertas o solo-JS | Documentar el estado real; Playwright únicamente con justificación escrita |
| Nominatim falla con direcciones bogotanas | Escalera de normalización → `null` + lista manual; nunca inventar |
| Dos agentes tocando `/data` a la vez | Solo `data-pipeline` escribe `sitios.json`; el descubrimiento 2a solo escribe CSVs crudos en `/data/import/` |
