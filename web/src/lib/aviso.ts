/**
 * El aviso de actualización de la portada: QUÉ frase decir, dado el estado real
 * del pipeline (W9). Módulo PURO —sin fs, sin JSX, sin `Date.now()`— para que
 * las cuatro ramas se puedan probar con fixtures sin construir el sitio.
 *
 * LA REGLA QUE GOBIERNA TODO ESTE ARCHIVO: el texto se DERIVA de los sellos
 * reales; jamás hay una constante que afirme una frescura que los datos no
 * tienen. Ninguna combinación de entradas produce una frase que diga "revisado
 * hoy" sobre un pipeline caído.
 *
 * LAS DOS VERDADES, que hasta W8 estaban colapsadas en una sola:
 *  - REVISIÓN: cuándo se miraron las fuentes. Dice si el sistema está vivo.
 *  - CAMBIO: cuándo cambiaron los datos. Dice cuán fresco es lo que se lee.
 * Colapsarlas hacía que tres días sin novedades se leyeran como abandono. Son
 * cosas distintas y ahora se dicen por separado.
 *
 * EVIDENCIA EN VEZ DE PROMESA — el cambio de voz de W9, y la razón por la que
 * ninguna rama con latido dice ya "esta lista se actualiza sola una vez al
 * día". Esa frase era una promesa que la persona no puede verificar, y era
 * además la primera en volverse mentira cuando la Action falla (por eso la
 * rama de revisión vieja ya la había tenido que soltar). Un sello de hace 2 h
 * prueba lo mismo y lo prueba solo. El ritmo —que existe y es real— vive
 * explicado en /acerca, que es donde cabe el párrafo.
 * No es una decisión estética: la promesa cuesta ~30 caracteres, y medido en
 * Chrome eso es una CUARTA línea del aviso a 320 y 360 px, que empuja la
 * primera tarjeta 22 px más abajo justo en las pantallas donde ya asomaba
 * apenas. Con la forma corta, el caso normal ocupa MENOS que el aviso que se
 * publica hoy. La lista es el héroe (DESIGN.md §0): el contexto no le quita
 * pantalla.
 */

/** Un instante, ya resuelto en build time (nunca se calcula en el cliente). */
export interface Instante {
  /** "hace 3 h" / "hace 2 días" — `haceTexto()`, el mismo de las tarjetas. */
  hace: string;
  /** Horas crudas: eligen la rama. El número manda sobre el texto. */
  horas: number;
  /** Sello ISO: va al atributo `datetime`, que —a diferencia del texto
   * relativo, congelado en la build— no envejece. */
  iso: string;
}

/** Estado de frescura que la portada le pasa al aviso. */
export interface Frescura {
  /**
   * Último CAMBIO de los datos. Siempre existe: sale del latido y, si no hay
   * latido, del sello `actualizado` de sitios.json, que significa lo mismo.
   */
  cambio: Instante;
  /** Última REVISIÓN de fuentes. Solo existe si hay latido. */
  revision?: Instante;
  /** ¿La última revisión trajo novedades? (campo `huboCambios` del latido) */
  huboCambios?: boolean;
}

/**
 * Rama elegida. Se expone —y viaja al DOM como `data-caso`— para que las
 * pruebas y la auditoría puedan afirmar QUÉ caso se está viendo sin leer la
 * prosa, y para que un cambio de copy no rompa una prueba de lógica.
 */
export type CasoAviso =
  | "revisado-con-cambios"
  | "revisado-sin-novedades"
  | "cambio-fuera-de-revision"
  | "revision-vieja"
  | "sin-latido-al-dia"
  | "sin-latido-desfasado";

/** Texto plano, o un instante que el componente envuelve en `<time>`. */
export type Segmento = string | Instante;

export interface Aviso {
  caso: CasoAviso;
  /** El contexto: se concatena tal cual, con los `<time>` intercalados. */
  segmentos: Segmento[];
  /** La orden, siempre la misma y siempre al final (DESIGN.md §6). */
  orden: string;
}

/**
 * DESVIACIÓN DECLARADA de DESIGN.md §6, heredada de W8 y ratificada aquí: la
 * cadena canónica es "Verifica el punto antes de desplazarte: los horarios y
 * las necesidades cambian rápido." En el aviso va SIN la cola explicativa,
 * por una razón medida —con ella el aviso gana una línea a 320 px y empuja la
 * primera tarjeta otros 22 px bajo el pliegue—. La orden está entera en la
 * mitad que se conserva y la frase completa sigue literal en /acerca, que es a
 * quien §6 se la asigna.
 */
const ORDEN = "Verifica el punto antes de desplazarte.";

/**
 * A partir de cuántas horas una revisión es "vieja" y el aviso deja de recitar
 * el ritmo para avisar que algo se rompió.
 *
 * 30 = las 24 h del ritmo + 6 h de holgura. La holgura no es un redondeo
 * cómodo: el cron de GitHub Actions es "mejor esfuerzo" y puede demorarse, y
 * una build disparada por un cambio de CÓDIGO puede caer 24,x h después de la
 * última corrida sin que nada esté roto. Con el latido publicándose todos los
 * días, la revisión en build es de minutos; pasar de 30 h significa que la
 * Action lleva un ciclo entero sin correr, que es justo lo que hay que decir.
 */
