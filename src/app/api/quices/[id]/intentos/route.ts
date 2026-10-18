import { ruta, respuestaOk } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import { obtenerQuizAutorizado } from '@/lib/quices/servicio';
import { listarIntentosDocente } from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/quices/[id]/intentos - intentos del quiz con su linea de tiempo de
 * infracciones. Solo el autor del quiz (o un administrador) puede verlo.
 */
export const GET = ruta<Ctx['params']>(async (_req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const { id } = await ctx.params;

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  const intentos = await listarIntentosDocente(quiz.id);

  return respuestaOk({ intentos });
});
