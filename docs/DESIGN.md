# DESIGN.md — Sistema de diseño · Mapa de Ayuda

> **APROBADO por el usuario (2026-08-14, gate W1 de `docs/PLAN_WEB.md`).**
> Este documento es **ley para la UI**: toda pantalla, componente y cadena de texto de `/web` se revisa contra él. Los cambios al sistema se escriben aquí primero y luego se aplican, nunca al revés.
>
> Decisiones aprobadas: sistema general (paleta/tipografía/layout) ✅ · elemento distintivo = **A, «riel de rumbo»** (§4) ✅ · contactos con nombre de persona = **revelado al tocar** (§7) ✅ — las tres, en la aprobación original del 2026-08-14.
>
> **Revisión W6 (2026-08-14).** La doble auditoría devolvió tres preguntas medidas (P4 contraste del punto ●, P5 acción en `pausado`, P6 borde de controles) y un hueco de copy (P8, `/campanas` vacío). Las decisiones ya están aplicadas en §1, §3, §5, §6, §8 y §9; el antes→después y el porqué de cada una están en **§11**.
>
> ✅ **P4 ratificado (2026-08-17, revisión de conformidad):** el punto ● del chip de estado no tiene tinta propia — usa la del texto del chip (§1). Quedaba como único punto pendiente de la revisión W6 y ya está confirmado; el histórico del cambio sigue en §11. **No cambiaron** los 6 colores núcleo, ni los textos y tintes de los 4 estados, ni las 10 categorías, ni el elemento distintivo. El resto de W6 fue correctivo (medidas mal atribuidas) o aditivo (un token de borde, copy nuevo).
>
> **Revisión de conformidad (2026-08-17).** Una auditoría doc↔código encontró nueve puntos donde el código se adelantó a este documento o donde el documento afirmaba algo que el código desmiente. Los nueve están resueltos en §0, §3, §4, §6, §7 y §8, con su antes→después en **§11**. Conformidad medida: 54/54 tokens de §9 idénticos a `globals.css`, 34/34 razones de contraste recalculadas al centésimo, 42/44 cadenas de microcopy literales.

---

## 0. Principio rector

Es un sitio de emergencia humanitaria que se usa con estrés, con prisa y desde un celular, a veces en 3G y a pleno sol. **Claridad absoluta por encima de decoración: cada elemento que no informa, estorba.** El sistema es sobrio y confiable — códigos de ayuda humanitaria (azul institucional, neutros fríos), nunca de alarma. Un solo elemento distintivo; todo lo demás quieto y disciplinado.

Realidades del dato que moldean cada decisión (pipeline 2026-08-13):

| Realidad | Consecuencia de diseño |
|---|---|
| 155 de 204 sitios tienen ciudad, repartidos en 28 (Bogotá 68, Medellín 22, Cali 13, Cartagena 11; el resto, colas de 1–4) | Selector de ciudad visible desde el día 1 (default: Bogotá) **+ opción "Todas las ciudades (155)"** como salida (§3) |
| Solo ~20 sitios con coordenadas | **La lista es el héroe**; el mapa es mejora progresiva con conteo honesto |
| 49 sitios sin ciudad ni punto físico | Ruta propia "Campañas nacionales", jamás mezclados con "cerca de ti" |
| Estados ya trabajando (1 `lleno` real) | Semántica de estados legible de un vistazo, siempre texto + color |
| 10 personas con nombre + celular, en 10 sitios (14 entradas: tres coordinadoras aparecen en dos sedes o campañas) | Decisión explícita de render (§7) |

---

## 1. Paleta

Seis colores núcleo (3 cromáticos + familia neutra) más los semánticos de estado. El azul institucional es el único color de marca; el verde y el ámbar existen solo como semántica de estado. **El rojo no existe en el sistema núcleo**: aparece únicamente como color de la categoría `sangre` (§5), contenido en badges y markers.

| Token | Hex | Rol |
|---|---|---|
| `tinta` | `#1A2530` | Texto principal (azul-pizarra casi negro, no negro puro) |
| `secundario` | `#43525F` | Texto secundario: dirección, horario, metadatos |
| `fondo` | `#EFF2F5` | Fondo de página (gris frío muy claro) |
| `superficie` | `#FFFFFF` | Tarjetas, barras, controles |
| `borde` | `#D4DBE1` | **Trim** (1 px): borde de tarjeta y panel, separadores. Decorativo: no identifica ningún control |
| `borde-control` | `#78848F` | **Borde de campo** (1 px): `<select>` de ciudad y campo de búsqueda — lo que hace visible dónde se escribe. Añadido en W6/P6 (§11) |
| `accion` | `#0A5CA8` | Primario: botones, links, foco, chip de filtro activo |

El neutro del borde tiene **dos pesos, no dos colores**: misma familia fría, mismo rol estructural, distinta carga de trabajo. La regla que los separa está en §8 y se resume así: **si el borde es lo único que dice "aquí se escribe", tiene que verse (3.0); si solo separa dos superficies que ya se distinguen por su valor, no.**

Semánticos de estado (chip = tinte de fondo + punto ● + **palabra siempre**; el color nunca es el único canal):

| Estado | Texto | Tinte fondo | Punto ● | Forma del chip |
|---|---|---|---|---|
| `activo` | `#166B31` | `#DEF2E2` | = el texto | ● Activo |
| `lleno` | `#7A4F06` | `#FBEED0` | = el texto | ● Lleno — ya no recibe |
| `pausado` | `#49565F` | `#E8EBEE` | = el texto | ● Pausado — no recibe por ahora |
| `cerrado` | `#FFFFFF` | sólido `#333E48` | — (sin punto) | Cerrado (chip invertido: se lee "apagado") |

**El punto usa la misma tinta que la palabra** — `currentColor`, nunca un hex propio (cambiado en W6/P4, §11). Dos razones: el punto mide 8 px y a ese tamaño una tinta intermedia se deshace a pleno sol, que es el escenario de uso; y un hex propio se desincroniza de su tinte sin que nadie lo note — fue exactamente el hallazgo P4. Con `currentColor` el contraste del punto **es** el del texto, ya medido abajo, y no puede volver a divergir. El punto no aporta color extra: aporta forma, y la forma es lo que se reconoce de lejos.

### Contraste WCAG calculado (no estimado)

Todos los pares que se usan juntos, con la razón calculada por luminancia relativa (WCAG 2.x) **contra el fondo real sobre el que se pinta cada elemento** — no contra el fondo de la página (precisión corregida en W6/P4, §11: el punto del chip vive sobre el tinte del chip, nunca sobre `superficie`). AA texto = 4.5:1 · AA no-texto (1.4.11) = 3.0:1.

