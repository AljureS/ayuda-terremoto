# Plan Web — hasta la página en producción

Plan ejecutable fase por fase para `/web`: la página estática (Next.js App Router + TS + Tailwind, `output: 'export'`, deploy en Vercel) que muestra el punto de ayuda más cercano. Gobiernan: `docs/MASTER_PROMPT.md` (Parte 2 + Dirección de diseño), `docs/architecture.md` (§4 privacidad — frontera de confianza) y la regla de oro (solo lee `/data/sitios.json` en build time; tipo `Sitio` propio, cero imports de `/scraper`).

**Enfoque mobile + desktop:** mobile-first como manda el contrato (uso real: celular, a veces 3G), con layout desktop responsive de primera clase (≥ 1024 px: lista y mapa lado a lado si el diseño lo aprueba). Ningún breakpoint se entrega sin verificar.

**En paralelo (parte de este goal):** el scraper queda bajo prueba y monitoreo continuo — corrida de verificación al arrancar + monitor cada 2 h que corre `build:data` y avisa únicamente si hay fallo o cambios reales en `sitios.json` (ética: ~6 requests/2 h al hub, dentro de lo razonable).

## Realidades del dato que moldean el producto (del pipeline, 2026-08-13)

1. **204 sitios en 28 ciudades** → el selector de ciudad (que el contrato preveía oculto "mientras solo exista Bogotá") va **visible desde el día 1**. Default: Bogotá (68 sitios, 67 activos).
2. **Solo ~20 sitios tienen coordenadas** (OSM Colombia sin números de placa; ubicación manual en curso en `docs/UBICAR_A_MANO.md`) → **la LISTA es la vista por defecto y el héroe del producto**; el mapa es mejora progresiva que crece a medida que el humano ubica puntos. Esto además es óptimo para 3G (el chunk de Leaflet no se paga de entrada).
3. **49 sitios sin ciudad ni punto físico** (46 campañas de dinero + 3 convocatorias nacionales) → necesitan presentación propia (sección o filtro "Campañas y convocatorias nacionales"), nunca mezclados con "cerca de ti".
4. **Los estados ya trabajan**: hay 1 sitio `lleno` real y 7 con fechas de cierre en el texto → la semántica de estados (activo/lleno/pausado/cerrado) debe leerse de un vistazo, con texto además de color.
5. **Contactos con nombre de persona + celular** (coordinadores publicados por sus organizaciones) → decisión de diseño/privacidad sobre cómo renderizarlos (observación de la auditoría F6). Cifra actualizada en W6: **10 sitios → 14 entradas → 10 personas únicas** (varias se repiten en dos sitios); el "5" original quedó viejo al crecer el dataset. Tratamiento aprobado: revelado al tocar.

## Estado

- [x] W1 — Sistema de diseño — gate ✅ (`docs/DESIGN.md` aprobado por el usuario: riel de rumbo + revelado al tocar; 2026-08-14)
- [x] W2 — Base + Lista + Filtros + Búsqueda — gate ✅ (build limpio 107 KB first-load, lista pre-renderizada, contactos personales 0 en claro con assert de build, 320/1280 px verificados con render real, URL de filtros funcionando; 2026-08-14)
- [x] W3 — Mapa Leaflet — gate ✅ (chunk aparte con 0 refs en HTML inicial, 29/29 checks de render real, popup + Cómo llegar, conteo honesto por filtro, 109 KB first-load; 2026-08-14)
- [x] W4 — Ubicación + distancia + privacidad UI — gate ✅ (riel de rumbo funcionando, trazado del flujo de coordenadas con barrido de aguja en runtime: DOM/URL/red/storage limpios; 4 fallos con microcopy, localStorage solo con opt-in, +2 KB → 111 KB; 2026-08-14)
- [x] W5 — Contenido fijo + SEO/OG + headers CSP — gate ✅ (`/acerca` legible sin JS, og.png 1200×630/52 KB, metadata dentro de límites en las 3 rutas, CSP con 0 violaciones en 4 escenarios reales, delta de peso 0 KB; 2026-08-14)
- [x] W6 — QA + auditoría de privacidad (doble GO) — gates ✅ (QA: Lighthouse móvil 100 perf en las 3 rutas, a11y 100 tras fix, 109 KB gz, matriz de 12 edge cases sin un crash · Privacidad: promesa verificada contra el build minificado; NO-GO inicial por la CSP que podía no llegar a producción → resuelto con `vercel.json` duplicado; 10 hallazgos corregidos; 2026-08-14)
- [x] W7a — Ship-check local ✅ **GO** (datos válidos · build limpio · 0 recursos externos · headers en ambos `vercel.json` · metadata OG completa · Lighthouse móvil 99/100/100/100) + README con la guía de deploy. Commits `6f0e528` y `1136884`.
- [ ] W7b — **Deploy real (te toca a ti):** crear el proyecto en Vercel con Root Directory `web`, fijar `SITIO_URL` con el dominio real, redeployar, y verificar con `curl -I` que los 4 headers llegaron. Pasos exactos en el `README.md` de la raíz.

