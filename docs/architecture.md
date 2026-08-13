# Arquitectura — Mapa de Ayuda

Cómo está armado el sistema y **por qué**. Este documento complementa a `docs/MASTER_PROMPT.md` (el contrato: qué construir) y a `docs/EQUIPO.md` (quién lo construye). Los agentes lo leen antes de trabajo de fondo; cuando una decisión de arquitectura cambie, se actualiza aquí **antes** de aplicarla en el código (dueño de mantenerlo: `docs-ops`).

## 1. Vista general

```
FUENTES OFICIALES                              COMUNIDAD
bogota.gov.co · Cruz Roja · IDIGER ·           Google Sheet público
UNGRD · Defensa Civil · Banco de               (varias pestañas / gids)
Alimentos · IDPYBA · IDCBIS                          │
      │  HTML (cheerio, robots.txt,                  │  CSV export
      │  ≥2 s entre requests, UA con correo)         │
      ▼                                              ▼
┌───────────────────────────────────────────────────────────┐
│  /scraper — Node + TypeScript (jamás importa de /web)     │
│  import:sheet → scrape → geocode → dedupe → merge         │
│  · Nominatim ≤ 1 req/s + caché versionada                 │
│  · merge respeta manual:true (el humano siempre gana)     │
│  · valida con zod ANTES de escribir                       │
└──────────────────────────┬────────────────────────────────┘
                           │  escritura atómica, orden determinista
                           ▼
              ╔═══════════════════════════╗
              ║   /data/sitios.json       ║   ← ÚNICA FRONTERA entre
              ║   fuente única de verdad  ║     las dos mitades del repo.
              ║   (editable a mano)       ║     También la edita el humano.
              ╚═══════════╤═══════════════╝
                          │  import en build time (nunca en runtime)
                          ▼
┌───────────────────────────────────────────────────────────┐
│  /web — Next.js App Router, output:'export' (100% SSG)    │
│  build → HTML estático con la lista pre-renderizada       │
│  · tipo Sitio duplicado a propósito (regla de oro)        │
│  · chunk de Leaflet separado, carga solo con el mapa      │
└──────────────────────────┬────────────────────────────────┘
                           │  git push a main → build automática
                           ▼
                Vercel — CDN estático + headers de vercel.json (CSP)
                           │
                           ▼
              NAVEGADOR DEL USUARIO (frontera de confianza)
              · filtros, búsqueda, Haversine, orden por distancia
              · geolocalización SOLO en memoria del dispositivo
              · único request externo: tiles de OSM
```

## 2. La frontera única: `/data/sitios.json`

| Quién | Acceso | Cómo |
|---|---|---|
| Pipeline del scraper | escribe | zod → escritura atómica → orden determinista; jamás toca `manual: true` |
| Persona mantenedora | escribe | a mano o vía `/estado` y `/nuevo-sitio` (que ponen `manual: true`) |
| Build de la web | lee | import en build time; la web no conoce al scraper |

Semántica de los campos de control (el corazón del modelo de datos):

| Campo | Semántica |
|---|---|
| `id` | Slug kebab-case **estable**: una vez publicado, no se regenera nunca. Es la identidad del sitio a través de corridas del pipeline y ediciones manuales. |
| `manual` | `true` = un humano editó este registro; el pipeline no lo modifica ni lo elimina jamás, aunque la fuente lo contradiga (la contradicción se reporta, el humano decide). |
| `estado` | `activo ⇄ lleno ⇄ pausado → cerrado`. Cambiarlo debe costar editar una línea (skill `/estado`). Por defecto la web solo muestra `activo`. |
| `verificado` | Confianza en el dato: `false` para lo importado de la comunidad sin confirmar, `true` cuando una fuente oficial o el mantenedor lo confirma. |
| `fuente` | URL de origen, siempre poblada. Es la trazabilidad pública del proyecto (aparece como link en la UI). |
| `categorias` | Enum cerrado de 10 valores (ver contrato). Cerrado a propósito: los filtros, colores de marker y badges derivan de él. |
| `ultimaActualizacion` | ISO con offset −05:00 (Bogotá). En emergencia, dato viejo = dato peligroso: > 72 h dispara alerta en `/validate-data`. |

El schema canónico completo con ejemplo vive en `docs/MASTER_PROMPT.md` — única definición ejecutable: `/scraper/src/schema.ts` (zod).

## 3. Decisiones de arquitectura (y sus porqués)

