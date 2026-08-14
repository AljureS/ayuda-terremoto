# DESIGN.md — Sistema de diseño · Mapa de Ayuda

> **APROBADO por el usuario (2026-08-14, gate W1 de `docs/PLAN_WEB.md`).**
> Este documento es **ley para la UI**: toda pantalla, componente y cadena de texto de `/web` se revisa contra él. Los cambios al sistema se escriben aquí primero y luego se aplican, nunca al revés.
>
> Decisiones aprobadas: sistema general (paleta/tipografía/layout) ✅ · elemento distintivo = **A, «riel de rumbo»** (§4) ✅ · contactos con nombre de persona = **revelado al tocar** (§7) ✅.

---

## 0. Principio rector

Es un sitio de emergencia humanitaria que se usa con estrés, con prisa y desde un celular, a veces en 3G y a pleno sol. **Claridad absoluta por encima de decoración: cada elemento que no informa, estorba.** El sistema es sobrio y confiable — códigos de ayuda humanitaria (azul institucional, neutros fríos), nunca de alarma. Un solo elemento distintivo; todo lo demás quieto y disciplinado.

Realidades del dato que moldean cada decisión (pipeline 2026-08-13):

| Realidad | Consecuencia de diseño |
|---|---|
| 204 sitios en ~28 ciudades | Selector de ciudad visible desde el día 1 (default: Bogotá, 68 sitios) |
| Solo ~20 sitios con coordenadas | **La lista es el héroe**; el mapa es mejora progresiva con conteo honesto |
| 49 sitios sin ciudad ni punto físico | Ruta propia "Campañas nacionales", jamás mezclados con "cerca de ti" |
| Estados ya trabajando (1 `lleno` real) | Semántica de estados legible de un vistazo, siempre texto + color |
| 5 contactos con nombre de persona + celular | Decisión explícita de render (§7) |

---

## 1. Paleta

Seis colores núcleo (3 cromáticos + familia neutra) más los semánticos de estado. El azul institucional es el único color de marca; el verde y el ámbar existen solo como semántica de estado. **El rojo no existe en el sistema núcleo**: aparece únicamente como color de la categoría `sangre` (§5), contenido en badges y markers.

| Token | Hex | Rol |
|---|---|---|
| `tinta` | `#1A2530` | Texto principal (azul-pizarra casi negro, no negro puro) |
| `secundario` | `#43525F` | Texto secundario: dirección, horario, metadatos |
| `fondo` | `#EFF2F5` | Fondo de página (gris frío muy claro) |
| `superficie` | `#FFFFFF` | Tarjetas, barras, controles |
| `borde` | `#D4DBE1` | Bordes de tarjeta e inputs (1 px; no-texto) |
| `accion` | `#0A5CA8` | Primario: botones, links, foco, chip de filtro activo |

Semánticos de estado (chip = tinte de fondo + punto ● + **palabra siempre**; el color nunca es el único canal):

| Estado | Texto | Tinte fondo | Punto ● | Forma del chip |
|---|---|---|---|---|
| `activo` | `#166B31` | `#DEF2E2` | `#1E7A3C` | ● Activo |
| `lleno` | `#7A4F06` | `#FBEED0` | `#B8860B` | ● Lleno — ya no recibe |
| `pausado` | `#49565F` | `#E8EBEE` | `#85929D` | ● Pausado |
| `cerrado` | `#FFFFFF` | sólido `#333E48` | — | Cerrado (chip invertido: se lee "apagado") |

### Contraste WCAG calculado (no estimado)

Todos los pares que se usan juntos, con la razón calculada por luminancia relativa (WCAG 2.x). AA texto = 4.5:1 · AA no-texto (1.4.11) = 3.0:1.