## W1 — Sistema de diseño

**Responsable:** `design-director` (con el skill `frontend-design` como método, subordinado al brief). **Gate:** propuesta presentada y aprobada por el usuario; `docs/DESIGN.md` escrito con tokens Tailwind.

Entregables: paleta 4–6 colores con hex y roles + contraste AA calculado por par · 2 tipografías con roles (restricción dura: sin fuentes externas — system stack o self-hosted subseteada) · concepto de layout mobile y desktop (jerarquía de tarjeta, filtros, toggle lista/mapa, dónde viven las campañas nacionales) · semántica visual de estados y categorías (badges = markers) · **el elemento distintivo** (2–3 candidatos, recomendación argumentada) · microcopy crítico (banner privacidad, permiso ubicación, estados vacíos, disclaimer).

## W2 — Base + Lista + Filtros + Búsqueda

**Responsable:** `web-engineer`. **Gate:** `npm run build` produce `out/` sin errores · lista completa pre-renderizada en el HTML · usable a 320 px y en desktop · grep de hosts externos en `out/` = solo navegación legítima (aún sin tiles) · 0 datos de usuario en red.

Entregables: scaffolding Next.js App Router + TS + Tailwind con `output: 'export'` e `images.unoptimized` · tipo `Sitio` propio (duplicación deliberada documentada) · carga de `/data/sitios.json` en build time · vista lista con tarjeta completa (nombre, badges, qué reciben, dirección, horario, estado, fuente, última actualización) · chips de categorías multiselección · filtro de estado (default solo `activo`) · búsqueda por texto sin tildes · selector de ciudad (default Bogotá) · sección "Campañas nacionales" para los sin-ciudad · filtros compartibles por URL (`?cat=sangre`) — jamás la ubicación · tokens de `docs/DESIGN.md` aplicados.

## W3 — Mapa

**Responsable:** `web-engineer`. **Gate:** chunk de Leaflet NO referenciado en el HTML inicial (carga solo al abrir el mapa) · sitios sin coords no rompen nada · tiles caídos degradan con mensaje (la lista siempre sirve) · atribución OSM visible.

Entregables: Leaflet + react-leaflet vía `next/dynamic` con `ssr: false` y placeholder sin layout shift · `L.divIcon` SVG por categoría (mismo sistema de color que los badges) · tiles OSM con atribución · popup con detalle y "Cómo llegar" (`google.com/maps/dir` deep link, solo coordenada del sitio, `rel="noopener noreferrer"`) · toggle lista/mapa (lista default) · el mapa muestra el conteo honesto ("20 de 204 puntos ubicados en el mapa — el resto en la lista").

## W4 — Ubicación + distancia + privacidad UI

