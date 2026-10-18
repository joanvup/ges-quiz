import { prisma } from '@/lib/db';
import { noEncontrado, sinPermiso } from '@/lib/http';
import type {
  PreguntaQuizDto,
  QuizDetalleDto,
  QuizResumenDto,
} from '@/lib/cliente/tipos';

type UsuarioActual = { id: string; role: string };

/**
 * Consulta reutilizable con todo lo necesario para la ficha del quiz.
 * Solo se usa en el servidor (docentes y administradores).
 */
export const INCLUDE_QUIZ = {
  author: { select: { id: true, name: true } },
  assignments: {
    select: { group: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  questions: {
    orderBy: { position: 'asc' },
    include: {
      question: {
        include: {
          options: { orderBy: { position: 'asc' } },
          document: { select: { id: true, title: true } },
        },
      },
    },
  },
  _count: { select: { attempts: true } },
} as const;

type QuizConRelaciones = NonNullable<Awaited<ReturnType<typeof buscarQuiz>>>;

async function buscarQuiz(id: string) {
  return prisma.quiz.findUnique({ where: { id }, include: INCLUDE_QUIZ });
}

/** Busca un quiz y verifica que el usuario pueda administrarlo. */
export async function obtenerQuizAutorizado(id: string, usuario: UsuarioActual) {
  const quiz = await buscarQuiz(id);
  if (!quiz) throw noEncontrado('Quiz');
  if (usuario.role !== 'ADMIN' && quiz.authorId !== usuario.id) throw sinPermiso();
  return quiz;
}

export function totalPuntos(quiz: { questions: { points: number }[] }): number {
  return quiz.questions.reduce((suma, pregunta) => suma + pregunta.points, 0);
}

function aPreguntaQuizDto(
  entrada: QuizConRelaciones['questions'][number],
): PreguntaQuizDto {
  return {
    id: entrada.id,
    preguntaId: entrada.questionId,
    posicion: entrada.position,
    puntos: entrada.points,
    tipo: entrada.question.type,
    enunciado: entrada.question.statement,
    explicacion: entrada.question.explanation,
    tema: entrada.question.topic,
    dificultad: entrada.question.difficulty,
    estado: entrada.question.status,
    respuestaPendiente: entrada.question.answerPending,
    documento: entrada.question.document
      ? { id: entrada.question.document.id, titulo: entrada.question.document.title }
      : null,
    opciones: entrada.question.options.map((opcion) => ({
      id: opcion.id,
      etiqueta: opcion.label,
      texto: opcion.text,
      correcta: opcion.isCorrect,
    })),
  };
}

function camposComunes(quiz: QuizConRelaciones) {
  return {
    id: quiz.id,
    titulo: quiz.title,
    descripcion: quiz.description,
    estado: quiz.status,
    autor: { id: quiz.author.id, nombre: quiz.author.name },
    creadoEn: quiz.createdAt.toISOString(),
    actualizadoEn: quiz.updatedAt.toISOString(),
    publicadoEn: quiz.publishedAt?.toISOString() ?? null,
    disponibleDesde: quiz.availableFrom?.toISOString() ?? null,
    disponibleHasta: quiz.availableTo?.toISOString() ?? null,
    navegacion: quiz.navigationMode,
    tiempoTotalSeg: quiz.timeLimitSec,
    tiempoPorPreguntaSeg: quiz.perQuestionTimeSec,
    mezclarPreguntas: quiz.shuffleQuestions,
    mezclarOpciones: quiz.shuffleOptions,
    intentosMaximos: quiz.maxAttempts,
    cantidadPreguntas: quiz.questionCount,
    puntosPorDefecto: quiz.defaultPoints,
    notaAprobacion: quiz.passingScore,
    notaMaxima: quiz.maxGrade,
    mostrarResultados: quiz.showResults,
    permitirRevision: quiz.allowReview,
    modoSeguro: quiz.secureMode,
    umbralInfracciones: quiz.infractionThreshold,
    accionInfraccion: quiz.infractionAction,
    bloquearSinPantallaCompleta: quiz.blockWithoutFullscreen,
    grupos: quiz.assignments.map((asignacion) => ({
      id: asignacion.group.id,
      nombre: asignacion.group.name,
    })),
    totalPreguntas: quiz.questions.length,
    totalPuntos: totalPuntos(quiz),
    intentos: quiz._count.attempts,
  };
}

export function aQuizResumenDto(quiz: QuizConRelaciones): QuizResumenDto {
  return camposComunes(quiz);
}

export function aQuizDetalleDto(quiz: QuizConRelaciones): QuizDetalleDto {
  return {
    ...camposComunes(quiz),
    preguntas: quiz.questions.map(aPreguntaQuizDto),
  };
}

/**
 * Reglas de negocio para publicar. Devuelve errores (bloquean) y
 * advertencias (se muestran pero permiten publicar).
 */
export function validarPublicacion(quiz: QuizConRelaciones): {
  errores: string[];
  advertencias: string[];
} {
  const errores: string[] = [];
  const advertencias: string[] = [];

  if (quiz.questions.length === 0) {
    errores.push('El quiz debe tener al menos una pregunta.');
  }
  if (quiz.assignments.length === 0) {
    errores.push('Asigna el quiz a por lo menos un grupo antes de publicarlo.');
  }
  if (quiz.passingScore > quiz.maxGrade) {
    errores.push('La nota minima de aprobacion no puede superar la nota maxima.');
  }
  if (quiz.availableFrom && quiz.availableTo && quiz.availableTo <= quiz.availableFrom) {
    errores.push('La fecha de cierre debe ser posterior a la fecha de apertura.');
  }
  if (quiz.availableTo && quiz.availableTo.getTime() <= Date.now()) {
    errores.push('La fecha de cierre ya paso: actualiza la ventana de disponibilidad.');
  }
  if (quiz.questionCount && quiz.questionCount > quiz.questions.length) {
    errores.push(
      `Se piden ${quiz.questionCount} preguntas por intento pero el quiz solo tiene ${quiz.questions.length}.`,
    );
  }

  const sinRespuesta = quiz.questions.filter((entrada) => {
    if (entrada.question.answerPending) return true;
    return !entrada.question.options.some((opcion) => opcion.isCorrect);
  });
  if (sinRespuesta.length > 0) {
    errores.push(
      `${sinRespuesta.length} pregunta(s) no tienen una respuesta correcta confirmada. Editalas antes de publicar.`,
    );
  }

  const pendientes = quiz.questions.filter(
    (entrada) => entrada.question.status === 'PENDING_REVIEW',
  ).length;
  if (pendientes > 0) {
    advertencias.push(
      `${pendientes} pregunta(s) estaban pendientes de revision. Al publicar quedaran marcadas como aprobadas.`,
    );
  }

  if (quiz.secureMode && !quiz.blockWithoutFullscreen) {
    advertencias.push(
      'El modo seguro esta activo pero no bloquea navegadores sin pantalla completa: la proteccion sera menor.',
    );
  }

  return { errores, advertencias };
}