| Par en uso | Razón | Criterio | Veredicto |
|---|---|---|---|
| `tinta` sobre `superficie` | **15.54** | 4.5 | AAA |
| `tinta` sobre `fondo` | **13.83** | 4.5 | AAA |
| `secundario` sobre `superficie` | **8.04** | 4.5 | AAA |
| `secundario` sobre `fondo` | **7.16** | 4.5 | AAA |
| Blanco sobre `accion` (botón primario) | **6.75** | 4.5 | AA ✓ |
| `accion` sobre `superficie` (links) | **6.75** | 4.5 | AA ✓ |
| `accion` sobre `fondo` (links, anillo de foco) | **6.01** | 4.5 / 3.0 | AA ✓ |
| `activo`: texto sobre tinte | **5.63** | 4.5 | AA ✓ |
| `activo`: punto ● sobre `superficie` | **5.38** | 3.0 no-texto | ✓ |
| `lleno`: texto sobre tinte | **6.19** | 4.5 | AA ✓ |
| `lleno`: punto ● sobre `superficie` | **3.25** | 3.0 no-texto | ✓ |
| `pausado`: texto sobre tinte | **6.31** | 4.5 | AA ✓ |
| `pausado`: punto ● sobre `superficie` | **3.18** | 3.0 no-texto | ✓ |
| `cerrado`: blanco sobre sólido | **10.92** | 4.5 | AAA |

(Contrastes de las 10 categorías: tabla completa en §5.)

Reglas duras de color:
- El rojo jamás domina: ninguna superficie, banner o botón primario es rojo. Solo `sangre` (§5) lo usa, en badge y marker.
- Ningún significado viaja solo en color: estado = punto + palabra; categoría = color + etiqueta; distancia = cifra + unidad.
- No hay modo oscuro en v1 (decisión): un solo tema claro de máximo contraste, pensado para pantallas baratas a pleno sol. Se documenta aquí si algún día cambia.

---

## 2. Tipografía

**Restricción dura (arquitectura §3, decisión 10): cero requests externos.** Evaluación honesta de las dos opciones reales:

| Opción | Costo | Riesgo |
|---|---|---|
| System stack | **0 KB, 0 requests, render inmediato** | Menos identidad tipográfica |
| Self-hosted subseteada (p. ej. una sans Latin, 2 pesos woff2) | 60–90 KB ≈ **1.5–3 s extra en 3G real**, contra un presupuesto total de JS ≤ 180 KB gz | FOUT/FOIT en el primer render — exactamente el momento en que la persona más necesita leer |

**Recomendación: system stack, sin disculpas.** En una herramienta de emergencia la identidad no puede costar segundos; la arquitectura ya acepta este tradeoff y lo compensa el elemento distintivo (§4). La personalidad tipográfica sale del **uso** (roles, pesos, tabulación), no de un archivo de fuente.

Dos tipografías con roles definidos, ambas del sistema:

| Rol | Stack | Uso |
|---|---|---|
| **Sans — todo el texto** | `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif` | Títulos, tarjetas, controles, cuerpo. En Colombia el parque real es mayoritariamente Android → renderiza Roboto/Noto: legibles, neutras, nativas |
| **Mono — cifras operativas** | `ui-monospace, "SF Mono", "Roboto Mono", "Cascadia Mono", monospace` + `font-variant-numeric: tabular-nums` | **Solo** distancia, rumbo, conteos ("20 de 204") y horarios. Es la voz "de radio de campaña" del sitio: datos operativos que se alinean en columna y se distinguen de la prosa de un vistazo |

El mono se usa con avaricia — si aparece en prosa, es un error de implementación.

Escala (base ≥ 16 px, sin tamaños intermedios caprichosos):

| Token | Tamaño/interlínea | Peso | Uso |
|---|---|---|---|
| `texto-meta` | 13/18 | 400 | Fuente, "actualizado hace X h" — nunca para información crítica |
| `texto-sec` | 15/22 | 400 | Dirección, horario, descripción |
| `texto-base` | 16/24 | 400 | Cuerpo, controles, inputs (16 px evita el zoom automático de iOS) |
| `titulo-tarjeta` | 18/24 | 600 | Nombre del sitio |
| `titulo-seccion` | 22/28 | 700 | Encabezados de sección |
| `titulo-pagina` | 28/34 | 700 | H1 |
| `cifra` (mono) | 18/24 | 600 | La distancia en la tarjeta; conteos |

