# /scraper — pipeline de datos del Mapa de Ayuda

Recolecta e importa puntos de ayuda (terremoto de Colombia, 10-ago-2026) y escribe la fuente única de verdad: `/data/sitios.json`. **Regla de oro:** este paquete jamás importa código de `/web` ni exporta código para ella; la única frontera es el JSON.

## Comandos

| Comando | Estado | Qué hace |
|---|---|---|
| `npm run validate` | ✅ funcional (F1) | Valida `/data/sitios.json` contra el schema zod canónico (`src/schema.ts`). Exit 1 con errores detallados si falla. |
| `npm run import:sheet` | ✅ funcional (F2) | Importa el Google Sheet comunitario con el mapeo aprobado en 2b (merge, nunca reemplazo; jamás toca `manual: true`). |
| `npm run geocode` | ✅ funcional (F3) | Geocodifica con Nominatim los sitios con dirección y sin coordenadas (≤1 req/s, caché versionada). Ver sección abajo. |
| `npm run scrape` | ✅ funcional (F4) | Scrapea las fuentes oficiales de `src/sources.ts` (cheerio, robots.txt, ≥2 s entre requests) y escribe el **staging** `cache/scraped.json`. **No toca `/data/sitios.json`.** Ver sección abajo. |
| `npm run build:data` | ✅ funcional (F5) | Pipeline completo: importar → scrapear → **merge con dedupe** → geocodificar → validar, con reporte consolidado. Ver sección abajo. |

## Geocodificación (`npm run geocode`, F3)

Nominatim (OpenStreetMap) con las reglas del contrato: **máximo 1 request/segundo** (espera ≥1100 ms entre requests), User-Agent identificable con correo de contacto, y `countrycodes=co`.

- **Qué toca:** solo sitios con `direccion` y `ciudad` no vacías y `lat/lng: null`. Nunca re-geocodifica un sitio que ya tiene coordenadas, y **jamás modifica un registro `manual: true`** (lo salta y lo reporta).
- **Caché** en `cache/geocode.json` (clave = dirección normalizada + ciudad), **versionada en git**: guarda aciertos, resultados de precisión baja y fallos (marcador negativo). Una segunda corrida sale 100 % de caché con 0 requests. La caché se guarda tras cada consulta: una interrupción no pierde nada.
- **Escalera de normalización** (para en el primer acierto): (e1) dirección original + ciudad + Colombia → (e2) depurada: `Carrera→Cra, Calle→Cl, Avenida→Av, Transversal→Tv, Diagonal→Dg`, sin `#` (rompe a Nominatim), sin `No.`/paréntesis/URLs/colas tipo "Local 1"/"piso 2"; si el texto no tiene vía se consulta como nombre de lugar (POI) → (e3) solo vía principal, **siempre precisión baja**.
- **Sanidad geográfica:** bbox de Colombia (lat −4.3…13.5, lng −82…−66); para ciudad Bogotá, además bbox de Bogotá (lat 3.7…5.0, lng −74.6…−73.8); el `display_name` debe mencionar la ciudad esperada; resultados a nivel ciudad/barrio se rechazan y a nivel calle cuentan como precisión baja.
- **Precisión baja nunca se escribe** al JSON (una vía entera puede quedar a kilómetros): queda en la caché como pista y el sitio va a la lista "para ubicar a mano" con `lat/lng: null`. Jamás se inventan coordenadas.
- **Escritura:** una sola, al final, por `lib/sitios-file` (zod → orden determinista → atómica), y solo si algo cambió — los timestamps no se tocan si no hay cambios.
- `npm run geocode -- --dry-run` muestra la escalera de consultas de cada dirección pendiente sin tocar la red ni escribir nada.
- La caché es editable a mano: si conoces las coordenadas de una dirección fallida puedes poner `"resultado": "ok"` con `lat`/`lng` en su entrada (el bbox se re-verifica al leer), aunque para un sitio puntual suele ser más directo editar `sitios.json` (y marcar `manual: true` si quieres que el pipeline no lo toque).

## Scraping de fuentes oficiales (`npm run scrape`, F4)

