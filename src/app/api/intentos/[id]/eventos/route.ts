import { ruta, leerCuerpo, respuestaOk, infoCliente, demasiadasPeticiones } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { limitar } from '@/lib/rate-limit';
import { esquemaEventoProctor } from '@/lib/esquemas/proctoring';
import {
  estadoIntentoDto,
  obtenerIntentoAutorizado,
  registrarEventoProctor,
  resolverTiempos,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/intentos/[id]/eventos - registra un evento de proctoring del modo
 * seguro. El servidor clasifica su gravedad y aplica la sancion si se alcanza
 * el umbral de infracciones.
 */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  verificarCsrf(req, sesion);

  const limite = limitar(`intentos:eventos:${sesion.usuario.id}`, 120, 60);
  if (!limite.permitido) {
    throw demasiadasPeticiones(
      'Demasiados eventos de seguridad seguidos. Espera unos segundos.',
      limite.reintentarEn,
    );
  }

  const { id } = await ctx.params;
  const { ip, userAgent } = infoCliente(req);
  const datos = await leerCuerpo(req, esquemaEventoProctor);

  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);

  if (procesado.status !== 'IN_PROGRESS') {
    return respuestaOk({
      estado: estadoIntentoDto(procesado),
      infracciones: procesado.infractions,
      accion: null,
    });
  }

  const resultado = await registrarEventoProctor(procesado, datos, ip, userAgent);

  return respuestaOk({
    estado: estadoIntentoDto(resultado.intento),
    infracciones: resultado.infracciones,
    contoComoInfraccion: resultado.contoComoInfraccion,
    accion: resultado.accion,
  });
});
