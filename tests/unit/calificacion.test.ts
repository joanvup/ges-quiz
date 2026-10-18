import { describe, expect, it } from 'vitest';
import {
  calificarRespuesta,
  hayRespuesta,
  normalizarSeleccion,
  normalizarTexto,
  type OpcionPregunta,
} from '@/lib/intentos/reglas';

const opciones = (
  ...entradas: Array<[string, string, boolean]>
): OpcionPregunta[] =>
  entradas.map(([id, text, isCorrect]) => ({ id, text, isCorrect }));

describe('normalizarTexto', () => {
  it('ignora mayusculas, tildes, signos y espacios repetidos', () => {
    expect(normalizarTexto('  El   SOL, es una Estrella! ')).toBe('el sol es una estrella');
  });

  it('devuelve cadena vacia para textos sin letras ni numeros', () => {
    expect(normalizarTexto('   ¿?!!  ')).toBe('');
  });
});

describe('calificarRespuesta - opcion unica y verdadero/falso', () => {
  const single = opciones(['a', 'Mercurio', false], ['b', 'Jupiter', true], ['c', 'Venus', false]);

  it('acepta exactamente la opcion correcta', () => {
    expect(calificarRespuesta('MCQ_SINGLE', single, ['b'], '')).toBe(true);
  });

  it('rechaza una opcion incorrecta', () => {
    expect(calificarRespuesta('MCQ_SINGLE', single, ['a'], '')).toBe(false);
  });

  it('rechaza la respuesta vacia', () => {
    expect(calificarRespuesta('MCQ_SINGLE', single, [], '')).toBe(false);
  });

  it('rechaza opciones desconocidas', () => {
    expect(calificarRespuesta('MCQ_SINGLE', single, ['z'], '')).toBe(false);
  });
});

describe('calificarRespuesta - seleccion multiple', () => {
  const multi = opciones(['a', 'A', true], ['b', 'B', true], ['c', 'C', false]);

  it('acepta todas y solo las correctas', () => {
    expect(calificarRespuesta('MCQ_MULTI', multi, ['b', 'a'], '')).toBe(true);
  });

  it('rechaza si falta una correcta', () => {
    expect(calificarRespuesta('MCQ_MULTI', multi, ['a'], '')).toBe(false);
  });

  it('rechaza si se agrega una incorrecta', () => {
    expect(calificarRespuesta('MCQ_MULTI', multi, ['a', 'b', 'c'], '')).toBe(false);
  });
});

describe('calificarRespuesta - respuesta corta', () => {
  const corta = opciones(['a', 'El Sol', true], ['b', 'sol', true]);

  it('acepta el texto normalizado (mayusculas y tildes)', () => {
    expect(calificarRespuesta('SHORT_ANSWER', corta, [], '  el   SOL ')).toBe(true);
  });

  it('acepta cualquiera de las respuestas equivalentes', () => {
    expect(calificarRespuesta('SHORT_ANSWER', corta, [], 'Sol')).toBe(true);
  });

  it('rechaza un texto distinto', () => {
    expect(calificarRespuesta('SHORT_ANSWER', corta, [], 'la luna')).toBe(false);
  });

  it('rechaza la respuesta vacia', () => {
    expect(calificarRespuesta('SHORT_ANSWER', corta, [], '   ')).toBe(false);
  });

  it('rechaza cuando la pregunta no tiene respuesta marcada', () => {
    const sinClave = opciones(['a', 'Mercurio', false]);
    expect(calificarRespuesta('SHORT_ANSWER', sinClave, [], 'Mercurio')).toBe(false);
  });
});

describe('normalizarSeleccion', () => {
  it('limita a una sola opcion en preguntas de respuesta unica', () => {
    expect(normalizarSeleccion('MCQ_SINGLE', ['a', 'b', 'c'], ['a', 'b'])).toEqual(['a']);
  });

  it('conserva varias opciones validas en seleccion multiple', () => {
    expect(normalizarSeleccion('MCQ_MULTI', ['a', 'b', 'c'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('descarta identificadores desconocidos y duplicados', () => {
    expect(normalizarSeleccion('MCQ_MULTI', ['a', 'b'], ['a', 'a', 'z'])).toEqual(['a']);
  });

  it('ignora cualquier opcion en respuestas cortas', () => {
    expect(normalizarSeleccion('SHORT_ANSWER', ['a', 'b'], ['a'])).toEqual([]);
  });
});

describe('hayRespuesta', () => {
  it('detecta opciones seleccionadas', () => {
    expect(hayRespuesta(['a'], '')).toBe(true);
  });

  it('detecta texto con contenido', () => {
    expect(hayRespuesta([], '  algo ')).toBe(true);
  });

  it('considera vacia la respuesta sin opciones ni texto', () => {
    expect(hayRespuesta([], '   ')).toBe(false);
  });
});