Un único módulo cheerio (`src/scrape.ts`) parametrizado por la config declarativa de `src/sources.ts` (diseño del recon F4a, `docs/RECON_FUENTES.md`): el hub `bogota.gov.co` publica los listados de todas las categorías y los actualiza in-place, más el comunicado de la Cruz Roja. Cada entrada de la config lleva URL exacta, categorías base, patrón de parser, mínimo esperado y notas. **Playwright está prohibido:** el recon verificó que toda fuente viable es HTML estático server-rendered; si algún día una fuente lo hiciera inevitable, el contrato exige justificarlo por escrito aquí antes de agregarlo.

- **SALIDA EN STAGING (decisión de arquitectura):** `scrape` escribe los registros extraídos — ya validados uno a uno contra el schema canónico — en `cache/scraped.json` (**versionado en git**, escritura atómica con orden determinista), **nunca** en `/data/sitios.json`. Razón: los puntos del hub (sedes de Cruz Roja, Palacio de los Deportes, bancos de sangre…) ya existen en `sitios.json` vía la hoja comunitaria con otros ids; mezclarlos sin dedupe crearía duplicados. El merge con dedupe cross-fuente es responsabilidad de F5 (`npm run build:data`). Cada corrida imprime los solapamientos detectados (mismo id o mismo nombre normalizado que un sitio publicado) como lista informativa para ese merge.
- **Ética verificable en el código:** antes de scrapear un dominio se descarga y evalúa su `robots.txt` (parser de `User-agent`/`Disallow`/`Allow`/`Crawl-delay` en `scrape.ts`; si no se puede verificar, ese dominio **no** se scrapea — fail-closed; el `Crawl-delay` aplicado es el de los grupos aplicables a nuestro User-Agent, con piso de 2 s). Mínimo 2 s entre requests al mismo dominio, User-Agent identificable con correo de contacto, y solo las URLs de la config (fuentes oficiales); `fuente` = URL exacta del artículo en cada registro. **Excepción documentada (auditoría F6):** la descarga del Google Sheet en `import-sheet.ts` no consulta robots.txt — no es scraping sino el endpoint de export de una hoja pública cuyas URLs exactas manda el contrato (Fase 0 de `docs/MASTER_PROMPT.md`), con UA identificable, ≤ 8 requests por corrida y 2 s de espera entre ellos.
- **Tolerante a cambios (contrato):** cada parser está atado a la redacción real del artículo (documentada en las notas de `sources.ts`). Si el HTML o la redacción cambian, falla con un mensaje que dice **qué patrón se rompió y en qué URL**; un mínimo esperado por fuente detecta listas sospechosamente cortas. Si cualquier fuente falla, **no se escribe nada** (all-or-nothing): el staging anterior queda intacto — un artículo caído no borra puntos ni deja pasar datos a medias.
- **Semántica de los registros scrapeados:** `ciudad: "Bogotá"`, `estado: "activo"`, `manual: false`, **`verificado: true`** (fuente oficial, a diferencia de los datos comunitarios de la hoja), `lat/lng: null` (los llena `geocode` dentro del pipeline), `localidad` solo si el artículo la da, horario del artículo (párrafo global con excepciones repartido por punto; si es ambiguo va a `descripcion`), categorías derivadas de la fuente (acopio: de la lista "¿Qué donar?" del artículo; sangre → `sangre`; Corferias → `mascotas`), ids con la escalera estable existente (nombre → +ciudad → +vía). Los ids del staging son identidad **provisional**: al fusionar, F5 conserva el id publicado más antiguo.
- **Re-ejecutable sin churn:** si lo extraído no cambió, el archivo no se reescribe y los `ultimaActualizacion` por registro se conservan; solo cambia lo que de verdad cambió en la fuente. El diff de git del staging es la forma de ver qué cambió el hub entre corridas.
- **Agregar un artículo nuevo del hub:** añadir la entrada en `src/sources.ts` (el buscador de bogota.gov.co está bloqueado por robots.txt, así que los artículos nuevos se descubren a mano) y, si su redacción no calza con un patrón existente, escribir su parser en `PARSERS` (`scrape.ts`). La ruta 2 del contrato quedó documentada como respaldo comentado en `sources.ts`; el punto temporal de sangre de la SDS (12–14 ago, misma dirección del IDCBIS) se omite a propósito — ver notas de la fuente.

## Pipeline completo (`npm run build:data`, F5)

Un solo comando corre todo el ciclo del contrato y termina con un **reporte
consolidado** (nuevos · fusionados con ambos ids · modificados por campo · sin
coordenadas · candidatos no fusionados · contradicciones con `manual: true`):