| Par en uso | Razón | Criterio | Veredicto |
|---|---|---|---|
| `tinta` sobre `superficie` | **15.54** | 4.5 | AAA |
| `tinta` sobre `fondo` | **13.83** | 4.5 | AAA |
| `secundario` sobre `superficie` | **8.04** | 4.5 | AAA |
| `secundario` sobre `fondo` | **7.16** | 4.5 | AAA |
| Blanco sobre `accion` (botón primario) | **6.75** | 4.5 | AA ✓ |
| `accion` sobre `superficie` (links) | **6.75** | 4.5 | AA ✓ |
| `accion` sobre `fondo` (links, anillo de foco) | **6.01** | 4.5 / 3.0 | AA ✓ |
| `activo`: texto **y punto ●** sobre su tinte | **5.63** | 4.5 | AA ✓ |
| `lleno`: texto **y punto ●** sobre su tinte | **6.19** | 4.5 | AA ✓ |
| `pausado`: texto **y punto ●** sobre su tinte | **6.31** | 4.5 | AA ✓ |
| `cerrado`: blanco sobre sólido | **10.92** | 4.5 | AAA |
| `borde-control` sobre `superficie` (select, búsqueda) | **3.82** | 3.0 no-texto | ✓ |
| `borde-control` sobre `fondo` (si un campo se mueve fuera de la barra) | **3.40** | 3.0 no-texto | ✓ |
| `marker-inactivo` sobre su aro blanco (mapa, §5) | **3.18** | 3.0 no-texto | ✓ |
| `borde` (trim) sobre `superficie` | **1.40** | decorativo | fuera de alcance — ver §8 |
| `borde` (trim) sobre `fondo` | **1.24** | decorativo | fuera de alcance — ver §8 |

Una sola fila por estado porque texto y punto son la misma tinta: no hay un segundo número que verificar ni que pueda envejecer. Las dos últimas filas están escritas **con su razón real y baja a propósito**: el trim decorativo se declara y se justifica (§8), no se omite — una tabla de contraste que solo lista lo que aprueba no es una tabla, es una defensa.

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
│ ☐ Incluir 1 punto que no recibe  │  filtro de estado (default: solo activo)
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
- Selector de ciudad: `<select>` nativo (teclado del sistema, cero JS extra), ciudades ordenadas por número de sitios —desempate alfabético en español—, con conteo: "Bogotá (68)". El conteo de cada ciudad es de **todos** sus sitios, no solo los activos: nombra el tamaño de la ciudad, no el resultado del filtro.
- **Última opción: "Todas las ciudades (155)"** (ratificada en la revisión de conformidad del 2026-08-17, §11 — antes este documento decía "sin opción «todas» en v1: la pregunta del producto es local"). La pregunta sigue siendo local; lo que cambió es qué significa "local". Tres razones la sostienen:
  1. **Lo cercano no respeta el límite municipal.** El riel de rumbo (§4) ordena por distancia real; el `<select>` fijado en una ciudad esconde lo que queda al otro lado del borde por lejos que esté el resto. **No es hipotético: ya pasa con los 20 sitios ubicados de hoy.** El punto de Medellín y el de Itagüí están a **4,7 km** — municipios distintos, `<select>` distinto—, mientras dos puntos dentro de la misma Bogotá (Javeriana y Tadeo Lozano) están a **11,0 km**. Chía, contigua al norte de Bogotá, tiene otros dos. La división administrativa y la distancia caminable no son la misma cosa, y el elemento distintivo del sitio mide la segunda.
  2. **La búsqueda está dentro de la ciudad.** Quien recibió por WhatsApp "la Cruz Roja está recibiendo" y escribe ese nombre solo encuentra la sede de la ciudad seleccionada. Sin "todas" no hay ninguna forma de buscar en el país.
  3. **La cola es larga.** Bogotá tiene 68 de 155; los otros 87 se reparten en 27 ciudades, la mayoría con 1–4 sitios. Quien está en un municipio pequeño no sabe si su ciudad está en la lista, y adivinar entre 28 opciones es peor que ver las 155.
- **Condiciones de la opción "todas"** (las cinco son parte de la decisión; quitar cualquiera la deja mal): (a) **nunca es el default** —el default es Bogotá, o la primera ciudad por conteo si Bogotá no estuviera—; (b) va **al final** del `<select>`, después de las ciudades: la pregunta local se lee primero; (c) su conteo es **155, no 204** — las campañas nacionales siguen fuera de la lista local, siempre (§3, `/campanas`); (d) con "todas" activa, **cada tarjeta muestra su ciudad** — sin ella "Cra 4 #22-61" es ambiguo entre 28 municipios; (e) la línea de conteo nombra el alcance ("N puntos en 28 ciudades") y el estado vacío por ciudad ("Todavía no hay puntos de esta categoría en {ciudad}", §6) **no aplica**: no hay una ciudad que nombrar.
- Toggle **[Mapa]** carga Leaflet recién al tocarlo (chunk separado). Al abrir, muestra el conteo honesto (§6).
- `/campanas`: ruta estática propia con las 46 campañas de dinero + 3 convocatorias nacionales. Tarjeta sin dirección/distancia, con "Dona aquí" como acción única (sujeta a la regla de arriba: solo en `activo`). Compartible por WhatsApp — es exactamente el contenido que más se reenvía.
- **Secciones que se vacían** (añadido en W6/P8, §11): cada sección de `/campanas` —"Dona desde cualquier lugar", "Voluntariado nacional"— se renderiza **solo si tiene al menos un elemento**. Nunca un encabezado con "(0)" seguido de una lista vacía: un conteo honesto que anuncia la nada es peor que no estar. Si ninguna sección tiene contenido, las dos se sustituyen por el estado vacío de la página (§6). Y la tarjeta de acceso de la portada no se muestra con 0 campañas: **el sitio nunca enlaza a una página vacía.**

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
│ │  Cómo llegar │  Fuente ↗ · hace 3 h  │ ⑦ acción única (44px, solo con
│ └──────────────┘                       │    destino y `activo`) + fuente (13px)
└────────────────────────────────────────┘
```

- La tarjeta ES el detalle: no hay navegación a página de sitio. Una sola acción primaria ("Cómo llegar", deep link a Google Maps con la coordenada **del sitio**).
- **La acción primaria existe solo en `estado: activo`.** Regla, no lista de estados (reescrita en W6/P5, §11 — la redacción anterior enumeraba `cerrado`/`lleno` y dejaba `pausado` invitando a viajar). Si el punto no recibe **ahora mismo**, la tarjeta no ofrece "Cómo llegar"; si la campaña no recibe ahora mismo, no ofrece "Dona aquí". Vale para los cuatro estados y para cualquiera que se agregue después: la pregunta que contesta el botón es "¿voy?", y solo `activo` la contesta que sí.
- **Informar no es invitar.** En `lleno`, `pausado` y `cerrado` la tarjeta sigue completa —nombre, chip, categorías, qué reciben, dirección, horario, fuente, frescura—: quien busca ese punto merece saber que existe y por qué hoy no. Lo único que se retira es el botón que empuja a moverse.
- El **riel de rumbo (§4) no desaparece** en esos estados: la distancia es dato, no invitación. Saber que el punto pausado queda a 400 m sirve para volver mañana; borrarlo sería esconder información por miedo a que se malinterprete.
- Teléfono: si existe, segunda acción `tel:` "Llamar" (44 px). Contactos con nombre de persona: §7. **Cuando no hay acción primaria y sí hay teléfono institucional, "Llamar" toma el estilo primario**: pasa a ser la única acción de la tarjeta y además la correcta para estos estados —confirmar antes de desplazarte, §6—. Ninguna tarjeta muestra su única **acción de destino** en estilo secundario.
- **Los controles de revelado de §7 quedan fuera de esa regla** (aclarado en la revisión de conformidad del 2026-08-17, §11; el documento decía "su única acción" y el código nunca lo cumplió para "Ver contacto"). La regla gobierna las acciones que **comprometen** —"Cómo llegar" te mueve, "Dona aquí" te saca del sitio, "Llamar" abre el marcador—: su estilo dice cuál es LA acción. "Ver contacto" no lleva a ninguna parte, expande la tarjeta en su lugar; es un control de revelado, y se queda **siempre secundario** por tres razones:
  - **Es reversible y bimodal.** El mismo botón dice "Ver contacto" y "Ocultar contacto" (§6). Un control que cambiara de peso al alternarse mentiría sobre su importancia en uno de los dos estados.
  - **La acción real está detrás del tap.** Si "Ver contacto" fuera primario, al revelarse habría dos primarios apilados o el énfasis saltaría de un botón a otro dentro de la misma tarjeta. La única acción de destino de esa tarjeta es el "Llamar" que aparece revelado.
  - **§7 decidió no anunciar el dato.** El revelado existe para que el nombre y el celular de una persona no estén en el HTML inicial. Un bloque azul sólido diciendo "Ver contacto" publicita justo lo que la decisión eligió mantener discreto. La proporción es la decisión.
- **Dentro del bloque revelado, "Llamar" también es secundario y plano, uno por persona.** No es un descuido: son hasta tres coordinadores en la misma tarjeta (la campaña de Fundación Amigos por una Nueva Colombia tiene tres) y ascender uno a primario **jerarquizaría personas** —diría "llama a esta"— sin ningún dato que lo justifique. Tres opciones iguales se presentan iguales.
- Caso de referencia, para que la regla se pueda verificar contra la UI real: **Fundación Amigos por una Nueva Colombia** en `/campanas` no tiene enlace de donación ni teléfono institucional; su contacto es personal, así que su único control es "Ver contacto", secundario. Es correcto por esta regla, no una excepción.

### Desktop (≥ 1024 px)

Lista y mapa lado a lado; los filtros **no** son sidebar (10 chips caben en una fila; una sidebar desperdicia ancho y huele a plantilla de admin).

```
┌──────────────────────────────────────────────────────────────┐
│ Mapa de Ayuda · banner privacidad                            │
│ [Bogotá ▾] [🔍 Buscar…](Alimentos)(Agua)(Sangre) ☐ no reciben │  filtros: 1 barra horizontal
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
- Riesgo asumido (el único del sistema): la flecha norte-arriba exige una pizca de lectura de mapa. Mitigación en dos canales distintos, **que no se pisan** (corregido en la revisión de conformidad del 2026-08-17, §11 — este documento pedía `aria-label`, y el `aria-label` habría sido el error):
  - **Ratón / puntero:** `title="Dirección desde tu ubicación, norte arriba"` en la columna. Explica la convención a quien ve la flecha y no la entiende.
  - **Lector de pantalla:** un `<span class="sr-only">` con la lectura completa —"a 1,2 kilómetros, dirección noreste" (§8)—, con la flecha y la cifra en `aria-hidden`. Un `aria-label` en el contenedor **habría reemplazado** ese texto por la explicación de la convención: quien no ve la flecha se habría quedado sin la distancia y sin el rumbo, que es toda la información. La convención norte-arriba no le sirve a quien no ve el dibujo; la cardinal hablada sí.
  - La cifra en km siempre manda y la flecha solo acompaña.

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

