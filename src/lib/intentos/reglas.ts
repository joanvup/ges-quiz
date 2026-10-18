/**
 * Reglas puras del motor de intentos: normalizacion de respuestas, calificacion
 * y decisiones de navegacion. Se aislan aqui (sin Prisma ni red) para poder
 * probarlas con pruebas unitarias y para dejar una unica fuente de verdad de la
 * logica que corre en el servidor.
 */

export type OpcionPregunta = { id: string; text: string; isCorrect: boolean };

/** Normaliza un texto: minusculas, sin tildes, sin signos y con espacios simples. */
export function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Califica una respuesta.
 *
 *  - SHORT_ANSWER: se comparan los textos normalizados contra las opciones
 *    marcadas como correctas (varias respuestas equivalentes son validas).
 *  - Opcion multiple / verdadero-falso: la seleccion debe coincidir exactamente
 *    con el conjunto de opciones correctas (todas y solo esas).
 */
export function calificarRespuesta(
  tipo: string,
  opciones: OpcionPregunta[],
  seleccion: string[],
  texto: string,
): boolean {
  if (tipo === 'SHORT_ANSWER') {
    const normalizada = normalizarTexto(texto);
    if (!normalizada) return false;
    const aceptadas = opciones
      .filter((opcion) => opcion.isCorrect)
      .map((opcion) => normalizarTexto(opcion.text));
    return aceptadas.includes(normalizada);
  }

  const esperadas = opciones.filter((opcion) => opcion.isCorrect).map((opcion) => opcion.id);
  const seleccionadas = new Set(seleccion);
  return (
    esperadas.length > 0 &&
    esperadas.length === seleccionadas.size &&
    esperadas.every((id) => seleccionadas.has(id))
  );
}

/**
 * Normaliza la seleccion enviada por el cliente contra las opciones reales de
 * la pregunta: descarta ids desconocidos, elimina duplicados y limita a una
 * sola opcion salvo en preguntas de seleccion multiple.
 */
export function normalizarSeleccion(
  tipo: string,
  opcionesValidas: string[],
  seleccion: string[],
): string[] {
  if (tipo === 'SHORT_ANSWER') return [];
  const validas = new Set(opcionesValidas);
  const limpias = [...new Set(seleccion)].filter((id) => validas.has(id));
  const maximo = tipo === 'MCQ_MULTI' ? validas.size : 1;
  return limpias.slice(0, Math.max(1, maximo));
}

/** Indica si el intento puede retroceder a la pregunta anterior. */
export function puedeRetroceder(navegacion: string, posicion: number): boolean {
  return navegacion === 'FREE' && posicion > 0;
}

/** Indica si una respuesta guardada tiene contenido (opciones o texto). */
export function hayRespuesta(opciones: string[], texto: string): boolean {
  return opciones.length > 0 || texto.trim().length > 0;
}