const HORAS_REVISION_VIEJA = 30;

/**
 * El ritmo prometido, para la rama SIN latido. Es el umbral de W8 y se
 * conserva idéntico: sin latido no sabemos nada de revisiones, solo la edad
 * del sello, y esa era —y sigue siendo— la única lectura honesta posible.
 */
const HORAS_DE_PROMESA = 24;

/** Una hora de tolerancia entre los dos sellos = "son la misma corrida". */
const MISMA_CORRIDA_MS = 3_600_000;

export function construirAviso(f: Frescura): Aviso {
  const r = f.revision;

  // ── Sin latido: el comportamiento de W8, intacto ──────────────────────────
  // El archivo puede no existir todavía. Sin él no se puede distinguir "no
  // hubo novedades" de "nadie revisó", así que no se afirma ninguna de las
  // dos: se dice lo único que se sabe, la edad del dato.
  if (!r) {
    const desfasado = f.cambio.horas > HORAS_DE_PROMESA;
    return {
      caso: desfasado ? "sin-latido-desfasado" : "sin-latido-al-dia",
      segmentos: [
        "Esta lista se actualiza sola una vez al día",
        desfasado ? ", pero la última fue " : "; la última fue ",
        f.cambio,
        ".",
      ],
      orden: ORDEN,
    };
  }

  const revisionVieja = r.horas > HORAS_REVISION_VIEJA;
  // El cambio lo trajo ESA revisión: `huboCambios` lo declara y los sellos lo
  // confirman. Se piden las dos cosas porque el número es lo que se imprime:
  // si el archivo se contradice a sí mismo, se cae a la rama de dos hechos,
  // que solo afirma sellos y por eso no puede mentir.
  const cambioEnLaRevision =
    f.huboCambios === true &&
    Math.abs(Date.parse(r.iso) - Date.parse(f.cambio.iso)) < MISMA_CORRIDA_MS;

  // ── Revisión fresca + novedades: el caso normal ───────────────────────────
  // Cuando la última corrida cambió los datos, revisión y cambio son el MISMO
  // instante: dar dos números iguales sería ruido, así que va uno solo.
  if (cambioEnLaRevision && !revisionVieja) {
    return {
      caso: "revisado-con-cambios",
      segmentos: ["Las fuentes se revisaron ", r, " y trajeron novedades."],
      orden: ORDEN,
    };
  }

  // ── Los datos cambiaron DESPUÉS de la última revisión ─────────────────────
  // No es un caso raro: marcar un punto como lleno a mano es la operación más
  // frecuente de la emergencia, y toca el sello de sitios.json sin tocar el
  // latido. Va ANTES de la rama de revisión vieja a propósito: si alguien
  // corrigió el dato hace una hora, decir "los datos pueden estar viejos"
  // porque la Action lleva tres días caída sería falso donde importa —lo que
  // la persona lee está fresco—. La rama solo afirma el sello más reciente.
  if (f.cambio.horas < r.horas) {
    return {
      caso: "cambio-fuera-de-revision",
      segmentos: ["La lista cambió por última vez ", f.cambio, "."],
      orden: ORDEN,
    };
  }

  // ── Revisión vieja: la Action falló o nadie corrió el pipeline ────────────
  // La única rama que sube el tono, y lo sube con un hecho, no con un color ni
  // un ícono de alarma (DESIGN.md §0: códigos humanitarios, nunca de alarma).
  // Es la señal útil de que algo se rompió.
  if (revisionVieja) {
    return {
      caso: "revision-vieja",
      segmentos: [
        "Las fuentes no se revisan desde ",
        r,
        ": los datos pueden estar viejos.",
      ],
      orden: ORDEN,
    };
  }

  // ── Revisión fresca + sin novedades: el caso que motivó W9 ────────────────
  // Antes esto se leía "la última actualización fue hace 4 días" —abandono—.
  // El ORDEN de la frase es la corrección: primero la vigilancia (se revisó
  // hace 2 h), después la frescura real del dato (sin novedades desde hace 4
  // días). Los dos puntos hacen el trabajo causal: lo segundo es consecuencia
  // de lo primero, no un descuido. Cubre por igual un cambio de hace 20 h y
  // uno de hace 4 días: en los dos la frase es cierta y ninguno es una falla.
  return {
    caso: "revisado-sin-novedades",
    segmentos: [
      "Las fuentes se revisaron ",
      r,
      ": sin novedades desde ",
      f.cambio,
      ".",
    ],
    orden: ORDEN,
  };
}

/** El aviso como texto plano. Para pruebas y auditoría, no para render. */
export function avisoPlano(a: Aviso): string {
  const contexto = a.segmentos
    .map((s) => (typeof s === "string" ? s : s.hace))
    .join("");
  return `${contexto} ${a.orden}`;
}