**Recomendación: A**, con C absorbido como su regla de voz. B se descarta. → **Aprobado por el usuario el 2026-08-14** (gate W1, cabecera). El marcador "decisión pendiente" sobrevivió aquí hasta la revisión de conformidad del 2026-08-17 (§11): el riel llevaba desde W4 construido y en producción.

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
- Estados ≠ activo en el mapa (solo si el filtro los incluye): marker desaturado a `marker-inactivo` `#85929D` con aro blanco (razón **3.18** contra el aro, §1); el popup muestra el chip de estado. **Token propio desde W6** (§11): el mismo hex servía de punto del chip y de marker apagado —dos roles sin relación colgando de un token— y por eso el rediseño del punto amenazaba con mover el mapa sin que nadie lo pidiera. El hex del marker **no cambia**: lo verificado en W3 sigue en pie píxel por píxel.

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
| **Filtro de estado** (checkbox, default desmarcado = solo `activo`). Tres formas según el conteo | 0 → "Incluir los puntos que no reciben" · 1 → "Incluir 1 punto que no recibe" · N → "Incluir N puntos que no reciben" |
| **Sin resultados** (filtros/búsqueda) | "Ningún punto coincide con esta búsqueda. Quita algún filtro o revisa otra categoría. Las campañas nacionales reciben ayuda desde cualquier lugar." — Acciones: **[Quitar filtros]** **[Ver campañas]** |
| Ciudad sin sitios de la categoría | "Todavía no hay puntos de esta categoría en {ciudad}. Mira las campañas nacionales o revisa otra ciudad." |
| **Campañas vacías** (`/campanas` sin ninguna campaña; añadido en W6/P8, §11) | "Todavía no hay campañas nacionales publicadas. Los puntos de ayuda con dirección siguen en la lista." — Acción: **[Ver puntos de ayuda]** |
| **Tiles del mapa caídos** | "El mapa no cargó. Revisa tu conexión o vuelve a la lista: tiene la misma información." — Acción: **[Volver a la lista]** |
| **Conteo honesto del mapa** (siempre visible en vista mapa) | "20 de 204 puntos ubicados en el mapa. El resto está en la lista." (cifras dinámicas, mono) |
| Separador de no ubicados (fin de lista ordenada) | "— Sin ubicación exacta todavía (48) —" |
| localStorage bloqueado | "El navegador no permite guardar preferencias en este dispositivo. Todo funciona igual; los filtros no se recordarán." |
| **Botón borrar** (siempre visible en el pie) | "Borrar mis datos" |
| Confirmación de borrar | "Se borrarán los filtros guardados y la ubicación recordada de este dispositivo. El sitio sigue funcionando normal." — **[Borrar]** **[Cancelar]** → al confirmar: "Datos borrados." |
| **Disclaimer "Acerca de"** (contrato) | "Verifica el punto antes de desplazarte: los horarios y las necesidades cambian rápido." — **literal en `/acerca`**, que es a quien el contrato se lo asigna. En el aviso de la portada va truncado a "Verifica el punto antes de desplazarte." (forma corta autorizada abajo) |
| Frescura del dato (pie de tarjeta) | "hace 3 h" / "hace 2 días" (desde `ultimaActualizacion`) |
| Dato comunitario sin confirmar (`verificado: false`) | "Reporte de la comunidad — sin confirmar" (texto 13 px junto a la fuente; nunca un color de alarma) |
| Acciones canónicas — **destino** (llevan a otro lugar o comprometen) | "Cómo llegar" · "Llamar" · "Dona aquí" · "Ver campañas" · **"Ver puntos de ayuda"** (W6) · "Usar mi ubicación" · "Quitar filtros" · "Reportar un cambio" · **"Ver mapa"** · **"Acerca de este sitio"** |
| Acciones canónicas — **revelado y vuelta** (abren o cierran algo en su lugar; nunca estilo primario, §3) | **"Ver contacto" / "Ocultar contacto"** (mismo botón, §7) · **"Volver a la lista"** (botón: vuelve de la vista mapa a la lista, misma página) · **"Volver a la lista de puntos"** (enlace de regreso desde `/campanas`, `/acerca` y la 404, con "←": nombra el destino porque cambia de ruta) |

