import {
  ruta,
  leerCuerpo,
  respuestaOk,
  demasiadasPeticiones,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { limitar } from '@/lib/rate-limit';
import { esquemaGuardarRespuesta } from '@/lib/esquemas/intentos';
import {
  estadoIntentoDto,
  guardarRespuesta,
  obtenerIntentoAutorizado,
  resolverTiempos,
} from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/intentos/[id]/respuesta - autoguardado de la respuesta vigente.
 * Si el tiempo ya expiro, el intento se envia solo y se devuelve el estado.
 */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('STUDENT');
  verificarCsrf(req, sesion);

  const limite = limitar(`intentos:respuesta:${sesion.usuario.id}`, 300, 60);
  if (!limite.permitido) {
    throw demasiadasPeticiones(
      'Demasiadas peticiones seguidas. Espera unos segundos.',
      limite.reintentarEn,
    );
  }

  const { id } = await ctx.params;
  const datos = await leerCuerpo(req, esquemaGuardarRespuesta);

  const intento = await obtenerIntentoAutorizado(id, sesion.usuario.id);
  const procesado = await resolverTiempos(intento);
  if (procesado.status !== 'IN_PROGRESS') {
    return respuestaOk({ estado: estadoIntentoDto(procesado), guardada: false });
  }

  const actualizado = await guardarRespuesta(procesado, {
    preguntaId: datos.preguntaId,
    opciones: datos.opciones,
    texto: datos.texto ?? null,
  });

  return respuestaOk({ estado: estadoIntentoDto(actualizado), guardada: true });
});
