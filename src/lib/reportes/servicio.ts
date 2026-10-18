import { prisma } from '@/lib/db';

/* ------------------------------------------------------------------ *
 * Reportes de resultados (Fase 6)
 * ------------------------------------------------------------------ */

export type ReporteOpcion = {
  id: string;
  etiqueta: string;
  texto: string;
  correcta: boolean;
  elegidas: number;
  porcentaje: number;
};

export type ReportePregunta = {
  posicion: number;
  questionId: string;
  enunciado: string;
  tipo: string;
  tema: string | null;
  puntos: number;
  presentadas: number;
  respondidas: number;
  correctas: number;
  omitidas: number;
  porcentajeAcierto: number;
  opciones: ReporteOpcion[];
};

export type ReporteEstudiante = {
  id: string;
  nombre: string;
  correo: string;
  grupos: string[];
  intentos: number;
  enviados: number;
  mejorNota: number | null;
  ultimaNota: number | null;
  aprobada: boolean | null;
  tiempoTotalSeg: number;
  infracciones: number;
  estado: 'SIN_INTENTAR' | 'EN_PROGRESO' | 'ENVIADO' | 'ANULADO';
};

export type ReporteGrupo = {
  id: string;
  nombre: string;
  estudiantes: number;
  enviados: number;
  promedioNota: number | null;
  aprobados: number;
  tasaAprobacion: number;
};

export type ReporteQuiz = {
  quizId: string;
  titulo: string;
  estado: string;
  autorNombre: string;
  notaAprobacion: number;
  notaMaxima: number;
  totalPreguntas: number;
  totalPuntos: number;
  intentosMaximos: number;
  modoSeguro: boolean;
  umbralInfracciones: number;
  accionInfraccion: string;
  grupos: { id: string; nombre: string }[];
  resumen: {
    estudiantesAsignados: number;
    sinIntentar: number;
    intentosTotales: number;
    enviados: number;
    enProgreso: number;
    anulados: number;
    aprobados: number;
    tasaAprobacion: number;
    promedioNota: number | null;
    tiempoPromedioSeg: number | null;
    infraccionesTotales: number;
  };
  estudiantes: ReporteEstudiante[];
  porGrupo: ReporteGrupo[];
  preguntas: ReportePregunta[];
};

type Intento = {
  id: string;
  studentId: string;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  lastSeenAt: Date;
  infractions: number;
  grade: number | null;
  questionOrder: string;
  student: { id: string; name: string; email: string };
  answers: {
    questionId: string;
    selectedOptions: string;
    textAnswer: string | null;
    isCorrect: boolean | null;
    timeSpentSec: number;
  }[];
};

function duracionSeg(intento: Intento): number {
  const fin = intento.submittedAt ?? intento.lastSeenAt;
  return Math.max(0, Math.round((fin.getTime() - intento.startedAt.getTime()) / 1000));
}