---

## 3. Layout

### Mobile (320–430 px) — la vista que manda

Lista por defecto, mapa bajo demanda. Justificación: solo 20/204 sitios tienen coordenadas (el mapa hoy es la vista incompleta) y en 3G el chunk de Leaflet no debe pagarse de entrada. La lista completa viene pre-renderizada en el HTML: es contenido útil al primer byte.

```
┌──────────────────────────────────┐
│ Mapa de Ayuda                    │  header 1 sola vez (no sticky)
│ Terremoto en Colombia · Ago 2026 │
│ ⓘ Tu ubicación se usa solo en tu │  banner privacidad (permanente,
│   dispositivo y nunca se envía…  │  1 línea colapsable)
├──────────────────────────────────┤
│ [Bogotá ▾]  [🔍 Buscar…]  [Mapa] │  ← BARRA STICKY (56 px): ciudad,
├──────────────────────────────────┤    búsqueda, toggle mapa/lista
│ (Alimentos)(Agua)(Sangre)(Ropa)→ │  chips scroll horizontal (no sticky)
│ ☐ Incluir llenos y cerrados      │  filtro de estado (default: solo activo)
├──────────────────────────────────┤
│ ▸ Campañas y convocatorias       │  tarjeta de acceso fija: los 49 sin
│   nacionales (49) — ayuda desde  │  punto físico viven en /campanas,
│   cualquier lugar                │  jamás dentro de la lista local
├──────────────────────────────────┤
│ 68 puntos en Bogotá ·            │  línea de conteo honesto (mono)
│ [📍 Usar mi ubicación]           │  botón secundario, solo on-tap
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ TARJETA DE SITIO             │ │  (jerarquía abajo)
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
└──────────────────────────────────┘
```

- **Sticky solo la barra de 56 px** (ciudad + búsqueda + toggle): en un viewport de 568 px no se sacrifica más. Los chips se quedan arriba — se configuran una vez.
- Selector de ciudad: `<select>` nativo (teclado del sistema, cero JS extra), ciudades ordenadas por número de sitios, con conteo: "Bogotá (68)". Sin opción "todas" en v1: la pregunta del producto es local.
- Toggle **[Mapa]** carga Leaflet recién al tocarlo (chunk separado). Al abrir, muestra el conteo honesto (§6).
- `/campanas`: ruta estática propia con las 46 campañas de dinero + 3 convocatorias nacionales. Tarjeta sin dirección/distancia, con "Dona aquí" como acción única. Compartible por WhatsApp — es exactamente el contenido que más se reenvía.

### Jerarquía exacta de la tarjeta de sitio

Orden de lectura: **nombre → estado → distancia → categorías → qué reciben → dirección/horario → fuente**.

```
┌────────────────────────────────────────┐
│ Cruz Roja — Sede Ándes        ↗ 1,2 km │ ① nombre (18/600) + ② riel de
│ ● Activo                               │    rumbo (mono, §4)
│ (Alimentos)(Agua)(Medicamentos)        │ ③ estado (chip) ④ categorías
│ Reciben alimentos no perecederos,      │ ⑤ qué reciben (15px, máx 2 líneas)
│ agua y kits de aseo.                   │
│ Cra 4 #22-61, Chapinero                │ ⑥ dirección + horario (15px sec.)
│ Lun–Dom 8:00–18:00                     │
│ ┌──────────────┐                       │
│ │  Cómo llegar │  Fuente ↗ · hace 3 h  │ ⑦ acción única (44px, solo si hay
│ └──────────────┘                       │    coords) + fuente y frescura (13px)
└────────────────────────────────────────┘
```

- La tarjeta ES el detalle: no hay navegación a página de sitio. Una sola acción primaria ("Cómo llegar", deep link a Google Maps con la coordenada **del sitio**).
- Estado ≠ activo: el chip cambia y, en `cerrado`/`lleno`, "Cómo llegar" desaparece (no se invita a ir a donde no reciben).
- Teléfono: si existe, segunda acción `tel:` "Llamar" (44 px). Contactos con nombre de persona: §7.

