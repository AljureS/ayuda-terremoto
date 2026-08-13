# El equipo — Mapa de Ayuda

Equipo experto de subagentes y skills para construir y operar el proyecto descrito en `docs/MASTER_PROMPT.md`. Diseñado como un equipo seed de startup: poca gente, mucha seniority, territorios claros, y revisión adversarial integrada — no como paso opcional sino como puerta de salida. Las decisiones técnicas y fronteras del sistema están en `docs/architecture.md`; el mapa de propiedad (quién es dueño de qué componente) vive en su §8.

## Cómo funciona

- **La sesión principal de Claude es el tech lead**: entiende el pedido, decide, delega a los agentes y responde ante ti.
- **Los agentes** (`.claude/agents/*.md`) son especialistas con territorio y reglas propias. Los constructores escriben código; los auditores solo reportan (separación deliberada: quien audita no se audita a sí mismo).
- **Los skills** (`.claude/skills/*/`) son los rituales operativos repetibles: se invocan con `/nombre` o se activan solos cuando el pedido coincide. Codifican los procedimientos que el MASTER_PROMPT exige (mostrar el mapeo antes de convertir, verificar privacidad dos veces, etc.).
- Los agentes y skills nuevos quedan disponibles al reiniciar la sesión de Claude Code.

## Roster

### `data-pipeline` — Ingeniero de datos
Territorio: `/scraper` y `/data`. Único que escribe `sitios.json`. Sabe: importación del Google Sheet con aprobación de mapeo, scraping ético (robots.txt, delays, UA con correo), Nominatim con caché y normalización de direcciones bogotanas, dedupe por nombre/distancia, merge que jamás toca `manual: true`.
> Ejemplo: "Construye el importador de la Fase 0" · "Agrega el scraper de la Cruz Roja"

### `web-engineer` — Ingeniero frontend
Territorio: `/web`. Sabe: Next.js con export estático y sus limitaciones, las trampas de Leaflet en Next (ssr:false, divIcon), geolocalización que nunca sale del dispositivo, CSP en `vercel.json`, presupuestos de peso para 3G.
> Ejemplo: "Implementa la vista de lista con filtros" · "Agrega el botón de usar mi ubicación"

### `design-director` — Dirección de diseño y contenido
Entrega el mini sistema de diseño **antes** de que se escriba UI (paleta, tipografías, layout, el elemento distintivo) y es dueño del copy en español y del Open Graph para WhatsApp. Después, guardián de la disciplina visual.
> Ejemplo: "Propón el sistema de diseño" · "Revisa que la tarjeta de sitio siga `docs/DESIGN.md`"

### `privacy-auditor` — Auditor adversarial (solo lectura)
Su misión es intentar demostrar que la promesa de privacidad es falsa: rastrea el flujo de la geolocalización, greppea el build en busca de hosts externos, inventaría localStorage, revisa la CSP y la ética del scraper. Reporta con severidad y veredicto GO/NO-GO. No edita nada.
> Ejemplo: "Audita la privacidad antes del deploy" (o directamente `/privacy-audit`)

### `qa-performance` — QA y rendimiento
Corre builds y Lighthouse móvil, verifica presupuestos (perf > 90, a11y ≥ 95, JS inicial ≤ 180 KB gz), y ejecuta la matriz de edge cases: geolocalización denegada, coordenadas nulas, 0 resultados, localStorage bloqueado, tiles caídos. Reporta; no arregla código de producción.
> Ejemplo: "Pasa QA a la web antes de publicar"

### `docs-ops` — Documentación y operación
Escribe el README y los runbooks para una sola persona operando con prisa: cómo correr el pipeline, cómo marcar un punto como `lleno` a mano, cómo deployar en Vercel, cómo agregar una ciudad. Regla: nada se documenta sin haberse ejecutado.
> Ejemplo: "Escribe el README y el checklist de deploy"

## Skills (rituales)

