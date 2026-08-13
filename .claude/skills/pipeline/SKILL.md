---
name: pipeline
description: Corre el pipeline completo de datos (importar → scrapear → geocodificar → dedupe → merge → validar), verifica que ningún registro manual cambió y presenta el diff de sitios.json para revisión antes de commitear. Úsalo para la actualización diaria de datos durante la emergencia.
---

1. **Preflight:** `git status` — si `/data/sitios.json` tiene cambios sin commitear, resuélvelos primero: el diff del pipeline debe quedar limpio y atribuible a esta corrida.
2. Corre `cd scraper && npm run build:data`. Si alguna fase del pipeline no está implementada todavía, di cuál falta y corre en orden las que existan (`import:sheet` → `scrape` → `geocode`).
3. **Verificación de invariante:** con `git diff -- data/sitios.json`, confirma que ningún registro con `manual: true` cambió. Si alguno cambió, es un bug del merge: **no commitees** y pásalo al agente `data-pipeline` con el diff como evidencia.
4. **Reporte de cambios** (del output del pipeline + el diff): sitios nuevos · cambios de estado · sitios modificados (qué campo) · direcciones sin geocodificar (lista para ubicar a mano) · duplicados no resueltos · contradicciones entre fuentes y registros manuales.
5. Corre `/validate-data`.
6. Muestra el resumen y ofrece commit con mensaje descriptivo (`datos: +N sitios, M cambios de estado — <fecha>`) y push. Recuerda al usuario: push a `main` = redeploy automático en Vercel.