```
import:sheet → scrape → merge con dedupe (src/merge.ts) → geocode → validate
```

- **Nota de orden (decisión documentada):** el contrato enuncia "geocodificar →
  dedupe → merge"; aquí `geocode` corre **después** del merge porque opera
  sobre el archivo ya fusionado: una sola pasada cubre también los sitios
  nuevos del staging, y las direcciones ya publicadas conservan su entrada de
  caché (0 requests repetidos). Funcionalmente equivalente — nada se
  geocodifica dos veces ni deja de geocodificarse.
- **Falla limpio por fase:** cada error dice en qué fase murió y
  `/data/sitios.json` queda en el último estado consistente (toda escritura del
  proyecto es zod → orden determinista → atómica). `scrape` es la única fase
  que NO detiene el pipeline: si un artículo cambió de redacción
  (`ErrorDePatron`), se sigue con el staging previo — un artículo caído no
  borra puntos ya conocidos.
- **Idempotente:** una segunda corrida sin cambios en las fuentes deja
  `sitios.json` **byte-idéntico** (verificable con `shasum`) y hace 0 requests
  a Nominatim (todo cae en caché). El merge restaura los timestamps de todo
  registro cuyo contenido no cambió respecto al inicio de la corrida.

### Reglas de dedupe (src/merge.ts)

Dos registros son el mismo sitio si (criterios del contrato + refinamiento 2b):
**(a)** nombre normalizado igual **y** misma ciudad **y** dirección normalizada
igual o una vacía — el scoping por ciudad/dirección es obligatorio: Laika ×8 o
Cruz Roja en 12 ciudades son sedes legítimas, no duplicados; **(b)** a < 100 m
(Haversine) con ≥ 1 categoría común; **(c)** misma dirección normalizada en la
misma ciudad con nombre distinto — fusiona solo si comparten categoría o un
token significativo del nombre (los nombres de ciudad no cuentan como token:
"Alcaldía de Santiago de Cali" y "Banco Regional Cali" solo comparten "Cali");
si no, queda como **candidato** para revisión humana; **(d)** refinamiento
para reconciliar el staging: todos los tokens significativos (≥ 2) del nombre
de un lado contenidos en nombre+dirección del otro, misma ciudad y categoría
común — cubre "El estadio El Campín" ↔ "…(Estadio Nemesio Camacho el Campín)"
y typos de placa; solo aplica si uno de los dos es del staging.

La normalización de direcciones para comparar vive en `lib/direccion.ts`
(ordinales escritos → dígitos, "Av. Carrera" ≡ "Carrera", sin paréntesis ni
descriptores de interior). Es deliberadamente más agresiva que la del
geocodificador — que debe preservar la fidelidad de la consulta — por eso son
funciones separadas y la tabla de abreviaturas del contrato está duplicada a
propósito (geocode.ts no es importable: ejecuta main() al cargarse).

### Precedencia al fusionar

- `manual: true` **gana siempre**: queda byte-idéntico, el duplicado no manual
  se descarta y toda diferencia se reporta como contradicción. Dos manuales en
  un grupo → no se fusiona nada, se reporta. build-data además **verifica** el
  invariante antes de escribir: si un manual cambió, aborta sin escribir.
- **Id:** sobrevive el ya publicado (el del staging se descarta). Entre dos
  publicados: el de nombre menos repetido en el archivo ("Unicentro" es mejor
  identidad que "Alcaldía de Bogotá / Cruz Roja", que aparece ×4), y en empate
  el lexicográficamente menor. Los ids publicados jamás se regeneran.
- **Campos:** el staging (oficial fresco) gana `estado`, `horario`,
  `descripcion`, `contacto` campo a campo y `fuente`; un campo no vacío nunca
  es reemplazado por uno vacío (el instagram/web de la hoja sobrevive si el
  scraped no trae contacto). `verificado` = OR; `categorias` = unión.
- **`nombre`, `direccion` y `ciudad` conservan el valor ya publicado** —
  desviación deliberada de "el más reciente gana", por dos razones duras:
  import:sheet identifica sus filas por (pestaña, nombre, ciudad, dirección) y
  reescribirlos rompería la re-adopción en cada corrida; y la caché de geocode
  está indexada por la dirección publicada. Lo específico del scraped queda en
  la descripción y en el reporte (p. ej. el typo "Nacoinal" de la hoja
  sobrevive en el nombre hasta que se corrija en la hoja o a mano).