### Desktop (≥ 1024 px)

Lista y mapa lado a lado; los filtros **no** son sidebar (10 chips caben en una fila; una sidebar desperdicia ancho y huele a plantilla de admin).

```
┌──────────────────────────────────────────────────────────────┐
│ Mapa de Ayuda · banner privacidad                            │
│ [Bogotá ▾] [🔍 Buscar…] (Alimentos)(Agua)(Sangre)… ☐ llenos  │  filtros: 1 barra horizontal
├──────────────────────┬───────────────────────────────────────┤
│ 68 puntos · [📍]     │                                       │
│ ┌──────────────────┐ │                                       │
│ │ tarjeta          │ │            MAPA (sticky,              │
│ └──────────────────┘ │            llena el alto)             │
│ ┌──────────────────┐ │                                       │
│ │ tarjeta          │ │   "20 de 204 puntos ubicados          │
│ └──────────────────┘ │    en el mapa" (esquina, mono)        │
│  lista scrolleable   │                                       │
│  (~460 px)           │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

- La lista sigue siendo la columna primaria (izquierda, orden de lectura); el aside del mapa muestra el conteo honesto + botón "Ver mapa" y el mapa se monta **al pedirlo** (ratificado en W3: montarlo al entrar al breakpoint costaría ~50 KB gz + 200–400 KB de tiles en cada visita desktop para un mapa que hoy ubica 20 de 204 puntos; quien lo quiere lo paga en ~1 s, quien no, paga 0).
- Hover en tarjeta resalta su marker y viceversa (refuerzo, nunca canal único).
- Entre 640–1023 px: layout mobile con márgenes crecientes (sin variante intermedia que mantener).

---

## 4. EL elemento distintivo — 3 candidatos, 1 recomendación

El contrato pide exactamente uno. Todo lo demás queda quieto.

### Candidato A — «El riel de rumbo» (recomendado)

El borde derecho de cada tarjeta es una columna fija en mono donde vive la distancia con su **flecha de rumbo real** (bearing geográfico, norte arriba — mismo marco que el mapa), calculada con la misma matemática de Haversine que ya corre en el cliente. Al ordenar por cercanía, el riel se convierte en la columna vertebral visual de la lista: una regla graduada de la ayuda.

```
…antes del permiso:          …con ubicación:            …sin coordenadas:
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│ Sitio A      │            │ Sitio A  ↗   │            │ Sitio K      │
│              │            │       1,2 km │            │              │
└──────────────┘            └──────────────┘            └──────────────┘
(riel vacío,                ┌──────────────┐            + un solo separador al
 el botón 📍                │ Sitio B  →   │              final de la lista:
 invita)                    │       3,8 km │            ── Sin ubicación exacta
                            └──────────────┘               todavía (48) ──
