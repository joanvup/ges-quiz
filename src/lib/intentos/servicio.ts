import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ErrorApi, conflicto, noEncontrado, sinPermiso } from '@/lib/http';
import {
  EVENTOS_INFRACCION,
  type AccionInfraccion,
  type TipoEventoProctor,
} from '@/lib/dominio/constantes';
import { auditar, ACCIONES } from '@/lib/audit';
import {
  calificarRespuesta,
  hayRespuesta,
  normalizarSeleccion,
  puedeRetroceder,
} from './reglas';
import type {
  EstadoIntentoDto,
  EstadoQuizEstudiante,
  EventoProctorDto,
  IntentoDocenteDto,
  PreguntaEnCursoDto,
  QuizEstudianteDto,
  ResultadoIntentoDto,
  ResultadoPreguntaDto,
  ResumenIntentoDto,
} from '@/lib/cliente/tipos';

/* ------------------------------------------------------------------ *
 * Inclusiones y tipos
 * ------------------------------------------------------------------ */

export const INCLUDE_INTENTO = {
  quiz: {
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: {
          question: { include: { options: { orderBy: { position: 'asc' } } } },
        },
      },
    },
  },
  answers: true,
} as const;

export const INCLUDE_QUIZ_INTENTO = {
  questions: {
    orderBy: { position: 'asc' },
    include: {
      question: { include: { options: { orderBy: { position: 'asc' } } } },
    },
  },
} as const;

async function buscarIntento(id: string) {
  return prisma.attempt.findUnique({ where: { id }, include: INCLUDE_INTENTO });
}

export type IntentoCompleto = NonNullable<Awaited<ReturnType<typeof buscarIntento>>>;
type EntradaIntento = IntentoCompleto['quiz']['questions'][number];

type QuizParaIntento = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.quiz.findUnique<{
        where: { id: string };
        include: typeof INCLUDE_QUIZ_INTENTO;
      }>
    >
  >
>;

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

