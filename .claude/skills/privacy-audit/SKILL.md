---
name: privacy-audit
description: Auditoría completa de privacidad — la "verificación doble" que exige el proyecto. Lanza al agente privacy-auditor sobre el código y el build de /web y sobre la ética del scraper; presenta los hallazgos con severidad y un veredicto GO/NO-GO. Úsalo después de cambios en /web y siempre antes de un deploy.
---

La promesa del banner — "Tu ubicación se usa solo en tu dispositivo y nunca se envía a ningún servidor" — tiene que ser literalmente cierta. Este skill es la verificación doble que exige el contrato (`docs/MASTER_PROMPT.md`); el modelo de privacidad contra el que se audita está en `docs/architecture.md` §4.

1. **Asegura material auditable:** si `/web` existe, corre `cd web && npm run build` para tener `out/` fresco — se audita lo que se sirve, no solo el fuente. Si la web aún no existe, la auditoría cubre lo que haya (scraper, datos) y lo dice explícitamente.
2. **Lanza el agente `privacy-auditor`** con este alcance completo:
   - Flujo de la geolocalización de punta a punta (¿a dónde llegan las coordenadas?).
   - Requests de red en código y en `out/` — hosts externos reales servidos.
   - Cookies y storage: inventario de claves, gate de opt-in de cada una, y que "Borrar mis datos" borre todas.
   - Terceros ejecutando código: la cifra correcta es cero (Google Fonts incluido).
   - Headers en `vercel.json`: CSP estricta, Referrer-Policy, X-Content-Type-Options, Permissions-Policy.
   - `rel="noopener noreferrer"` en links externos; el deep link "Cómo llegar" sin coordenada del usuario.
   - Ética del scraper: robots.txt, delays ≥ 2 s, User-Agent con correo, Nominatim ≤ 1 req/s con caché, `fuente` poblado, registros `manual: true` intactos.
3. **Presenta al usuario:** tabla de hallazgos (severidad · archivo:línea · evidencia · fix recomendado) + veredicto **GO / NO-GO** + la lista de qué se verificó.
4. **Si hay hallazgos críticos o altos:** NO-GO. Pasa la lista de fixes al agente que corresponda (`web-engineer` o `data-pipeline`) y re-audita después de los arreglos — el veredicto GO solo sale de una auditoría limpia, no de "ya lo arreglé".
