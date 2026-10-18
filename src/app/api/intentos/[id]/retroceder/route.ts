import { ruta, respuestaOk } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import {
  estadoIntentoDto,
  obtenerIntentoAutorizado,
  resolverTiempos,
  retrocederIntento,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/intentos/[id]/retroceder - vuelve a la pregunta anterior.
 * El servicio rechaza la operacion si el quiz es de navegacion solo hacia
 * adelante, sin importar lo que el cliente intente.
 */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  verificarCsrf(req, sesion);
  const { id } = await ctx.params;

  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);
  if (procesado.status !== 'IN_PROGRESS') {
    return respuestaOk({ estado: estadoIntentoDto(procesado) });
  }

  const actualizado = await retrocederIntento(procesado);
  return respuestaOk({ estado: estadoIntentoDto(actualizado) });
});