export function leerLista(texto: string): string[] {
  try {
    const valor = JSON.parse(texto || '[]');
    return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function leerMapa(texto: string): Record<string, string[]> {
  try {
    const valor = JSON.parse(texto || '{}');
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
    const mapa: Record<string, string[]> = {};
    for (const [clave, lista] of Object.entries(valor)) {
      if (Array.isArray(lista)) {
        mapa[clave] = lista.filter((item): item is string => typeof item === 'string');
      }
    }
    return mapa;
  } catch {
    return {};
  }
}

function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

function segundosHasta(fecha: Date | null, ahora: Date): number | null {
  if (!fecha) return null;
  return Math.max(0, Math.ceil((fecha.getTime() - ahora.getTime()) / 1000));
}

/* ------------------------------------------------------------------ *
 * Acceso y lectura del intento
 * ------------------------------------------------------------------ */

/** Busca un intento y verifica que pertenezca al estudiante autenticado. */
export async function obtenerIntentoAutorizado(id: string, estudianteId: string) {
  const intento = await buscarIntento(id);
  if (!intento) throw noEncontrado('Intento');
  if (intento.studentId !== estudianteId) throw sinPermiso();
  return intento;
}

export function entradasDelIntento(intento: IntentoCompleto): EntradaIntento[] {
  const orden = leerLista(intento.questionOrder);
  const mapa = new Map(intento.quiz.questions.map((entrada) => [entrada.questionId, entrada]));
  return orden
    .map((id) => mapa.get(id))
    .filter((entrada): entrada is EntradaIntento => Boolean(entrada));
}

function entradaActual(intento: IntentoCompleto, entradas: EntradaIntento[]) {
  if (entradas.length === 0) return null;
  const posicion = Math.min(Math.max(intento.currentPosition, 0), entradas.length - 1);
  return entradas[posicion] ?? null;
}

function opcionesEnOrden(intento: IntentoCompleto, entrada: EntradaIntento) {
  const mapa = leerMapa(intento.optionOrder);
  const orden = mapa[entrada.questionId];
  const opciones = [...entrada.question.options];
  if (orden && orden.length > 0) {
    opciones.sort((a, b) => {
      const ia = orden.indexOf(a.id);
      const ib = orden.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  return opciones;
}

function respuestaDe(intento: IntentoCompleto, preguntaId: string) {
  const respuesta = intento.answers.find((fila) => fila.questionId === preguntaId);
  const opciones = respuesta ? leerLista(respuesta.selectedOptions) : [];
  return {
    opciones,
    texto: respuesta?.textAnswer ?? '',
    existe: Boolean(respuesta),
  };
}

function tieneRespuesta(intento: IntentoCompleto, entrada: EntradaIntento): boolean {
  const respuesta = respuestaDe(intento, entrada.questionId);
  return hayRespuesta(respuesta.opciones, respuesta.texto);
}

function expiracionPregunta(intento: IntentoCompleto): Date | null {
  const limite = intento.quiz.perQuestionTimeSec;
  if (!limite || intento.status !== 'IN_PROGRESS') return null;
  const inicio = intento.questionStartedAt ?? intento.startedAt;
  return new Date(inicio.getTime() + limite * 1000);
}

/* ------------------------------------------------------------------ *
 * DTO de estado (solo la pregunta actual, nunca la clave)
 * ------------------------------------------------------------------ */

export function estadoIntentoDto(intento: IntentoCompleto): EstadoIntentoDto {
  const entradas = entradasDelIntento(intento);
  const total = entradas.length;
  const posicion = total === 0 ? 0 : Math.min(Math.max(intento.currentPosition, 0), total - 1);
  const entrada = entradaActual(intento, entradas);
  const ahora = new Date();
  const expiraPregunta = expiracionPregunta(intento);
  const respuesta = entrada ? respuestaDe(intento, entrada.questionId) : { opciones: [], texto: '' };
  const soloTexto = entrada?.question.type === 'SHORT_ANSWER';

  let pregunta: PreguntaEnCursoDto | null = null;
  if (entrada) {
    const opciones = soloTexto ? [] : opcionesEnOrden(intento, entrada);
    pregunta = {
      id: entrada.questionId,
      tipo: entrada.question.type,
      enunciado: entrada.question.statement,
      dificultad: entrada.question.difficulty,
      tema: entrada.question.topic,
      puntos: entrada.points,
      opciones: opciones.map((opcion, indice) => ({
        id: opcion.id,
        etiqueta: String.fromCharCode(65 + indice),
        texto: opcion.text,
      })),
      ayuda:
        entrada.question.type === 'MCQ_MULTI'
          ? 'Selecciona todas las opciones que correspondan.'
          : entrada.question.type === 'SHORT_ANSWER'
            ? 'Escribe tu respuesta con tus propias palabras.'
            : entrada.question.type === 'TRUE_FALSE'
              ? 'Selecciona verdadero o falso.'
              : 'Selecciona una sola opcion.',
      respuesta: {
        opciones: respuesta.opciones,
        texto: respuesta.texto ?? '',
      },
    };
  }

  return {
    id: intento.id,
    quizId: intento.quizId,
    tituloQuiz: intento.quiz.title,
    descripcionQuiz: intento.quiz.description,
    estado: intento.status,
    posicion,
    total,
    esUltima: total > 0 && posicion === total - 1,
    navegacion: intento.quiz.navigationMode,
    puedeRetroceder: puedeRetroceder(intento.quiz.navigationMode, posicion),
    pregunta,
    expiraEn: intento.expiresAt?.toISOString() ?? null,
    preguntaExpiraEn: expiraPregunta?.toISOString() ?? null,
    ahora: ahora.toISOString(),
    segundosRestantes: segundosHasta(intento.expiresAt, ahora),
    segundosPreguntaRestantes: segundosHasta(expiraPregunta, ahora),
    permitirRevision: intento.quiz.allowReview,
    mostrarResultados: intento.quiz.showResults,
    modoSeguro: intento.quiz.secureMode,
    umbralInfracciones: intento.quiz.infractionThreshold,
    accionInfraccion: intento.quiz.infractionAction,
    bloquearSinPantallaCompleta: intento.quiz.blockWithoutFullscreen,
    respondidas: entradas.filter((entrada) => tieneRespuesta(intento, entrada)).length,
  };
}

/* ------------------------------------------------------------------ *
 * Resultado y revision posterior al envio
 * ------------------------------------------------------------------ */

export function resultadoIntentoDto(intento: IntentoCompleto): ResultadoIntentoDto {
  const mostrar = intento.quiz.showResults;
  const base = {
    id: intento.id,
    quizId: intento.quizId,
    tituloQuiz: intento.quiz.title,
    estado: intento.status,
    motivo: intento.submitReason,
    enviadoEn: intento.submittedAt?.toISOString() ?? null,
    mostrar,
  };

  if (mostrar === 'NONE' || intento.status !== 'SUBMITTED') {
    return {
      ...base,
      puntaje: null,
      puntajeMaximo: null,
      nota: null,
      aprobada: null,
      preguntas: [],
    };
  }

  const preguntas: ResultadoPreguntaDto[] = [];
  if (mostrar === 'SCORE_AND_ANSWERS') {
    const entradas = entradasDelIntento(intento);
    entradas.forEach((entrada, indice) => {
      const respuesta = respuestaDe(intento, entrada.questionId);
      const opciones = opcionesEnOrden(intento, entrada);
      const mapa = new Map(opciones.map((opcion) => [opcion.id, opcion]));
      const respondida = respuesta.opciones.length > 0 || respuesta.texto.trim().length > 0;
      const correctas = entrada.question.options.filter((opcion) => opcion.isCorrect);
      preguntas.push({
        posicion: indice + 1,
        preguntaId: entrada.questionId,
        enunciado: entrada.question.statement,
        tipo: entrada.question.type,
        puntos: entrada.points,
        puntosObtenidos: intento.answers.find((fila) => fila.questionId === entrada.questionId)
          ?.pointsAwarded ?? 0,
        correcta:
          intento.answers.find((fila) => fila.questionId === entrada.questionId)?.isCorrect ?? false,
        respondida,
        seleccion: respuesta.opciones.map((id) => {
          const opcion = mapa.get(id);
          return {
            id,
            etiqueta: opcion?.label ?? '',
            texto: opcion?.text ?? '(opcion eliminada)',
          };
        }),
        textoRespuesta: respuesta.texto || null,
        correctas: correctas.map((opcion) => ({
          id: opcion.id,
          etiqueta: opcion.label,
          texto: opcion.text,
        })),
        explicacion: entrada.question.explanation,
      });
    });
  }

  return {
    ...base,
    puntaje: intento.score ?? 0,
    puntajeMaximo: intento.maxScore,
    nota: intento.grade ?? 0,
    aprobada: intento.passed ?? false,
    preguntas,
  };
}

export function resumenIntentoDto(intento: IntentoCompleto): ResumenIntentoDto {
  const entradas = entradasDelIntento(intento);
  return {
    total: entradas.length,
    respondidas: entradas.filter((entrada) => tieneRespuesta(intento, entrada)).length,
    preguntas: entradas.map((entrada, indice) => ({
      posicion: indice + 1,
      enunciado: entrada.question.statement,
      respondida: tieneRespuesta(intento, entrada),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Calificacion (siempre en el servidor)
 * ------------------------------------------------------------------ */

function calcularResultado(
  entrada: EntradaIntento,
  seleccion: string[],
  texto: string,
): { correcta: boolean } {
  return {
    correcta: calificarRespuesta(entrada.question.type, entrada.question.options, seleccion, texto),
  };
}

/** Califica y marca el intento como enviado. Es idempotente si ya estaba enviado. */
export async function calificarYEnviar(
  intento: IntentoCompleto,
  motivo: 'MANUAL' | 'TIME_UP' | 'INFRACTIONS' | 'FORCED',
): Promise<IntentoCompleto> {
  if (intento.status === 'SUBMITTED') return intento;
  if (intento.status === 'VOIDED') {
    throw conflicto('Este intento fue anulado y no se puede enviar.');
  }

  const entradas = entradasDelIntento(intento);
  const respuestas = new Map(intento.answers.map((fila) => [fila.questionId, fila]));
  const ahora = new Date();

  let puntaje = 0;
  let maximo = 0;
  const calculos = entradas.map((entrada) => {
    const respuesta = respuestas.get(entrada.questionId);
    const seleccion = respuesta ? leerLista(respuesta.selectedOptions) : [];
    const texto = respuesta?.textAnswer ?? '';
    const { correcta } = calcularResultado(entrada, seleccion, texto);
    const puntos = correcta ? entrada.points : 0;
    puntaje += puntos;
    maximo += entrada.points;
    return { entrada, respuesta, seleccion, texto, correcta, puntos };
  });

  const nota =
    maximo > 0 ? Math.round((puntaje / maximo) * intento.quiz.maxGrade * 100) / 100 : 0;
  const aprobada = nota >= intento.quiz.passingScore;

  await prisma.$transaction(async (tx) => {
    for (const calculo of calculos) {
      if (calculo.respuesta) {
        await tx.answer.update({
          where: { id: calculo.respuesta.id },
          data: {
            selectedOptions: JSON.stringify(calculo.seleccion),
            textAnswer: calculo.texto || null,
            isCorrect: calculo.correcta,
            pointsAwarded: calculo.puntos,
            isFinal: true,
          },
        });
      } else {
        await tx.answer.create({
          data: {
            attemptId: intento.id,
            questionId: calculo.entrada.questionId,
            selectedOptions: '[]',
            textAnswer: null,
            isCorrect: false,
            pointsAwarded: 0,
            isFinal: true,
          },
        });
      }
    }

    await tx.attempt.update({
      where: { id: intento.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: ahora,
        submitReason: motivo,
        lastSeenAt: ahora,
        score: puntaje,
        maxScore: maximo,
        grade: nota,
        passed: aprobada,
      },
    });
  });

  const actualizado = await buscarIntento(intento.id);
  if (!actualizado) throw noEncontrado('Intento');

  await auditar({
    accion: ACCIONES.INTENTO_ENVIADO,
    actorId: intento.studentId,
    tipoEntidad: 'Attempt',
    entidadId: intento.id,
    meta: {
      quizId: intento.quizId,
      motivo,
      puntaje,
      maximo,
      nota,
      aprobada,
    },
  });

  return actualizado;
}

/**
 * Aplica los limites de tiempo del lado del servidor:
 *  - tiempo total agotado -> envia el intento automaticamente;
 *  - tiempo por pregunta agotado -> avanza sola hasta la pregunta vigente;
 *  - si se agota el tiempo de la ultima pregunta -> envia el intento.
 */
export async function resolverTiempos(intento: IntentoCompleto): Promise<IntentoCompleto> {
  if (intento.status !== 'IN_PROGRESS') return intento;

  const ahora = new Date();
  if (intento.expiresAt && intento.expiresAt.getTime() <= ahora.getTime()) {
    return calificarYEnviar(intento, 'TIME_UP');
  }

  const limite = intento.quiz.perQuestionTimeSec;
  if (!limite) return intento;

  const entradas = entradasDelIntento(intento);
  const inicio = intento.questionStartedAt ?? intento.startedAt;
  const transcurrido = (ahora.getTime() - inicio.getTime()) / 1000;
  if (transcurrido < limite) return intento;

  const pasos = Math.floor(transcurrido / limite);
  const nuevaPosicion = intento.currentPosition + pasos;
  if (nuevaPosicion >= entradas.length) {
    return calificarYEnviar(intento, 'TIME_UP');
  }

  const nuevoInicio = new Date(inicio.getTime() + pasos * limite * 1000);
  const actualizado = await prisma.attempt.update({
    where: { id: intento.id },
    data: {
      currentPosition: nuevaPosicion,
      questionStartedAt: nuevoInicio,
      lastSeenAt: ahora,
    },
    include: INCLUDE_INTENTO,
  });
  return actualizado;
}

/* ------------------------------------------------------------------ *
 * Inicio del intento
 * ------------------------------------------------------------------ */

export type ResultadoInicio = {
  intento: IntentoCompleto;
  reanudado: boolean;
};

/**
 * Crea el intento (o reanuda el que ya esta en progreso). Congela en el
 * servidor el orden de preguntas y de opciones, y calcula la expiracion.
 */
export async function iniciarIntento(
  quiz: QuizParaIntento,
  estudianteId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<ResultadoInicio> {
  const activo = await prisma.attempt.findFirst({
    where: { quizId: quiz.id, studentId: estudianteId, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
    include: INCLUDE_INTENTO,
  });
  if (activo) {
    const procesado = await resolverTiempos(activo);
    if (procesado.status === 'IN_PROGRESS') {
      await prisma.attempt.update({
        where: { id: procesado.id },
        data: { lastSeenAt: new Date() },
      });
      return { intento: procesado, reanudado: true };
    }
  }

  const usados = await prisma.attempt.count({
    where: {
      quizId: quiz.id,
      studentId: estudianteId,
      status: { in: ['SUBMITTED', 'VOIDED'] },
    },
  });
  if (usados >= quiz.maxAttempts) {
    throw new ErrorApi(
      409,
      'SIN_INTENTOS',
      'Ya usaste todos los intentos permitidos para este quiz.',
    );
  }

  const ultimo = await prisma.attempt.findFirst({
    where: { quizId: quiz.id, studentId: estudianteId },
    orderBy: { attemptNumber: 'desc' },
    select: { attemptNumber: true },
  });

  let orden = [...quiz.questions];
  if (quiz.questionCount && quiz.questionCount < orden.length) {
    orden = barajar(orden).slice(0, quiz.questionCount);
  }
  if (quiz.shuffleQuestions) {
    orden = barajar(orden);
  } else {
    orden.sort((a, b) => a.position - b.position);
  }

  const optionOrder: Record<string, string[]> = {};
  for (const entrada of orden) {
    const ids = entrada.question.options
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((opcion) => opcion.id);
    optionOrder[entrada.questionId] = quiz.shuffleOptions ? barajar(ids) : ids;
  }

  const ahora = new Date();
  let expira: Date | null = quiz.timeLimitSec
    ? new Date(ahora.getTime() + quiz.timeLimitSec * 1000)
    : null;
  if (quiz.availableTo && (!expira || quiz.availableTo.getTime() < expira.getTime())) {
    expira = new Date(quiz.availableTo);
  }

  const maxScore = orden.reduce((suma, entrada) => suma + entrada.points, 0);

  const creado = await prisma.attempt.create({
    data: {
      quizId: quiz.id,
      studentId: estudianteId,
      attemptNumber: (ultimo?.attemptNumber ?? 0) + 1,
      status: 'IN_PROGRESS',
      startedAt: ahora,
      lastSeenAt: ahora,
      questionStartedAt: ahora,
      expiresAt: expira,
      currentPosition: 0,
      questionOrder: JSON.stringify(orden.map((entrada) => entrada.questionId)),
      optionOrder: JSON.stringify(optionOrder),
      maxScore,
      ip,
      userAgent,
    },
    include: INCLUDE_INTENTO,
  });

  await auditar({
    accion: ACCIONES.INTENTO_INICIADO,
    actorId: estudianteId,
    tipoEntidad: 'Attempt',
    entidadId: creado.id,
    meta: {
      quizId: quiz.id,
      intento: creado.attemptNumber,
      preguntas: orden.length,
      expiraEn: expira?.toISOString() ?? null,
    },
    ip,
  });

  return { intento: creado, reanudado: false };
}

/* ------------------------------------------------------------------ *
 * Guardado de respuestas y navegacion
 * ------------------------------------------------------------------ */

type DatosRespuesta = {
  preguntaId: string;
  opciones: string[];
  texto?: string | null;
};

/**
 * Guarda (autoguardado) la respuesta de la pregunta vigente.
 *
 * Reglas de seguridad:
 *  - solo se aceptan respuestas de la pregunta que el servidor marca como
 *    actual (nunca de otra posicion, aunque el cliente la envie);
 *  - las opciones se filtran contra las opciones reales de la pregunta;
 *  - una sola opcion en preguntas de respuesta unica, sin importar lo enviado;
 *  - en respuestas cortas se ignora cualquier opcion enviada.
 */
export async function guardarRespuesta(
  intento: IntentoCompleto,
  datos: DatosRespuesta,
): Promise<IntentoCompleto> {
  if (intento.status !== 'IN_PROGRESS') {
    throw conflicto('El intento ya no esta en progreso.');
  }

  const entradas = entradasDelIntento(intento);
  const entrada = entradaActual(intento, entradas);
  if (!entrada) throw conflicto('El intento no tiene preguntas.');

  if (entrada.questionId !== datos.preguntaId) {
    throw new ErrorApi(
      409,
      'PREGUNTA_FUERA_DE_TURNO',
      'Solo puedes responder la pregunta que estas viendo.',
    );
  }

  let opciones: string[] = [];
  let texto: string | null = null;

  if (entrada.question.type === 'SHORT_ANSWER') {
    texto = (datos.texto ?? '').trim().slice(0, 1000) || null;
  } else {
    opciones = normalizarSeleccion(
      entrada.question.type,
      entrada.question.options.map((opcion) => opcion.id),
      datos.opciones,
    );
  }

  await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId: intento.id, questionId: entrada.questionId } },
    create: {
      attemptId: intento.id,
      questionId: entrada.questionId,
      selectedOptions: JSON.stringify(opciones),
      textAnswer: texto,
      isFinal: false,
    },
    update: {
      selectedOptions: JSON.stringify(opciones),
      textAnswer: texto,
      isFinal: false,
    },
  });

  await prisma.attempt.update({
    where: { id: intento.id },
    data: { lastSeenAt: new Date() },
  });

  const actualizado = await buscarIntento(intento.id);
  return actualizado ?? intento;
}

/** Avanza a la siguiente pregunta. La ultima pregunta exige enviar el intento. */
export async function avanzarIntento(intento: IntentoCompleto): Promise<IntentoCompleto> {
  if (intento.status !== 'IN_PROGRESS') {
    throw conflicto('El intento ya no esta en progreso.');
  }
  const entradas = entradasDelIntento(intento);
  if (entradas.length === 0) throw conflicto('El intento no tiene preguntas.');
  if (intento.currentPosition >= entradas.length - 1) {
    throw conflicto('Ya estas en la ultima pregunta. Envia el intento para terminarlo.');
  }

  const ahora = new Date();
  return prisma.attempt.update({
    where: { id: intento.id },
    data: {
      currentPosition: intento.currentPosition + 1,
      questionStartedAt: ahora,
      lastSeenAt: ahora,
    },
    include: INCLUDE_INTENTO,
  });
}

/**
 * Retrocede a la pregunta anterior. El servidor rechaza la peticion cuando el
 * quiz es de navegacion "solo hacia adelante", sin importar lo que pida el
 * cliente.
 */
export async function retrocederIntento(intento: IntentoCompleto): Promise<IntentoCompleto> {
  if (intento.status !== 'IN_PROGRESS') {
    throw conflicto('El intento ya no esta en progreso.');
  }
  if (!puedeRetroceder(intento.quiz.navigationMode, intento.currentPosition)) {
    if (intento.quiz.navigationMode !== 'FREE') {
      throw new ErrorApi(
        409,
        'RETROCESO_NO_PERMITIDO',
        'Este quiz es de navegacion solo hacia adelante: no puedes volver a preguntas anteriores.',
      );
    }
    throw conflicto('Ya estas en la primera pregunta.');
  }

  const ahora = new Date();
  return prisma.attempt.update({
    where: { id: intento.id },
    data: {
      currentPosition: intento.currentPosition - 1,
      questionStartedAt: ahora,
      lastSeenAt: ahora,
    },
    include: INCLUDE_INTENTO,
  });
}

/** Envia y califica el intento (siempre en el servidor). */
export async function entregarIntento(intento: IntentoCompleto): Promise<IntentoCompleto> {
  if (intento.status === 'IN_PROGRESS') {
    return calificarYEnviar(intento, 'MANUAL');
  }
  return intento;
}

/* ------------------------------------------------------------------ *
 * Elegibilidad y panel del estudiante
 * ------------------------------------------------------------------ */

/**
 * Devuelve el quiz con sus preguntas si el estudiante puede presentarlo:
 * publicado, asignado a alguno de sus grupos y dentro de la ventana.
 */
export async function obtenerQuizParaEstudiante(
  quizId: string,
  estudianteId: string,
): Promise<QuizParaIntento> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: {
          question: { include: { options: { orderBy: { position: 'asc' } } } },
        },
      },
      assignments: {
        include: {
          group: {
            include: { memberships: { where: { userId: estudianteId }, select: { id: true } } },
          },
        },
      },
    },
  });

  if (!quiz) throw noEncontrado('Quiz');
  if (quiz.status === 'DRAFT') {
    throw conflicto('Este quiz aun no ha sido publicado por el docente.');
  }
  if (quiz.status === 'CLOSED') {
    throw conflicto('Este quiz ya fue cerrado.');
  }

  const asignado = quiz.assignments.some((asignacion) => asignacion.group.memberships.length > 0);
  if (!asignado) {
    throw new ErrorApi(
      403,
      'QUIZ_NO_ASIGNADO',
      'Este quiz no esta asignado a ninguno de tus grupos.',
    );
  }

  const ahora = new Date();
  if (quiz.availableFrom && quiz.availableFrom.getTime() > ahora.getTime()) {
    throw conflicto('Este quiz todavia no esta disponible.');
  }
  if (quiz.availableTo && quiz.availableTo.getTime() < ahora.getTime()) {
    throw conflicto('El plazo para presentar este quiz ya termino.');
  }

  return quiz;
}

const INCLUDE_PANEL_ESTUDIANTE = {
  questions: { select: { points: true } },
  assignments: { include: { group: { select: { id: true, name: true } } } },
  _count: { select: { questions: true } },
  attempts: {
    orderBy: { attemptNumber: 'asc' },
    select: { id: true, status: true, grade: true, passed: true, attemptNumber: true },
  },
} as const;

type QuizPanel = Prisma.QuizGetPayload<{ include: typeof INCLUDE_PANEL_ESTUDIANTE }>;

/** Construye el DTO del panel del estudiante para un quiz. */
function aQuizEstudianteDto(quiz: QuizPanel): QuizEstudianteDto {
  const ahora = new Date();
  const intentos = quiz.attempts;
  const enProgreso = intentos.find((intento) => intento.status === 'IN_PROGRESS') ?? null;
  const finalizados = intentos.filter((intento) => intento.status !== 'IN_PROGRESS');
  const enviados = intentos.filter((intento) => intento.status === 'SUBMITTED');
  const usados = finalizados.length;
  const restantes = Math.max(0, quiz.maxAttempts - usados);
  const ultimo = intentos.reduce<QuizPanel['attempts'][number] | null>(
    (max, intento) => (!max || intento.attemptNumber > max.attemptNumber ? intento : max),
    null,
  );

  const visible = quiz.showResults !== 'NONE';
  const notas = enviados
    .map((intento) => intento.grade)
    .filter((nota): nota is number => nota !== null);
  const mejorNota = visible && notas.length > 0 ? Math.max(...notas) : null;
  const aprobada = visible ? enviados.some((intento) => intento.passed === true) : null;

  let estado: EstadoQuizEstudiante;
  if (quiz.status === 'CLOSED') {
    estado = 'CERRADO';
  } else if (enProgreso) {
    estado = 'EN_PROGRESO';
  } else if (restantes === 0) {
    estado = 'COMPLETADO';
  } else if (quiz.availableFrom && quiz.availableFrom.getTime() > ahora.getTime()) {
    estado = 'PROXIMO';
  } else if (quiz.availableTo && quiz.availableTo.getTime() < ahora.getTime()) {
    estado = 'CERRADO';
  } else {
    estado = 'DISPONIBLE';
  }

  const totalPuntos = quiz.questions.reduce((suma, pregunta) => suma + pregunta.points, 0);

  return {
    id: quiz.id,
    titulo: quiz.title,
    descripcion: quiz.description,
    estado,
    publicadoEn: quiz.publishedAt?.toISOString() ?? null,
    disponibleDesde: quiz.availableFrom?.toISOString() ?? null,
    disponibleHasta: quiz.availableTo?.toISOString() ?? null,
    navegacion: quiz.navigationMode,
    tiempoTotalSeg: quiz.timeLimitSec,
    tiempoPorPreguntaSeg: quiz.perQuestionTimeSec,
    intentosMaximos: quiz.maxAttempts,
    intentosUsados: usados,
    intentosRestantes: restantes,
    totalPreguntas: quiz.questions.length,
    totalPuntos,
    modoSeguro: quiz.secureMode,
    permitirRevision: quiz.allowReview,
    mostrarResultados: quiz.showResults,
    notaMaxima: quiz.maxGrade,
    notaAprobacion: quiz.passingScore,
    grupos: quiz.assignments.map((asignacion) => ({
      id: asignacion.group.id,
      nombre: asignacion.group.name,
    })),
    mejorNota,
    aprobada,
    intentoEnProgresoId: enProgreso?.id ?? null,
    ultimoIntentoId: ultimo?.id ?? null,
  };
}

/** Lista los quices publicados o cerrados asignados a los grupos del estudiante. */
export async function listarQuicesEstudiante(estudianteId: string): Promise<QuizEstudianteDto[]> {
  const quices = await prisma.quiz.findMany({
    where: {
      status: { in: ['PUBLISHED', 'CLOSED'] },
      assignments: { some: { group: { memberships: { some: { userId: estudianteId } } } } },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      ...INCLUDE_PANEL_ESTUDIANTE,
      attempts: {
        ...INCLUDE_PANEL_ESTUDIANTE.attempts,
        where: { studentId: estudianteId },
      },
    },
  });

  return quices.map((quiz) => aQuizEstudianteDto(quiz));
}

/** Resumen del panel para un unico quiz, o `null` si no esta disponible para el estudiante. */
export async function obtenerResumenQuizEstudiante(
  quizId: string,
  estudianteId: string,
): Promise<QuizEstudianteDto | null> {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      status: { in: ['PUBLISHED', 'CLOSED'] },
      assignments: { some: { group: { memberships: { some: { userId: estudianteId } } } } },
    },
    include: {
      ...INCLUDE_PANEL_ESTUDIANTE,
      attempts: {
        ...INCLUDE_PANEL_ESTUDIANTE.attempts,
        where: { studentId: estudianteId },
      },
    },
  });

  return quiz ? aQuizEstudianteDto(quiz) : null;
}