```

- **Por qué es el distintivo correcto:** es información pura (qué tan lejos y hacia dónde), nace del corazón del producto ("el punto más cercano"), cuesta 0 KB (SVG inline de 1 flecha + mono del sistema), y **solo aparece cuando la persona ejerce la acción privada** — el elemento memorable del sitio es la recompensa visible de que la promesa de privacidad es real.
- Absorbe la honestidad del dato: los sitios sin coordenadas no fingen — un único separador los agrupa al final ("sin ubicación exacta todavía"), en la misma voz mono del riel.
- Riesgo asumido (el único del sistema): la flecha norte-arriba exige una pizca de lectura de mapa. Mitigación: `aria-label` y `title` "Dirección desde tu ubicación, norte arriba"; la cifra en km siempre manda y la flecha solo acompaña.

### Candidato B — «El filo de estado»

Cada tarjeta lleva un filo izquierdo de 3 px del color del estado; una lista sana es un canto verde continuo y un `lleno` ámbar salta de inmediato.

```
┃┌─────────────┐   ┃ verde = activo
┃│ Sitio A     │   ┋ ámbar = lleno
┃└─────────────┘
```

- A favor: escaneo instantáneo del estado. En contra: es el patrón de toda tarjeta de notificación/alerta de cualquier template — reconocible, no memorable. Y hoy hay 203 activos y 1 lleno: el filo sería decoración verde repetida 203 veces. **Descartado como distintivo**; el chip de estado (§1) ya cumple.

### Candidato C — «El tablero honesto»

El conteo como voz del sitio, en mono, en todas partes: "68 puntos en Bogotá", "20 de 204 ubicados en el mapa", "hace 3 h". El sitio rinde cuentas de su propio dato en cada pantalla.

- A favor: convierte la debilidad del dato (incompleto, cambiante) en credibilidad. En contra: es dirección de contenido más que forma visual — le falta cuerpo para ser EL distintivo.
- **Se adopta como regla de copy (§6) subordinada al candidato A**, que ya habla en esa misma voz mono.

**Recomendación: A**, con C absorbido como su regla de voz. B se descarta. → **Decisión pendiente del usuario.**

---

## 5. Sistema badge = marker (10 categorías)

Un solo sistema de color compartido: el badge de la lista (texto oscuro sobre tinte) y el marker del mapa (círculo sólido) usan los mismos hex por categoría. Contrastes calculados:

| Categoría | Etiqueta visible | Sólido (marker / texto badge) | Tinte (fondo badge) | txt/tinte | blanco/sólido |
|---|---|---|---|---|---|
| `acopio_general` | Acopio | `#3D5A76` azul pizarra | `#E4EBF1` | **5.97** | **7.19** |
| `alimentos` | Alimentos | `#B0490B` naranja | `#FBEBDD` | **4.74** | **5.52** |
| `agua` | Agua | `#0A6E97` cian | `#DFF0F8` | **4.87** | **5.69** |
| `sangre` | Sangre | `#A81E22` rojo contenido | `#F9E5E4` | **6.04** | **7.31** |
| `medicamentos` | Medicamentos | `#0D7362` verde azulado | `#DDF1EC` | **4.90** | **5.76** |
| `construccion` | Construcción | `#7A4A21` marrón ladrillo | `#F4E9DE` | **6.21** | **7.42** |
| `ropa_abrigo` | Ropa y abrigo | `#6D3FA5` violeta | `#EFE7F8` | **6.01** | **7.23** |
| `voluntariado` | Voluntariado | `#41499F` índigo | `#E7E9F8` | **6.50** | **7.84** |
| `dinero` | Dinero | `#59650E` oliva | `#EEF1D8` | **5.53** | **6.38** |
| `mascotas` | Mascotas | `#AC2166` magenta | `#FAE4EE` | **5.50** | **6.64** |

Todos los textos de badge superan AA (≥ 4.5) y todos los glifos blancos sobre sólido superan incluso 4.5 (el mínimo exigible para no-texto es 3.0).

Asignación con lógica semántica donde existe (sangre=rojo — único rojo del sistema —, alimentos=naranja, agua=cian, construcción=ladrillo, medicamentos=verde farmacia) y separación máxima donde no. Hueco deliberado en el verde puro y el ámbar puro: reservados para los estados `activo` y `lleno` (dinero es oliva, no verde billete, para no rozar el chip de activo).

Honestidad sobre los pares más cercanos a tamaño chico: (sangre, mascotas), (violeta, índigo), (naranja, marrón), (cian, verde azulado). Por eso **el color jamás va solo**: el badge siempre lleva su etiqueta; el marker lleva glifo y popup.

Spec del marker (`L.divIcon`, SVG inline, cero assets externos):
- Círculo de 28 px, relleno sólido de la **primera** categoría del sitio, aro blanco de 2 px (halo que lo separa de cualquier tile), sombra 0 1px 2px rgba(16,24,32,0.3).
- Glifo blanco interior: mini-ícono SVG propio por categoría (10 paths dibujados a mano, ≤ 200 bytes c/u; iniciales no sirven — Alimentos/Agua/Acopio colisionan).
- Target táctil efectivo ≥ 44 px (padding invisible del divIcon).
- Sitio con varias categorías: manda la primera del array; el popup lista todas como badges.
- Estados ≠ activo en el mapa (solo si el filtro los incluye): marker desaturado a `#85929D` con aro blanco; el popup muestra el chip de estado.

