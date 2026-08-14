# /web — Mapa de Ayuda

Página estática (Next.js App Router + TypeScript + Tailwind v4, `output: 'export'`)
que muestra los puntos de ayuda del terremoto. La gobierna `docs/DESIGN.md`
(sistema de diseño aprobado — ley para la UI) y `docs/MASTER_PROMPT.md` Parte 2.

## Comandos

```bash
npm run dev     # desarrollo (turbopack)
npm run build   # produce web/out/ (build clásico webpack; ver nota abajo)
```

No hay `npm start`: no existe servidor. `out/` se sirve como archivos estáticos
(Vercel, root directory `web`).

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
  "Ver contacto". Además, `prepararDatos()` **rompe la build** si un nombre o
  celular personal aparece en claro en el payload (garantía estructural, cubre
  datos futuros del pipeline).

## Decisiones de W2

- **Next 15.5.23 (major 15 fijado)** con React 19.1 y Tailwind v4: terreno
  conocido y compatible con react-leaflet v5 (W3). Las advisories de `npm audit`
  (postcss bundled en next, sharp) son herramientas de build con inputs propios
  del repo; su "fix" es Next 16 (breaking) — riesgo aceptado y documentado.
- **`next build` clásico (webpack), no turbopack:** turbopack no resuelve el
  import de `/data/sitios.json` fuera del root del paquete.
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
  `--color-pausado-punto`.
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
  `[inicializado, cats, ciudad, verTodos, q]` — `pos` no aparece ni en las
  dependencias ni en el cuerpo).
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
  nadie quiere reabrir el sitio con una búsqueda vieja pegada.
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

## Pendiente de fases siguientes

- W5: "Acerca de" (incluye el crédito OSM con link), OG image, y
  `vercel.json` con la CSP del contrato (el `'unsafe-inline'` de script-src
  es el tradeoff conocido del export estático). La CSP ya contempla
  `img-src https://tile.openstreetmap.org` para los tiles.
