---
name: import-sheet
description: Fase 0 — importa el Google Sheet comunitario a /data/sitios.json. Descarga los CSV de todas las pestañas, muestra columnas y mapeo propuesto, espera aprobación y convierte. Úsalo al arrancar el proyecto y cada vez que la hoja comunitaria se actualice (re-importar hace merge, nunca reemplazo).
---

Procedimiento de la Fase 0 de `docs/MASTER_PROMPT.md` (las URLs exactas de la hoja están ahí).

1. Descarga el CSV con la URL de export directa; si falla, usa la URL `gviz` de fallback.
2. Descubre las demás pestañas: baja el `/htmlview` de la hoja y extrae todos los `gid=` únicos; descarga cada pestaña que tenga datos.
3. **PARA AQUÍ** — muestra por pestaña: las columnas encontradas (con 2–3 filas de muestra) y el mapeo propuesto columna → campo del schema canónico. Señala las columnas sin mapeo claro. Espera la aprobación del mapeo: es un requisito explícito del proyecto, no conviertas sin él.
4. Con el mapeo aprobado, convierte con el importador (`cd scraper && npm run import:sheet`). Si el importador aún no existe, delega su construcción al agente `data-pipeline` con el mapeo aprobado como spec.
5. Reglas de conversión: ids = slugs kebab-case estables (verifica colisiones contra los existentes) · `manual: false` · `verificado: false` salvo evidencia · `fuente` = URL de la hoja · timestamps con offset de Bogotá (−05:00).
6. Si la descarga falla del todo: deja el importador listo para leer `/data/import/*.csv` y di exactamente: "descarga la hoja como CSV y ponla en `/data/import/<nombre>.csv`".
7. Cierra con `/validate-data` y el reporte de importación: filas leídas, convertidas, descartadas y por qué.

**Re-importaciones:** son un merge, no un reemplazo. Jamás toques registros `manual: true`, conserva los ids existentes, y muestra el diff de `/data/sitios.json` antes de escribir.
