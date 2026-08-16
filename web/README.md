# /web — Mapa de Ayuda

Página estática (Next.js App Router + TypeScript + Tailwind v4, `output: 'export'`)
que muestra los puntos de ayuda del terremoto. La gobierna `docs/DESIGN.md`
(sistema de diseño aprobado — ley para la UI) y `docs/MASTER_PROMPT.md` Parte 2.

## Comandos

```bash
npm run dev     # desarrollo en http://localhost:3000 (webpack — NO turbopack)
npm run build   # produce web/out/ (mismo bundler; ver nota abajo)
```

No hay `npm start`: no existe servidor. `out/` se sirve como archivos estáticos
(Vercel, root directory `web`).

> **Ni `dev` ni `build` usan turbopack, y la bandera no se vuelve a agregar.**
> Turbopack no resuelve `import crudos from "../../../data/sitios.json"`
> (`src/lib/datos.ts`), el único import que cruza fuera del root del paquete y
> la frontera con `/data`. Con `--turbopack` el servidor arranca ("✓ Ready") y
> **cada request devuelve HTTP 500** con `Module not found: Can't resolve
> '../../../data/sitios.json'` — falla en la petición, no al arrancar, así que
> es fácil creer que funciona. Verificado en W7: `next dev --turbopack` → 500;
> `next dev` (webpack) → 200 con las 67 tarjetas pre-renderizadas. Si algún día
> se quiere la velocidad de turbopack, primero hay que resolver ese import (por
> ejemplo copiando el JSON dentro del paquete en un paso previo), no al revés.

## Reglas de oro que este paquete respeta

- **Cero imports desde `/scraper`.** El tipo `Sitio` está duplicado a propósito
  en `src/lib/tipos.ts` (comentado ahí). La única frontera con el resto del
  monorepo es `import ... from "../../../data/sitios.json"` en
  `src/lib/datos.ts`, **en build time**. La web compila aunque `/scraper` no
  exista.
- **Privacidad por arquitectura.** Sin backend, sin cookies, sin analytics, sin
  assets externos (tipografía = system stack). Los únicos hosts externos del
  build son `<a href>` de navegación iniciada por el usuario: fuentes oficiales,
  links de donación/contacto del dataset y los deep links keyless de Google
  Maps (`/maps/dir` con la coordenada del sitio; `/maps/search` con la
  dirección pública cuando no hay coordenada). Jamás la ubicación del usuario,
  que en W2 ni siquiera existe.
- **Contactos con nombre de persona** (decisión aprobada, `docs/DESIGN.md` §7):
  nunca en claro en el HTML/payload. En build se clasifican
  (`src/lib/contacto.ts`), se ofuscan (base64 — ofuscación, no cifrado,
  documentado en el código) y solo se decodifican en el dispositivo al tocar
  "Ver contacto". Además, `prepararDatos()` **rompe la build** si un nombre, un
  celular personal o un documento de identidad aparece en claro en el payload
  (garantía estructural, cubre datos futuros del pipeline; reglas endurecidas en
  W6 — ver esa sección).

## Decisiones de W2

- **Next 15.5.23 (major 15 fijado)** con React 19.1 y Tailwind v4: terreno
  conocido y compatible con react-leaflet v5 (W3). Las advisories de `npm audit`
  (postcss bundled en next, sharp) son herramientas de build con inputs propios
  del repo; su "fix" es Next 16 (breaking) — riesgo aceptado y documentado.
- **`next build` clásico (webpack), no turbopack:** turbopack no resuelve el
  import de `/data/sitios.json` fuera del root del paquete. (El script `dev`
  sí se quedó con la bandera hasta W7, donde se quitó: ver la nota de
  "Comandos" arriba.)
- **`trailingSlash: true`**: cada ruta es carpeta con `index.html` en `out/`.
- **"hace X h" calculado en build** (sin relojes en cliente en W2): correcto
  porque cada actualización de datos implica push → rebuild.
- Toggle **[Mapa] oculto** hasta W3: un botón muerto en la barra de 56 px sería
  decoración que estorba (`DESIGN.md` §0).
- La vista por defecto (Bogotá, solo activos) sale **pre-renderizada como HTML
  semántico** (67 `<article>`); el dataset completo viaja en el payload RSC del
  mismo documento (cero fetch en runtime). `/campanas` prerenderiza sus 49.

## Decisiones de W3 (mapa)

- **leaflet 1.9.4 + react-leaflet 5.0.0** (v5 = compatible React 19) +
  `@types/leaflet`. Nada más. CSS de Leaflet importado **local** desde
  node_modules en `src/components/mapa/Mapa.tsx` — jamás unpkg/CDN.
- **Carga diferida real**: `Mapa.tsx` entra solo vía `next/dynamic` con
  `ssr: false` (`PanelMapa.tsx`). El HTML inicial no referencia ninguno de
  sus chunks; el costo del mapa (~50 KB gz: 4,3 código propio + 42,7 leaflet
  + 3,0 CSS) se paga únicamente al abrirlo. First-load de `/`: 109 KB
  (107 en W2; los +2 KB son el toggle + el wrapper de dynamic).
- **Desktop abre con botón "Ver mapa", no al entrar al breakpoint**
  (desviación deliberada de DESIGN.md §3 acordada en el plan de W3):
  el aside sticky es visible al cargar, así que IntersectionObserver no
  diferiría nada; montar al cargar costaría ~50 KB gz de JS + 200–400 KB de
  tiles en cada visita desktop para un mapa que hoy ubica 20 de 204 puntos.
  Con el botón, quien quiere el mapa lo paga en ~1 s; quien no, paga 0.
- **Un solo Leaflet vivo**: el mapa se monta en el hueco móvil (toggle
  [Mapa], lista SIEMPRE default) **o** en el aside desktop según matchMedia
  ≥1024 px, nunca en ambos. La vista no va a la URL: un link compartido
  siempre abre en lista (el camino pre-renderizado).
- **Markers**: `L.divIcon` con SVG inline (spec DESIGN.md §5) — círculo
  28 px del sólido de la categoría (mismas CSS vars que los badges), aro
  blanco, glifo propio por categoría, target táctil 44 px. Sitio
  multi-categoría: manda la **primera categoría en el orden del enum**
  (`CATEGORIAS` de tipos.ts; en el dataset actual coincide con la primera
  del array en los 111 multi-categoría). Estado ≠ activo: desaturado
  `--color-pausado-punto` — **renombrado a `--color-marker-inactivo` en W7**
  (mismo hex `#85929D`; ver esa sección).
- **El mapa muestra el conjunto filtrado vigente** con fit-bounds; sin
  ningún punto ubicado → encuadre de Colombia + "Ningún punto ubicado en el
  mapa para este filtro." El conteo honesto ("X de Y puntos ubicados en el
  mapa") usa los números del conjunto filtrado — es lo que el mapa muestra.