| Skill | Qué hace | Cuándo |
|---|---|---|
| `/import-sheet` | Fase 0: baja los CSV del Sheet (todas las pestañas), muestra columnas y mapeo, espera aprobación, convierte | Al arrancar, y cada vez que la hoja comunitaria se actualice |
| `/pipeline` | Corre `build:data` completo, verifica que ningún `manual: true` cambió, presenta el diff y ofrece commit | Actualización diaria de datos |
| `/validate-data` | Schema zod + calidad: ids duplicados, coords nulas o fuera de Colombia, datos > 72 h, fuentes vacías | Tras cualquier cambio de datos |
| `/nuevo-sitio` | Alta manual de un punto: campos mínimos, slug estable, geocodifica, `manual: true`, valida | Cuando llega un dato por WhatsApp/llamada |
| `/estado` | Cambia estado de un punto (`lleno`, `cerrado`…) con `manual: true` y timestamps; la operación más frecuente | "Marca X como lleno" |
| `/privacy-audit` | Lanza al `privacy-auditor` sobre código + build; tabla de hallazgos y GO/NO-GO | Tras cambios en `/web`, siempre antes de deploy |
| `/ship-check` | Puerta de salida: datos válidos → build → hosts externos → headers → OG → Lighthouse → veredicto + pasos de deploy | Siempre antes de publicar |

## Skills de referencia (guías instaladas)

Además de los rituales, hay dos skills de terceros instalados a nivel de proyecto (`.claude/skills/`, versionados en `skills-lock.json`). No son procedimientos: son conocimiento que los agentes consultan mientras construyen. Ambos fueron auditados antes de instalar: solo markdown, sin scripts ni ejecutables.

| Skill | Fuente | Qué aporta | Quién lo usa y cuándo |
|---|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Método para diseño visual intencional y no genérico: fundamentar en el sujeto, tipografía con carácter, un solo elemento distintivo, crítica antes de codear | `design-director` al proponer el sistema; `web-engineer` al construir UI nueva. **Jerarquía:** el MASTER_PROMPT y `docs/DESIGN.md` mandan sobre el skill — aquí la dirección es sobria y disciplinada, y el propio skill lo respeta ("el brief siempre gana") |
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | ~70 reglas de rendimiento React/Next con ejemplos incorrecto/correcto, priorizadas por impacto (`rules/*.md`) | `web-engineer` al escribir componentes; `qa-performance` como checklist de revisión. **Alcance:** aplican `bundle-`, `rerender-`, `rendering-`, `client-` y `js-`; las `server-*` y `async-api-routes` no aplican (export estático, sin backend). `client-swr-dedup` tampoco: aquí no hay data fetching en cliente |

Para actualizarlos: `npx skills update` (verifica el diff antes de aceptar — son dependencias de terceros).

## Fases → responsables

| Fase | Lidera | Apoya | Puerta de calidad |
|---|---|---|---|
| 1. Scaffolding + schema + zod | `data-pipeline` | `docs-ops` (higiene de repo) | `/validate-data` |
| 2. Fase 0: importar el Sheet | `data-pipeline` vía `/import-sheet` | — | Mapeo aprobado por ti + `/validate-data` |
| 3. Web (mapa, lista, filtros, distancia) | `web-engineer` | `design-director` (sistema **antes** de codear) | `qa-performance` + `/privacy-audit` |
| 4. Scraper + pipeline de merge | `data-pipeline` | `privacy-auditor` (ética de scraping) | `/pipeline` + `/validate-data` |
| 5. README + deploy | `docs-ops` | todos | `/ship-check` |

## Flujo de calidad

```
constructor (data-pipeline / web-engineer)
        │  entrega
        ▼
auditor (privacy-auditor / qa-performance)   ← adversarial, solo reporta
        │  hallazgos → vuelven al constructor
        ▼
ritual de salida (/ship-check)               ← GO / NO-GO
        │  GO
        ▼
push a main → Vercel redeploya
```

## Ajustar el equipo

Cada agente es un archivo en `.claude/agents/`, cada skill una carpeta en `.claude/skills/`. Edítalos como cualquier archivo del repo: son parte del proyecto y se versionan con él.
