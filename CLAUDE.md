# Mapa de Ayuda — Terremoto de Colombia (10 ago 2026)

Proyecto cívico de emergencia: web estática para encontrar el punto de ayuda más cercano en Bogotá (acopio, sangre, voluntariado…), filtrado por categoría. Deploy en Vercel. Mantenido por una sola persona. El plan maestro completo está en `docs/MASTER_PROMPT.md` — es el contrato del proyecto; ante cualquier duda, manda él. Las decisiones de arquitectura y sus porqués están en `docs/architecture.md`.

## Arquitectura (innegociable)

- Monorepo: `/scraper` (Node + TS) · `/web` (Next.js estático) · `/data` (fuente única de verdad).
- **Regla de oro:** `/scraper` y `/web` no comparten código ni se importan. Se comunican **solo** a través de `/data/sitios.json`. La web funciona aunque el scraper no exista.
- La web es 100 % estática (`output: 'export'`): sin API routes, sin backend, sin base de datos. Los datos entran en build time; actualizar datos = editar el JSON + push (Vercel redeploya solo).
- `manual: true` = registro editado a mano → el scraper **jamás** lo sobreescribe ni lo elimina.
- Los `id` son slugs estables: publicados una vez, no se regeneran nunca.
- Enums: `categorias` ∈ alimentos, agua, ropa_abrigo, mascotas, construccion, medicamentos, sangre, voluntariado, dinero, acopio_general · `estado` ∈ activo | lleno | pausado | cerrado.

## Invariantes duros

1. **Privacidad:** la ubicación del usuario nunca sale de su dispositivo (ni a servidor, ni a analytics, ni a logs, ni a la URL). Cero cookies, cero analytics, cero JS/CSS/fonts de terceros. Único request externo permitido: tiles de OSM. `localStorage` solo con opt-in + botón "Borrar mis datos". CSP estricta en `vercel.json`.
2. **Ética de scraping:** respetar robots.txt, ≥ 2 s entre requests, User-Agent identificable con correo de contacto, solo fuentes oficiales, `fuente` siempre poblado. Nominatim: máx 1 req/s + caché en `/scraper/cache/geocode.json`.
3. **Datos:** todo `sitios.json` pasa por zod antes de escribirse (`npm run validate`). Escritura atómica y orden determinista (diffs de git legibles). Timestamps en hora de Bogotá (−05:00).
4. **Calidad web:** mobile-first (3G real), Lighthouse perf > 90, contraste AA, targets táctiles ≥ 44 px, `prefers-reduced-motion` respetado, copy en español con voz activa.

## Equipo de subagentes (`.claude/agents/`)

| Agente | Úsalo para |
|---|---|
| `data-pipeline` | Todo `/scraper` y `/data`: importar el Sheet, scrapear, geocodificar, dedupe, merge, validar |
| `web-engineer` | Todo `/web`: mapa, lista, filtros, geolocalización, export estático, CSP |
| `design-director` | Sistema de diseño, copy en español, SEO/OG para WhatsApp |
| `privacy-auditor` | Auditoría adversarial de privacidad y ética de scraping (solo reporta, no edita) |
| `qa-performance` | Lighthouse, accesibilidad, edge cases, presupuestos de bundle |
| `docs-ops` | README, runbooks, deploy en Vercel |

Skills operativos: `/import-sheet` · `/pipeline` · `/validate-data` · `/nuevo-sitio` · `/estado` · `/privacy-audit` · `/ship-check`. Detalle y ejemplos en `docs/EQUIPO.md`.

Skills de referencia (guías instaladas de terceros, no rituales): `frontend-design` (Anthropic — método de dirección visual; lo usan `design-director` y `web-engineer` al crear UI nueva, siempre subordinado a `docs/DESIGN.md` y al MASTER_PROMPT) · `vercel-react-best-practices` (Vercel — ~70 reglas de rendimiento React/Next para `web-engineer` y `qa-performance`; en este proyecto aplican las categorías `bundle-`, `rerender-`, `rendering-`, `client-` y `js-`; las `server-`/`async-api-routes` no, porque la web es export estático sin backend).

## Documentación

- **Convención: todo `.md` nuevo se crea en `/docs/`.** Únicas excepciones: `CLAUDE.md` (raíz — lo carga Claude Code), el `README.md` de la raíz (lo exige el contrato) y los `README.md` package-local de `/scraper` y `/web`.
- Mapa: `docs/MASTER_PROMPT.md` (contrato) · `docs/architecture.md` (decisiones, fronteras, semántica de campos) · `docs/EQUIPO.md` (equipo) · `docs/PLAN_SCRAPPER.md` (plan de ejecución del scraper, con estado) · `docs/PLAN_WEB.md` (plan de la página — EN EJECUCIÓN) · `docs/DESIGN.md` (sistema de diseño, cuando exista).

## Orden de trabajo (estado)

1. ☑ Scaffolding monorepo + schema + validación zod (F1 de `docs/PLAN_SCRAPPER.md` — hecho)
2. ☑ Fase 0: importar Google Sheet → primer `sitios.json` real (205 sitios; mapeo aprobado el 2026-08-12)
3. ◐ Web funcional: lista+filtros (W2 ✅), mapa (W3 ✅), geolocalización y distancia (W4 ✅); faltan contenido/SEO/CSP, auditorías y deploy (`docs/PLAN_WEB.md`)
4. ☑ Scraper de fuentes oficiales + pipeline completo de merge (`npm run build:data` operativo; F4–F5 de `docs/PLAN_SCRAPPER.md`)
5. ◐ README raíz con runbook del scraper listo y probado; el checklist de deploy en Vercel llega con la fase web (`docs/PLAN_WEB.md`)

Regla del flujo: tras cualquier cambio de datos corre `/validate-data`; antes de cada deploy corre `/ship-check` (incluye la verificación de privacidad).

RULE FOR OPUS 5: THE PROJECT HAS BEEN COMPLETED UP TO THIS STEP BY FABLE 5. DO NOT CONTRADICT IT. DO NOT QUESTION FABLE 5'S DECISIONS.S
