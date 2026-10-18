import { ruta, respuestaOk } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import { estadoBaseDatos } from '@/lib/basedatos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/base-datos
 * Devuelve el motor activo, la conexion (sin contrasena) y el conteo de filas.
 */
export const GET = ruta(async () => {
  await requiereRolApi('ADMIN');
  const estado = await estadoBaseDatos();
  return respuestaOk({ estado });
});
