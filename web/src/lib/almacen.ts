/**
 * localStorage con OPT-IN — contrato + DESIGN.md §7.
 *
 * Nada se escribe sin que la persona lo pida con un control explícito
 * ("Recordar mis filtros…" / "Recordar mi ubicación…"). Todas las claves del
 * sitio llevan el prefijo "ma:" para que "Borrar mis datos" pueda enumerarlas
 * y borrarlas TODAS sin mantener una lista a mano.
 *
 * TODO acceso va en try/catch: Safari en modo privado (versiones viejas)
 * lanza QuotaExceededError en setItem, y hay navegadores que lanzan con solo
 * tocar window.localStorage (cookies bloqueadas). La app jamás crashea por
 * esto — la escritura devuelve false y la UI comunica que no puede recordar.
 */

export const PREFIJO = "ma:";
export const CLAVE_FILTROS = `${PREFIJO}filtros`;
export const CLAVE_UBICACION = `${PREFIJO}ubicacion`;

export function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** true si quedó guardado; false si el navegador lo bloquea (modo privado). */
export function escribir(clave: string, valor: string): boolean {
  try {
    window.localStorage.setItem(clave, valor);
    return true;
  } catch {
    return false;
  }
}

export function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    /* bloqueado: no había nada que borrar */
  }
}

/** Borra TODAS las claves del sitio, enumerando por prefijo. */
export function borrarTodo(): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIJO)) claves.push(k);
    }
    for (const k of claves) window.localStorage.removeItem(k);
  } catch {
    /* bloqueado: no hay nada guardado que borrar */
  }
}
