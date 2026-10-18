import { ruta, respuestaOk } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import {
  estadoIntentoDto,
  obtenerIntentoAutorizado,
  resolverTiempos,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/intentos/[id] - estado del intento (solo la pregunta vigente).
 * Aplica los limites de tiempo del servidor antes de responder.
 */
export const GET = ruta<Ctx['params']>(async (_req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  const { id } = await ctx.params;

  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);

  return respuestaOk({ estado: estadoIntentoDto(procesado) });
});