**Las campañas se mencionan solo si existen** (W6/P8, §11). Dos filas de arriba —"Sin resultados" y "Ciudad sin sitios de la categoría"— rematan mandando a las campañas nacionales. Con 0 campañas esa frase afirma algo falso y además enlaza a una página vacía, contra la regla de §10. Por eso **la frase de campañas y la acción [Ver campañas] se renderizan solo si hay al menos una campaña**; si no la hay, el estado vacío se queda con su acción restante ([Quitar filtros]) y la frase desaparece entera — no se reescribe en negativo, que sería explicarle a la persona un vacío que no le sirve de nada. Misma regla que la tarjeta de acceso de la portada (§3): el sitio no promete ayuda que hoy no tiene.

**Gramática de los estados vacíos** (regla que gobierna las cuatro filas de arriba y cualquiera que se agregue): **hecho + salida**, en ese orden y en dos frases cortas. Primero qué pasa, sin rodeos ni disculpas; después a dónde ir, con una acción canónica. Nunca se culpa a la persona (en `/campanas` no filtró nada: no hay nada que "quitar") y nunca se dramatiza un vacío de datos con tono de error — un vacío es una foto del dato de hoy, no una falla. "Todavía" es la palabra del sistema para eso: dice que el dato falta **ahora**, y esta emergencia se mueve rápido. Mismo uso en "Todavía no hay puntos de esta categoría" y en "Sin ubicación exacta todavía".

### Aviso de actualización de la portada — seis ramas

Solo se dibuja en la portada (`/`), bajo el banner de privacidad. Se documenta aquí en la revisión de conformidad del 2026-08-17 (§11): se construyó en W8 y se partió en seis ramas en W9 sin pasar por este documento.

**Qué distingue** (la razón de existir de las seis ramas): **revisar ≠ cambiar.** Una cosa es cuándo se miraron las fuentes —dice si el sistema está vivo— y otra cuándo cambiaron los datos —dice cuán fresco es lo que se lee—. Colapsadas en un solo número, tres días sin novedades se leían como abandono. Es la voz del "tablero honesto" (§4, candidato C): el sitio rinde cuentas de su propio dato en vez de prometer un ritmo que la persona no puede verificar.

Cada rama es **contexto + orden**, en ese orden: primero el hecho con su sello, después siempre la misma orden. Los "hace X" van en `<time datetime>` (el texto relativo se congela en la build; el sello no envejece).

| Rama | Cuándo | Texto exacto (contexto) |
|---|---|---|
| `revisado-con-cambios` | La última revisión fue reciente y trajo novedades (mismo instante) | "Las fuentes se revisaron {hace} y trajeron novedades." |
| `revisado-sin-novedades` | Revisión reciente, sin novedades — **el caso que motivó W9** | "Las fuentes se revisaron {hace}: sin novedades desde {hace}." |
| `cambio-fuera-de-revision` | Los datos cambiaron después de la última revisión (edición manual: marcar un punto como lleno) | "La lista cambió por última vez {hace}." |
| `revision-vieja` | La revisión pasa de 30 h: la actualización automática se rompió | "Las fuentes no se revisan desde {hace}: los datos pueden estar viejos." |
| `sin-latido-al-dia` | No hay archivo de latido y el dato tiene ≤ 24 h | "Esta lista se actualiza sola una vez al día; la última fue {hace}." |
| `sin-latido-desfasado` | No hay archivo de latido y el dato pasa de 24 h | "Esta lista se actualiza sola una vez al día, pero la última fue {hace}." |
| **Orden** (las seis, siempre, al final y en negrita) | — | "Verifica el punto antes de desplazarte." |

Reglas de voz de este bloque:

- **`revision-vieja` es la única rama que sube el tono, y lo sube con un hecho.** Nunca con un color de alarma ni un ícono de alerta (§0: códigos humanitarios, no de alarma). El ⓘ es decoración `aria-hidden` y el aviso no lleva `role="alert"`: es contexto permanente, no una interrupción.
- **Ninguna rama con latido promete el ritmo.** "Se actualiza sola una vez al día" solo aparece cuando no hay latido, que es el único caso donde no se puede probar nada mejor. Un sello de hace 2 h prueba lo mismo y se verifica solo; una promesa es la primera frase que se vuelve mentira cuando la automatización falla. El ritmo —que existe— se explica en `/acerca`, donde cabe el párrafo.
- **`cambio-fuera-de-revision` va antes que `revision-vieja` a propósito.** Si alguien corrigió el dato hace una hora, decir "los datos pueden estar viejos" porque la automatización lleva tres días caída sería falso donde importa: lo que la persona lee está fresco.

**Desviación autorizada — la orden va truncada en la portada.** La cadena canónica del contrato es "Verifica el punto antes de desplazarte: los horarios y las necesidades cambian rápido." En el aviso se usa **solo la primera mitad**, hasta el punto. La razón es medida, no estética: con la cola, el aviso ocupa 5 líneas a 320 px y empuja la primera tarjeta 22 px más abajo, justo en las pantallas donde apenas asomaba. La lista es el héroe (§0): el contexto no le quita pantalla. Lo que se conserva es la **orden completa** —el imperativo entero, sin recortar—; lo que se va es la explicación de por qué, que no cambia lo que hay que hacer. **La frase completa sigue literal en `/acerca`**, que es a quien el contrato se la asigna, y allí con dos párrafos que la desarrollan. Es la única cadena del sistema con dos formas autorizadas, y las dos están escritas aquí: cualquier tercera es una desviación.

### SEO / Open Graph

(Semilla para W5, verificada en caracteres.)

- `<title>`: **"Mapa de Ayuda — Terremoto en Colombia"** (37/60)
- description: **"Encuentra el punto de ayuda más cercano: donaciones, sangre y voluntariado. Sin rastreo."** (88/90)
- OG image 1200×630: `superficie` blanca, "Mapa de Ayuda" en sans 700 enorme + una línea de propósito, fila de 10 puntos de categoría como único adorno. Sin degradados. Legible en miniatura de WhatsApp.
- `lang="es"` en `<html>`; toda la metadata en español.

---

## 7. Contactos con nombre de persona — decisión aprobada

Hecho, **recontado sobre el dataset con el predicado del propio código** en la revisión de conformidad del 2026-08-17 (§11 — este documento decía 5 y la cifra nunca se actualizó): **10 personas con nombre + celular personal, en 10 sitios, 14 entradas.** Publicadas así por sus propias organizaciones. Ocho son coordinaciones de voluntariado (Sergio M., Ximena H., Natalia R., Carolina C. ×2 sedes, Hillary A., Marcelino G.) y el mismo patrón aparece en campañas de dinero (Gina R., Luisa C. y Gabriel L., los tres en dos registros de la misma fundación; Nicole G.). Dato público y necesario — llamar al coordinador ES la acción de voluntariado — pero nuestro sitio estático lo amplificaría a otra escala de alcance y scrapeo.

La cifra es informativa, no operativa: **la regla nunca fue una lista de personas**, sino un predicado sobre el campo `contacto.telefono` (¿quedan palabras que no sean técnicas ni institucionales?). Por eso el error de conteo no produjo ningún dato expuesto — cubría a las 10 desde el primer día — y por eso esta cifra volverá a envejecer en cada corrida del pipeline sin que nada se rompa. **Si alguna vez hay que citarla, se recuenta; no se copia de aquí.**

