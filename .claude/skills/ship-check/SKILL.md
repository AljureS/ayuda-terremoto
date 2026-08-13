---
name: ship-check
description: Puerta de salida a producción — corre la secuencia completa de verificación (datos válidos, build, hosts externos, headers, Open Graph, Lighthouse) y entrega un veredicto GO/NO-GO con los pasos exactos de deploy. Úsalo siempre antes de publicar o cuando el usuario diga "vamos a deployar / publicar".
---

Corre la secuencia completa y reporta cada paso como ✅ / ❌ / ⚠️ (⚠️ = no verificable ahora; di por qué). **No pares en el primer fallo:** completa toda la secuencia y prioriza al final.

1. **Datos:** `/validate-data` en verde.
2. **Build:** `cd web && npm run build` sin errores → `out/` existe y contiene `index.html`.
3. **Privacidad rápida:** hosts externos en el build —
   `grep -rhoE "https?://[a-zA-Z0-9.-]+" web/out --include="*.html" --include="*.js" --include="*.css" | sort -u`
   Solo deben aparecer tiles de OSM y links de navegación legítimos (Google Maps dir, fuentes oficiales, mailto). Cualquier otro host = ❌. Esta es la verificación rápida; si `/web` cambió desde la última auditoría profunda, corre también `/privacy-audit`.
4. **Headers:** `vercel.json` presente en la raíz con CSP, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` y `Permissions-Policy` con geolocation.
5. **Compartibilidad (WhatsApp):** en `out/index.html` — `<html lang="es">` · `<title>` ≤ 60 caracteres · meta description · og:title · og:description · og:image apuntando a un archivo que existe en `out/`.
6. **Lighthouse móvil** (sirviendo `out/` en local): performance > 90, accesibilidad ≥ 95. Sin Chrome disponible → ⚠️ y dilo en el veredicto.
7. **Veredicto:**
   - **GO** → entrega los pasos exactos: primer deploy (Vercel → repo → Root Directory `web`) o redeploy (commit + push a `main`). Después del deploy: `curl -I` a la URL de producción para confirmar los headers, y abrir el sitio desde un celular.
   - **NO-GO** → lista priorizada de fixes y a qué agente pasar cada uno (`web-engineer`, `data-pipeline`, `design-director`, `docs-ops`).
