---
name: nuevo-sitio
description: Agrega un punto de ayuda a mano a /data/sitios.json — para datos que llegan por WhatsApp, llamada o verificación directa. Recolecta los campos mínimos, genera un slug estable, geocodifica con Nominatim respetando las reglas del proyecto, marca manual:true y valida. Úsalo cuando el usuario diga "agrega este punto…".
argument-hint: <nombre del sitio> [dirección] [categorías]
---

1. **Recolecta lo mínimo:** nombre · dirección · categorías (del enum: alimentos, agua, ropa_abrigo, mascotas, construccion, medicamentos, sangre, voluntariado, dinero, acopio_general) · qué reciben (`descripcion`) · `fuente` (URL oficial; si es un reporte directo sin URL, anótalo como "Reporte directo verificado por el mantenedor — <fecha>"). Pregunta solo lo que falte y no sea inferible; horario, contacto y localidad son opcionales.
2. **`id`:** slug kebab-case del nombre (minúsculas, sin tildes ni puntuación). Verifica que no exista ya en `sitios.json` — si existe uno igual o muy parecido, puede ser el mismo sitio: muéstralo y pregunta si esto es una actualización en vez de un alta.
3. **Geocodifica** respetando las reglas del proyecto: consulta primero la caché `/scraper/cache/geocode.json`; si no está, haz 1 request a Nominatim con el User-Agent identificable del proyecto, con la dirección + ", Bogotá, Colombia" (si falla, escala la normalización: Carrera→Cra, sin "#"). Verifica que el resultado caiga en el bbox de Bogotá. Si todo falla: `lat/lng: null`, avisa que el sitio irá solo en la lista, y jamás inventes coordenadas. Guarda el resultado en la caché.
4. **Campos de control:** `manual: true` (el scraper no volverá a tocar este registro) · `verificado` según lo confirme el usuario · `estado: "activo"` salvo indicación contraria · `ultimaActualizacion` y el `actualizado` raíz con la hora actual de Bogotá (−05:00).
5. Corre `/validate-data`, muestra el registro agregado y el diff, y ofrece commit + push (recuerda: push = redeploy automático).