| # | Decisión | Por qué | Tradeoff aceptado |
|---|---|---|---|
| 1 | Sitio 100 % estático, sin backend ni base de datos | Operable por una persona, costo cero, y **la privacidad queda garantizada por arquitectura**: no existe servidor que pueda recibir datos del usuario | No hay tiempo real: actualizar = editar JSON + push (~1 min de redeploy) |
| 2 | `sitios.json` como única frontera entre `/scraper` y `/web` | Desacople total: la web vive sin el scraper; cada mitad se puede reescribir sin tocar la otra | Tipo `Sitio` duplicado en `/web` (deliberado y comentado) |
| 3 | Leaflet + tiles OSM, cero API keys | Sin cuentas, sin billing, sin tracking de terceros, sin secretos que rotar | Dependemos de la política de uso de tiles de OSM: atribución obligatoria y tráfico moderado |
| 4 | Geolocalización y distancia 100 % en el cliente (Haversine en memoria) | La promesa del banner es literal porque es estructural: las coordenadas no tienen a dónde ir | El orden por distancia no es compartible por URL (correcto: la ubicación jamás va a la URL) |
| 5 | zod en el borde de escritura, no de lectura | Un dato corrupto no puede entrar al repo; la web confía en el JSON | — |
| 6 | Caché de geocodificación versionada en git (`/scraper/cache/geocode.json`) | Nunca se geocodifica dos veces; corridas reproducibles; respeto real del límite de Nominatim | Repo algo más pesado |
| 7 | `manual: true` como override humano permanente | En una emergencia el criterio humano corrige al scraper, nunca al revés | Lógica de merge con precedencia (manual > más reciente) que hay que probar bien |
| 8 | Escritura atómica + orden determinista del JSON | El diff diario de git es la herramienta de revisión del mantenedor; tiene que ser legible | — |
| 9 | `'unsafe-inline'` solo en `script-src` de la CSP | El export estático de Next inyecta scripts inline de bootstrap; los hashes son frágiles entre builds | Hueco conocido y documentado; el resto de la CSP queda cerrado |
| 10 | Tipografía system stack (o una self-hosted subseteada) | Google Fonts violaría el invariante de privacidad y cuesta un request en 3G | Menos identidad tipográfica; el elemento distintivo del diseño la compensa |
| 11 | Filtros sí pueden ir en la URL (`?cat=sangre`) | Compartir por WhatsApp una vista filtrada es distribución real de la ayuda | Ninguno — la ubicación del usuario queda explícitamente prohibida en la URL |

## 4. Arquitectura de privacidad (frontera de confianza)

Todo lo sensible vive y muere en el dispositivo del usuario:

- **Existe:** coordenadas del usuario en estado de React (memoria); opcionalmente en `localStorage` **solo** si marca "recordar mi ubicación" (opt-in), borrable con "Borrar mis datos".
- **Prohibido por diseño:** enviarlas por red (no hay backend y `connect-src 'self'`), ponerlas en URL/history, loggearlas, pasarlas a terceros (no hay terceros: cero analytics, cero cookies, cero CDNs).
- **Único request externo:** tiles de `tile.openstreetmap.org` (revelan el área del mapa visible al servidor de tiles — inherente a cualquier mapa web con tiles remotos; sin identidad del usuario).
- **Excepción iniciada por el usuario:** "Cómo llegar" navega a Google Maps con la coordenada **del sitio** (dato público), nunca la del usuario. Link con `rel="noopener noreferrer"`; `Referrer-Policy: no-referrer` global.
- **Enforcement:** CSP estricta + headers en `vercel.json` (aplican al estático en Vercel) + auditoría adversarial del **build** (`web/out/`) por `privacy-auditor` antes de cada deploy — la verificación doble que exige el contrato.

## 5. Flujo operativo (el día típico de la emergencia)

```
mañana → /pipeline  (import → scrape → geocode → dedupe → merge → validar)
       → revisar reporte + git diff   (nuevos · sin coords · contradicciones con manual)
       → resolver a mano              (/estado, /nuevo-sitio)
       → /validate-data
       → commit + push a main         ← esto YA es el deploy
       → Vercel rebuild (~1 min) → verificar en prod desde el celular
```

Antes de cualquier publicación con cambios de código: `/ship-check` (incluye `/privacy-audit`).

## 6. Escalar a otra ciudad (terreno ya preparado)

Sin cambios de arquitectura: (1) sitios nuevos llegan con otro valor en `ciudad`; (2) el selector de ciudad de la web aparece automáticamente cuando hay más de una; (3) el geocodificador agrega el bbox de sanidad de la ciudad nueva; (4) el scraper suma las fuentes oficiales locales. El deploy no cambia.

## 7. Lo que deliberadamente NO se construye (y por qué el terreno queda listo)

| Diferido | El terreno listo |
|---|---|
| Panel de administración | Editar el JSON + push ya es administración; `/estado` y `/nuevo-sitio` son el "panel" conversacional |
| Formulario público de reportes | El campo `verificado` ya modela confianza; "cómo reportar un cambio" va como mailto en "Acerca de" |
| Notificaciones | `ultimaActualizacion` + el feed implícito del git log lo harían posible sin migrar datos |

## 8. Mapa de propiedad (equipo ↔ componentes)

| Componente | Construye | Audita | Skills que lo tocan |
|---|---|---|---|
| `/scraper` | `data-pipeline` | `privacy-auditor` (ética de scraping) | `/import-sheet`, `/pipeline` |
| `/data/sitios.json` | `data-pipeline` + humano | `qa-performance` (calidad de datos) | `/validate-data`, `/nuevo-sitio`, `/estado`, `/pipeline` |
| `/web` | `web-engineer` (+ `design-director`: `docs/DESIGN.md` es ley para la UI) | `privacy-auditor` + `qa-performance` | `/privacy-audit`, `/ship-check` |
| `vercel.json` (headers/CSP) | `web-engineer` | `privacy-auditor` | `/ship-check` |
| `README.md` + runbooks + este documento | `docs-ops` | — | `/ship-check` (checklist de deploy) |

## Documentos relacionados

- `docs/MASTER_PROMPT.md` — el contrato: qué construir, schema canónico, fuentes objetivo.
- `docs/EQUIPO.md` — el equipo: agentes, skills, fases y flujo de calidad.
- `docs/DESIGN.md` — sistema de diseño (lo crea `design-director` antes de la UI).
- `CLAUDE.md` (raíz) — resumen de contexto que carga cada sesión.

**Convención de documentación:** todo `.md` nuevo del proyecto se crea en `/docs/`. Únicas excepciones: `CLAUDE.md` (raíz — lo carga Claude Code), el `README.md` de la raíz (lo exige el contrato) y los `README.md` package-local de `/scraper` y `/web`.
