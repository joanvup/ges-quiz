import { ruta, respuestaOk, conflicto } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import {
  avanzarIntento,
  entradasDelIntento,
  estadoIntentoDto,
  obtenerIntentoAutorizado,
  resolverTiempos,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/intentos/[id]/avanzar - pasa a la siguiente pregunta. */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  verificarCsrf(req, sesion);
  const { id } = await ctx.params;

  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);
  if (procesado.status !== 'IN_PROGRESS') {
    return respuestaOk({ estado: estadoIntentoDto(procesado) });
  }

  const entradas = entradasDelIntento(procesado);
  if (entradas.length === 0) throw conflicto('El intento no tiene preguntas.');

  const actualizado = await avanzarIntento(procesado);
  return respuestaOk({ estado: estadoIntentoDto(actualizado) });
});
