import { ruta, respuestaOk } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import {
  obtenerIntentoAutorizado,
  resolverTiempos,
  resumenIntentoDto,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/intentos/[id]/resumen - revision final antes de enviar.
 * Solo devuelve que preguntas estan respondidas; nunca la clave ni el banco.
 */
export const GET = ruta<Ctx['params']>(async (_req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  const { id } = await ctx.params;

  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);

  return respuestaOk({
    resumen: resumenIntentoDto(procesado),
    estado: procesado.status,
    permitirRevision: procesado.quiz.allowReview,
  });
});