| Opción | Descripción | Contra |
|---|---|---|
| (a) Tal cual la fuente | Nombre + celular impresos en la tarjeta | Publicamos datos personales en HTML estático indexable; escala el alcance más allá de lo que la organización decidió |
| **(b) Revelado al tocar — recomendada** | La tarjeta muestra "Contacto de voluntariado disponible" + botón **[Ver contacto]** (44 px); al tocar se revela "Pregunta por {nombre}" + **[Llamar]** (`tel:`) | Un tap extra en emergencia |
| (c) Solo organización, sin nombre | "Contacto: {organización}" + teléfono | Pierde información útil real ("pregunta por Carolina") que la propia organización quiso dar |

**Recomendación: (b).** Conserva la fidelidad a la fuente pública y la utilidad humana del nombre, pero lo saca del HTML inicial (no queda indexado por buscadores ni cosechable con un `curl`; se renderiza solo en interacción). Costo: un tap. Proporcional: el dato sirve para llamar, no para listar. Aplica como regla general a todo `contacto.telefono` que contenga nombre de persona, no a una lista fija. → **Aprobado por el usuario el 2026-08-14** (gate W1, cabecera). El marcador "decisión pendiente" sobrevivió aquí hasta la revisión de conformidad del 2026-08-17 (§11): el revelado llevaba desde W2 construido y en producción.

El botón del revelado es **siempre secundario**, en los dos sentidos del alternador ("Ver contacto" / "Ocultar contacto"), y las acciones "Llamar" que aparecen dentro del bloque revelado también: van una por persona y todas iguales. Las razones —y su interacción con la regla de acción única— están en §3.

---

## 8. Accesibilidad — restricción de diseño, no parche

- **Contraste — alcance explícito** (reescrito en W6/P4+P6, §11; la redacción anterior prometía un piso universal que el trim de tarjeta nunca cumplió): todo par se calcula en §1 y §5 **contra el fondo real sobre el que se pinta**, no contra el fondo de la página. Pisos: **4.5** para texto · **3.0** para lo que identifica un control o porta información (borde de campo, marker, glifo, punto de estado). **Fuera** de ese piso, declarado y medido igual: lo puramente decorativo —trim de tarjeta, separadores, sombra—, que no identifica ningún control ni carga significado; la tarjeta ya se separa por el escalón de valor `superficie`/`fondo` más `--shadow-tarjeta`, y subir ese trim a 3.0 convertiría la lista en una cuadrícula de hoja de cálculo. Por eso `borde` (1.40) es correcto donde está y `borde-control` (3.82) es obligatorio donde el borde es lo único que dice "aquí se escribe". Todo color nuevo entra aquí con su razón calculada **y declarando contra qué fondo se midió**: una razón sin su fondo es una cifra sin unidad.
- **Targets táctiles ≥ 44 px:** botones, chips, toggle, select de ciudad, markers (padding invisible), "Ver contacto", links de acción del pie de tarjeta.
- **Tipografía:** base 16 px; nada informativo por debajo de 13 px; interlínea ≥ 1.4 en prosa.
- **Color nunca único canal:** estado = ● + palabra; categoría = color + etiqueta; marker = color + glifo + popup; "sin confirmar" = texto, no color.
- **`prefers-reduced-motion`:** las transiciones son prescindibles por diseño. El inventario completo son **cuatro micro-movimientos** (corregido en la revisión de conformidad del 2026-08-17, §11 — este documento decía "solo dos" y les atribuía una propiedad que no usan): tres `transition` de 120 ms —chip de categoría y toggle mapa/lista, ambos sobre `colors`; flecha del riel, sobre `transform`— y una `animation` de 150 ms sobre `opacity`, la aparición del panel de mapa. Bajo `reduce` se eliminan **las cuatro**: la regla global anula `transition` y `animation` con `!important` sobre `*`, así que el inventario no tiene que estar completo para que la garantía se cumpla — pero sí para que este documento no afirme algo falso. Ninguno de los cuatro es decorativo: dos acompañan un cambio de estado que ya ocurrió, la flecha gira a su ángulo nuevo en vez de saltar (bajo `reduce` aparece directamente en el ángulo final; nunca gira) y el panel entra sin parpadeo. Nada anima solo, nada parpadea, cero spinners decorativos (los estados de carga son texto).
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
  --color-borde: #D4DBE1;        /* trim decorativo: tarjeta, panel, separador */
  --color-borde-control: #78848F; /* W6/P6 — borde de campo: select y búsqueda */
  --color-accion: #0A5CA8;

  /* estados: texto / tinte. SIN token de punto: el punto es currentColor
     (W6/P4) — hereda la tinta del texto del chip y no puede divergir. */
  --color-activo: #166B31;
  --color-activo-tinte: #DEF2E2;
  --color-lleno: #7A4F06;
  --color-lleno-tinte: #FBEED0;
  --color-pausado: #49565F;
  --color-pausado-tinte: #E8EBEE;
  --color-cerrado: #333E48;

  /* mapa: marker de estado ≠ activo (W6/P4 — antes compartía token con el
     punto del chip; mismo hex de siempre, ahora con nombre propio) */
  --color-marker-inactivo: #85929D;

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

**Cuál de los dos bordes** (W6/P6): `borde-control` va en los controles **que aceptan entrada** —`<select>`, campos de texto—, cuyo contenido es dato de la persona y no una etiqueta que los nombre: sin un borde visible no hay nada que diga dónde se escribe. Los controles **con etiqueta propia** —botones y chips, que dicen "Mapa", "Alimentos", "Llamar" a 6.75:1, y que al activarse se rellenan sólidos de `accion`— se identifican por su palabra y conservan `borde` como trim. El efecto secundario es bienvenido: en la barra sticky los dos campos quedan emparejados entre sí y el botón "Mapa" se lee como lo que es, un botón, no un tercer campo.

---

## 10. Gobernanza y "nunca"

- Toda UI nueva se revisa contra este documento; una desviación se corrige citando el token o la regla exacta violada.
- Cambios al sistema: primero aquí, después el código.
- **La revisión también va al revés** (aprendido en W6): si el código sigue este documento al pie de la letra y aun así el resultado está mal, el defecto es del documento. P4, P5 y P6 fueron los tres casos —una medida contra el fondo equivocado, una regla escrita como lista de estados, un piso de contraste prometido de más—, y en los tres el código era fiel. Un hallazgo de auditoría contra la UI se lee primero como sospecha contra estas páginas.
- **Toda razón de contraste se declara con su fondo.** Un número solo es verificable si dice contra qué se midió; si el elemento se mueve de fondo, la fila se recalcula antes del cambio, no después.
- **Preferir la regla al enumerado.** "Solo en `activo`" sobrevive a un estado nuevo; "en `cerrado`/`lleno`" no. Cuando una regla se pueda escribir como invariante positivo, se escribe así.
- **Una cadena que se muestra a una persona es diseño, aunque nazca de una condición** (aprendido en la revisión de conformidad del 2026-08-17). Seis ramas de copy shipearon sin pasar por §6 porque parecían lógica. Regla: **si tiene texto visible, tiene fila en §6** — el conteo de una etiqueta, la rama de un `if`, el estado de un alternador. La prueba es "¿alguien la lee?", no "¿quién la escribió?".
- **Una desviación declarada en un comentario de código no está declarada.** Un `// DESVIACIÓN de DESIGN.md` es honesto y no basta: nadie audita comentarios. Va a §6/§11 con su medida, o se revierte. Dos formas de la misma cadena solo existen si las dos están escritas aquí.
- **Las cifras del dataset envejecen; los predicados no.** Ningún número de este documento (conteos de sitios, ciudades, personas) es operativo: se recuenta contra los datos, nunca se copia de aquí. Donde el número sostiene una decisión, se dice contra qué se midió y cuándo.
- **Nunca:** decoración que no informa · rojo dominante · fuentes o assets externos · copy en inglés · color como único canal · más de un elemento distintivo · hex fuera de tokens · texto crítico bajo 4.5:1 · targets bajo 44 px · una razón de contraste declarada contra un fondo que no es el que se pinta · un enlace hacia una página vacía.

