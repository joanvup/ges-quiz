import { prisma } from '@/lib/db';
import {
  ruta,
  leerCuerpo,
  respuestaOk,
  infoCliente,
  noEncontrado,
  sinPermiso,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaEliminarBanco } from '@/lib/esquemas/preguntas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/preguntas/banco
 *
 * Elimina un banco de preguntas completo: todas las de un documento (el banco
 * del PDF) o, si `documentoId` es null, las manuales del propio docente (el
 * banco general). El documento y el archivo NO se tocan.
 *
 * Las preguntas que ya fueron respondidas en algun intento no se borran para no
 * perder resultados: se archivan (se retiran de los quices y vuelven a borrador).
 */
export const DELETE = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { documentoId } = await leerCuerpo(req, esquemaEliminarBanco);

  if (documentoId) {
    const documento = await prisma.document.findUnique({
      where: { id: documentoId },
      select: { id: true, title: true, uploadedById: true },
    });
    if (!documento) throw noEncontrado('Documento');
    if (sesion.usuario.role !== 'ADMIN' && documento.uploadedById !== sesion.usuario.id) {
      throw sinPermiso();
    }
  }

  const esAdmin = sesion.usuario.role === 'ADMIN';
  // El banco general es personal (solo las propias). El banco de un documento lo
  // vacia su autor; un administrador puede vaciar el de cualquiera.
  const where = {
    documentId: documentoId ?? null,
    ...(documentoId && esAdmin ? {} : { authorId: sesion.usuario.id }),
  };

  const preguntas = await prisma.question.findMany({
    where,
    select: { id: true, _count: { select: { answers: true } } },
  });

  const sinRespuestas = preguntas.filter((p) => p._count.answers === 0).map((p) => p.id);
  const conRespuestas = preguntas.filter((p) => p._count.answers > 0).map((p) => p.id);

  if (preguntas.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (sinRespuestas.length > 0) {
        await tx.quizQuestion.deleteMany({ where: { questionId: { in: sinRespuestas } } });
        await tx.questionOption.deleteMany({ where: { questionId: { in: sinRespuestas } } });
        await tx.question.deleteMany({ where: { id: { in: sinRespuestas } } });
      }
      if (conRespuestas.length > 0) {
        await tx.quizQuestion.deleteMany({ where: { questionId: { in: conRespuestas } } });
        await tx.question.updateMany({
          where: { id: { in: conRespuestas } },
          data: { status: 'DRAFT' },
        });
      }
    });
  }

  await auditar({
    accion: ACCIONES.BANCO_PREGUNTAS_ELIMINADO,
    actorId: sesion.usuario.id,
    tipoEntidad: documentoId ? 'Document' : 'Question',
    entidadId: documentoId ?? 'GENERAL',
    meta: {
      banco: documentoId ?? 'GENERAL',
      total: preguntas.length,
      eliminadas: sinRespuestas.length,
      archivadas: conRespuestas.length,
    },
    ip,
  });

  return respuestaOk({
    total: preguntas.length,
    eliminadas: sinRespuestas.length,
    archivadas: conRespuestas.length,
  });
});