- **Controles abajo a la derecha** (zoom sobre la atribución): los controles
  de Leaflet siempre flotan sobre los panes (stacking context del map-pane),
  y arriba taparían el título de los popups en pantallas angostas. Ancho de
  popup adaptativo (`min(280, innerWidth − 96)`): cabe entero a 320 px.
- **Tiles caídos** degradan al microcopy de DESIGN.md §6 con "Volver a la
  lista" en móvil; si un tile carga después, el mapa se recupera solo.
- Atribución "© OpenStreetMap contributors" como texto plano en el control
  (único host externo nuevo del build: `tile.openstreetmap.org`); el crédito
  con link llega con "Acerca de" en W5. Notas para el auditor sobre el chunk
  de leaflet (`d0deef33.*.js`): (1) contiene el string
  `https://leafletjs.com` — constante del prefix default de su control de
  atribución, desactivado aquí con `prefix={false}`: nunca se renderiza ni
  genera requests; (2) contiene `navigator.geolocation` — es la API
  `map.locate()` del core de Leaflet, **código muerto en este sitio**:
  ningún archivo de `/web` llama `locate` (grep = 0) y en W3 no existe
  geolocalización por diseño (llega en W4, solo en memoria).

## Decisiones de W4 (ubicación, riel de rumbo, privacidad UI)

- **La posición del usuario vive en UN solo `useState`** (`pos`, en
  `ListaFiltrada`) y todo el trato con el sensor está en UN solo archivo
  (`src/components/Ubicacion.tsx`). Trazado completo del flujo en la tabla de
  abajo; los greps de auditoría son `fetch(|XMLHttpRequest|sendBeacon|WebSocket|new Image(`
  sobre `src/` (**0 usos totales**) y `pushState|replaceState|location.search`
  (**solo** el sync de filtros de W2, cuyo `useEffect` depende de
  `[inicializado, cats, ciudad, verTodos]` — `pos` no aparece ni en las
  dependencias ni en el cuerpo; `q` salió de esa lista en W6, ver abajo).
- **Redondeo a 4 decimales (~11 m) en el instante del fix**: el
  `GeolocationPosition` completo muere dentro de su callback; ni el estado ni
  el localStorage ven jamás una versión más precisa. Para ordenar puntos de
  acopio a escala de ciudad sobra.
- **Haversine y rumbo propios** (`src/lib/geo.ts`, ~20 líneas, cero
  dependencias nuevas). Verificados contra la ley de cosenos esférica
  (coinciden a <1 mm) y contra rumbos canónicos (90/0/180/270 exactos).
- **El riel de rumbo** (`src/components/Riel.tsx`, DESIGN.md §4): flecha SVG
  propia rotada al bearing real (norte arriba) + distancia en mono
  `cifra` 18/600. Ocupa exactamente los 56 px que W2 ya reservaba, y solo
  crece con distancias inusualmente largas (medido: 97,5 px con "6627,3 km",
  sin scroll horizontal a 320 px). Un único `sr-only` lo anuncia como
  "a 491 metros, dirección sur"; las piezas visuales van `aria-hidden`.
- **Los 4 fallos, 3 textos**: DESIGN.md §6 define una sola cadena para
  "Contexto inseguro / sin soporte" y otra para "no disponible / timeout".
  Las cuatro causas se detectan por separado (`code 1` / `code 3` / `code 2` /
  `!navigator.geolocation` / `!isSecureContext`); los textos son tres porque
  así lo fija el sistema de diseño. **Nota para el auditor:** la detección usa
  `!navigator.geolocation`, no `"geolocation" in navigator` — con `in` la
  guarda pasa cuando la propiedad existe en el prototipo pero vale `undefined`
  y la llamada revienta (bug real, detectado en el harness de W4).
- **Contexto inseguro y falta de soporte se detectan ANTES de llamar** al
  sensor: la persona recibe el mensaje útil en vez de un prompt inútil.
- **localStorage: la PRESENCIA de la clave ES el opt-in.** No se guarda ningún
  flag `recordar=0`; sin opt-in el sitio escribe **0 claves** (verificado en
  runtime). Claves con prefijo propio `ma:` (`ma:filtros`, `ma:ubicacion`)
  para que "Borrar mis datos" las enumere y borre todas sin lista hardcodeada.
  Todo acceso va en try/catch (`src/lib/almacen.ts`): con `setItem` lanzando
  (Safari privado) la app no crashea y muestra el microcopy de §6.
- **La búsqueda libre (`q`) NO se guarda** aunque el opt-in de filtros esté
  activo: es texto que la persona escribió (a veces su propia dirección) y
  nadie quiere reabrir el sitio con una búsqueda vieja pegada. (W6 llevó la
  misma regla a la URL: ver abajo.)
- **Precedencia URL > filtros recordados**: un link compartido por WhatsApp
  abre la vista que quiso quien lo compartió; los filtros guardados se aplican
  solo cuando no hay query string. Sin esta regla, W2 se rompería en silencio.
- **"Borrar mis datos" vive en el pie** (todas las páginas) y se comunica con
  la lista por un evento in-document (`ma:datos-borrados`) que **no transporta
  ningún dato**: evita subir el estado a un server component y deja el pie
  funcionando también en `/campanas`. Confirmación in-page con el copy del
  sistema, nunca `confirm()` del navegador.
- **El mapa hereda el conjunto filtrado en el orden vigente y nada más**: en
  W4 NO existe marker de la posición del usuario (DESIGN.md no lo pide).
- Peso: first-load de `/` **109 → 111 KB** (+2 KB por toda la fase: geo,
  riel, ubicación, almacén y borrado) y de `/campanas` **105 → 106 KB** (+1 KB:
  solo hereda `BorrarDatos` por el pie compartido). Presupuesto: ≤ 180 KB.
- **Estado conocido y aceptado:** en desktop el mapa del aside puede estar
  abierto mientras se activa la ubicación, así que `paraMapa` cambia de orden
  bajo una instancia viva de Leaflet. Es el mismo conjunto reordenado: en el
  peor caso re-encuadra a los mismos bounds. Sin acción.

### Trazado del flujo de la posición del usuario (W4)

| # | Dónde existe | Qué es | Sale de ahí hacia |
|---|---|---|---|
| 1 | `GeolocationPosition` en la callback de `getCurrentPosition` (`Ubicacion.tsx`) | el fix crudo del navegador | solo `redondearPosicion()`; muere al terminar la callback |
| 2 | `pos` — `useState` en `ListaFiltrada` | `{lat, lng}` redondeado a ~11 m | solo el `useMemo` de distancias |
| 3 | argumento de `distanciaM()` / `rumboGrados()` (`lib/geo.ts`) | funciones puras | devuelven metros y grados |
| 4 | prop `riel={{metros, rumbo}}` de `TarjetaSitio` | resultado derivado, no la posición | pantalla |
| 5 | `localStorage["ma:ubicacion"]` | **solo con opt-in explícito** | el propio dispositivo; borrable con "Borrar mis datos" |

