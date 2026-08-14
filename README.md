# Mapa de Ayuda — Terremoto de Colombia (10-ago-2026)

Página web para encontrar el punto de ayuda más cercano (acopio, sangre, voluntariado, mascotas…) tras el terremoto del 10 de agosto de 2026.
Los datos los recolecta un scraper de fuentes oficiales más una hoja comunitaria, y los mantiene **una sola persona** editando un JSON.

**Arquitectura en 4 líneas:**

1. `/scraper` (Node + TypeScript) importa la hoja comunitaria, scrapea fuentes oficiales, geocodifica y fusiona.
2. Todo termina en `/data/sitios.json` — **la fuente única de verdad**, también editable a mano.
3. `/web` (Next.js estático, aún no existe) leerá ese JSON en build time y se desplegará en Vercel.
4. **Regla de oro:** `/scraper` y `/web` no comparten código; se comunican **únicamente** por `/data/sitios.json`.

El detalle vive en [`docs/architecture.md`](docs/architecture.md) (cómo y por qué) y [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md) (el contrato).

---

## Requisitos e instalación

- Node.js 20 o superior (probado con Node 24.13) y npm.
- Nada más: sin claves de API, sin cuentas, sin variables de entorno.

```bash
cd scraper && npm install
```

Todos los comandos de abajo se corren desde `scraper/`.

---

## Los comandos del scraper

| Comando | Qué hace | Cuándo correrlo |
|---|---|---|
| `npm run build:data` | **El pipeline completo** (importar → scrapear → merge → geocodificar → validar) | Cada mañana. Es el comando del día a día. |
| `npm run validate` | Valida `/data/sitios.json` contra el schema | Después de **cualquier** edición a mano |
| `npm run import:sheet` | Solo la hoja comunitaria → merge sobre el JSON | Casi nunca suelto (ver advertencias) |
| `npm run scrape` | Solo fuentes oficiales → staging `cache/scraped.json` | Para diagnosticar un artículo caído |
| `npm run geocode` | Solo geocodifica direcciones sin coordenadas | Tras agregar sitios a mano sin lat/lng |

El README técnico de cada comando (parsers, caché, reglas de dedupe) está en [`scraper/README.md`](scraper/README.md).

### `npm run build:data` — el comando del día a día

```bash
cd scraper && npm run build:data
```

Corre las 5 fases y termina con un reporte consolidado. Hoy tardó **25 segundos** (con todo en caché); hace requests reales, ver advertencias abajo. Output real (recortado):

```
build:data — F5: pipeline completo (import → scrape → merge+dedupe → geocode → validar)
  estado inicial: 204 sitios (manuales: 0)

FASE 1/5 · import:sheet     ← hoja comunitaria → merge (jamás toca manual:true)
FASE 2/5 · scrape           ← fuentes oficiales → staging (all-or-nothing)
FASE 3/5 · merge            ← staging → sitios.json con dedupe
FASE 4/5 · geocode          ← Nominatim ≤ 1 req/s con caché versionada
FASE 5/5 · validate         ← validación zod final

════════════════════════════════════════════════════════════════════════
REPORTE CONSOLIDADO — build:data
════════════════════════════════════════════════════════════════════════
TOTAL: 204 sitios (inicio: 204) · verificados: 23 · manuales: 0 · sin coordenadas: 184

NUEVOS (0):
FUSIONADOS (22)  [id conservado ← id descartado]:
  ...
SIN COORDENADAS: 184 en total (lista completa: docs/UBICAR_A_MANO.md)
CANDIDATOS no fusionados — revisión humana (5):
  ? banco-regional-cartagena ↔ cruz-roja-cartagena
      misma dirección normalizada pero sin categoría ni token de nombre en común
  ...
CONTRADICCIONES con manual:true (0):

Duración total: 25 s

✓ Pipeline completo en verde. Siguiente paso: revisar el diff de /data/sitios.json y hacer push.
```

**Qué revisar en el reporte (en este orden):**

1. `CONTRADICCIONES con manual:true` — la fuente dice algo distinto a tu edición manual. Tu edición **sigue mandando**; decide tú si actualizas el registro.
2. `NUEVOS` — sitios que no existían. Ojo con los que quedan sin coordenadas.
3. `CANDIDATOS no fusionados` — posibles duplicados que el dedupe no resolvió solo. Si son el mismo sitio, fusiónalos a mano (borra uno, une lo útil en el otro).
4. `fechas de cierre en el texto` — descripciones tipo "hasta el viernes 14": el pipeline **no** infiere estados; si la fecha ya pasó, marca el sitio (runbook abajo).
5. `git diff data/sitios.json` — la verdad final de qué cambió.

Es **idempotente**: correrlo dos veces sin cambios en las fuentes deja el archivo byte-idéntico (verificado hoy con `shasum`).

### `npm run validate` — después de cualquier edición

```bash
cd scraper && npm run validate
```

Output real cuando todo está bien:

```
✓ VÁLIDO
  Sitios: 204 (manuales: 0 · sin coordenadas: 184)
  Actualizado: 2026-08-13T19:16:42-05:00
```