---

## 11. Revisiones del sistema

El histórico no se borra: cada revisión deja aquí el antes→después y el porqué. La aprobación original del usuario (cabecera, 2026-08-14) se mantiene intacta.

### Revisión de conformidad — 2026-08-17 (auditoría doc↔código, posterior a W9)

Una auditoría contrastó este documento contra la UI construida. **La conformidad medida es alta**: los 54 tokens de §9 son idénticos a `globals.css`, las 34 razones de contraste de §1 y §5 recalculadas desde los hex del código coinciden al centésimo, y 42 de 44 cadenas de microcopy son literales. Lo que sigue no es deuda de calidad: es deuda de **gobernanza**. En nueve puntos el código se adelantó al documento, que es exactamente lo que §10 prohíbe.

**Cómo se resolvió cada uno.** En dos casos había que elegir entre pedir un cambio de código o admitir que el documento estaba incompleto. **Los dos se resolvieron hacia el documento, y por eso esta revisión no pide ni una línea de código.** Eso no es indulgencia con el código: en los dos casos el código tenía una razón que el documento no había considerado, y la prueba es que escribirla obligó a **fortalecer la regla**, no a debilitarla — la regla de acción única salió de aquí distinguiendo destino de revelado, que es lo que siempre quiso decir.

**C1 — La opción "Todas las ciudades". → Ratificada, con cinco condiciones escritas.**

| | Antes (§3) | Ahora |
|---|---|---|
| Texto | *«Sin opción "todas" en v1: la pregunta del producto es local.»* | Última opción del `<select>`: **"Todas las ciudades (155)"**, con sus cinco condiciones |

Es el hallazgo más viejo: se añadió en W2 porque la tarea lo pidió, quedó señalado como desviación consciente y nunca se resolvió — ningún documento del proyecto lo autorizaba. La frase de v1 no era un capricho: quería impedir que la lista se convirtiera en un directorio nacional y perdiera la pregunta "¿cuál me queda cerca?". Esa intención se conserva entera; lo que se corrigió es la creencia de que "local" y "municipio" son la misma cosa. **No lo son, y se puede medir con el dato de hoy:** el punto ubicado de Medellín y el de Itagüí están a **4,7 km** en municipios distintos, mientras dos puntos de la misma Bogotá (Javeriana y Tadeo Lozano) están a **11,0 km**. El `<select>` esconde el primero y muestra el segundo. Se suman dos huecos más: la búsqueda vive dentro de la ciudad —quien busca "Cruz Roja" sin "todas" no puede buscar en el país— y la cola es larga (68 de 155 en Bogotá; los otros 87 repartidos en 27 ciudades de 1 a 4 sitios), así que quien está en un municipio pequeño no sabe si aparece.

Se ratifica **con las cinco condiciones que la vuelven disciplinada** (§3): nunca es el default · va al final · cuenta 155 y no 204 · cada tarjeta muestra su ciudad · la línea de conteo nombra el alcance y el estado vacío por ciudad no aplica. Las cinco ya se cumplen en la UI, y por eso ratificar no cuesta código: el ingeniero había implementado la opción **con** sus consecuencias, no suelta. Escribirlas aquí es lo que impide que la próxima edición se lleve una por delante.

**C2 — El rótulo del filtro de estado. → El nuevo texto es el canónico, y entra a §6 con sus tres formas.**

| | Antes (§3) | Ahora (§6, cadena canónica) |
|---|---|---|
| Rótulo | "☐ Incluir llenos y cerrados" | 0 → "Incluir los puntos que no reciben" · 1 → "Incluir 1 punto que no recibe" · N → "Incluir N puntos que no reciben" |

El cambio salió de una revisión del usuario sobre la UI corriendo: *«¿qué significa ese input? ¿que está abierto y funcionando el lugar?»*. El rótulo viejo fallaba en tres cosas y el nuevo las arregla las tres. **(1) No decía qué escondía**: ahora el número lo dice, y de paso revela que la lista de arriba es la de los que **sí** reciben. **(2) Nombraba dos de los tres estados que oculta** —`pausado` quedaba fuera del texto—; "que no recibe" es una **regla, no un enumerado**, que cubre `lleno`, `pausado`, `cerrado` y cualquier estado futuro: es §10 aplicada al copy. **(3) Competía con "abierto/cerrado"**: el `estado` contesta "¿sigue recibiendo?", no "¿está abierto ahora?" —eso es el `horario`, y solo 17 de 204 sitios lo tienen—. "Recibir" es además el verbo que ya usan los chips ("Lleno — ya no recibe", "Pausado — no recibe por ahora"): el rótulo es su generalización exacta, no vocabulario nuevo.

Detalle que va al documento porque sostiene la honestidad del número: **el conteo sale del conjunto filtrado vigente** (ciudad + chips + búsqueda), así que nunca promete puntos que al marcar la casilla no aparecen. Un conteo global habría dicho "Incluir 1 punto" en una ciudad donde no hay ninguno.

**C3 — Seis ramas del aviso de frescura, sin documentar. → §6 gana el bloque completo, con la desviación del disclaimer autorizada.**

Se construyeron en W8 y se partieron en seis en W9 sin pasar por §6: `revisado-con-cambios`, `revisado-sin-novedades`, `cambio-fuera-de-revision`, `revision-vieja`, `sin-latido-al-dia`, `sin-latido-desfasado`. Ahora están en §6 con su cadena exacta, su condición y sus reglas de voz. Distinguen **revisar de cambiar**: colapsadas en un solo número, tres días sin novedades se leían como abandono. Es el "tablero honesto" (§4/C) hecho encabezado.

**Y la desviación que faltaba traer.** El ingeniero la declaró en un comentario de código y ahí se quedó; un comentario no es una declaración auditable (§10, regla nueva). Queda **autorizada** aquí:

| | Cadena del contrato (§6) | En el aviso de la portada |
|---|---|---|
| Disclaimer | "Verifica el punto antes de desplazarte: los horarios y las necesidades cambian rápido." | **"Verifica el punto antes de desplazarte."** |

La razón está medida: con la cola, el aviso ocupa **5 líneas a 320 px** y empuja la primera tarjeta **22 px** más abajo, en las pantallas donde apenas asomaba. §0 dice que la lista es el héroe; el contexto no le quita pantalla. Se conserva **la orden entera** —el imperativo completo, sin recortar— y se va la explicación de por qué, que no cambia lo que hay que hacer. La frase completa sigue **literal en `/acerca`**, que es a quien el contrato se la asigna. Es la única cadena del sistema con dos formas, y las dos quedan escritas: cualquier tercera es una desviación.

