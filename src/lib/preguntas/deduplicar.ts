/**
 * Deteccion de preguntas duplicadas.
 *
 * Estrategia en dos niveles:
 *  1. Huella exacta (sha1 del enunciado normalizado) -> duplicado exacto.
 *  2. Similitud de Jaccard sobre el conjunto de palabras -> duplicado
 *     aproximado (por ejemplo, la misma pregunta redactada con ligeras
 *     variaciones o repetida en fragmentos con solape).
 */

const UMBRAL_SIMILITUD = 0.82;

export function normalizarEnunciado(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function palabras(texto: string): Set<string> {
  return new Set(
    normalizarEnunciado(texto)
      .split(' ')
      .filter((palabra) => palabra.length > 2),
  );
}

/** Indice de Jaccard entre dos enunciados (0 a 1). */
export function similitud(a: string, b: string): number {
  const conjuntoA = palabras(a);
  const conjuntoB = palabras(b);
  if (conjuntoA.size === 0 || conjuntoB.size === 0) return 0;
  let interseccion = 0;
  for (const palabra of conjuntoA) {
    if (conjuntoB.has(palabra)) interseccion += 1;
  }
  const union = conjuntoA.size + conjuntoB.size - interseccion;
  return union === 0 ? 0 : interseccion / union;
}

export type PreguntaExistente = { enunciado: string; huella: string | null };

/** Indica si un enunciado ya existe (exacto o muy parecido). */
export function estaDuplicada(
  enunciado: string,
  huella: string,
  existentes: PreguntaExistente[],
  umbral = UMBRAL_SIMILITUD,
): boolean {
  for (const existente of existentes) {
    if (existente.huella && existente.huella === huella) return true;
    if (similitud(enunciado, existente.enunciado) >= umbral) return true;
  }
  return false;
}