### Comportamientos esperados entre corridas

- **Gemelos de pestaña conservados:** dos registros publicados que cumplen (a)
  pero con categorías disjuntas NO se fusionan (p. ej.
  `…-carrera-74` ‖ `…-carrera-74-voluntariado`). Son el diseño deliberado de
  2b: el mismo lugar anunciado en pestañas distintas de la hoja con **estados
  independientes** (hoy hay un gemelo de voluntariado "lleno" cuyo gemelo de
  acopio sigue "activo" — fusionarlos perdería esa señal). El reporte los
  lista.
- **Re-fusiones estables:** cuando una fusión intra-hoja descarta un id, la
  hoja sigue trayendo esa fila; en la siguiente corrida import:sheet la vuelve
  a crear como alta y el merge la vuelve a fusionar en el mismo id. El archivo
  final no cambia ni un byte (la restauración de timestamps lo garantiza),
  pero el reporte de import mostrará esas altas en cada corrida mientras la
  fila exista en la hoja. Es ruido esperado y honesto, no un bug.
- Igual de esperado: import:sheet puede reportar "modificados" que el merge
  revierte en la misma corrida (la hoja y la fuente oficial describen el mismo
  sitio con palabras distintas; gana la oficial). El diff de git al final es
  la verdad.

## Decisiones técnicas (F1)

- **Módulos: ESM** (`"type": "module"` + `module: NodeNext` en tsconfig). Es el default moderno de Node 20+, todo el stack (zod 4, cheerio 1, csv-parse 6, tsx) es ESM-first, y no hay build: `tsx` ejecuta los `.ts` directamente. Convención NodeNext: los imports relativos llevan extensión `.js`.
- **Dependencias** (mínimas por contrato F1 — cada una justificada):
  - `zod@4.4.3` — schema canónico; valida en el borde de escritura.
  - `csv-parse@6.2.1` — importación del Sheet/CSVs (F2).
  - `cheerio@1.2.0` — parseo de HTML estático de fuentes oficiales (F4).
  - `tsx@4.23.12` (dev) — ejecuta TypeScript sin paso de build.
  - `typescript@5.9.3` (dev) — tipos y chequeo del editor.
- **Sin `@types/node` (todavía):** el contrato de F1 fija la lista de dependencias y nada más. `tsx` no lo necesita para ejecutar; sí hará falta como devDependency cuando montemos un script `typecheck` (`tsc --noEmit`) — se propondrá en ese momento.
- **Escritura de `/data/sitios.json`:** único camino permitido, `escribirSitios()` en `src/lib/sitios-file.ts` — zod → orden determinista (sitios por `id`, claves en orden canónico, categorías en orden del enum) → escritura atómica (tmp + rename). El diff de git queda legible para revisión humana.
- **Timestamps:** siempre offset fijo `-05:00` (Bogotá, sin DST) vía `ahoraBogota()` en `src/lib/time.ts`.
- **`/scraper/cache/geocode.json`** (existirá en F3) **se versiona en git** a propósito — no lo ignores.

## Estructura

```
src/
  schema.ts        ← schema zod canónico (única definición) + tipos inferidos
  validate.ts      ← npm run validate
  import-sheet.ts  ← npm run import:sheet (F2, mapeo aprobado en 2b)
  geocode.ts       ← npm run geocode (F3, Nominatim + caché + escalera)
  scrape.ts        ← npm run scrape (F4: robots.txt + parsers + staging)
  sources.ts       ← config declarativa de fuentes oficiales (F4)
  merge.ts         ← dedupe + fusión (F5) — módulo puro, sin I/O
  build-data.ts    ← npm run build:data (F5: orquesta el pipeline completo)
  lib/
    normalize.ts   ← minúsculas / sin tildes / sin puntuación
    slug.ts        ← slugify kebab-case para ids estables
    haversine.ts   ← distancia en metros (dedupe < 100 m)
    direccion.ts   ← normalización de direcciones PARA COMPARAR (dedupe F5)
    time.ts        ← ahoraBogota()
    paths.ts       ← rutas canónicas independientes del cwd
    sitios-file.ts ← orden determinista + escritura atómica + zod
cache/
  geocode.json     ← caché de geocodificación (SE VERSIONA en git — decisión #6)
  scraped.json     ← STAGING del scrape (SE VERSIONA; lo consume el merge de F5)
```