**C4 — "Ver contacto" siempre secundario. → §3 excluye los controles de revelado, y la regla queda mejor dicha.**

| | Antes (§3) | Ahora |
|---|---|---|
| Regla | "Ninguna tarjeta muestra su única **acción** en estilo secundario." | "Ninguna tarjeta muestra su única **acción de destino** en estilo secundario." + los controles de revelado de §7 quedan fuera, con su porqué |

Hay una tarjeta real así hoy: **Fundación Amigos por una Nueva Colombia** en `/campanas`, sin enlace de donación y sin teléfono institucional —su contacto es personal—, de modo que su único control es "Ver contacto", secundario. La alternativa era ascenderlo a primario. Se descarta por tres razones: es un control **reversible y bimodal** (el mismo botón dice "Ocultar contacto", y cambiar de peso al alternarse mentiría en uno de los dos estados); **la acción real está detrás del tap**, así que un "Ver contacto" primario apilaría dos primarios o movería el énfasis dentro de la misma tarjeta; y **§7 decidió no anunciar el dato** — un bloque azul sólido publicita justo lo que el revelado eligió mantener discreto. La proporción es la decisión, no un efecto secundario de ella.

Se documenta además lo que el hallazgo no preguntaba pero habría vuelto como el hallazgo de mañana: **dentro del bloque revelado, "Llamar" también es secundario y plano, uno por persona.** Esa misma campaña lista tres coordinadores; ascender uno **jerarquizaría personas** sin ningún dato que lo justifique. Tres opciones iguales se presentan iguales.

Precisión que la regla vieja se comía: §3 dice que "Llamar" toma el estilo primario cuando queda solo. Eso habla del **teléfono institucional** de la tarjeta. En esta campaña ese teléfono no existe —el número es personal y vive detrás del revelado—, así que la regla ni siquiera aplicaba. Ahora se dice cuál "Llamar" gobierna cada regla.

**C5 — Cuatro acciones que la UI usa y §6 no listaba. → Añadidas, y la lista se parte en dos.**

Faltaban "Acerca de este sitio", "Ocultar contacto", "Volver a la lista" y "Ver mapa". Se añaden las cuatro, y la fila única de acciones canónicas pasa a **dos filas** — porque C4 acababa de demostrar que la distinción importa: las **de destino** (llevan a otro lugar o comprometen) pueden tomar estilo primario; las **de revelado y vuelta** (abren o cierran algo en su lugar) nunca. "Ver contacto"/"Ocultar contacto" entran como el par que son, un solo botón con dos textos.

Se documentan también **dos formas de volver**, que no son la misma: **"Volver a la lista"** es el botón de los tiles caídos, que vuelve de la vista mapa a la lista **en la misma página**; **"Volver a la lista de puntos"** es el enlace de regreso desde `/campanas`, `/acerca` y la 404, y nombra el destino porque **cambia de ruta**. La cola no es redundancia: quien está en otra página necesita saber a qué lista vuelve.

**C6 — "Solo existen dos micro-transiciones". → Son cuatro, y dos no son las que §8 decía.**

| | Antes (§8) | Ahora |
|---|---|---|
| Inventario | 2: "chip activo 120 ms, panel de mapa 150 ms, ambas `opacity/transform`" | 4: chip 120 ms `colors` · toggle mapa/lista 120 ms `colors` · flecha del riel 120 ms `transform` · panel de mapa 150 ms `opacity` (`animation`) |

La afirmación estaba mal en dos ejes, no en uno: contaba dos donde hay cuatro **y** le atribuía al chip una propiedad que no usa (anima `colors`, no `opacity/transform`). **Sin impacto de accesibilidad:** la regla global de `prefers-reduced-motion` anula `transition` y `animation` con `!important` sobre `*`, así que las cuatro se eliminan estén o no inventariadas — la garantía nunca dependió de que la lista estuviera completa. Se corrige porque un documento que afirma "solo existen dos" y tiene cuatro deja de ser verificable, y §8 es la sección donde la verificabilidad **es** el contenido.

**C7 — `aria-label` en el riel. → Manda el código: `title` + `sr-only`.**

| | Antes (§4) | Ahora |
|---|---|---|
| Mitigación | "`aria-label` y `title` 'Dirección desde tu ubicación, norte arriba'" | `title` con esa frase (para quien ve la flecha) **+** `sr-only` con "a 1,2 kilómetros, dirección noreste" (para quien no la ve) |

El caso más claro de §10 al revés: el documento estaba equivocado y el código, mejor. Un `aria-label` en el contenedor **habría reemplazado** el texto hablado de distancia y rumbo por la explicación de la convención — quien usa lector de pantalla se habría quedado sin el dato y con la instrucción de leer un dibujo que no ve. La convención norte-arriba no le sirve; la cardinal hablada sí. Son dos públicos y dos canales, y confundirlos habría costado justo la información que el elemento distintivo existe para dar.

**C8 — "5 contactos con nombre de persona". → Son 10 personas en 10 sitios (14 entradas).**

Recontado con el predicado del propio código sobre el dataset vigente. Faltaban **Gina Rodríguez, Luisa Coral, Gabriel Lozano** (los tres en dos registros de la misma fundación), **Nicole González** y **Marcelino Gaitán Villegas**. Corregido en §0 y §7.

**Ningún dato quedó expuesto por este error, y la razón importa:** §7 nunca se implementó como lista de cinco nombres sino como **predicado** sobre `contacto.telefono`, así que el revelado cubría a las 10 desde el primer día. El error era del documento contándose a sí mismo. De ahí la regla nueva de §10: las cifras del dataset se recuentan, no se copian de aquí.

**C9 — Marcadores de gobernanza contradictorios. → Limpiados sin borrar el histórico.**

La cabecera daba por aprobados el elemento distintivo, P4 y §7, mientras tres lugares del cuerpo seguían diciendo lo contrario:

| Lugar | Antes | Ahora |
|---|---|---|
| Cabecera | "⚠️ Pendiente de ratificación del usuario" (P4) | "✅ P4 ratificado (2026-08-17)" |
| §4, recomendación | "→ Decisión pendiente del usuario." | "→ Aprobado por el usuario el 2026-08-14 (gate W1)" |
| §7, título y cierre | "decisión propuesta" · "→ Decisión pendiente del usuario." | "decisión aprobada" · "→ Aprobado por el usuario el 2026-08-14 (gate W1)" |

Se **convierten**, no se borran: cada marcador queda como afirmación fechada y anota que sobrevivió hasta esta revisión, con el elemento distintivo construido desde W4 y el revelado desde W2. Un documento que dice "pendiente" sobre algo que lleva semanas en producción entrena a leerse por encima, y esa es la avería que hace posibles los otros ocho hallazgos. Las fechas son las citables: 2026-08-14 para lo que aprobó el gate W1; 2026-08-17 para P4, que se ratifica **en** esta revisión y no se retrofecha.

**Qué NO cambió:** los 54 tokens de §9 · las 34 razones de contraste de §1 y §5 · los 6 colores núcleo · los textos y tintes de los 4 estados · las 10 categorías · las 2 tipografías y la escala · el elemento distintivo · el layout · las 42 cadenas de microcopy que ya eran literales. **Y ninguna línea de `/web`:** esta revisión se resuelve entera del lado del documento.

