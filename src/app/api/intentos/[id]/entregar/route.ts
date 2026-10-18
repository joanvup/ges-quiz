import { ruta, leerCuerpo, respuestaOk } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { esquemaEntregarIntento } from '@/lib/esquemas/intentos';
import {
  entregarIntento,
  estadoIntentoDto,
  obtenerIntentoAutorizado,
  resolverTiempos,
  resultadoIntentoDto,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/intentos/[id]/entregar - envia y califica el intento.
 * La calificacion ocurre siempre en el servidor y el intento deja de ser
 * reabrible.
 */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  verificarCsrf(req, sesion);
  await leerCuerpo(req, esquemaEntregarIntento);

  const { id } = await ctx.params;
  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);
  const enviado = await entregarIntento(procesado);

  return respuestaOk({
    estado: estadoIntentoDto(enviado),
    resultado: resultadoIntentoDto(enviado),
  });
});