**Responsable:** `web-engineer`. **Gate:** trazado completo del flujo de coordenadas (memoria → nada más) verificado por el propio ingeniero + checklist de privacidad del contrato en verde; los 4 fallos de geolocalización manejados con mensaje útil.

Entregables: botón "📍 Usar mi ubicación" (solo on-tap, nunca al cargar) · Haversine en cliente · orden por cercanía + distancia en tarjeta (m/km) · manejo de denegado/timeout/no-soportado/contexto-inseguro · banner permanente de privacidad · `localStorage` con opt-in (filtros; posición solo si marca "recordar") con try/catch Safari privado · botón "Borrar mis datos" que limpia todo y confirma.

## W5 — Contenido fijo + SEO/OG + headers

**Responsables:** `web-engineer` + `design-director` (copy). **Gate:** `out/index.html` con `lang="es"`, título ≤ 60, description ≤ 90, og:image existente 1200×630 · `vercel.json` con la CSP del contrato (base en `docs/architecture.md`/agente web) + Referrer-Policy no-referrer + X-Content-Type-Options + Permissions-Policy.

Entregables: página/sección "Acerca de" (qué es, disclaimer "verifica antes de desplazarte", cómo reportar un cambio — mailto al correo del proyecto, créditos a fuentes oficiales y hoja comunitaria, atribución © OpenStreetMap contributors) · metadata español pensada para el preview chico de WhatsApp · og.png estática legible en miniatura · decisión aplicada sobre los 5 contactos personales (mostrar tal cual la fuente o solo organización — resolver con el usuario en W1/W6).

## W6 — QA + auditoría (doble GO)

**Responsables:** `qa-performance` y `privacy-auditor` en paralelo; fixes de vuelta a `web-engineer`; re-verificación tras fixes. **Gate:** Lighthouse móvil performance > 90 y accesibilidad ≥ 95 · JS inicial ≤ 180 KB gz · matriz completa de edge cases · `/privacy-audit` sobre código Y build (`out/`) en **GO**.

Matriz mínima: coords null · 0 resultados · dataset vacío · nombres larguísimos · estados ≠ activo · geolocalización denegada/timeout/insegura · localStorage bloqueado · tiles caídos · 320 px · zoom 200 % · landscape · teclado completo · `prefers-reduced-motion`.

## W7 — Ship

**Responsables:** `docs-ops` + skill `/ship-check`. **Gate:** `/ship-check` en GO · README con la sección web + primer deploy en Vercel documentado paso a paso (root directory `web`, headers desde `vercel.json`, push a main = redeploy) · página desplegada y verificada desde un celular real (curl -I de headers en prod).

## Mecánica del loop

Igual que el plan del scraper: cada fase la ejecuta su responsable → gate verificado (skills `/validate-data`, `/privacy-audit`, `/ship-check` donde aplique) → checkbox aquí y en `CLAUDE.md` → notificaciones de agentes avanzan; heartbeat de respaldo; monitor del scraper corriendo en paralelo. Paradas humanas: aprobación del diseño (W1) y el primer deploy (W7).

## Riesgos y respuestas

| Riesgo | Respuesta |
|---|---|
| Política de uso de tiles OSM | Atribución obligatoria + tráfico de un sitio cívico moderado; si el tráfico explota, evaluar proveedor de tiles sin key en ese momento |
| `'unsafe-inline'` en script-src (export estático de Next) | Tradeoff documentado en architecture §3; el resto de la CSP cerrado; auditor lo reconoce |
| Límite de sesión mata a un agente a media fase | Cada prompt de fase es spec completo y auto-contenido; retomar = relanzar con nota de auditoría de lo heredado (patrón probado en F2c/F5) |
| El monitor del scraper cambia `sitios.json` durante una build de la web | Escritura atómica: la build lee el archivo viejo o el nuevo, nunca uno a medias; el dato nuevo entra en la siguiente build |
| Safari modo privado lanza en `setItem` | try/catch + comunicar que no se puede recordar (W4) |