---

## 6. Microcopy — el copy es interfaz

Reglas: español, voz activa, **imperativo neutro consistente** (la forma del contrato: "Dona aquí", "Verifica el punto", "Tu ubicación" — jamás formas con "usted", jamás mezclar registros). Frases cortas. Sin anglicismos evitables. Los conteos y cifras van en mono (regla heredada del candidato C): el sitio siempre dice cuánto sabe y cuánto no.

| Momento | Texto exacto |
|---|---|
| **Banner de privacidad** (permanente, contrato) | "Tu ubicación se usa solo en tu dispositivo y nunca se envía a ningún servidor." |
| **Antes del permiso de ubicación** (al tocar 📍, previo al prompt del navegador) | "Para ordenar los puntos del más cercano al más lejano, el navegador va a pedir permiso de ubicación. El cálculo ocurre en tu teléfono: la ubicación no se envía a ningún servidor, no se guarda sin tu permiso y nunca aparece en el enlace." — Botones: **[Usar mi ubicación]** **[Ahora no]** |
| Opt-in de recordar (checkbox junto a lo anterior, desmarcado) | "Recordar mi ubicación en este dispositivo" |
| **Permiso denegado** | "Sin el permiso, la lista no se puede ordenar por cercanía — pero sigue completa. Busca por dirección o localidad, o activa la ubicación para este sitio en la configuración del navegador." |
| Ubicación no disponible / timeout | "No se pudo obtener tu ubicación. Intenta de nuevo donde haya mejor señal." |
| Contexto inseguro / sin soporte | "Este navegador no permite usar la ubicación aquí. La lista completa sigue disponible." |
| **Sin resultados** (filtros/búsqueda) | "Ningún punto coincide con esta búsqueda. Quita algún filtro o revisa otra categoría. Las campañas nacionales reciben ayuda desde cualquier lugar." — Acciones: **[Quitar filtros]** **[Ver campañas]** |
| Ciudad sin sitios de la categoría | "Todavía no hay puntos de esta categoría en {ciudad}. Mira las campañas nacionales o revisa otra ciudad." |
| **Tiles del mapa caídos** | "El mapa no cargó. Revisa tu conexión o vuelve a la lista: tiene la misma información." — Acción: **[Volver a la lista]** |
| **Conteo honesto del mapa** (siempre visible en vista mapa) | "20 de 204 puntos ubicados en el mapa. El resto está en la lista." (cifras dinámicas, mono) |
| Separador de no ubicados (fin de lista ordenada) | "— Sin ubicación exacta todavía (48) —" |
| localStorage bloqueado | "El navegador no permite guardar preferencias en este dispositivo. Todo funciona igual; los filtros no se recordarán." |
| **Botón borrar** (siempre visible en el pie) | "Borrar mis datos" |
| Confirmación de borrar | "Se borrarán los filtros guardados y la ubicación recordada de este dispositivo. El sitio sigue funcionando normal." — **[Borrar]** **[Cancelar]** → al confirmar: "Datos borrados." |
| **Disclaimer "Acerca de"** (contrato) | "Verifica el punto antes de desplazarte: los horarios y las necesidades cambian rápido." |
| Frescura del dato (pie de tarjeta) | "hace 3 h" / "hace 2 días" (desde `ultimaActualizacion`) |
| Dato comunitario sin confirmar (`verificado: false`) | "Reporte de la comunidad — sin confirmar" (texto 13 px junto a la fuente; nunca un color de alarma) |
| Acciones canónicas | "Cómo llegar" · "Llamar" · "Dona aquí" · "Ver campañas" · "Usar mi ubicación" · "Quitar filtros" · "Reportar un cambio" |