Output real cuando te equivocas (aquí un `estado` mal escrito — te dice registro y campo exactos):

```
✗ VALIDACIÓN FALLIDA — 1 problema(s) de schema:

  ✗ sitios.47.estado: Invalid option: expected one of "activo"|"lleno"|"pausado"|"cerrado"

  Schema canónico: /scraper/src/schema.ts (contrato: docs/MASTER_PROMPT.md)
```

Si falla: corrige lo que señala y vuelve a correrlo. **Nunca hagas push con validate en rojo.**

### Las piezas sueltas (solo para diagnóstico)

`npm run scrape` — solo las fuentes oficiales; escribe el staging `scraper/cache/scraped.json` y **no toca** `/data/sitios.json`. Output real: `24 registros en staging · requests reales: 6 · duración: 9 s`, con el veredicto de robots.txt impreso por dominio. Si un artículo cambió de redacción, falla diciendo qué patrón se rompió y en qué URL, y el staging anterior queda intacto.

`npm run geocode` — solo llena `lat/lng` nulos de sitios con dirección. Output real de hoy: `direcciones desde caché: 125 de 125 · requests reales a Nominatim: 0 · duración: 0 s` y la lista completa "PARA UBICAR A MANO". Con `npm run geocode -- --dry-run` ves qué consultaría sin tocar la red.

`npm run import:sheet` — solo la hoja comunitaria. Su reporte por pestaña muestra filas leídas, descartadas (con motivo) y notas.

### Advertencias reales (comprobadas)

- **`build:data` hace requests reales:** descarga la hoja (Google), hace 6 requests a las fuentes oficiales (robots.txt incluido) con ≥ 2 s entre requests al mismo dominio, y consulta Nominatim a ≤ 1 request/segundo **solo** para direcciones nuevas (las conocidas salen de la caché versionada). Los límites son por diseño ético: si hay muchas direcciones nuevas, tarda — déjalo terminar.
- **La hoja comunitaria puede cambiar de formato:** el importador identifica cada pestaña por su `gid`, valida cada registro con zod antes de escribir y lista toda fila descartada con su motivo — no corrompe datos en silencio. Si la descarga falla, lee los CSV guardados en `/data/import/` (fallback del contrato).
- **No corras `import:sheet` suelto en el día a día:** re-crea como "altas" filas que el merge ya fusionó (comprobado hoy: 204 → 211 sitios). No es un bug — `build:data` las vuelve a fusionar en la misma corrida; suelto, te deja el archivo a mitad de camino.
- **Un artículo oficial caído no rompe nada:** `scrape` es all-or-nothing sobre su staging; el pipeline continúa con el staging anterior.

---

## Editar un sitio a mano — marcar un punto como `lleno`

El caso más frecuente de la emergencia: un punto deja de recibir donaciones. Son 3 líneas.

1. Abre `/data/sitios.json` y busca el sitio por nombre (Cmd+F / Ctrl+F, por ejemplo `"Unicentro"`).

2. Cambia **estas 3 líneas** del registro — antes:

```json
{
  "id": "unicentro",
  "nombre": "Unicentro",
  ...
  "estado": "activo",
  "verificado": true,
  "manual": false,
  "ultimaActualizacion": "2026-08-13T19:02:08-05:00"
}
```

Después:

```json
{
  "id": "unicentro",
  "nombre": "Unicentro",
  ...
  "estado": "lleno",
  "verificado": true,
  "manual": true,
  "ultimaActualizacion": "2026-08-13T19:45:00-05:00"
}
```

- `estado`: `"lleno"` (o `"pausado"`, `"cerrado"`, de vuelta a `"activo"`).
- `manual: true` = **el scraper jamás vuelve a tocar este registro** — ni lo modifica ni lo elimina, aunque la fuente diga otra cosa (la contradicción solo se reporta).
- `ultimaActualizacion`: la hora actual de Bogotá con `-05:00`. Este comando te la da lista para pegar:

```bash
TZ=America/Bogota date +"%Y-%m-%dT%H:%M:%S-05:00"
```

3. Valida:

```bash
cd scraper && npm run validate
```

Debe decir `✓ VÁLIDO` con `manuales: 1` (probado hoy con este mismo ejemplo).

4. Commit y push:

```bash
cd .. && git add data/ && git commit -m "unicentro: lleno" && git push
```

> Cuando la web exista, el push será también el deploy (Vercel redeploya solo en ~1 min — pendiente, ver abajo).

Desde ese momento, cada `build:data` mostrará el sitio en `CONTRADICCIONES con manual:true` mientras las fuentes lo sigan listando distinto. **Es normal: significa que tu edición sigue mandando.** Output real de hoy (probado con este ejemplo):

```
CONTRADICCIONES con manual:true (3):
  ⚠ "unicentro" difiere de su fuente (https://bogota.gov.co/mi-ciudad/seguridad/puntos-de-donacion-en-bogota-para-damnificados-terremoto-en-colombia) en: nombre, direccion, categorias, estado, contacto — decide la persona mantenedora
```