/* ------------------------------------------------------------------ *
 * Proctoring (modo seguro)
 * ------------------------------------------------------------------ */

export type ResultadoEventoProctor = {
  intento: IntentoCompleto;
  infracciones: number;
  contoComoInfraccion: boolean;
  accion: AccionInfraccion | null;
};

/**
 * Registra un evento de proctoring y, si cuenta como infraccion, actualiza el
 * contador. Al alcanzar el umbral se aplica la accion configurada en el quiz
 * (anular, enviar automaticamente o solo registrar). El servidor decide que
 * eventos son infraccion; el cliente solo reporta lo que ocurre.
 */
export async function registrarEventoProctor(
  intento: IntentoCompleto,
  datos: { tipo: TipoEventoProctor; detalle?: string | null; clientTs?: string | null },
  ip: string | null,
  userAgent: string | null,
): Promise<ResultadoEventoProctor> {
  const contoComoInfraccion = EVENTOS_INFRACCION.includes(datos.tipo);
  const clientTs = datos.clientTs ? new Date(datos.clientTs) : null;

  await prisma.proctorEvent.create({
    data: {
      attemptId: intento.id,
      type: datos.tipo,
      detail: datos.detalle ?? null,
      severity: contoComoInfraccion ? 'WARNING' : 'INFO',
      countsAsInfraction: contoComoInfraccion,
      clientTs: clientTs && !Number.isNaN(clientTs.getTime()) ? clientTs : null,
      ip,
      userAgent,
    },
  });

  if (!contoComoInfraccion || intento.status !== 'IN_PROGRESS') {
    return {
      intento,
      infracciones: intento.infractions,
      contoComoInfraccion,
      accion: null,
    };
  }

  const infracciones = intento.infractions + 1;
  const umbral = Math.max(1, intento.quiz.infractionThreshold);
  const accion: AccionInfraccion | null =
    infracciones >= umbral ? (intento.quiz.infractionAction as AccionInfraccion) : null;

  let actualizado: IntentoCompleto;

  if (accion === 'VOID') {
    actualizado = await prisma.attempt.update({
      where: { id: intento.id },
      data: {
        infractions: infracciones,
        status: 'VOIDED',
        voidedReason: 'Se alcanzo el umbral de infracciones en modo seguro.',
        lastSeenAt: new Date(),
      },
      include: INCLUDE_INTENTO,
    });
    await auditar({
      accion: ACCIONES.INTENTO_ANULADO,
      actorId: intento.studentId,
      tipoEntidad: 'Attempt',
      entidadId: intento.id,
      meta: { motivo: 'INFRACCIONES', infracciones, umbral },
      ip,
    });
  } else {
    await prisma.attempt.update({
      where: { id: intento.id },
      data: { infractions: infracciones, lastSeenAt: new Date() },
    });

    if (accion === 'AUTO_SUBMIT') {
      const refrescado = await buscarIntento(intento.id);
      actualizado = refrescado
        ? await calificarYEnviar(refrescado, 'INFRACTIONS')
        : intento;
    } else {
      actualizado = (await buscarIntento(intento.id)) ?? intento;
    }
  }

  await auditar({
    accion: ACCIONES.INFRACCION,
    actorId: intento.studentId,
    tipoEntidad: 'Attempt',
    entidadId: intento.id,
    meta: { tipo: datos.tipo, infracciones, umbral, accion },
    ip,
  });

  return { intento: actualizado, infracciones, contoComoInfraccion, accion };
}

