import { prisma } from '@/lib/db';
import { ruta, leerCuerpo, respuestaOk, infoCliente, noEncontrado, sinPermiso } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar } from '@/lib/audit';
import { huellaTexto } from '@/lib/auth/password';
import { esquemaActualizarPregunta } from '@/lib/esquemas/preguntas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function obtenerPreguntaAutorizada(id: string, usuarioId: string, esAdmin: boolean) {
  const pregunta = await prisma.question.findUnique({ where: { id } });
  if (!pregunta) throw noEncontrado('Pregunta');
  if (!esAdmin && pregunta.authorId !== usuarioId) throw sinPermiso();
  return pregunta;
}

/** PATCH /api/preguntas/[id] */
export const PATCH = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const pregunta = await obtenerPreguntaAutorizada(id, sesion.usuario.id, sesion.usuario.role === 'ADMIN');
  const datos = await leerCuerpo(req, esquemaActualizarPregunta);

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },
      data: {
        ...(datos.enunciado !== undefined
          ? { statement: datos.enunciado, fingerprint: huellaTexto(datos.enunciado) }
          : {}),
        ...(datos.tipo !== undefined ? { type: datos.tipo } : {}),
        ...(datos.explicacion !== undefined ? { explanation: datos.explicacion || null } : {}),
        ...(datos.tema !== undefined ? { topic: datos.tema || null } : {}),
        ...(datos.pagina !== undefined ? { sourcePage: datos.pagina } : {}),
        ...(datos.dificultad !== undefined ? { difficulty: datos.dificultad } : {}),
        ...(datos.estado !== undefined ? { status: datos.estado } : {}),
        ...(datos.documentoId !== undefined ? { documentId: datos.documentoId } : {}),
        // Al editar la respuesta se considera revisada.
        ...(datos.opciones !== undefined ? { answerPending: false } : {}),
      },
    });

    if (datos.opciones !== undefined) {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      if (datos.opciones.length > 0) {
        await tx.questionOption.createMany({
          data: datos.opciones.map((opcion, indice) => ({
            questionId: id,
            label: String.fromCharCode(65 + indice),
            text: opcion.texto,
            isCorrect: opcion.correcta,
            position: indice,
          })),
        });
      }
    }
  });

  await auditar({
    accion: 'PREGUNTA_ACTUALIZADA',
    actorId: sesion.usuario.id,
    tipoEntidad: 'Question',
    entidadId: id,
    meta: { campos: Object.keys(datos), enunciadoPrevio: pregunta.statement.slice(0, 120) },
    ip,
  });

  return respuestaOk({ actualizada: true });
});

/** DELETE /api/preguntas/[id] */
export const DELETE = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const pregunta = await obtenerPreguntaAutorizada(id, sesion.usuario.id, sesion.usuario.role === 'ADMIN');

  const intentos = await prisma.answer.count({ where: { questionId: id } });
  if (intentos > 0) {
    // Se conserva la pregunta para no invalidar intentos y reportes ya hechos.
    await prisma.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({ where: { questionId: id } });
      await tx.question.update({ where: { id }, data: { status: 'DRAFT' } });
    });
    await auditar({
      accion: 'PREGUNTA_ARCHIVADA',
      actorId: sesion.usuario.id,
      tipoEntidad: 'Question',
      entidadId: id,
      meta: { motivo: 'tiene respuestas de estudiantes', intentos },
      ip,
    });
    return respuestaOk({
      eliminada: false,
      archivada: true,
      mensaje:
        'La pregunta ya fue usada en intentos de estudiantes, por eso se retire de los quices pero no se elimino.',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.deleteMany({ where: { questionId: id } });
    await tx.questionOption.deleteMany({ where: { questionId: id } });
    await tx.question.delete({ where: { id } });
  });

  await auditar({
    accion: 'PREGUNTA_ELIMINADA',
    actorId: sesion.usuario.id,
    tipoEntidad: 'Question',
    entidadId: id,
    meta: { enunciado: pregunta.statement.slice(0, 120) },
    ip,
  });

  return respuestaOk({ eliminada: true });
});
