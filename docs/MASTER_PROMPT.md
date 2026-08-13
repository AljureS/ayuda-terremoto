# MASTER PROMPT — Mapa de Ayuda: Terremoto de Colombia (10 de agosto de 2026)

## Rol

Actúa como desarrollador principal de un proyecto cívico de emergencia. El objetivo es lanzar rápido algo confiable, ligero y fácil de mantener por una sola persona. Prioriza simplicidad sobre sofisticación: cada dependencia extra es un riesgo.

## Contexto

El 10 de agosto de 2026 un terremoto de magnitud 7.4, con epicentro en San José del Palmar (Chocó), afectó gravemente a Quibdó, Cali, Pereira, Dosquebradas, Manizales y otros municipios del occidente de Colombia. En Bogotá se activaron puntos de acopio, donación de sangre y voluntariado para ayudar a las zonas afectadas.

Vamos a construir una página web centralizada donde cualquier persona en Bogotá pueda encontrar **el punto de ayuda más cercano**, filtrado por categoría (alimentos, mascotas, materiales de construcción, sangre, voluntariado, etc.). Debe poder escalar después a otras ciudades de Colombia. El deploy será en **Vercel**. Por ahora los datos los actualizo yo manualmente, alimentados por un scraper de fuentes oficiales.

## Estructura del proyecto (monorepo)

```
/scraper    → recolección e importación de datos desde fuentes oficiales
/web        → la página web (Next.js, deploy en Vercel)
/data       → fuente única de verdad: sitios.json (+ carpeta /data/import para CSVs manuales)
README.md
```

**Regla de oro:** `/scraper` y `/web` no comparten código ni se importan entre sí. Se comunican **únicamente** a través de `/data/sitios.json`. La web debe poder funcionar aunque el scraper no exista.

---

## Fase 0 — Importar los datos existentes (hazlo primero)

Ya existe una hoja de cálculo pública de Google Sheets con puntos recopilados por la comunidad. Descárgala directamente como CSV con estas URLs (pruébalas en orden):

1. `https://docs.google.com/spreadsheets/d/106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U/export?format=csv&gid=1375250837`
2. Fallback: `https://docs.google.com/spreadsheets/d/106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U/gviz/tq?tqx=out:csv&gid=1375250837`

La hoja puede tener varias pestañas (gids distintos). Inspecciona `https://docs.google.com/spreadsheets/d/106XcWaBgaxFG-Y8R14bTOq9E2igE9Zu3bVaU_g5jc6U/htmlview` para descubrir los demás gids e impórtalos todos.

Crea `/scraper/import-sheet.ts` que:
- Descargue el/los CSV.
- Muestre las columnas encontradas y proponga un mapeo al schema canónico (abajo) antes de convertir.
- Genere el primer `/data/sitios.json` real.
- Si la descarga falla, deja el script listo para leer CSVs desde `/data/import/` y dime exactamente qué archivo poner ahí.

## Schema canónico (`/data/sitios.json`)

```json
{
  "actualizado": "2026-08-12T00:00:00-05:00",
  "sitios": [
    {
      "id": "slug-unico-estable",
      "nombre": "",
      "categorias": ["alimentos"],
      "descripcion": "Qué reciben o qué se necesita ahí",
      "direccion": "",
      "ciudad": "Bogotá",
      "localidad": "",
      "lat": 4.6486,
      "lng": -74.0628,
      "horario": "",
      "contacto": { "telefono": "", "web": "", "instagram": "" },
      "fuente": "URL oficial de donde salió el dato",
      "estado": "activo",
      "verificado": true,
      "manual": false,
      "ultimaActualizacion": "2026-08-12T00:00:00-05:00"
    }
  ]
}
```

