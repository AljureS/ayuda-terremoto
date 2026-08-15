# Mapa de Ayuda — Terremoto de Colombia (10-ago-2026)

Página web para encontrar el punto de ayuda más cercano (acopio, sangre, voluntariado, mascotas…) tras el terremoto del 10 de agosto de 2026.
Los datos los recolecta un scraper de fuentes oficiales más una hoja comunitaria, y los mantiene **una sola persona** editando un JSON.

**Arquitectura en 4 líneas:**

1. `/scraper` (Node + TypeScript) importa la hoja comunitaria, scrapea fuentes oficiales, geocodifica y fusiona.
2. Todo termina en `/data/sitios.json` — **la fuente única de verdad**, también editable a mano.
3. `/web` (Next.js estático) lee ese JSON **en build time** y se despliega en Vercel.
4. **Regla de oro:** `/scraper` y `/web` no comparten código; se comunican **únicamente** por `/data/sitios.json`.

El detalle vive en [`docs/architecture.md`](docs/architecture.md) (cómo y por qué) y [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md) (el contrato).

**Atajos:** [runbook diario](#runbook-diario-de-emergencia) · [marcar un punto como `lleno`](#editar-un-sitio-a-mano--marcar-un-punto-como-lleno) · [correr la web en local](#correrla-en-local) · [primer deploy](#primer-deploy-en-vercel) · [verificar producción](#verificación-post-deploy) · [si un deploy falla](#si-un-deploy-falla) · [la web en números](#la-web-en-números)

---

## Requisitos e instalación

- Node.js 20 o superior (probado con Node 24.13) y npm.
- Sin claves de API, sin cuentas de terceros, sin secretos que rotar.
- **Una sola variable de entorno en todo el proyecto:** `SITIO_URL`, y vive en el dashboard de Vercel, no en tu máquina ([por qué](#primer-deploy-en-vercel)). Ni el scraper ni el `npm run dev` de la web necesitan nada.

Desde la raíz del repo, las dos mitades se instalan por separado (no comparten dependencias):

```bash
cd scraper && npm install
cd ../web && npm install
```

Los comandos del scraper se corren desde `scraper/`; los de la web, desde `web/`. Cada bloque de abajo trae su `cd`.

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

> **El push ya es el deploy.** Vercel construye y publica solo en ~1–2 min; no hay que tocar código ni entrar al dashboard. Detalle en [Redeploy](#redeploy-push-a-main--deploy).

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
#    ESTO YA ES EL DEPLOY: push a main → Vercel reconstruye y publica en ~1–2 min
cd .. && git add data/ scraper/cache/ && git commit -m "datos: corrida diaria" && git push

# 6. Abrir la URL de producción desde el celular y verificar que el dato nuevo esté
```

**El paso 5 es el paso de publicación.** No hay comando de deploy, ni dashboard, ni build a mano: el push dispara todo. Actualizar datos **nunca** requiere tocar código de `/web`.

Si el paso 6 muestra el dato viejo, espera un minuto más y recarga; si sigue viejo, ve a [Si un deploy falla](#si-un-deploy-falla).

---

## La web (`/web`)

Next.js (App Router) + TypeScript + Tailwind con `output: 'export'`: la build produce **HTML estático** en `web/out/`. Sin servidor, sin API routes, sin base de datos — por eso la ubicación de quien la usa no tiene a dónde ir aunque alguien quisiera.

Lee `/data/sitios.json` **en build time**, nunca en runtime. Actualizar datos = editar el JSON + push; no se toca código.

### Correrla en local

```bash
cd web && npx next dev
```

Output real (2026-08-14; se corrió con `-p 5056` porque el 3000 estaba ocupado en esta máquina):

```
   ▲ Next.js 15.5.23
   - Local:        http://localhost:5056
   - Network:      http://192.168.80.19:5056

 ✓ Starting...
 ✓ Ready in 1202ms
```

Abre la URL que imprime. Si el 3000 está ocupado, Next elige otro puerto y lo dice ahí — léelo, no lo asumas.

> ⚠️ **No le agregues `--turbopack` al script `dev`.** Turbopack **no resuelve** el import de `../../../data/sitios.json` — la única frontera de la web con el resto del repo. Con la bandera puesta, el servidor arranca y dice `Ready` (por eso es fácil no darse cuenta), pero cualquier página responde **HTTP 500**:
>
> ```
> ⨯ ./src/lib/datos.ts:13:1
> Module not found: Can't resolve '../../../data/sitios.json'
> ```
>
> Es la misma limitación por la que `build` usa webpack (decisión de W2, [`web/README.md`](web/README.md)). La bandera estuvo puesta y se quitó tras comprobar el fallo; `npm run dev` funciona hoy con webpack (verificado: HTTP 200 y las 67 tarjetas de Bogotá activa).

### Construirla

```bash
cd web && npm run build
```

Output real (2026-08-14, Node 24.13). Se capturó antes de los últimos fixes de diseño, así que las cifras pueden moverse uno o dos KB — la fuente de verdad es lo que imprima **tu** corrida:

```
   ▲ Next.js 15.5.23

   Creating an optimized production build ...
 ✓ Compiled successfully in 512ms
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (10/10)
   Finalizing page optimization ...
   Collecting build traces ...
 ✓ Exporting (2/2)

Route (app)                                 Size  First Load JS
┌ ○ /                                    8.27 kB         112 kB
├ ○ /_not-found                            133 B         103 kB
├ ○ /acerca                              2.32 kB         106 kB
├ ○ /campanas                            2.91 kB         106 kB
├ ○ /icon.svg                                0 B            0 B
├ ○ /manifest.webmanifest                  133 B         103 kB
├ ○ /robots.txt                            133 B         103 kB
└ ○ /sitemap.xml                           133 B         103 kB
+ First Load JS shared by all             103 kB

○  (Static)  prerendered as static content
```

Todo en `○ (Static)`: eso es lo que garantiza que no quedó nada dinámico. `/` es la lista, `/campanas` las campañas nacionales y `/acerca` el contenido fijo; los tres de `133 B` son `robots.txt`, `sitemap.xml` y el manifest, que salen a `out/` como archivos reales.

### Previsualizar el build tal como se sirve

El servidor de desarrollo **no** es lo que se publica. Para ver los archivos exactos que suben a Vercel:

```bash
cd web && npx serve out -l 5055
```

La primera vez descarga `serve` — esto no es un cuelgue:

```
npm warn exec The following package was not found and will be installed: serve@14.2.6
 INFO  Accepting connections at http://localhost:5055
```

> ⚠️ **Así NO se aplican los headers de `vercel.json`.** Comprobado hoy contra ese mismo servidor local:
>
> ```
> $ curl -sI http://localhost:5055/ | grep -iE 'content-security-policy|referrer-policy|x-content-type-options|permissions-policy'
> (sin salida)
> ```
>
> Es lo esperado: los headers los pone Vercel, no un servidor de archivos estáticos. `serve` sirve para revisar contenido y layout, **nunca** para dar por buena la CSP. La única verificación real es el [`curl -I` contra producción](#verificación-post-deploy).

---

## Primer deploy en Vercel

Se hace **una sola vez**. De ahí en adelante todo es `git push`.

> ⏳ **Nada de esta sección se ha ejecutado todavía**, porque requiere el deploy real. Los pasos están escritos desde la configuración verificada del repo (`web/next.config.ts`, `web/src/lib/seo.ts`, los dos `vercel.json`), pero **el dashboard no se ha tocado**. Lo que sí está probado en local va marcado como tal.

1. Entra a [vercel.com/new](https://vercel.com/new) e importa este repositorio de GitHub.

2. **Root Directory = `web`.** Es el paso que más se equivoca. Sin él, Vercel busca un proyecto Next en la raíz del repo y no lo encuentra.

3. **Framework Preset: Next.js.** Déjalo detectar solo. `web/next.config.ts` ya trae `output: 'export'` y Vercel publica `out/` sin ayuda. **No cambies** Build Command ni Output Directory.

4. **Deploy.** El build tarda ~1–2 min. Puede salir con el dominio provisional del código; es normal y lo resuelven los pasos 6 y 7. **Todavía no compartas este enlace.**

5. **Copia el dominio que Vercel te asignó** (`https://algo.vercel.app`, o tu dominio propio si ya lo conectaste).

6. **Crea la variable de entorno `SITIO_URL`** — Settings → Environment Variables, entorno **Production** — con ese dominio, con `https://` y **sin** slash final:

   ```
   SITIO_URL = https://tu-dominio-real.vercel.app
   ```

7. **Redeploya.** Deployments → el último → menú `⋯` → **Redeploy**. `SITIO_URL` se lee **en build time**: el deploy del paso 4 sigue publicado con el dominio viejo hasta que reconstruyas. **Sin este paso, el paso 6 no sirve de nada.**

### Por qué `SITIO_URL` no es opcional

`web/src/lib/seo.ts` resuelve el dominio en tres escalones: `SITIO_URL` → la variable que inyecta Vercel → un **provisional `https://mapa-de-ayuda.vercel.app` que este proyecto no controla**.

Si el provisional llega a producción, la canónica, `og:url`, `og:image`, `sitemap.xml` y `robots.txt` de las tres rutas apuntan a un sitio ajeno — y **el preview de WhatsApp iría a buscar la imagen OG a ese sitio ajeno**, que es justamente la pieza que hace que la gente abra el enlace.

Fíjala siempre, aunque parezca redundante: así el escalón del medio deja de importar y no dependes de si el proyecto tiene activado *"Automatically expose System Environment Variables"* ni de qué pasa el día que conectes un dominio propio.

**El mecanismo sí está verificado** (probado hoy en local, construyendo con la variable puesta — cambian los cinco lugares):

```
$ cd web && SITIO_URL=https://ejemplo-mapa-de-ayuda.vercel.app npm run build

$ grep -o '<link rel="canonical"[^>]*>' out/index.html
<link rel="canonical" href="https://ejemplo-mapa-de-ayuda.vercel.app/"/>

$ grep -o '<meta property="og:image"[^>]*>' out/index.html
<meta property="og:image" content="https://ejemplo-mapa-de-ayuda.vercel.app/og.png"/>

$ tail -1 out/robots.txt
Sitemap: https://ejemplo-mapa-de-ayuda.vercel.app/sitemap.xml
```

---

## Verificación post-deploy

**No compartas el enlace antes de terminar esta sección.** Es el gate real. Cambia `<dominio>` por el tuyo en los comandos.

### 1. Los 4 headers de seguridad

```bash
curl -sI https://<dominio>/ | grep -iE 'content-security-policy|referrer-policy|x-content-type-options|permissions-policy'
```

El `grep -i` no es adorno: en HTTP/2 los nombres de header van en minúscula. Deben salir los cuatro, con estos valores (son el contenido literal de `vercel.json`):

```
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
referrer-policy: no-referrer
x-content-type-options: nosniff
permissions-policy: geolocation=(self), camera=(), microphone=()
```

Los dos que hay que mirar de verdad:

- **`connect-src 'self'`** — es lo que hace *estructuralmente imposible* que la ubicación de quien usa el sitio salga por la red. Es la promesa del banner de privacidad, escrita como regla del navegador.
- **`geolocation=(self)`** — sin él, el botón "Usar mi ubicación" no funciona en producción aunque funcione en local.

> ⏳ **Por verificar en el primer deploy.** Ese bloque es lo que `vercel.json` declara, **no una respuesta capturada de producción** — nadie ha deployado todavía. Así se ve la salida del comando (corrido hoy contra el build local con `npx serve`, donde los headers **no** aplican y por eso el `grep` sale vacío):
>
> ```
> $ curl -sI http://localhost:5055/
> HTTP/1.1 200 OK
> Content-Length: 335241
> Content-Type: text/html; charset=utf-8
> ETag: "65785cfb594164223840d5aa44bf9929c7406926"
> ...
> ```

**Si en producción no aparecen, el deploy NO está protegido.** No compartas el enlace y revisa esto:

`vercel.json` está **duplicado a propósito** en la raíz del repo y en `/web`, con contenido idéntico (decisión 12 de [`docs/architecture.md`](docs/architecture.md), hallazgo de la auditoría W6). El motivo: con *Root Directory* = `web`, Vercel lee el `vercel.json` de **dentro** de esa carpeta e ignora el de la raíz. Con los dos archivos, la CSP se aplica sea cual sea la configuración del dashboard.

Así que si los headers faltan, el problema no es el repo — es la configuración del proyecto en Vercel. Verifica en Settings que *Root Directory* sea exactamente `web` (o la raíz), redeploya y vuelve a correr el `curl`.

> Si algún día editas un `vercel.json`, **edita el otro**. Son dos archivos que deben quedar idénticos.

### 2. La canónica apunta a tu dominio, no al provisional

```bash
curl -s https://<dominio>/ | grep -o '<link rel="canonical"[^>]*>'
```

Debe mostrar **tu** dominio. Si sale `mapa-de-ayuda.vercel.app`, falta `SITIO_URL` o falta el redeploy del paso 7 — vuelve allá.

Este comando es el que cierra la pregunta entera: no importa por qué escalón resolvió el dominio, si la canónica es la correcta, `og:url`, `og:image`, `sitemap.xml` y `robots.txt` también lo son.

> ⏳ **Por verificar en el primer deploy.** El comando sí está probado: corrido hoy contra el build local devolvió `<link rel="canonical" href="https://ejemplo-mapa-de-ayuda.vercel.app/"/>`.

### 3. Desde un celular real

No desde el simulador del escritorio. Abre `https://<dominio>/` en el teléfono y prueba, en este orden:

1. **La lista carga** con los puntos de Bogotá.
2. **Un filtro** de categoría (por ejemplo `sangre`) cambia la lista y el conteo.
3. **El botón "Usar mi ubicación"** pide permiso y ordena por cercanía. El navegador solo entrega coordenadas en contexto seguro: producción (HTTPS) y `localhost` califican, pero abrir el `http://192.168.x.x:5056` del servidor de desarrollo **desde el celular no** — por eso este paso se prueba aquí y no antes.
4. **Abrir el mapa** y ver que cargan los tiles.
5. **"Cómo llegar"** en un punto abre Google Maps con el destino correcto.

> ⏳ **Por verificar en el primer deploy.**

### 4. El preview de WhatsApp

Pega el enlace en un chat contigo mismo. Deben aparecer título, descripción e imagen. Es la vía por la que la gente va a recibir este sitio: si el preview sale roto o vacío, el enlace no se propaga.

> ⏳ **Por verificar en el primer deploy.** Lo que sí está verificado hoy en el build: `out/og.png` existe y pesa 52,8 KB.

---

## Redeploy: push a `main` = deploy

No hay nada más que hacer:

```bash
cd .. && git add data/ scraper/cache/ && git commit -m "datos: corrida diaria" && git push
```

Vercel detecta el push a `main`, construye y publica en **~1–2 min**. Es exactamente el paso 5 del [runbook diario](#runbook-diario-de-emergencia) — el mismo comando, no uno adicional.

**Actualizar datos NO requiere tocar código.** El JSON entra en build time: editas `/data/sitios.json`, haces push, y la página sale con el dato nuevo. Nunca hace falta abrir `/web` para cambiar un horario, un estado o una dirección.

> Antes de cada deploy que **sí** lleve cambios de código, corre `/ship-check`.

---

## Si un deploy falla

Los logs de build están en el dashboard de Vercel → tu proyecto → **Deployments** → el deploy en rojo → **Building**. El error real casi siempre está en las últimas 20 líneas.

Las tres cosas que hay que revisar, en orden de probabilidad:

1. **Root Directory mal puesto.** Síntoma: el build ni siquiera encuentra el proyecto Next (`No Next.js version detected` o un `package.json` que no es el de la web). Arreglo: Settings → General → Root Directory = `web` → redeploy.

2. **Alguien cambió el `build` a turbopack.** En `web/package.json`, `build` es `next build` (webpack clásico) **a propósito**: turbopack no resuelve el import de `../../../data/sitios.json`, que vive fuera del root del paquete. Síntoma exacto (comprobado: la bandera estuvo un tiempo en el script `dev` y lo tenía roto):

   ```
   Module not found: Can't resolve '../../../data/sitios.json'
   ```

   Es una decisión de W2 documentada en [`web/README.md`](web/README.md). **No lo cambies.** Si el build empieza a fallar resolviendo el JSON, lo primero que se revisa es que ese script siga siendo `next build` a secas.

3. **La build se rompe por un dato** (menos frecuente, pero real). El saneador de `/web` detiene la build si detecta lo que parece un documento de identidad sin etiquetar en un texto del dataset — y un NIT o un monto en pesos (`$5.000.000`) tienen la misma forma que una cédula. El mensaje de error trae las tres salidas posibles. El detalle está en `web/README.md` (decisiones de W6, "Para quien opera el pipeline").

---

## La web en números

Lo que midieron las auditorías de W6. Sirve para saber **qué estás protegiendo** el día que toques el código:

| Medida | Valor |
|---|---|
| Lighthouse móvil — rendimiento | **100** en las 3 rutas |
| Lighthouse móvil — accesibilidad | **100** en las 3 rutas |
| JS inicial de `/` | **112 KB** gz (presupuesto: 180 KB) — `/campanas` y `/acerca`, 106 KB |
| Cookies · analytics · terceros | **cero** |
| Único host externo que el sitio pide | `tile.openstreetmap.org`, **solo al abrir el mapa** |

La cifra de KB no hay que creérsela de memoria: la imprime `npm run build` en la columna **First Load JS**. Si un cambio tuyo la sube, ahí se ve.

El resto de hosts externos del build son `<a href>` de navegación que inicia la persona: fuentes oficiales, links de donación del dataset y los deep links de Google Maps. Verificado hoy sobre `web/out/`: `tile.openstreetmap.org` solo aparece en el chunk del mapa (que el HTML inicial no referencia) y como texto en `/acerca`.

> **Regla:** antes de cada deploy con cambios de código, corre **`/ship-check`**. Verifica datos, build, hosts externos, headers, Open Graph y Lighthouse, y da un veredicto GO / NO-GO. Los deploys de solo datos no lo necesitan: para eso está `/validate-data` en el runbook.

---

## Datos y semántica (resumen)

Estado de hoy: **204 sitios** en 28 ciudades · 23 verificados por fuente oficial · 20 con coordenadas · 133 con dirección para ubicar a mano · 49 sin ciudad (46 son campañas de dinero sin punto físico: van en lista, no en mapa) · 2 sin dirección.

| Campo | Semántica en una línea |
|---|---|
| `id` | Slug estable: una vez publicado, **no se regenera nunca** (sobrevive corridas y fusiones) |
| `estado` | `activo` \| `lleno` \| `pausado` \| `cerrado` — la web muestra solo `activo` por defecto |
| `manual` | `true` = editado por humano; el pipeline jamás lo toca (solo reporta contradicciones) |
| `verificado` | `false` = dato comunitario sin confirmar · `true` = confirmado por fuente oficial o por ti |
| `fuente` | URL de origen, siempre poblada — la trazabilidad pública del proyecto |
| `categorias` | Enum cerrado de 10: `alimentos`, `agua`, `ropa_abrigo`, `mascotas`, `construccion`, `medicamentos`, `sangre`, `voluntariado`, `dinero`, `acopio_general` |
| `ultimaActualizacion` | ISO con `-05:00` (Bogotá); dato viejo = dato peligroso |

El schema canónico completo está en [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md); su única definición ejecutable es `scraper/src/schema.ts` (zod). El porqué de cada decisión: [`docs/architecture.md`](docs/architecture.md).

---

## Agregar una ciudad

Las dos mitades ya están listas: **no hay que escribir código de interfaz.**

1. **Pon la ciudad en el campo `ciudad`** de los sitios nuevos, con su nombre exacto y su tilde (`"Manizales"`, `"Quibdó"`, `"Medellín"`). Da igual si llegan por `build:data`, por `/nuevo-sitio` o editando el JSON a mano.

2. **El selector de ciudad aparece solo.** La lista de ciudades y sus conteos se calculan del dataset en build time — en `/web` no hay ni una ciudad escrita a mano. QA lo verificó en W6 construyendo con un dataset alterado: la ciudad nueva sale en el selector con su conteo correcto sin tocar una línea de código. El selector solo se muestra cuando hay más de una ciudad; hoy hay 28.

3. **Agrega su bbox de sanidad** en `scraper/src/geocode.ts` si vas a geocodificar muchas direcciones ahí. Sin él, la validación cae al bbox de Colombia entero: sigue funcionando, pero deja pasar coordenadas absurdas dentro del país. Hoy solo Bogotá tiene bbox fino.

4. **Suma sus fuentes oficiales** al scraper si las hay (alcaldía local, seccional de Cruz Roja).

El deploy no cambia: `npm run validate` → commit → push.

---

## Pendiente (honesto)

- **El primer deploy no se ha hecho todavía.** La guía de Vercel está escrita desde la configuración real del repo, pero los pasos del dashboard, el `curl -I` contra producción, la prueba desde el celular y el preview de WhatsApp siguen **⏳ por verificar** — van marcados así donde aparecen. Cuando el deploy exista, reemplaza esas marcas por la salida real.
- **133 sitios con dirección pero sin coordenadas:** salen en la lista, no en el mapa. Ver [`docs/UBICAR_A_MANO.md`](docs/UBICAR_A_MANO.md).
- **Licencia del código:** falta tomar la decisión y crear el archivo `LICENSE` (propuesta: MIT).

---

## Créditos y licencias

- **Fuentes oficiales:** [Alcaldía de Bogotá](https://bogota.gov.co) (puntos de acopio, donación de sangre y acopio para animales) y [Cruz Roja Colombiana](https://www.cruzrojacolombiana.org). Cada sitio conserva su URL de origen en `fuente`.
- **Datos comunitarios:** [hoja de cálculo pública](https://docs.google.com/spreadsheets/d/106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U/htmlview) mantenida por voluntarios. Gracias.
- **Mapa y geocodificación:** tiles de [OpenStreetMap](https://www.openstreetmap.org) y geocodificación con [Nominatim](https://nominatim.org) — datos **© OpenStreetMap contributors** ([ODbL](https://www.openstreetmap.org/copyright)). **Esta atribución es obligatoria**: la exigen tanto los tiles del mapa como Nominatim. Ya aparece en el control del mapa y en la página `/acerca`; no la quites.
- **Licencia del código:** se propone MIT (decisión pendiente del mantenedor; el archivo `LICENSE` se creará al tomarla).