Y a dónde **no** llega, verificado en runtime con una coordenada-aguja
(4.7123, −74.0917) tras activar ubicación, marcar "recordar" y abrir el mapa:
URL/history/referrer, DOM serializado completo, **todos** los atributos del
DOM, texto visible, `sessionStorage`, cookies (cero) y los 24 requests de red
— todos limpios; el único host externo en runtime sigue siendo
`tile.openstreetmap.org`.

## Decisiones de W5 (contenido fijo, SEO/OG, headers)

- **`/acerca`** (`src/app/acerca/page.tsx`): server component puro, se lee
  completa **sin JavaScript** (verificado con `scriptExecutionDisabled`: el
  texto visible mide exactamente lo mismo con JS y sin JS). Contiene el
  disclaimer del contrato, cómo reportar un cambio, los créditos a las
  fuentes, la atribución de OpenStreetMap y la sección de privacidad.
  El enlace vive en el pie de **todas** las páginas. El disclaimer **no** se
  replica en el pie: `docs/DESIGN.md` §6 le asigna esa cadena a "Acerca de",
  y ampliarla a toda la UI es decisión de `design-director`, no de esta fase.
- **Los números de "Acerca de" se calculan en build** desde
  `/data/sitios.json` (`prepararDatos()` expone `actualizadoFecha` y
  `sitiosPorFuente`). Los conteos de los créditos salen del host de `fuente`
  de cada registro: si el pipeline cambia, el texto no miente. Nunca hay
  cifras escritas a mano.
- **Cadencia: se describe el mecanismo, no una frecuencia inventada.** El
  sitio dice cómo se actualiza (editar el JSON → push → rebuild) y la regla
  de las 72 h de `/validate-data`, más el sello real del dataset. Prometer
  "varias veces al día" sería una cifra que nadie puede sostener.
- **Metadata por ruta** (`src/lib/seo.ts` + `metadatosRuta()`): Next hace
  merge **shallow** de `metadata`, así que una página que declara `openGraph`
  reemplaza entero el del layout. Por eso cada ruta arma su objeto completo —
  si no, `/campanas` y `/acerca` se quedarían sin `og:image`. Las canónicas
  llevan slash final porque es lo que realmente se sirve (`trailingSlash`).
  La description de `/campanas` se recortó de 116 a 87 caracteres (≤ 90).
- **`themeColor` va en el export `viewport`**, no en `metadata`: en `metadata`
  Next 15 emite un warning de build (y el gate de W5 exige build sin
  warnings). `colorScheme: "light"` porque DESIGN.md §1 decide que no hay modo
  oscuro en v1.