- `categorias` es un enum fijo: `alimentos`, `agua`, `ropa_abrigo`, `mascotas`, `construccion`, `medicamentos`, `sangre`, `voluntariado`, `dinero`, `acopio_general`. Un sitio puede tener varias.
- `estado`: `activo` | `lleno` | `pausado` | `cerrado`. Esto es clave: los puntos dejan de recibir donaciones y debo poder marcarlo editando una sola línea.
- `manual: true` significa que yo edité ese registro a mano: **el scraper jamás lo sobreescribe**.
- Valida todo el JSON con `zod` antes de escribirlo. Script `npm run validate`.

---

## Parte 1 — `/scraper`

- **Stack:** Node.js + TypeScript. `cheerio` para HTML estático; Playwright solo si una fuente lo hace inevitable (justifícalo antes de agregarlo).
- **Comandos:** `npm run import:sheet`, `npm run scrape`, `npm run geocode`, `npm run build:data` (pipeline completo: importar → scrapear → geocodificar → dedupe → merge respetando `manual: true` → validar → escribir `/data/sitios.json`).
- **Fuentes objetivo** (verifica que sigan vigentes y busca las páginas específicas de esta emergencia):
  - Alcaldía de Bogotá — `bogota.gov.co` (ya publicó listados oficiales de puntos de acopio, p. ej. `/mi-ciudad/seguridad/puntos-de-donacion-en-bogota-para-damnificados-terremoto-en-colombia` y `/mi-ciudad/ambiente/alcaldia-de-bogota-habilito-cuatro-puntos-de-donaciones-terremoto`)
  - Cruz Roja Colombiana — `cruzrojacolombiana.org` (varias sedes en Bogotá reciben 24h)
  - IDIGER — `idiger.gov.co` (gestión de riesgo de Bogotá)
  - UNGRD — `gestiondelriesgo.gov.co` (nivel nacional)
  - Defensa Civil — `defensacivil.gov.co`
  - Banco de Alimentos de Bogotá — `bancodealimentos.org.co`
  - IDPYBA — `proteccionanimalbogota.gov.co` (categoría mascotas)
  - IDCBIS / Hemocentro Distrital — `idcbis.org.co` (categoría sangre)
  - Campañas activas a rastrear: "Colombia, un solo corazón" y "El Chocó te Necesita" (busca sus páginas/comunicados oficiales).
- **Ética de scraping (no negociable):** respetar `robots.txt`, mínimo 2 segundos entre requests, User-Agent identificable con un correo de contacto, solo fuentes oficiales o institucionales, y guardar siempre el campo `fuente`. Nada de scraping agresivo: esto es un proyecto humanitario y debe comportarse como tal.
- **Geocodificación:** Nominatim (OpenStreetMap), máximo 1 request/segundo, con caché local en `/scraper/cache/geocode.json` para nunca geocodificar dos veces la misma dirección. Las direcciones bogotanas ("Carrera 4 #22-61") a veces fallan en Nominatim: normalízalas (Carrera→Cra, agregar ", Bogotá, Colombia") y si aun así falla, deja `lat/lng` en `null` y repórtame la lista para ubicarlas a mano.
- **Dedupe:** dos registros son el mismo sitio si el nombre normalizado coincide o si están a menos de 100 m con categorías similares. En conflicto gana el registro con `manual: true`, luego el más reciente.

## Parte 2 — `/web`

- **Stack:** Next.js (App Router) + TypeScript + Tailwind. **Sitio 100% estático** (`output: 'export'` o SSG puro): sin API routes, sin backend, sin base de datos. Los datos entran en build time desde `/data/sitios.json`. Actualizar datos = editar el JSON y hacer push (Vercel redeploya solo).
- **Mapa:** Leaflet + `react-leaflet` con tiles de OpenStreetMap. **Nada de Google Maps ni API keys.** Markers con color por categoría. Popup con detalle y botón "Cómo llegar" que abre `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG` (deep link, no requiere key).
- **Funcionalidad principal:**
  - Toggle vista mapa / vista lista. En lista, tarjetas con: nombre, categorías (badges), qué reciben, dirección, horario, estado, distancia (si hay ubicación), fuente (link) y fecha de última actualización.
  - Filtros por categoría (chips multiselección), filtro por estado (por defecto solo `activo`) y búsqueda por texto (nombre, dirección, localidad).
  - Botón "📍 Usar mi ubicación": pide permiso con `navigator.geolocation`, calcula distancia con fórmula de Haversine **en el cliente** y ordena la lista de más cercano a más lejano.
  - Selector de ciudad preparado desde ya (campo `ciudad` en el schema); se oculta mientras solo exista Bogotá.
