/**
 * Manejo del ano escolar. Se guarda como texto para admitir tanto un ano suelto
 * ("2026") como un ciclo lectivo de dos anos ("2026-2027").
 */

export const ANIO_MIN = 2000;
export const ANIO_MAX = 2100;

export const MENSAJE_ANIO =
  'Usa un ano escolar como 2026 o un ciclo como 2026-2027.';

/**
 * Normaliza un ano escolar escrito de formas distintas a su forma canonica.
 * Acepta `2026`, `2026-2027`, `2026/2027`, `2026-27` y `2026 - 2027`.
 * Devuelve `null` si no es valido.
 */
export function normalizarAnioEscolar(entrada: string): string | null {
  const texto = entrada
    .trim()
    .replace(/^'+/, '') // El apostrofo inicial que Excel usa para forzar texto.
    .replace(/\s*[-–—/]\s*/g, '-')
    .replace(/\s+/g, '');

  const coincidencia = /^(\d{4})(?:-(\d{2}|\d{4}))?$/.exec(texto);
  if (!coincidencia) return null;

  const inicio = Number(coincidencia[1]);
  if (inicio < ANIO_MIN || inicio > ANIO_MAX) return null;

  const sufijo = coincidencia[2];
  if (!sufijo) return String(inicio);

  let fin = Number(sufijo);
  if (sufijo.length === 2) {
    // "2026-27" -> "2026-2027"
    fin = Math.floor(inicio / 100) * 100 + fin;
    if (fin < inicio) fin += 100;
  }

  if (fin !== inicio + 1) return null;
  return `${inicio}-${fin}`;
}

/** Ano escolar por defecto: el ciclo que comienza este ano natural. */
export function anioEscolarActual(ahora: Date = new Date()): string {
  const inicio = ahora.getFullYear();
  return `${inicio}-${inicio + 1}`;
}