function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce((acumulado, valor) => acumulado + valor, 0);
  return Math.round((suma / valores.length) * 100) / 100;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function parsearIds(json: string): string[] {
  try {
    const valor = JSON.parse(json);
    return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function tieneRespuesta(answers: Intento['answers'], questionId: string): boolean {
  const respuesta = answers.find((entrada) => entrada.questionId === questionId);
  if (!respuesta) return false;
  return parsearIds(respuesta.selectedOptions).length > 0 || Boolean(respuesta.textAnswer?.trim());
}

/**
 * Construye el reporte completo de un quiz: resumen general, detalle por
 * estudiante, comparativa por grupo y analisis por pregunta (incluida la
 * distribucion de opciones elegidas para detectar distractores).
 */
export async function obtenerReporteQuiz(quizId: string): Promise<ReporteQuiz | null> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      author: { select: { name: true } },
      assignments: {
        include: {
          group: {
            include: {
              memberships: {
                include: {
                  user: { select: { id: true, name: true, email: true, role: true, active: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      questions: {
        orderBy: { position: 'asc' },
        include: { question: { include: { options: { orderBy: { position: 'asc' } } } } },
      },
      attempts: {
        include: {
          student: { select: { id: true, name: true, email: true } },
          answers: {
            select: {
              questionId: true,
              selectedOptions: true,
              textAnswer: true,
              isCorrect: true,
              timeSpentSec: true,
            },
          },
        },
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  if (!quiz) return null;

  const intentos = quiz.attempts as Intento[];
  const enviados = intentos.filter((intento) => intento.status === 'SUBMITTED');

  // --- Estudiantes asignados (union de grupos y de intentos) ----------------
  const estudiantes = new Map<string, { id: string; nombre: string; correo: string; grupos: string[] }>();
  for (const asignacion of quiz.assignments) {
    for (const membresia of asignacion.group.memberships) {
      const usuario = membresia.user;
      if (usuario.role !== 'STUDENT' || !usuario.active) continue;
      const actual = estudiantes.get(usuario.id) ?? {
        id: usuario.id,
        nombre: usuario.name,
        correo: usuario.email,
        grupos: [],
      };
      if (!actual.grupos.includes(asignacion.group.name)) actual.grupos.push(asignacion.group.name);
      estudiantes.set(usuario.id, actual);
    }
  }
  for (const intento of intentos) {
    if (!estudiantes.has(intento.studentId)) {
      estudiantes.set(intento.studentId, {
        id: intento.studentId,
        nombre: intento.student.name,
        correo: intento.student.email,
        grupos: [],
      });
    }
  }

  // --- Detalle por estudiante ----------------------------------------------
  const detalleEstudiantes: ReporteEstudiante[] = [];
  for (const estudiante of estudiantes.values()) {
    const propios = intentos.filter((intento) => intento.studentId === estudiante.id);
    const propiosEnviados = propios.filter((intento) => intento.status === 'SUBMITTED');
    const notas = propiosEnviados
      .map((intento) => intento.grade)
      .filter((nota): nota is number => nota !== null && nota !== undefined);
    const ultimo = propiosEnviados[propiosEnviados.length - 1];
    const mejorNota = notas.length > 0 ? Math.max(...notas) : null;

    let estado: ReporteEstudiante['estado'] = 'SIN_INTENTAR';
    if (propios.some((intento) => intento.status === 'IN_PROGRESS')) estado = 'EN_PROGRESO';
    else if (propiosEnviados.length > 0) estado = 'ENVIADO';
    else if (propios.some((intento) => intento.status === 'VOIDED')) estado = 'ANULADO';

    detalleEstudiantes.push({
      id: estudiante.id,
      nombre: estudiante.nombre,
      correo: estudiante.correo,
      grupos: estudiante.grupos,
      intentos: propios.length,
      enviados: propiosEnviados.length,
      mejorNota,
      ultimaNota: ultimo?.grade ?? null,
      aprobada: mejorNota === null ? null : mejorNota >= quiz.passingScore,
      tiempoTotalSeg: propiosEnviados.reduce((suma, intento) => suma + duracionSeg(intento), 0),
      infracciones: propios.reduce((suma, intento) => suma + intento.infractions, 0),
      estado,
    });
  }
  detalleEstudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const conEnvio = detalleEstudiantes.filter((estudiante) => estudiante.enviados > 0);
  const aprobados = conEnvio.filter((estudiante) => estudiante.aprobada).length;

  // --- Comparativa por grupo ------------------------------------------------
  const porGrupo: ReporteGrupo[] = quiz.assignments.map((asignacion) => {
    const estudiantesGrupo = detalleEstudiantes.filter((estudiante) =>
      estudiante.grupos.includes(asignacion.group.name),
    );
    const notas = estudiantesGrupo
      .map((estudiante) => estudiante.mejorNota)
      .filter((nota): nota is number => nota !== null);
    const aprobadosGrupo = estudiantesGrupo.filter((estudiante) => estudiante.aprobada).length;
    const conEnvioGrupo = estudiantesGrupo.filter((estudiante) => estudiante.enviados > 0).length;
    return {
      id: asignacion.group.id,
      nombre: asignacion.group.name,
      estudiantes: estudiantesGrupo.length,
      enviados: estudiantesGrupo.reduce((suma, estudiante) => suma + estudiante.enviados, 0),
      promedioNota: promedio(notas),
      aprobados: aprobadosGrupo,
      tasaAprobacion: conEnvioGrupo > 0 ? Math.round((aprobadosGrupo / conEnvioGrupo) * 100) : 0,
    };
  });

  // --- Analisis por pregunta ------------------------------------------------
  const preguntas: ReportePregunta[] = quiz.questions.map((entrada, indice) => {
    const questionId = entrada.questionId;
    const presentadas = enviados.filter((intento) =>
      parsearIds(intento.questionOrder).includes(questionId),
    ).length;

    const respuestas = enviados.flatMap((intento) =>
      intento.answers.filter((respuesta) => respuesta.questionId === questionId),
    );
    const respondidas = respuestas.filter(
      (respuesta) =>
        parsearIds(respuesta.selectedOptions).length > 0 || Boolean(respuesta.textAnswer?.trim()),
    ).length;
    const correctas = respuestas.filter((respuesta) => respuesta.isCorrect === true).length;
    const base = respondidas > 0 ? respondidas : 1;

    const opciones: ReporteOpcion[] = entrada.question.options.map((opcion) => {
      const elegidas = respuestas.filter((respuesta) =>
        parsearIds(respuesta.selectedOptions).includes(opcion.id),
      ).length;
      return {
        id: opcion.id,
        etiqueta: opcion.label,
        texto: opcion.text,
        correcta: opcion.isCorrect,
        elegidas,
        porcentaje: Math.round((elegidas / base) * 100),
      };
    });

    return {
      posicion: indice + 1,
      questionId,
      enunciado: entrada.question.statement,
      tipo: entrada.question.type,
      tema: entrada.question.topic,
      puntos: entrada.points,
      presentadas,
      respondidas,
      correctas,
      omitidas: Math.max(0, presentadas - respondidas),
      porcentajeAcierto: respondidas > 0 ? Math.round((correctas / respondidas) * 100) : 0,
      opciones,
    };
  });

  return {
    quizId: quiz.id,
    titulo: quiz.title,
    estado: quiz.status,
    autorNombre: quiz.author.name,
    notaAprobacion: quiz.passingScore,
    notaMaxima: quiz.maxGrade,
    totalPreguntas: quiz.questions.length,
    totalPuntos: quiz.questions.reduce((suma, entrada) => suma + entrada.points, 0),
    intentosMaximos: quiz.maxAttempts,
    modoSeguro: quiz.secureMode,
    umbralInfracciones: quiz.infractionThreshold,
    accionInfraccion: quiz.infractionAction,
    grupos: quiz.assignments.map((asignacion) => ({
      id: asignacion.group.id,
      nombre: asignacion.group.name,
    })),
    resumen: {
      estudiantesAsignados: detalleEstudiantes.length,
      sinIntentar: detalleEstudiantes.filter((estudiante) => estudiante.estado === 'SIN_INTENTAR').length,
      intentosTotales: intentos.length,
      enviados: enviados.length,
      enProgreso: intentos.filter((intento) => intento.status === 'IN_PROGRESS').length,
      anulados: intentos.filter((intento) => intento.status === 'VOIDED').length,
      aprobados,
      tasaAprobacion: conEnvio.length > 0 ? Math.round((aprobados / conEnvio.length) * 100) : 0,
      promedioNota: promedio(
        conEnvio
          .map((estudiante) => estudiante.mejorNota)
          .filter((nota): nota is number => nota !== null),
      ),
      tiempoPromedioSeg: promedio(enviados.map((intento) => duracionSeg(intento))),
      infraccionesTotales: intentos.reduce((suma, intento) => suma + intento.infractions, 0),
    },
    estudiantes: detalleEstudiantes,
    porGrupo,
    preguntas,
  };
}

/** Resumen ligero por quiz para la pagina indice de reportes. */
export async function listarReportesQuiz(usuario: { id: string; role: string }) {
  const quices = await prisma.quiz.findMany({
    where: usuario.role === 'ADMIN' ? {} : { authorId: usuario.id },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      author: { select: { name: true } },
      assignments: { select: { group: { select: { name: true } } } },
      _count: { select: { attempts: true, questions: true } },
    },
  });

  return quices.map((quiz) => ({
    id: quiz.id,
    titulo: quiz.title,
    estado: quiz.status,
    autor: quiz.author.name,
    grupos: quiz.assignments.map((asignacion) => asignacion.group.name),
    totalPreguntas: quiz._count.questions,
    intentos: quiz._count.attempts,
    modoSeguro: quiz.secureMode,
    actualizadoEn: quiz.updatedAt.toISOString(),
  }));
}

export { redondear };