- **Privacidad (requisito duro, verifícalo dos veces):**
  - La ubicación del usuario **nunca sale de su dispositivo**. Ni a un servidor nuestro (no hay), ni a analytics, ni a logs, ni en la URL.
  - Cero cookies. Cero analytics de terceros. Los únicos requests externos permitidos son los tiles de OSM.
  - `localStorage` solo con opt-in: guardar filtros elegidos y, si el usuario marca "recordar mi ubicación", la última posición. Incluir botón visible "Borrar mis datos" que limpia todo el `localStorage`.
  - Banner corto y claro en la UI: "Tu ubicación se usa solo en tu dispositivo y nunca se envía a ningún servidor."
  - Agrega una Content-Security-Policy estricta acorde.
- **Contenido fijo:**
  - Página/sección "Acerca de": qué es esto, disclaimer ("verifica el punto antes de desplazarte, los horarios y necesidades cambian rápido"), cómo reportar un cambio (mailto o link que yo te daré), y crédito a las fuentes oficiales.
  - Metadatos SEO + Open Graph en español, pensados para compartirse por WhatsApp (título, descripción e imagen OG legibles en preview pequeño).
- **Rendimiento y acceso:** mobile-first (el uso real será desde un celular, a veces en 3G), Lighthouse de performance > 90, targets táctiles grandes, contraste AA, `prefers-reduced-motion` respetado, todo el copy en español con voz activa ("Dona aquí", "Cómo llegar").

### Dirección de diseño

Es un sitio de emergencia humanitaria: claridad absoluta por encima de decoración. Antes de codear, propón un mini sistema de diseño (paleta de 4–6 colores con hex, 2 tipografías con roles definidos, concepto de layout) y justifícalo. Lineamientos:
- Sobrio y confiable, no alarmista: evita rojo sangre como color dominante; piensa en los códigos visuales de ayuda humanitaria.
- Tipografía grande y legible; jerarquía clara; los badges de categoría y el estado (`activo`/`lleno`) deben leerse de un vistazo.
- Un solo elemento distintivo y memorable (por ejemplo, el tratamiento visual de la distancia o de los estados); todo lo demás quieto y disciplinado. Nada que parezca plantilla genérica.

---

## Parte 3 — Operación y documentación

`README.md` en la raíz con:
- Cómo correr cada comando del scraper y qué hace el pipeline.
- Cómo editar un sitio a mano (ejemplo concreto: marcar un punto como `lleno`).
- Cómo hacer el primer deploy en Vercel y cómo funciona el redeploy al hacer push.
- Cómo agregar una ciudad nueva en el futuro.

**No implementar ahora** (solo dejar el terreno listo): panel de administración, formulario público de reportes, notificaciones.

## Orden de trabajo

1. Scaffolding del monorepo + schema + validación con zod.
2. Fase 0: importador del Google Sheet → primer `/data/sitios.json` real. Muéstrame las columnas que encontraste y el mapeo propuesto antes de convertir.
3. Web funcional con esos datos: mapa, lista, filtros, geolocalización y distancia.
4. Scraper de fuentes oficiales + pipeline completo de merge.
5. README + checklist de deploy en Vercel.

Empieza presentándome un plan corto de la fase 1. Pregúntame solo lo que sea bloqueante; para el resto, decide tú y documenta la decisión.
