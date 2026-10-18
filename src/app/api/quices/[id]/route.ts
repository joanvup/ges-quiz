import { prisma } from '@/lib/db';
import {
  ruta,
  leerCuerpo,
  respuestaOk,
  infoCliente,
  conflicto,
  solicitudInvalida,
  noEncontrado,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaActualizarQuiz, fechaDesdeTexto } from '@/lib/esquemas/quices';
import {
  INCLUDE_QUIZ,
  aQuizDetalleDto,
  obtenerQuizAutorizado,
  validarPublicacion,
} from '@/lib/quices/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/quices/[id] - ficha completa para el editor y la revision. */
export const GET = ruta<Ctx['params']>(async (_req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const { id } = await ctx.params;
  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);

  return respuestaOk({
    quiz: aQuizDetalleDto(quiz),
    revision: validarPublicacion(quiz),
  });
});

/** PATCH /api/quices/[id] - guarda la configuracion del quiz. */
export const PATCH = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  if (quiz.status === 'CLOSED') {
    throw conflicto('Un quiz cerrado no se puede editar. Crea uno nuevo si necesitas reutilizarlo.');
  }

  const datos = await leerCuerpo(req, esquemaActualizarQuiz);

  // Validacion de negocio con los valores ya combinados (PATCH parcial).
  const notaAprobacion = datos.notaAprobacion ?? quiz.passingScore;
  const notaMaxima = datos.notaMaxima ?? quiz.maxGrade;
  if (notaAprobacion > notaMaxima) {
    throw solicitudInvalida('La nota minima de aprobacion no puede superar la nota maxima.', {
      notaAprobacion: 'Debe ser menor o igual que la nota maxima.',
    });
  }

  const desde =
    datos.fechaDisponibleDesde !== undefined
      ? fechaDesdeTexto(datos.fechaDisponibleDesde)
      : quiz.availableFrom;
  const hasta =
    datos.fechaDisponibleHasta !== undefined
      ? fechaDesdeTexto(datos.fechaDisponibleHasta)
      : quiz.availableTo;

  if (datos.fechaDisponibleDesde && !desde) {
    throw solicitudInvalida('La fecha de apertura no es valida.', {
      fechaDisponibleDesde: 'Usa una fecha valida.',
    });
  }
  if (datos.fechaDisponibleHasta && !hasta) {
    throw solicitudInvalida('La fecha de cierre no es valida.', {
      fechaDisponibleHasta: 'Usa una fecha valida.',
    });
  }
  if (desde && hasta && hasta <= desde) {
    throw solicitudInvalida('La fecha de cierre debe ser posterior a la fecha de apertura.', {
      fechaDisponibleHasta: 'Debe ser posterior a la fecha de apertura.',
    });
  }

  let grupos: { id: string }[] | null = null;
  if (datos.grupoIds) {
    grupos = await prisma.group.findMany({
      where: { id: { in: datos.grupoIds } },
      select: { id: true },
    });
    if (grupos.length !== datos.grupoIds.length) {
      throw solicitudInvalida('Uno o mas grupos seleccionados no existen.');
    }
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    if (datos.grupoIds) {
      await tx.quizAssignment.deleteMany({ where: { quizId: id } });
      if (datos.grupoIds.length > 0) {
        await tx.quizAssignment.createMany({
          data: datos.grupoIds.map((groupId) => ({ quizId: id, groupId })),
        });
      }
    }

    await tx.quiz.update({
      where: { id },
      data: {
        ...(datos.titulo !== undefined ? { title: datos.titulo } : {}),
        ...(datos.descripcion !== undefined
          ? { description: datos.descripcion?.trim() || null }
          : {}),
        ...(datos.fechaDisponibleDesde !== undefined ? { availableFrom: desde } : {}),
        ...(datos.fechaDisponibleHasta !== undefined ? { availableTo: hasta } : {}),
        ...(datos.navegacion !== undefined ? { navigationMode: datos.navegacion } : {}),
        ...(datos.tiempoTotalSeg !== undefined ? { timeLimitSec: datos.tiempoTotalSeg } : {}),
        ...(datos.tiempoPorPreguntaSeg !== undefined
          ? { perQuestionTimeSec: datos.tiempoPorPreguntaSeg }
          : {}),
        ...(datos.mezclarPreguntas !== undefined
          ? { shuffleQuestions: datos.mezclarPreguntas }
          : {}),
        ...(datos.mezclarOpciones !== undefined ? { shuffleOptions: datos.mezclarOpciones } : {}),
        ...(datos.intentosMaximos !== undefined ? { maxAttempts: datos.intentosMaximos } : {}),
        ...(datos.cantidadPreguntas !== undefined
          ? { questionCount: datos.cantidadPreguntas }
          : {}),
        ...(datos.puntosPorDefecto !== undefined
          ? { defaultPoints: datos.puntosPorDefecto }
          : {}),
        ...(datos.notaAprobacion !== undefined ? { passingScore: datos.notaAprobacion } : {}),
        ...(datos.notaMaxima !== undefined ? { maxGrade: datos.notaMaxima } : {}),
        ...(datos.mostrarResultados !== undefined
          ? { showResults: datos.mostrarResultados }
          : {}),
        ...(datos.permitirRevision !== undefined
          ? { allowReview: datos.permitirRevision }
          : {}),
        ...(datos.modoSeguro !== undefined ? { secureMode: datos.modoSeguro } : {}),
        ...(datos.umbralInfracciones !== undefined
          ? { infractionThreshold: datos.umbralInfracciones }
          : {}),
        ...(datos.accionInfraccion !== undefined
          ? { infractionAction: datos.accionInfraccion }
          : {}),
        ...(datos.bloquearSinPantallaCompleta !== undefined
          ? { blockWithoutFullscreen: datos.bloquearSinPantallaCompleta }
          : {}),
      },
    });

    return tx.quiz.findUnique({ where: { id }, include: INCLUDE_QUIZ });
  });

  if (!actualizado) throw noEncontrado('Quiz');

  await auditar({
    accion: ACCIONES.QUIZ_ACTUALIZADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: id,
    meta: { campos: Object.keys(datos) },
    ip,
  });

  return respuestaOk({
    quiz: aQuizDetalleDto(actualizado),
    revision: validarPublicacion(actualizado),
  });
});

/** DELETE /api/quices/[id] - se puede borrar mientras nunca se haya ejecutado. */
export const DELETE = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  if (quiz._count.attempts > 0) {
    throw conflicto(
      'Este quiz ya fue presentado por lo menos una vez, por eso no se puede eliminar. Cierralo en lugar de borrarlo.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.quizAssignment.deleteMany({ where: { quizId: id } });
    await tx.quizQuestion.deleteMany({ where: { quizId: id } });
    await tx.quiz.delete({ where: { id } });
  });

  await auditar({
    accion: ACCIONES.QUIZ_ELIMINADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: id,
    meta: { titulo: quiz.title, estado: quiz.status },
    ip,
  });

  return respuestaOk({ eliminado: true });
});
