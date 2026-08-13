---
name: estado
description: Cambia el estado de un punto de ayuda (activo | lleno | pausado | cerrado) editando /data/sitios.json — la operación más frecuente durante la emergencia. Marca manual:true para que el scraper no lo revierta, actualiza timestamps y valida. Úsalo cuando el usuario diga "marca X como lleno / cerrado / pausado / activo".
argument-hint: <id o nombre> <activo|lleno|pausado|cerrado>
---

1. **Encuentra el sitio:** primero por `id` exacto; si no hay match, búsqueda difusa por nombre (sin tildes, case-insensitive, subcadenas). Varias coincidencias → lista numerada y pregunta cuál. Cero coincidencias → muestra los nombres más parecidos que encontraste.
2. **Edita el registro:**
   - `estado` al valor pedido.
   - `manual: true` — si no lo era, avisa en una línea: "a partir de ahora el scraper no toca este registro".
   - `ultimaActualizacion` del sitio y `actualizado` raíz a la hora actual de Bogotá (−05:00).
3. Corre la validación de schema (`npm run validate` o ad hoc si el scraper no existe aún).
4. Muestra el diff — debe ser mínimo: un solo sitio tocado más el timestamp raíz — y ofrece commit + push con mensaje tipo `datos: <nombre> → lleno`. Recuerda: push = redeploy en ~1 minuto.

**Reactivar** (lleno → activo): mismo procedimiento. Si el registro venía originalmente de una fuente scrapeada, pregunta si además quiere quitar `manual: true` para devolverle el control al scraper.
