import { ruta, respuestaOk, leerCuerpo } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { esquemaProbarConexion } from '@/lib/esquemas/base-datos';
import { convertirError, probarConexion } from '@/lib/basedatos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/base-datos/probar
 * Comprueba que la base de datos destino existe y acepta conexiones.
 * No crea ni modifica nada.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);

  const { conexion } = await leerCuerpo(req, esquemaProbarConexion);

  try {
    const resultado = await probarConexion(conexion);
    return respuestaOk({ resultado });
  } catch (error) {
    throw convertirError(error);
  }
});
