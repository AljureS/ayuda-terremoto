# Recon de fuentes oficiales — spec para F4b

Verificado el 12-ago-2026 (F4a de `docs/PLAN_SCRAPPER.md`). Método: búsquedas + fetches ligeros con UA identificable, 2–3 s entre requests, robots.txt revisado por dominio.

## Hallazgo central

**`bogota.gov.co` actúa como hub único:** la Alcaldía publica ahí los listados de todas las categorías (acopio, sangre, mascotas), incluidos los puntos operados por Cruz Roja e IDPYBA. Los artículos se actualizan **in-place** (la página del contrato ya incluye el Palacio de los Deportes, agregado el 12-ago). Las entidades satélite no tienen listados propios, están caídas o repiten el hub.

## Fuentes viables (construir scraper)

| Fuente | URL | Qué rinde | Estructura |
|---|---|---|---|
| Alcaldía — acopio (ruta 1 del contrato) | `https://bogota.gov.co/mi-ciudad/seguridad/puntos-de-donacion-en-bogota-para-damnificados-terremoto-en-colombia` | 6 puntos (5 Cruz Roja + Palacio de los Deportes) | `<ul><li>` "Nombre, en la dirección" + horario en párrafo + JSON-LD NewsArticle con fecha |
| Alcaldía — sangre | `https://bogota.gov.co/mi-ciudad/salud/puntos-para-donar-sangre-en-bogota-para-atencion-terremoto-2026` | ~15 bancos de sangre | Patrón "Nombre / Dirección: X" |
| Alcaldía — mascotas | `https://bogota.gov.co/mi-ciudad/ambiente/corferias-sera-centro-de-acopio-ayuda-animales-afectados-terremoto` | 1 punto IDPYBA (Corferias, Cra 37 #24-67, 10–18 h, 13–17 ago) | HTML estático completo |
| Alcaldía — respaldo (ruta 2 del contrato) | `https://bogota.gov.co/mi-ciudad/ambiente/alcaldia-de-bogota-habilito-cuatro-puntos-de-donaciones-terremoto` | Redundante con ruta 1 (snapshot 10–11 ago) | Solo verificación cruzada |
| Cruz Roja (opcional, 2ª prioridad) | `https://www.cruzrojacolombiana.org/cruz-roja-colombiana-despliega-capacidades-para-dar-respuesta-tras-las-afectaciones-por-sismo-en-colombia/` | 1 punto de sangre en Bogotá (Av. Cra 68 #68B-31) | `<li>` "Ciudad: dirección. Cel: X" — filtrar por prefijo de ciudad |

**Diseño F4b:** un único módulo cheerio parametrizado por lista de URLs de artículo (la config del scraper). Drupal server-rendered, robots.txt permisivo en `/mi-ciudad/*`. Artículos nuevos se agregan a mano a la config (el buscador del sitio está bloqueado por robots). Parser por patrones de redacción → **fallar con mensaje claro si la redacción cambia** (mandato del contrato). **No hay justificación para Playwright:** toda fuente viable es HTML estático.

## Descartadas como scraper (y por qué)

- **IDIGER:** 403 a cualquier cliente identificable (WAF). Evadirlo con UA de navegador violaría la ética del proyecto. No publica listados propios: usa el hub.
- **UNGRD:** solo noticias institucionales; su hub logístico es el aeropuerto de Cali.
- **Defensa Civil:** cero contenido del terremoto en portada. Si algún día se scrapea: su robots.txt exige `Crawl-delay: 10`.
- **Banco de Alimentos:** su banner de "sismos" es de Venezuela (24-jun), no de esta emergencia. A lo sumo 1 registro manual (Calle 19A #32-50).
- **IDCBIS:** institucional; su punto (Cra 32 #12-81) ya sale en el listado de sangre del hub.
- **IDPYBA:** dominio caído desde este entorno (SSL); su campaña ya está completa en el hub. Re-verificar en el futuro.
- **Campañas "Colombia, un solo corazón" / "El Chocó te Necesita":** sin sitio propio (prensa/Instagram). Puntos verificados se cargan a mano con `/nuevo-sitio`; la monetaria es categoría `dinero` manual.

## Casos para flujo manual (`/nuevo-sitio`)

La infografía PNG de puntos móviles de sangre (no scrapeable) · puntos de campañas ciudadanas verificados por teléfono · sede Defensa Civil / Banco de Alimentos si se confirma que reciben.
