/**
 * Genera web/public/og.png (1200×630) desde scripts/og.html.
 *
 *   node scripts/og.mjs
 *
 * NO forma parte de `npm run build`, a propósito: el builder de Vercel no
 * tiene Chrome. La imagen se genera una vez, se versiona en git y se
 * regenera a mano solo si cambia el copy o la paleta.
 *
 * Cero dependencias: usa el Chrome ya instalado en el sistema (headless) y
 * verifica el resultado leyendo el header IHDR del PNG. Chrome se lanza con un
 * `--user-data-dir` temporal para no tocar el perfil del usuario ni fallar si
 * ya hay un Chrome abierto.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = resolve(fileURLToPath(import.meta.url), "..");
const ENTRADA = join(AQUI, "og.html");
const SALIDA = resolve(AQUI, "..", "public", "og.png");
const ANCHO = 1200;
const ALTO = 630;

const CANDIDATOS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function buscarChrome() {
  const delEntorno = process.env.CHROME_BIN;
  if (delEntorno && existsSync(delEntorno)) return delEntorno;
  const hallado = CANDIDATOS.find((c) => existsSync(c));
  if (!hallado) {
    throw new Error(
      "No encontré Chrome. Instálalo o exporta CHROME_BIN=/ruta/al/binario.",
    );
  }
  return hallado;
}

/** Lee ancho y alto del chunk IHDR: bytes 16–23 de un PNG bien formado. */
function dimensionesPng(ruta) {
  const b = readFileSync(ruta);
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!b.subarray(0, 8).equals(firma)) throw new Error("El archivo no es un PNG.");
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

/**
 * Dispara el screenshot y espera al ARCHIVO, no al proceso.
 *
 * Chrome headless moderno (verificado en 151) escribe el PNG correctamente
 * pero NO termina solo tras `--screenshot`: se queda vivo indefinidamente. Así
 * que se espera a que el archivo aparezca y deje de crecer, y luego se mata el
 * proceso. Sin esto el script cuelga para siempre.
 */
async function capturar(chrome, perfil) {
  if (existsSync(SALIDA)) unlinkSync(SALIDA);

  const proc = spawn(
    chrome,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${perfil}`,
      // Sin escalado: 1 px de CSS = 1 px del PNG (si no, sale 2400×1260).
      "--force-device-scale-factor=1",
      `--window-size=${ANCHO},${ALTO}`,
      "--default-background-color=FFFFFFFF",
      `--screenshot=${SALIDA}`,
      `file://${ENTRADA}`,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  try {
    let estable = -1;
    for (let i = 0; i < 120; i++) {
      await esperar(500);
      if (!existsSync(SALIDA)) continue;
      const tam = statSync(SALIDA).size;
      // Dos lecturas seguidas con el mismo tamaño (> 0) = terminó de escribir.
      if (tam > 0 && tam === estable) return;
      estable = tam;
    }
    throw new Error("Chrome no produjo el PNG en 60 s.");
  } finally {
    proc.kill("SIGKILL");
  }
}

const chrome = buscarChrome();
const perfil = mkdtempSync(join(tmpdir(), "og-chrome-"));

try {
  await capturar(chrome, perfil);
} finally {
  rmSync(perfil, { recursive: true, force: true });
}

const { ancho, alto } = dimensionesPng(SALIDA);
const bytes = statSync(SALIDA).size;
const kb = (bytes / 1024).toFixed(1);

if (ancho !== ANCHO || alto !== ALTO) {
  throw new Error(`Dimensiones incorrectas: ${ancho}×${alto} (esperaba ${ANCHO}×${ALTO}).`);
}
if (bytes > 100 * 1024) {
  throw new Error(`og.png pesa ${kb} KB: el presupuesto es < 100 KB.`);
}

process.stdout.write(`og.png ${ancho}x${alto} ${kb} KB -> ${SALIDA}\n`);