### Revisión W6 — 2026-08-14 (doble auditoría, `docs/PLAN_WEB.md`)

QA recalculó los 34 pares de §1+§5 por luminancia y **coinciden al centésimo**: la tabla era correcta donde medía lo que decía medir. Los cuatro cambios de abajo salen de los cuatro sitios donde el documento decía otra cosa, o no decía nada.

**P4 — El punto ● se medía contra el fondo equivocado. → Opción (b), resuelta con una tinta en vez de tres hexes.**

| | Antes | Ahora |
|---|---|---|
| Punto `activo` | `#1E7A3C`, declarado **5.38** sobre `superficie` | `currentColor` = `#166B31` · **5.63** sobre su tinte |
| Punto `lleno` | `#B8860B`, declarado **3.25** sobre `superficie` — real **2.83** sobre su tinte | `currentColor` = `#7A4F06` · **6.19** sobre su tinte |
| Punto `pausado` | `#85929D`, declarado **3.18** sobre `superficie` — real **2.66** sobre su tinte | `currentColor` = `#49565F` · **6.31** sobre su tinte |
| Marker apagado del mapa | `--color-pausado-punto` (token prestado) | `--color-marker-inactivo: #85929D` — **mismo hex**, nombre propio |

Se pedía elegir entre corregir la tabla (a) u oscurecer los puntos (b). Es (b), y ejecutada hasta el final: el punto deja de tener tinta propia. Oscurecerlo hasta rozar el 3.0 habría arreglado dos cifras dejando en pie la causa —tres hexes a mano que nadie vuelve a medir cuando un tinte se mueve—; heredar la tinta del texto hace que el defecto no pueda repetirse, porque ya no hay dos números que puedan separarse. De paso el sistema pierde tres tokens y gana legibilidad: el punto mide 8 px y **el peor de los tres pasa de 2.66 a 5.63** (el peor era `pausado`, ahora es `activo`), en un punto que se mira a pleno sol.

La tabla se corrige igual, que era la mitad (a) del hallazgo: ahora todo se mide contra el fondo real y §8 lo fija como regla. El `3.18` que decía ser del punto `pausado` no era falso, era **de otro elemento**: es el marker apagado contra su aro blanco, y ahí quedó, medido y con nombre.

Efecto colateral evitado: `--color-pausado-punto` alimentaba también el marker del mapa. Sin separarlo, retocar un chip habría movido el mapa verificado en W3. Se separó primero.

**P5 — `pausado` conservaba "Cómo llegar". → Desaparece; y la regla se reescribe como invariante.**

Antes: *«en `cerrado`/`lleno`, "Cómo llegar" desaparece»*. Ahora: **la acción primaria existe solo en `activo`.** El código era fiel a §3; el defecto era de §3, que enumeró estados en lugar de decir la regla y por eso dejó fuera el estado que se agregó después.

Para quien va a desplazarte con una caja, `pausado` significa lo mismo que `lleno`: hoy no. Y significa algo peor —`lleno` tiene una causa conocida que se resuelve sola cuando el acopio se despacha; `pausado` no dice por qué, y el ciclo `activo ⇄ lleno ⇄ pausado → cerrado` lo pone a un paso de cerrar—. Un botón que abre Google Maps es una invitación a moverse, y ninguna versión de "no está recibiendo" justifica un viaje en bus con una caja. Lo que sí sirve: llamar antes. Por eso "Llamar" toma el estilo primario cuando queda sola.

Cambios que se derivan de la misma regla:
- El chip pasa de "Pausado" a **"Pausado — no recibe por ahora"**, en el patrón de "Lleno — ya no recibe". "Pausado" a secas nombra el estado del punto pero no contesta la única pregunta de quien lo lee. "Por ahora" carga el `⇄`: no está cerrado, vuelve. (`cerrado` se queda sin cola explicativa a propósito: es la única de las cuatro palabras que ya se entiende sola.)
- La regla alcanza `hrefDonar`, que hoy tampoco mira el estado: una campaña `cerrada` ofrece "Dona aquí" y ahí lo que se pierde es dinero. No estaba en el hallazgo; es la misma regla.

Hoy no hay ningún sitio `pausado`: esto es superficie latente, no un cambio visible. Por eso mismo había que escribirlo antes de que aparezca el primero.

**P6 — Borde de inputs a 1.40:1. → Se sube, solo en los campos que aceptan entrada.**

| | Antes | Ahora |
|---|---|---|
| `<select>` de ciudad, campo de búsqueda | `borde` `#D4DBE1` · **1.40** sobre `superficie` | `borde-control` **`#78848F`** · **3.82** sobre `superficie`, **3.40** sobre `fondo` |
| Tarjetas, paneles, separadores | `borde` `#D4DBE1` · **1.40** | sin cambio, ahora **declarado** como decorativo en §1 y §8 |
| Botones y chips de filtro | `borde` `#D4DBE1` | sin cambio |

El hallazgo era discutible en WCAG y real en la calle: bajo sol, con baja visión, un borde a 1.40 no existe, y un campo de búsqueda vacío sobre blanco no tiene otra cosa que lo delimite —su contenido es lo que la persona escribe, no una etiqueta que lo nombre—. Cuesta un hex. Se sube.

No se sube en botones ni chips, y la línea no es de conveniencia: esos controles llevan su propia palabra a 6.75:1 y al activarse se rellenan sólidos de `accion`. Su borde es trim, no identificación. Diez chips con borde oscuro en la fila más cargada de la pantalla habrían pesado justo donde el sistema promete estar quieto. `#78848F` se eligió con margen sobre los dos fondos del sistema (3.82 / 3.40) para que un campo pueda moverse fuera de la barra sin recalcular nada.

Esto obligó a reescribir §8, que prometía *«nada por debajo de AA 4.5 / 3.0»* — una promesa que el trim de tarjeta nunca cumplió y que la corrección de P6 volvía falsa de nuevo. Ahora §8 declara el alcance del piso y qué queda fuera, con la razón medida a la vista.

**P8 — `/campanas` sin estado vacío. → Copy definitivo + la regla que lo hace aparecer.**

> **"Todavía no hay campañas nacionales publicadas.**
> **Los puntos de ayuda con dirección siguen en la lista."** — Acción: **[Ver puntos de ayuda]**

El copy solo no bastaba: el encabezado "Dona desde cualquier lugar" se dibuja siempre, así que con dataset vacío el "(0)" habría sobrevivido al arreglo. Va con su regla estructural en §3 —sección sin elementos no se dibuja; ninguna sección con elementos ⇒ estado vacío de la página; y la portada no enlaza a `/campanas` con 0 campañas—.

"Ver puntos de ayuda" entra a la lista de acciones canónicas de §6 como espejo exacto de "Ver campañas". §6 gana además la gramática de los estados vacíos —hecho + salida, sin culpar y sin tono de error—, que estaba implícita en las cuatro filas existentes y ahora es explícita para las que vengan.

**Qué NO cambió:** los 6 colores núcleo · los textos y tintes de los 4 estados · las 10 categorías · las 2 tipografías y la escala · el elemento distintivo (riel de rumbo) · el revelado al tocar de §7 · el layout · el hex del marker del mapa.