---

## Ubicar sitios a mano (coordenadas pendientes)

Nominatim no conoce los números de placa de la mayoría de direcciones colombianas: hoy hay **133 sitios con dirección pero sin coordenadas**. La lista completa, con una pista por sitio (el centroide de la vía), está en [`docs/UBICAR_A_MANO.md`](docs/UBICAR_A_MANO.md).

Para resolver uno:

1. Busca la dirección en un mapa (la pista te deja en la calle correcta; la placa la ubicas tú).
2. Edita el sitio en `/data/sitios.json`: pon `lat` y `lng` (números, no strings).
3. `cd scraper && npm run validate`
4. `cd .. && git add data/ && git commit -m "coords: <id-del-sitio>" && git push`

El geocodificador **nunca pisa coordenadas ya puestas** (solo llena nulls), así que tu edición es permanente sin necesidad de `manual: true` — ponlo solo si además cambias otros campos.

---

## Runbook diario de emergencia

La rutina de la mañana, completa:

```bash
# 1. Correr el pipeline
cd scraper && npm run build:data

# 2. Revisar el reporte (contradicciones, nuevos, candidatos, fechas de cierre)
#    y el diff:
git diff ../data/sitios.json

# 3. Resolver a mano lo reportado editando /data/sitios.json:
#    - candidatos a duplicado → fusionar si son el mismo sitio
#    - contradicciones con manuales → decidir si tu edición sigue vigente
#    - sin coordenadas → docs/UBICAR_A_MANO.md (los que puedas)
#    - fechas de cierre ya pasadas → estado: "cerrado" + manual: true

# 4. Validar
npm run validate

# 5. Publicar (incluye la caché versionada del scraper)
cd .. && git add data/ scraper/cache/ && git commit -m "datos: corrida diaria" && git push
```

> **Pendiente:** cuando la web exista, el paso 5 será también el deploy (push a `main` = redeploy automático en Vercel) y el paso 6 será abrir la URL de producción desde el celular y verificar. Llega con `docs/PLAN_WEB.md`.

---

## Datos y semántica (resumen)

Estado de hoy: **204 sitios** en 28 ciudades · 23 verificados por fuente oficial · 20 con coordenadas · 133 con dirección para ubicar a mano · 49 sin ciudad (46 son campañas de dinero sin punto físico: van en lista, no en mapa) · 2 sin dirección.

| Campo | Semántica en una línea |
|---|---|
| `id` | Slug estable: una vez publicado, **no se regenera nunca** (sobrevive corridas y fusiones) |
| `estado` | `activo` \| `lleno` \| `pausado` \| `cerrado` — la web mostrará solo `activo` por defecto |
| `manual` | `true` = editado por humano; el pipeline jamás lo toca (solo reporta contradicciones) |
| `verificado` | `false` = dato comunitario sin confirmar · `true` = confirmado por fuente oficial o por ti |
| `fuente` | URL de origen, siempre poblada — la trazabilidad pública del proyecto |
| `categorias` | Enum cerrado de 10: `alimentos`, `agua`, `ropa_abrigo`, `mascotas`, `construccion`, `medicamentos`, `sangre`, `voluntariado`, `dinero`, `acopio_general` |
| `ultimaActualizacion` | ISO con `-05:00` (Bogotá); dato viejo = dato peligroso |

El schema canónico completo está en [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md); su única definición ejecutable es `scraper/src/schema.ts` (zod). El porqué de cada decisión: [`docs/architecture.md`](docs/architecture.md).

---

## Pendiente (honesto)

- **Web y deploy en Vercel** — no existen todavía. El plan llegará en `docs/PLAN_WEB.md`; ahí se documentará el primer deploy, el redeploy por push y la verificación en producción.
- **Agregar una ciudad** — el lado de datos **ya funciona**: los sitios llevan su `ciudad` (hoy hay 28) y el geocodificador valida contra el bbox de Colombia; al crecer una ciudad, agrégale su bbox de sanidad fina en `scraper/src/geocode.ts` (hoy solo Bogotá lo tiene). El selector de ciudad en la interfaz llegará con la web.

---

## Créditos y licencias

- **Fuentes oficiales:** [Alcaldía de Bogotá](https://bogota.gov.co) (puntos de acopio, donación de sangre y acopio para animales) y [Cruz Roja Colombiana](https://www.cruzrojacolombiana.org). Cada sitio conserva su URL de origen en `fuente`.
- **Datos comunitarios:** [hoja de cálculo pública](https://docs.google.com/spreadsheets/d/106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U/htmlview) mantenida por voluntarios. Gracias.
- **Geocodificación:** [Nominatim](https://nominatim.org) — datos **© OpenStreetMap contributors** ([ODbL](https://www.openstreetmap.org/copyright)). Esta atribución es obligatoria y también la exigirán los tiles del mapa cuando exista la web.
- **Licencia del código:** se propone MIT (decisión pendiente del mantenedor; el archivo `LICENSE` se creará al tomarla).
