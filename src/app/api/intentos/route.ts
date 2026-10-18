import { ruta, leerCuerpo, respuestaOk, infoCliente, demasiadasPeticiones } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { limitar } from '@/lib/rate-limit';
import { esquemaIniciarIntento } from '@/lib/esquemas/intentos';
import { estadoIntentoDto, iniciarIntento, obtenerQuizParaEstudiante } from '@/lib/intentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/intentos - inicia un intento o reanuda el que ya esta en progreso.
 *
 * Una sola sesion activa por quiz y estudiante: si existe un intento en
 * progreso se devuelve el mismo (no se duplica), lo que evita el doble
 * intento simultaneo desde dos pestanas.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('STUDENT');
  verificarCsrf(req, sesion);

  const limite = limitar(`intentos:iniciar:${sesion.usuario.id}`, 20, 60);
  if (!limite.permitido) {
    throw demasiadasPeticiones(
      'Demasiados intentos de inicio seguidos. Espera unos segundos.',
      limite.reintentarEn,
    );
  }

  const { ip, userAgent } = infoCliente(req);
  const datos = await leerCuerpo(req, esquemaIniciarIntento);
  const quiz = await obtenerQuizParaEstudiante(datos.quizId, sesion.usuario.id);
  const { intento, reanudado } = await iniciarIntento(quiz, sesion.usuario.id, ip, userAgent);

  return respuestaOk({ estado: estadoIntentoDto(intento), reanudado }, reanudado ? 200 : 201);
});