/* ------------------------------------------------------------------ *
 * Vista del docente: intentos e infracciones
 * ------------------------------------------------------------------ */

/** Lista los intentos de un quiz con su linea de tiempo de infracciones. */
export async function listarIntentosDocente(quizId: string): Promise<IntentoDocenteDto[]> {
  const intentos = await prisma.attempt.findMany({
    where: { quizId },
    orderBy: [{ startedAt: 'desc' }],
    include: {
      student: { select: { id: true, name: true, email: true } },
      events: { orderBy: { occurredAt: 'asc' } },
    },
  });

  return intentos.map((intento) => ({
    id: intento.id,
    estudiante: {
      id: intento.student.id,
      nombre: intento.student.name,
      correo: intento.student.email,
    },
    numero: intento.attemptNumber,
    estado: intento.status,
    motivo: intento.submitReason,
    iniciadoEn: intento.startedAt.toISOString(),
    enviadoEn: intento.submittedAt?.toISOString() ?? null,
    puntaje: intento.score,
    puntajeMaximo: intento.maxScore,
    nota: intento.grade,
    aprobada: intento.passed,
    infracciones: intento.infractions,
    eventos: intento.events.map<EventoProctorDto>((evento) => ({
      id: evento.id,
      tipo: evento.type,
      detalle: evento.detail,
      severidad: evento.severity,
      infraccion: evento.countsAsInfraction,
      ocurridoEn: evento.occurredAt.toISOString(),
    })),
  }));
}
