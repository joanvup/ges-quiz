import { prisma } from '@/lib/db';
import { ruta, respuestaOk, infoCliente, conflicto } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import {
  INCLUDE_QUIZ,
  aQuizDetalleDto,
  obtenerQuizAutorizado,
  validarPublicacion,
} from '@/lib/quices/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/quices/[id]/cerrar - cierra un quiz publicado. */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  if (quiz.status !== 'PUBLISHED') {
    throw conflicto('Solo se puede cerrar un quiz publicado.');
  }

  const cerrado = await prisma.quiz.update({
    where: { id },
    data: { status: 'CLOSED', availableTo: quiz.availableTo ?? new Date() },
    include: INCLUDE_QUIZ,
  });

  await auditar({
    accion: ACCIONES.QUIZ_CERRADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: id,
    meta: { titulo: quiz.title, intentos: quiz._count.attempts },
    ip,
  });

  return respuestaOk({
    quiz: aQuizDetalleDto(cerrado),
    revision: validarPublicacion(cerrado),
  });
});