SEO / Open Graph (semilla para W5, verificada en caracteres):
- `<title>`: **"Mapa de Ayuda — Terremoto en Colombia"** (37/60)
- description: **"Encuentra el punto de ayuda más cercano: donaciones, sangre y voluntariado. Sin rastreo."** (88/90)
- OG image 1200×630: `superficie` blanca, "Mapa de Ayuda" en sans 700 enorme + una línea de propósito, fila de 10 puntos de categoría como único adorno. Sin degradados. Legible en miniatura de WhatsApp.
- `lang="es"` en `<html>`; toda la metadata en español.

---

## 7. Contactos con nombre de persona — decisión propuesta

Hecho (auditoría F6): 5 coordinadores de voluntariado publicados con nombre + celular personal por sus propias organizaciones (Sergio M., Ximena H., Natalia R., Carolina C. ×2 sedes, Hillary A.), y el mismo patrón en un par de campañas de dinero. Dato público y necesario — llamar al coordinador ES la acción de voluntariado — pero nuestro sitio estático lo amplificaría a otra escala de alcance y scrapeo.

| Opción | Descripción | Contra |
|---|---|---|
| (a) Tal cual la fuente | Nombre + celular impresos en la tarjeta | Publicamos datos personales en HTML estático indexable; escala el alcance más allá de lo que la organización decidió |
| **(b) Revelado al tocar — recomendada** | La tarjeta muestra "Contacto de voluntariado disponible" + botón **[Ver contacto]** (44 px); al tocar se revela "Pregunta por {nombre}" + **[Llamar]** (`tel:`) | Un tap extra en emergencia |
| (c) Solo organización, sin nombre | "Contacto: {organización}" + teléfono | Pierde información útil real ("pregunta por Carolina") que la propia organización quiso dar |

**Recomendación: (b).** Conserva la fidelidad a la fuente pública y la utilidad humana del nombre, pero lo saca del HTML inicial (no queda indexado por buscadores ni cosechable con un `curl`; se renderiza solo en interacción). Costo: un tap. Proporcional: el dato sirve para llamar, no para listar. Aplica como regla general a todo `contacto.telefono` que contenga nombre de persona, no solo a los 5 actuales. → **Decisión pendiente del usuario.**

---

## 8. Accesibilidad — restricción de diseño, no parche

- **Contraste:** todo par texto/fondo del sistema está calculado en §1 y §5; nada por debajo de AA 4.5 (texto) / 3.0 (no-texto). Cualquier color nuevo entra aquí con su razón calculada antes de tocar código.
- **Targets táctiles ≥ 44 px:** botones, chips, toggle, select de ciudad, markers (padding invisible), "Ver contacto", links de acción del pie de tarjeta.
- **Tipografía:** base 16 px; nada informativo por debajo de 13 px; interlínea ≥ 1.4 en prosa.
- **Color nunca único canal:** estado = ● + palabra; categoría = color + etiqueta; marker = color + glifo + popup; "sin confirmar" = texto, no color.
- **`prefers-reduced-motion`:** las transiciones son prescindibles por diseño. Solo existen dos micro-transiciones (chip activo 120 ms, aparición del panel de mapa 150 ms, ambas `opacity/transform`); bajo `reduce` se eliminan por completo. Nada anima solo, nada parpadea, cero spinners decorativos (los estados de carga son texto).
- **Foco visible:** anillo de 2 px `accion` + offset 2 px sobre cualquier fondo del sistema (razón 6.01–6.75, calculada). Orden de tabulación = orden de lectura; la lista es navegable por teclado completa.
- **Semántica:** la lista es `<ul>` de `<article>`; estado y distancia con `aria-label` explícitos ("Estado: activo", "a 1,2 kilómetros, dirección noreste"); el toggle mapa/lista es `button` con `aria-pressed`.

---

## 9. Tokens Tailwind (listos para W2)

Tailwind v4 — bloque `@theme` en `globals.css`:

```css
@theme {
  /* núcleo */
  --color-tinta: #1A2530;
  --color-secundario: #43525F;
  --color-fondo: #EFF2F5;
  --color-superficie: #FFFFFF;
  --color-borde: #D4DBE1;
  --color-accion: #0A5CA8;

  /* estados: texto / tinte / punto */
  --color-activo: #166B31;
  --color-activo-tinte: #DEF2E2;
  --color-activo-punto: #1E7A3C;
  --color-lleno: #7A4F06;
  --color-lleno-tinte: #FBEED0;
  --color-lleno-punto: #B8860B;
  --color-pausado: #49565F;
  --color-pausado-tinte: #E8EBEE;
  --color-pausado-punto: #85929D;
  --color-cerrado: #333E48;

  /* categorías: sólido (badge-texto y marker) / tinte (badge-fondo) */
  --color-cat-acopio: #3D5A76;        --color-cat-acopio-tinte: #E4EBF1;
  --color-cat-alimentos: #B0490B;     --color-cat-alimentos-tinte: #FBEBDD;
  --color-cat-agua: #0A6E97;          --color-cat-agua-tinte: #DFF0F8;
  --color-cat-sangre: #A81E22;        --color-cat-sangre-tinte: #F9E5E4;
  --color-cat-medicamentos: #0D7362;  --color-cat-medicamentos-tinte: #DDF1EC;
  --color-cat-construccion: #7A4A21;  --color-cat-construccion-tinte: #F4E9DE;
  --color-cat-ropa: #6D3FA5;          --color-cat-ropa-tinte: #EFE7F8;
  --color-cat-voluntariado: #41499F;  --color-cat-voluntariado-tinte: #E7E9F8;
  --color-cat-dinero: #59650E;        --color-cat-dinero-tinte: #EEF1D8;
  --color-cat-mascotas: #AC2166;      --color-cat-mascotas-tinte: #FAE4EE;

  /* tipografía */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Roboto Mono", "Cascadia Mono", monospace;
  --text-meta: 0.8125rem;        --text-meta--line-height: 1.125rem;   /* 13/18 */
  --text-sec: 0.9375rem;         --text-sec--line-height: 1.375rem;    /* 15/22 */
  --text-base: 1rem;             --text-base--line-height: 1.5rem;     /* 16/24 */
  --text-tarjeta: 1.125rem;      --text-tarjeta--line-height: 1.5rem;  /* 18/24 */
  --text-seccion: 1.375rem;      --text-seccion--line-height: 1.75rem; /* 22/28 */
  --text-pagina: 1.75rem;        --text-pagina--line-height: 2.125rem; /* 28/34 */

  /* espaciado y forma */
  --spacing-tap: 2.75rem;        /* 44 px — target táctil mínimo */
  --spacing-barra: 3.5rem;       /* 56 px — barra sticky */
  --radius-tarjeta: 0.625rem;    /* 10 px */
  --radius-chip: 9999px;
  --shadow-tarjeta: 0 1px 2px rgb(16 24 32 / 0.06);
}
```

(Si W2 scaffoldea con Tailwind v3, el mismo mapa va en `theme.extend` de `tailwind.config.ts`: `colors`, `fontFamily`, `fontSize`, `spacing.tap`, `borderRadius`, `boxShadow` — mismos nombres, mismos hex. Los hex de este archivo son la fuente de verdad.)

Reglas de uso: las tarjetas se definen por `superficie` + `borde` 1 px + sombra mínima (nítido a pleno sol, barato de pintar). `cifra`/mono solo vía token. Ningún hex inline en componentes: si no hay token, primero se agrega aquí.

---

## 10. Gobernanza y "nunca"

- Toda UI nueva se revisa contra este documento; una desviación se corrige citando el token o la regla exacta violada.
- Cambios al sistema: primero aquí, después el código.
- **Nunca:** decoración que no informa · rojo dominante · fuentes o assets externos · copy en inglés · color como único canal · más de un elemento distintivo · hex fuera de tokens · texto crítico bajo 4.5:1 · targets bajo 44 px.
