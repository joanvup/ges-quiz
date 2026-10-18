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
import { esquemaPreguntasQuiz } from '@/lib/esquemas/quices';
import {
  INCLUDE_QUIZ,
  aQuizDetalleDto,
  obtenerQuizAutorizado,
  validarPublicacion,
} from '@/lib/quices/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/quices/[id]/preguntas
 * Reemplaza la lista ordenada de preguntas del quiz. Se envia el arreglo
 * completo para que reordenar, agregar y quitar sea una sola operacion.
 */
export const PUT = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  if (quiz.status === 'CLOSED') {
    throw conflicto('Un quiz cerrado no se puede editar.');
  }
  if (quiz._count.attempts > 0) {
    throw conflicto(
      'El quiz ya tiene intentos de estudiantes: no se pueden cambiar sus preguntas.',
    );
  }

  const datos = await leerCuerpo(req, esquemaPreguntasQuiz);
  const ids = datos.preguntas.map((pregunta) => pregunta.id);

  const disponibles = await prisma.question.findMany({
    where: {
      id: { in: ids },
      ...(sesion.usuario.role === 'ADMIN' ? {} : { authorId: sesion.usuario.id }),
    },
    select: { id: true },
  });
  if (disponibles.length !== ids.length) {
    throw solicitudInvalida(
      'Alguna de las preguntas seleccionadas no existe o no pertenece a tu banco.',
    );
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.deleteMany({ where: { quizId: id } });
    if (datos.preguntas.length > 0) {
      await tx.quizQuestion.createMany({
        data: datos.preguntas.map((pregunta, indice) => ({
          quizId: id,
          questionId: pregunta.id,
          position: indice,
          points: pregunta.puntos ?? quiz.defaultPoints,
        })),
      });
    }
    return tx.quiz.findUnique({ where: { id }, include: INCLUDE_QUIZ });
  });

  if (!actualizado) throw noEncontrado('Quiz');

  await auditar({
    accion: ACCIONES.QUIZ_ACTUALIZADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: id,
    meta: { preguntas: datos.preguntas.length },
    ip,
  });

  return respuestaOk({
    quiz: aQuizDetalleDto(actualizado),
    revision: validarPublicacion(actualizado),
  });
});
