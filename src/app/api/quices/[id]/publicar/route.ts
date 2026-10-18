import { prisma } from '@/lib/db';
import {
  ruta,
  leerCuerpo,
  respuestaOk,
  infoCliente,
  conflicto,
  ErrorApi,
  noEncontrado,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaPublicarQuiz } from '@/lib/esquemas/quices';
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
 * POST /api/quices/[id]/publicar
 * Publica el quiz solo tras una revision explicita del docente
 * (`confirmoRevision: true`). Valida preguntas, respuestas, grupos y fechas.
 */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;
  await leerCuerpo(req, esquemaPublicarQuiz);

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  if (quiz.status === 'PUBLISHED') {
    throw conflicto('Este quiz ya esta publicado.');
  }
  if (quiz.status === 'CLOSED') {
    throw conflicto('Un quiz cerrado no se puede volver a publicar. Crea uno nuevo.');
  }

  const revision = validarPublicacion(quiz);
  if (revision.errores.length > 0) {
    throw new ErrorApi(
      409,
      'QUIZ_NO_LISTO',
      'El quiz todavia no cumple los requisitos para publicarse.',
      { errores: revision.errores, advertencias: revision.advertencias },
    );
  }

  const publicado = await prisma.$transaction(async (tx) => {
    // La revision explicita convierte las preguntas incluidas en aprobadas.
    await tx.question.updateMany({
      where: { id: { in: quiz.questions.map((entrada) => entrada.questionId) } },
      data: { status: 'APPROVED', answerPending: false },
    });

    return tx.quiz.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: INCLUDE_QUIZ,
    });
  });

  if (!publicado) throw noEncontrado('Quiz');

  await auditar({
    accion: ACCIONES.QUIZ_PUBLICADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: id,
    meta: {
      titulo: quiz.title,
      preguntas: quiz.questions.length,
      grupos: quiz.assignments.length,
      advertencias: revision.advertencias,
    },
    ip,
  });

  return respuestaOk({
    quiz: aQuizDetalleDto(publicado),
    revision: validarPublicacion(publicado),
  });
});