- **Dominio (`SITIO_URL`)**: `metadataBase` necesita una URL absoluta o no hay
  preview en WhatsApp. Precedencia: variable `SITIO_URL` → la que inyecta
  Vercel (`VERCEL_PROJECT_PRODUCTION_URL`, nombre confirmado en la
  documentación de Vercel: "the production domain name of the project, set
  even in preview deployments"; llega **sin** protocolo) → **provisional
  `https://mapa-de-ayuda.vercel.app`** para builds locales.
  **W7 DEBE fijar el dominio real**: ese provisional es un dominio que el
  proyecto no controla y hoy aparece en `canonical`, `og:url`, `og:image`,
  `sitemap.xml` y `robots.txt` de las tres rutas. Basta con definir `SITIO_URL`
  en el dashboard (no hay que tocar código). Si se confía en la variable de
  Vercel, verificar que el proyecto tenga activado "Automatically expose System
  Environment Variables"; si estuviera apagada, el fallback provisional se
  publicaría en producción.
- **Atribución de OSM**: además del texto obligatorio "© OpenStreetMap
  contributors" y del enlace a `openstreetmap.org/copyright`, `/acerca` enlaza
  la licencia **ODbL** (`opendatacommons.org`). Es un host externo más, añadido
  a conciencia: la guía de atribución de OSM pide dejar claro que los datos
  están bajo esa licencia. Si el auditor prefiere el mínimo estricto, se puede
  quitar ese enlace sin perder el cumplimiento.
- **`robots.txt`, `sitemap.xml` y `manifest.webmanifest`** se generan con las
  rutas de metadata de Next (`src/app/robots.ts`, `sitemap.ts`, `manifest.ts`)
  y salen a `out/` como **archivos reales** (verificado: `trailingSlash: true`
  no los convierte en carpetas). Con `output: "export"` las tres necesitan
  `export const dynamic = "force-static"` o la build falla al recolectarlas.
  El manifest usa `display: "browser"` a propósito: sin service worker, una
  ventana standalone sin red mostraría el error del navegador.
- **`og.png` 1200×630, 52,8 KB, self-hosted** (`public/og.png`). Se genera con
  `node scripts/og.mjs` (Chrome headless del sistema, cero dependencias
  nuevas) desde `scripts/og.html`, y **se versiona en git**: la generación
  NO está en `npm run build` porque el builder de Vercel no tiene Chrome.
  Regenerar solo si cambia el copy o la paleta. Nota: Chrome headless moderno
  (verificado en 151) escribe el PNG pero **no termina solo** tras
  `--screenshot`; el script espera al archivo y mata el proceso.

### La CSP (raíz del repo: `/vercel.json`)

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org;
connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self';
form-action 'none'; frame-ancestors 'none'
```

Más `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` y
`Permissions-Policy: geolocation=(self), camera=(), microphone=()`
(`geolocation=(self)` es lo que permite el botón de W4).

Los dos `'unsafe-inline'`, para que el auditor los reconozca:

- **`script-src 'unsafe-inline'`** — tradeoff conocido y documentado
  (`docs/architecture.md` §3, decisión 9): el export estático de Next inyecta
  scripts inline de bootstrap y los hashes son frágiles entre builds.
- **`style-src 'unsafe-inline'`** — lo necesita **Leaflet**, no solo Next:
  escribe atributos `style` inline para las transformaciones de los panes
  (`style-src-attr` cae de vuelta a `style-src`). Quitarlo rompe el mapa.
  Que quede escrito para que un endurecimiento futuro no lo intente a ciegas.

Todo lo demás está cerrado: `connect-src 'self'` hace **estructuralmente
imposible** que la ubicación del usuario salga por la red, `form-action 'none'`
es gratis (el sitio no tiene ni un `<form>`) y `object-src`/`frame-ancestors`
van en `'none'`.

**Verificado contra el build real** (no solo leído): sirviendo `out/` en
`http://localhost` con los cuatro headers leídos de `vercel.json`, y midiendo
en Chrome con `securitypolicyviolation` dentro de la página **y**
`Log.entryAdded` (source `security`) desde el navegador — las violaciones de
CSP las genera el navegador, no `console.*`, así que escuchar solo la consola
daría un falso limpio. Resultado: **0 violaciones** en cuatro escenarios
(home con el mapa abierto, `/campanas`, ubicación activa con "recordar"
marcado, y `/acerca`), con los tiles de OSM cargando de verdad.

Se ejercita a propósito **"Ver contacto"**: es la única ruta de código con
decodificación (`atob` del base64 de DESIGN.md §7) y solo corre al tocar. La
CSP **no** concede `'unsafe-eval'`; si ese revelado dependiera de `eval`/
`new Function` fallaría en silencio hasta que un usuario lo tocara. Verificado:
revela el contacto sin una sola entrada de seguridad (y `grep` de
`eval(`/`new Function(` en `src/` = 0).

### Nota de deploy para W7

`vercel.json` está en la **raíz del repo**, como manda el contrato. Si en el
dashboard se configura *Root Directory* = `web`, Vercel puede leer el
`vercel.json` de **dentro** del Root Directory y **ignorar** el de la raíz — es
decir, ninguno de estos headers llegaría a producción. El gate de W7 ya incluye
`curl -I` contra prod: si los headers no aparecen, las salidas son mover o
duplicar la configuración dentro de `web/`, o dejar Root Directory en la raíz
con `outputDirectory: "web/out"`. No se inventan claves aquí.

## Decisiones de W6 (fixes de la doble auditoría)

Los ocho cambios de esta fase salieron de `qa-performance` y `privacy-auditor`.
Ninguno tocó `/data`, `/scraper`, `/docs` ni los `vercel.json`.

- **`src/app/not-found.tsx` (P1).** Sin ese archivo, `output: 'export'` escribía
  en `out/404.html` la página por defecto de Next: título en inglés, cuerpo en
  inglés dentro de `<html lang="es">`, **cero enlaces** y un
  `prefers-color-scheme: dark` inline contra DESIGN.md §1. Ahora la 404 lleva el
  encabezado y el pie del sitio, copy en español y tres salidas (lista,
  campañas, acerca), se navega **sin JavaScript** y declara `robots: noindex`
  (merge shallow: reemplaza el `index, follow` del layout — antes el archivo
  traía las dos directivas contradictorias). Pesa **menos** que la de Next:
  `/_not-found` pasó de 995 B a 133 B.
- **Un `h2` de sección en la home (P2).** La home encadenaba h1 → 67 h3 sin un
  solo h2 (`heading-order`, el único audit de accesibilidad en rojo: 98). El h2
  es la **línea de conteo honesto**, no un encabezado nuevo: la home queda con
  la misma cadena que `/campanas` y `/acerca` (h1 → h2 de sección → h3 de
  tarjeta) y el nombre del sitio sigue siendo h3 en las dos tarjetas. El reset
  de Tailwind hereda `font-size`/`font-weight` en encabezados, así que el tamaño
  no cambió (verificado con estilos computados: 15 px / 400 / mono).
- **`min-w-0` en el nombre de la tarjeta (P3).** Como flex item, el h3 heredaba
  `min-width: auto` y `break-words` **no** reduce el ancho min-content: por
  debajo de ~230 px CSS la tarjeta empujaba la columna del riel fuera
  (`scrollWidth` 191 vs `clientWidth` 161). Es el celular de 390 px con zoom de
  página al 200 %, o sea la persona de baja visión.
- **Dos desbordes más de la misma clase**, encontrados al extender esa medición
  a las otras rutas (ninguno estaba en el reporte; los dos son anteriores a W6):
  el `h1` compartido no tenía `break-words` ("Campañas y convocatorias
  nacionales" a 28 px sacaba `/campanas` al scroll horizontal) y los tres
  identificadores técnicos de `/acerca`
  (`tile.openstreetmap.org`, `ma:filtros`, `ma:ubicacion`) son palabras sin
  espacios de hasta 22 caracteres: llevan `wrap-anywhere`, que solo parte cuando
  no cabe. A 320 px CSS (el mínimo que exige WCAG 1.4.10) las tres rutas ya
  estaban bien y siguen bien.
- **Estado vacío de `/campanas` (P8).** Con el dataset sin campañas la página
  quedaba en "Dona desde cualquier lugar (0)" y nada más. Ahora cada sección
  existe solo si tiene contenido y, si no hay ninguna, aparece el estado vacío
  con el copy y la acción **literales** de DESIGN.md §6 ("Todavía no hay
  campañas nacionales publicadas. Los puntos de ayuda con dirección siguen en
  la lista." — **[Ver puntos de ayuda]**, acción canónica añadida en W6 como
  espejo de "Ver campañas").
- **Las campañas se mencionan solo si existen (P8, segunda mitad).**
  `design-director` publicó las decisiones de W6 en `docs/DESIGN.md` mientras
  esta fase estaba en curso, y §6 fija una regla que va más allá de `/campanas`:
  con 0 campañas, la frase que manda a las campañas nacionales afirma algo falso
  y enlaza a una página vacía, así que **la frase y la acción [Ver campañas]
  desaparecen enteras** de los tres estados vacíos de la home
  (`EstadoVacio`, prop `hayCampanas`). Es la misma regla que ya cumplía la
  tarjeta de acceso de la portada (`nCampanas > 0`). Con el dataset real
  (49 campañas) no cambia ni un carácter: verificado diffeando el texto visible
  de `/` y `/campanas` contra el build anterior a W6.
- **La búsqueda libre sale de la URL (BAJA-1).** `?q=` ya no se escribe nunca.
  W4 la había dejado fuera de `localStorage` por ser "texto que la persona
  escribió, a veces su propia dirección"; la URL es el artefacto **más**
  expuesto de los dos (se comparte por WhatsApp y queda en el historial del
  teléfono). Lo que la gente comparte de verdad —categoría y ciudad— sigue
  viajando. `?q=` se **lee** al cargar, para no romper un enlace ya compartido;
  como el sync usa `replaceState`, ese `q` heredado desaparece de la barra de
  direcciones y de la entrada del historial en el primer render (verificado).
  El copy de `/acerca` se precisó en la misma dirección: "no se guarda ni entra
  en el enlace que compartes".
- **Saneador y assert endurecidos (BAJA-3).** Los tres huecos que la auditoría
  llamó "garantía estructural con agujeros":
  1. *Nombre de una sola palabra.* El umbral de "esto es una persona" era
     `>= 2 palabras` **duplicado** en `contacto.ts` y en `datos.ts`. Ahora hay un
     solo predicado exportado, `esNombrePersonal()`, que llaman los dos, y baja a
     una palabra con lista de stopwords (institucionales derivadas de los 204
     `nombre` reales del dataset + vocabulario de servicio). En el dato de hoy no
     cambia nada: las 14 entradas son de dos o más palabras.
  2. *Números cortos.* `regexNumero()` devolvía `undefined` por debajo de 7
     dígitos. El piso baja a 4; a cambio, los números de menos de 7 dígitos
     exigen que no haya dígitos pegados a los lados. De 7 en adelante el
     comportamiento es idéntico al de W2–W5.
  3. *Documentos de identidad.* La auditoría encontró una cédula en claro en una
     descripción. Se cubre en dos niveles: **etiquetada** (`CC 25.289.478`,
     `C.C.: …`, `cédula …`) se recorta del texto y, si sobrevive, rompe la
     build; **sin etiqueta** (`25.289.478` suelta) rompe la build pidiendo
     revisión manual. El dígito obligatorio tras la etiqueta es lo que deja
     fuera "C.C. Parque Fabricato" (centro comercial, 3 casos reales).
  Además, el texto libre se sanea para **todos** los sitios, no solo los que
  tienen contacto personal (una cédula puede aparecer en cualquier descripción),
  y `limpiarDescripcion()` parte de la descripción ya saneada: con el texto
  crudo, un sitio que fuera campaña de dinero **y** tuviera contacto personal
  recuperaba la línea recién recortada (lo atrapaba el assert, pero rompiendo la
  build por un bug propio).

  **Para quien opera el pipeline:** el nivel 2 es la única regla que puede
  detener una build por un dato legítimo, porque un NIT
  (`Nit. 890.304.900` — 4 casos reales en el dataset) y una cifra de dinero en
  formato colombiano (`$5.000.000`) tienen exactamente la misma forma que una
  cédula. El mensaje de error trae las tres salidas: rotular el NIT (`NIT
  890.304.900` pasa), escribir el monto sin puntos, o borrar la cédula. Se
  prefirió esto a recortar en silencio: borrar el NIT de una campaña le quita a
  la gente cómo verificarla, y un recorte invisible no se audita.

- **Peso: +1 KB en `/`, −1 KB en la 404.** First load de `/`: **111 → 112 KB**
  (el kilobyte es la lógica condicional de los estados vacíos); `/campanas` y
  `/acerca` siguen en 106 KB; `/_not-found` baja de **104 a 103 KB** porque
  esta 404 pesa menos que la de Next. Presupuesto: ≤ 180 KB — quedan 68 KB de
  margen. El endurecimiento del saneador cuesta 0 KB en cliente: `contacto.ts`
  solo lo importa `datos.ts`, que es build time.
- **Lighthouse móvil tras los fixes:** `/` accesibilidad **98 → 100**,
  performance 100, best-practices 100, SEO 100 (3 corridas); `/campanas` y
  `/acerca`, 100 en las cuatro categorías.

## Decisiones de W7 (el código alcanza a DESIGN.md §11)

W6 dejó una deuda declarada: `design-director` publicó la revisión W6 del
sistema (`docs/DESIGN.md` §11 — P4, P5, P6, P8) mientras la fase de fixes
estaba en curso, así que **el código quedó por detrás del documento**. Esta
fase la salda. El único punto que tocaba algo ya aprobado —el punto ● del chip
pasa a `currentColor`— lo ratificó el usuario antes de empezar. Nada de
`/data`, `/scraper`, `/docs` ni los `vercel.json` se tocó.

- **Tokens de color: un solo cambio atómico** (§1, §9, W6/P4). Desaparecen
  `--color-activo-punto`, `--color-lleno-punto` y `--color-pausado-punto`;
  entran `--color-marker-inactivo: #85929D` y `--color-borde-control: #78848F`.
  Va todo junto **por obligación, no por prolijidad**: el marker apagado del
  mapa colgaba del token del punto de `pausado`. Sacar los tokens sin renombrar
  el `var()` de `iconos.ts` no degrada el marker, lo **rompe**: un `var()` sin
  definir es *invalid at computed-value time*, o sea `background: transparent`
  — círculo invisible con aro y glifo blancos sobre el tile, y el HTML seguiría
  siendo válido. Verificado en el CSS emitido de la build real
  (`--color-marker-inactivo:#85929d` presente) y en el DOM del mapa
  (`background-color: rgb(133, 146, 157)` en los 4 markers no-activos, 3.18
  contra el aro blanco, exactamente lo verificado en W3).
- **El punto ● no tiene tinta propia**: `bg-current` (= `currentColor`), y
  `ESTADO_INFO.punto` pasó de clase de color a **booleano** — lo tiene o no.
  El tipo es la garantía: no hay dónde volver a escribir un hex que se
  desincronice del tinte. Medido en el DOM real: el fondo del punto es
  idéntico al color del texto de su chip en los tres estados, con razones
  5.63 / 6.19 / 6.31 sobre su tinte (antes el peor era 2.66 real).
- **`shrink-0` en el punto (hallazgo propio de W7, no estaba en DESIGN.md).**
  El punto es un flex item de 8 px sin `shrink-0`: con el texto nuevo de
  `pausado` se comprimía a **4 px** (un óvalo de 4×8) a 195 px CSS — el celular
  de 390 px con zoom al 200 %, la misma persona del fix W6/P3. `Lleno — ya no
  recibe` ya lo sufría desde antes (5 px). DESIGN.md §1 fija 8 px y dice que
  lo que el punto aporta es **forma**; deformarlo justo donde hay baja visión
  es perder el canal que sustituye al color. Con la clase: 8×8 exactos a 320 y
  a 195 px.
- **La acción primaria existe solo en `activo`** (§3, W6/P5), escrita como
  invariante y no como lista: `hrefComoLlegar` pasó de
  `if (estado === "lleno" || estado === "cerrado")` a
  `if (estado !== "activo")`, y `hrefDonar` —que ignoraba el estado por
  completo— recibe la misma compuerta. La forma importa: la redacción por
  enumeración es exactamente la que dejó fuera a `pausado` cuando ese estado se
  agregó, y no se desactualiza sola con un estado futuro. **El popup del mapa
  hereda la compuerta, no la duplica**: consume el `comoLlegar` que ya viene
  calculado por sitio (verificado marker por marker: los 5 activos lo ofrecen,
  los 4 no-activos no).
- **`hrefDonar` también gobierna la limpieza de la descripción.** `datos.ts`
  usa su resultado para no imprimir dos veces la URL de donación; sin botón, la
  URL se queda una sola vez dentro del texto. Se sigue viendo exactamente una
  vez, con botón o sin él.
- **"Llamar" toma el estilo primario cuando queda sola** (§3): sin
  "Cómo llegar" / "Dona aquí" no es la segunda acción, es la única — y la
  correcta para estos estados, porque confirmar por teléfono es más barato que
  moverse con una caja. Ninguna tarjeta muestra su única acción en secundario.
- **Chip de `pausado`: "Pausado — no recibe por ahora"** (§1, patrón de
  `lleno`). Es ~40 % más largo que "Lleno — ya no recibe" y el chip **no lleva
  `whitespace-nowrap`** a propósito: eso es justo lo que causaría desborde.
  Medido en render real: a 320 px cabe en una línea (251×30 px, sin scroll
  horizontal); a 195 px envuelve dentro de la píldora a 3 líneas (129×74 px) y
  sigue dentro de la tarjeta. Ningún desborde en ninguna de las dos.
- **`borde-control` SOLO en los dos campos que aceptan entrada** (§9, W6/P6):
  el `<select>` de ciudad y el campo de búsqueda pasan a 3.82 sobre
  `superficie`. Botones, chips y el toggle [Mapa] se quedan en `borde` (1.40)
  como trim, medido y declarado: llevan su propia palabra a 6.75:1 y al
  activarse se rellenan sólidos de `accion`. Diez chips con borde oscuro
  pesarían justo en la fila más cargada de la pantalla.
- **El estado vacío de la home ya tiene salida** (la pregunta abierta que W6
  le dejó al director). Con dataset vacío, `sinDatos` se quedaba en el hecho y
  sin ninguna acción, contra la gramática de §6 (**hecho + salida**). La salida
  es `/acerca`: es la única página que sigue siendo útil sin un solo dato,
  porque explica qué es el sitio y cómo reportar un cambio. Aparece
  **únicamente cuando no hay campañas** —§6 pide *una* acción canónica y con
  campañas la salida ya es [Ver campañas]—, misma forma condicional que la
  regla "las campañas se mencionan solo si existen". Verificado con un build de
  0 sitios, con y sin JavaScript.
- **`npm run dev` estaba roto y ya no lo está.** El script conservaba
  `--turbopack`: arrancaba pero devolvía **500** en cada request. Ver la nota
  de "Comandos" arriba, que explica por qué la bandera no vuelve.

### Evidencia de W7

- **Build limpia**, sin warnings de export. `/` sigue reportando **112 kB** de
  First Load JS (redondeo de Next), `/campanas` y `/acerca` 106 kB;
  presupuesto ≤ 180 KB. Medido a mano con gzip, que es más preciso que el
  redondeo: el first-load de `/` pasa de **108,9 a 109,7 KB gz (+805 B)**,
  `/campanas` +102 B y `/acerca` +10 B; el HTML de `/` sube 30 B y el total de
  JS estático del sitio **baja 1,9 KB gz** (webpack dejó de duplicar en dos
  páginas el código que ahora comparten). Margen restante: ~70 KB.
- **Render con fixture de estados** (clon del repo en scratchpad, `/data`
  intacto): un sitio de cada estado + una campaña cerrada. Solo el `activo`
  ofrece acción primaria; en `lleno`, `pausado` y `cerrado` "Llamar" sale
  primaria (`bg accion`, blanco 6.75:1) y la tarjeta conserva nombre, chip,
  categorías, qué reciben, dirección, horario, fuente y frescura.
- **El mapa sigue vivo**: 9 markers, 5 con el sólido de su categoría
  (`#B0490B`, `#41499F`) y 4 con `#85929D`; círculo 28 px, target 44 px, glifo
  presente, tiles de OSM cargando y la atribución en su sitio.
- **Texto visible con el dataset real: idéntico** en las tres rutas (salvo el
  "hace N h" que se calcula en build). Coherente con el dato de hoy: 0 sitios
  `pausado`, 0 campañas no-activas y el único `lleno` no tiene teléfono ni
  tenía "Cómo llegar". **Todo esto es superficie latente** — por eso mismo
  había que escribirlo antes de que aparezca el primer `pausado`.
- **Sin regresiones**: 0 contactos personales en claro y 0 documentos de
  identidad en `out/` (los 10 nombres siguen solo tras "Ver contacto"), el
  assert de privacidad de la build pasa, el chunk de Leaflet (42,7 KB gz) sigue
  **sin aparecer** en el HTML de ninguna ruta, y el conjunto de hosts externos
  de `out/` es idéntico al de antes del cambio (48).
- **Lighthouse móvil de `/` (3 corridas): accesibilidad 100** (se mantiene),
  best-practices 100, SEO 100. `/campanas` y `/acerca`, 100 en las cuatro.
- **Performance 99, no 100 — este gate NO se cumple.** Es la única cifra que se
  movió, y se declara como incumplimiento antes que como explicación. Causa
  medida: **el número de requests, no el peso.** Webpack extrajo un chunk
  compartido (`913.js`, 2,8 KB gz) con el código que `/` y `/campanas`
  duplicaban; `/` pasa de 5 a 6 scripts y el modelo de latencia simulada de
  Lighthouse cobra un RTT por request → **LCP 1.849 → 1.999 ms**, con FCP, TBT
  y CLS idénticos. Los bytes van en la dirección contraria: el total del sitio
  baja 1,9 KB gz. Es un **efecto de umbral**: los ~800 B que agrega esta fase
  cruzaron el mínimo con el que webpack decide extraer código compartido.
  Evidencia de que no es una regresión de código: compilando la fuente
  **anterior** y la **nueva** en el mismo entorno aislado —donde el split
  ocurre en los dos casos— las dos dan **99, con métricas iguales al
  milisegundo** y 0,1 KB gz de diferencia en el first-load. **Palanca si el
  ship exige el 100 exacto: la estrategia de chunks, no este cambio.** No se
  tocó `next.config.ts` a propósito: un `webpack()` propio para forzar la
  fusión cambia un punto sintético por una pieza de configuración permanente
  que nadie va a poder explicar en seis meses, y con HTTP/2 sobre una sola
  conexión el request extra del mismo origen no cuesta esos 150 ms reales.

### De DESIGN.md, qué quedó sin implementar

- **"Acerca de este sitio" no está en la lista de acciones canónicas de §6.**
  La cadena es la del pie (idéntica, para que la persona reconozca el destino),
  pero §6 enumera "Ver campañas", "Ver puntos de ayuda", "Reportar un cambio"…
  y no esta. Falta la fila; `/docs` no se toca desde aquí.
- **"Ver contacto" sigue en estilo secundario cuando es la única acción de la
  tarjeta.** §3 dice que ninguna tarjeta muestra su única acción en secundario,
  y el handoff acotó el cambio a "Llamar" en las dos tarjetas. Además no es
  obvio que la regla aplique: "Ver contacto" es un control de **revelado**
  (§7), no una acción de destino, y §7 le fija 44 px sin fijarle peso visual.
  Decisión de `design-director`, no de esta fase.

## Decisiones de W8 (aviso de actualización + rótulo del filtro de estado)

Dos cambios de **copy** con su lógica mínima. Nada de `/data`, `/scraper`,
`/docs`, `.github` ni los `vercel.json` se tocó. Las dos cadenas nuevas están
marcadas para ratificación de `design-director`.

### 1. Aviso de actualización en la portada

- **Dónde: en el encabezado, pegado al banner de privacidad.** Los dos son
  avisos permanentes con la misma forma (ⓘ + texto secundario) y enmarcan la
  lista sin competir con ella. La otra sede candidata —junto al conteo
  honesto— se descartó por una razón **medible**: en móvil, la vista mapa
  esconde ese bloque entero (`enMapaMovil ? "hidden lg:block"` en
  `ListaFiltrada`), así que el aviso desaparecería justo cuando la persona
  está eligiendo un punto en el mapa. En el encabezado se ve en las dos
  vistas, en móvil y escritorio, no toca el `aria-live` del conteo y **cuesta
  0 B de JS** (server component puro; el conteo vive dentro del componente
  cliente).
- **El texto se deriva del dato, nunca de una constante.** `prepararDatos()`
  expone `actualizadoHoras` además del `actualizadoHace` de siempre, y el
  aviso elige la frase: con el archivo dentro de la promesa recita el ritmo
  (`"; la última fue hace 3 h"`), y por encima de las 24 h antepone la
  realidad al ritmo (`", pero la última fue hace 3 días"`). No hay redacción
  posible de ese componente que diga "actualizado hoy" sobre un archivo viejo.
  **Con el dataset de hoy** (sello `2026-08-14T19:16:17-05:00`) el aviso ya
  sale en la segunda forma: la build midió **26 h**.
- **`horasDesde()` es hermano de `haceTexto()`, no un refactor de él**
  (`lib/texto.ts`): `haceTexto` produce el "hace N h" de las 67 tarjetas y de
  los pies; compartir tres líneas no valía poner en juego texto ya verificado.
- **Sin mono** (DESIGN.md §2: "si aparece en prosa, es un error de
  implementación") y **sin `role="alert"`**: es contexto permanente, no una
  interrupción. El ⓘ va `aria-hidden` y no es canal único — el texto se lee
  entero sin él (verificado quitando los `[aria-hidden]` del DOM).
- **`<time dateTime={ISO}>`** envuelve el "hace N h": el texto visible es
  relativo y se congela en la build; el atributo lleva el instante absoluto,
  que no envejece. Cuesta 0 B.
- **El pie de la portada ya no repite el "hace N h"** — es la repetición torpe
  que había que resolver, y se conserva la mención de arriba, donde la persona
  decide. `actualizadoHace` pasó a opcional en `PieDatos`; `/campanas`,
  `/acerca` y la 404 lo siguen pasando (ahí es la única mención de frescura).
  Esa línea del pie **no** está en la tabla de §6, así que quitarla de una
  página es implementación reversible, no desviación del sistema.
- **Desviación declarada de §6:** la cadena canónica es "Verifica el punto
  antes de desplazarte: **los horarios y las necesidades cambian rápido**." En
  el aviso va sin la cola. Razón medida, no estética: con ella el aviso ocupa
  **5 líneas (110 px) a 320 px** y 4 (88 px) a 390, y empuja la primera
  tarjeta 22 px más abajo en ambos. La orden está entera en la mitad que se
  conserva y la frase completa sigue literal en `/acerca`, que es a quien §6
  se la asigna.

### 2. El rótulo del filtro de estado

`"Incluir llenos y cerrados"` → **`"Incluir N punto(s) que no recibe(n)"`**
(sin ninguno: `"Incluir los puntos que no reciben"`). Sale de una revisión del
usuario sobre la UI corriendo — *"¿qué significa ese input? ¿que está abierto
y funcionando el lugar?"*—. Las tres fallas y su arreglo:

1. **No decía qué escondía.** Ahora el número lo dice, y de paso revela que la
   lista de arriba es la de los que sí reciben. El conteo respeta ciudad +
   chips + búsqueda (mismo predicado `pasaFiltroFino` que alimenta la lista),
   así que nunca promete puntos que al marcar la casilla no aparecen: con
   `?cat=sangre` no hay ningún no-activo y el rótulo cae solo a su forma
   genérica.
2. **Nombraba dos de los tres estados que oculta** (`pausado` quedaba fuera).
   Ahora es una **regla y no un enumerado** —la forma que DESIGN.md §10 pide—:
   "que no recibe" cubre `lleno`, `pausado`, `cerrado` y cualquier estado
   futuro.
3. **Competía con "abierto/cerrado".** El `estado` contesta "¿sigue
   recibiendo?", no "¿está abierto ahora?" —eso es el `horario`, que solo
   tienen 17 de 204 sitios—. "Recibir" es además el verbo de los chips
   ("Lleno — ya no recibe", "Pausado — no recibe por ahora"): el rótulo es su
   generalización exacta, no vocabulario nuevo.

El `<label>` envolvente conserva su target de **44 px** y `?ver=todos` sigue
funcionando igual (verificado: casilla marcada, 68 tarjetas, conteo "68 puntos
en Bogotá").

**El conteo honesto no se tocó, y la decisión se deja abierta al director.** El
rótulo dice qué revelaría la casilla; la mitad positiva —*la lista que estás
viendo es la de los que sí reciben*— queda implícita y nunca escrita. Cambiar
el h2 es la forma de decirla, pero es cadena fijada en §3/§4C, así que va como
opción costeada en vez de como cambio unilateral. Medido sobre el h2 real
(mono 15/22):

| Variante | 320 px | 390 px |
|---|---|---|
| `67 puntos en Bogotá` (actual) | 1 línea | 1 línea |
| **`67 puntos reciben en Bogotá`** | **1 línea, +0 px** | **1 línea, +0 px** |
| `67 puntos reciben ayuda en Bogotá` | 2 líneas, +22 px | 1 línea, +0 px |
| `67 puntos que siguen recibiendo en Bogotá` | 2 líneas, +22 px | 2 líneas, +22 px |
| `12 de 67 puntos reciben en Bogotá` (con filtros) | 2 líneas, +22 px | 1 línea, +0 px |

La barata es "reciben": **0 px** en el estado por defecto y +22 px a 320 px solo
cuando hay filtros finos. "Reciben" intransitivo no es vocabulario nuevo —es el
verbo de los chips— y "puntos que reciben ayuda" ya es la frase de `/acerca`.

### Dos cosas que este cambio NO puede resolver solo

- **La promesa del ritmo depende de la GitHub Action, que aún no existe.**
  "Esta lista se actualiza sola una vez al día" —y el párrafo nuevo de
  `/acerca`— afirman un ritmo que se vuelve cierto cuando aterrice el workflow
  que otro agente está montando. **Si este cambio se mergea primero, la portada
  afirma algo que todavía no ocurre.** Es una dependencia de orden de merge, no
  un defecto del copy: el texto ya está escrito para que el número real lo
  desmienta solo (rama de "dato viejo") si la Action falla o se apaga.
- **El "hace N h" se congela en la build, y su desfase tiene tope.** El número
  es exacto en el instante de construir; quien abra la página 20 h después lee
  un número 20 h viejo. La rama de `> 24 h` **no** atrapa ese caso —compara
  sello contra build, no sello contra lectura—, así que el diseño de dos ramas
  no debe leerse como "el aviso no puede equivocarse sobre la frescura". Lo que
  sí se puede afirmar: con la publicación diaria el desfase queda acotado a
  ~24 h, y el `<time datetime>` lleva el instante absoluto, que no envejece.
  Corregirlo del todo pediría un reloj en el cliente, que W2 descartó por
  decisión documentada y que costaría JS donde este cambio cuesta 72 B.

### 3. `/acerca` — "Cada cuánto se actualiza"

Reescrita: antes describía solo el camino manual, porque era el único que
existía. Ahora dice el ritmo automático diario, que la persona mantenedora
puede correr el mismo proceso a mano, y que lo que se ve es lo que había en la
última construcción (recargar trae lo último). **La regla de las 72 h se
conserva literal** — sigue siendo cierta (`/validate-data`).

### Evidencia de W8

- **Build limpia**, sin warnings de export. Peso medido a mano con gzip (el
  método que reproduce las cifras de W7): first-load de `/` **109,66 → 109,73
  KB gz (+72 B)**; HTML de `/` +246 B; `/acerca` +113 B; `/campanas` y la 404,
  **0 B**. Total de JS estático del sitio +72 B. Presupuesto ≤ 180 KB.
- **Las dos ramas del aviso, probadas con fixtures** en un clon del repo en el
  scratchpad (`/data` intacto): sello de **3 h** → *"…una vez al día; la última
  fue hace 3 h."*; sello de **80 h** → *"…una vez al día, **pero** la última
  fue hace 3 días."* Con el dato real (26 h) sale la segunda: el aviso no
  puede afirmar el ritmo cuando el archivo lo desmiente.
- **Render real** (Chrome headless, CDP) a 195 / 320 / 360 / 390 / 1280 px:
  **cero desborde horizontal** en los cinco, en las dos ramas. Las cifras van
  por rama, porque son distintas y la que se ve en producción es la primera:

  | | aviso a 320 | 1.ª tarjeta a 320 (fold 568) | 1.ª tarjeta a 390 (fold 844) | a 1280 |
  |---|---|---|---|---|
  | *baseline* | — | 533 | 509 | 539 |
  | **rama normal** (dato del día) | 3 líneas / 66 px | **607** | **583** (261 px de tarjeta visibles) | **569** |
  | rama de dato viejo | 4 líneas / 88 px | 629 | 583 | 569 |

  La **rama normal es la de producción**: la Action publica y Vercel construye
  enseguida, así que la edad en build es ≈ 0. La rama larga solo aparece cuando
  se reconstruye sin datos nuevos — que es justo cuando hay que decirlo.
  **Límite honesto:** a 320×568 —iPhone SE de 1.ª gen— la primera tarjeta queda
  bajo el pliegue; en el baseline asomaba 35 px de sus 366. Cualquier aviso
  permanente cuesta ese asomo: el margen era de 35 px y dos líneas ya valen 44.
  En la pantalla que el contrato describe (gama media, 360–390 px) la tarjeta
  sigue holgadamente en la primera pantalla.
- **La rama plural del rótulo, probada** (el dato real tiene un solo no-activo,
  así que no se ejercitaba sola): fixture con 4 no-activos en Bogotá —uno de
  cada estado, `pausado` incluido— renderiza **"Incluir 4 puntos que no
  reciben"**, 242 px en **una línea** a 320 px, target de **44 px** intacto y
  sin desborde ni siquiera a 195 px. Las tres formas del rótulo (0, 1, N)
  quedan verificadas.
- **Ambas cadenas están en el HTML crudo**, no solo tras hidratar: `grep` sobre
  `out/index.html` encuentra el aviso y `"que no recibe"` (el rótulo vive en un
  componente cliente, así que no era obvio). El camino sin JavaScript conserva
  los dos textos; la cadena vieja no aparece en ningún lado.
- **Contraste medido sobre el fondo real** (estilos computados del DOM, no
  estimados): prosa `#43525F` sobre `#EFF2F5` = **7,16**; imperativo `#1A2530`
  sobre el mismo fondo = **13,83**. Son las dos filas que DESIGN.md §1 ya trae
  medidas: el aviso **no introduce ni un par de color nuevo** ni una superficie
  nueva (es texto sobre el fondo de página; un recuadro tintado habría leído
  como alarma y habría exigido un token que este territorio no puede escribir).
- **Lighthouse móvil, baseline y W8 medidos igual** (3 corridas cada uno,
  sirviendo `out/` con gzip y los 4 headers de `/vercel.json` — sin gzip el
  número se hunde a 79 y no describe lo que Vercel sirve):
  **performance 99 · accesibilidad 100 · best-practices 100 · SEO 100** en los
  dos, con FCP 907–909 ms, LCP 2004–2007 ms, TBT 0 y CLS 0,000. El 99 es el
  estado que W7 dejó declarado; **W8 no lo mueve** (LCP a 3 ms del baseline).
- **Sin regresiones:** el diff del texto visible de `/` contra el baseline son
  exactamente las tres líneas de este cambio (aviso +, rótulo modificado, eco
  del pie −); el conjunto de hosts externos de `out/` es **idéntico** (48); 0
  contactos personales en claro (los 7 blobs ofuscados se decodificaron y se
  buscó cada nombre y cada número en `out/`: 0 apariciones); el chunk de
  Leaflet (`d0deef33.*.js`) **no** aparece en el HTML de ninguna ruta; 0
  violaciones de CSP con los headers reales.

## Pendiente de fases siguientes

- **W6** (QA + privacidad): Lighthouse móvil, matriz de edge cases y
  `/privacy-audit` sobre código y `out/`.
- **W7** (ship): fijar `SITIO_URL` con el dominio real, verificar los headers
  en producción con `curl -I` (ver la nota de arriba) y documentar el deploy.
- Ícono PNG del manifest (192/512) si alguna vez se busca instalabilidad real
  en Android; hoy el manifest declara solo el SVG local, coherente con
  `display: "browser"`.
