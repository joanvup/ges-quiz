import { ruta, respuestaOk, infoCliente } from '@/lib/http';
import { requiereUsuarioApi, verificarCsrf } from '@/lib/auth/guard';
import { cerrarSesion } from '@/lib/auth/session';
import { auditar, ACCIONES } from '@/lib/audit';

export const runtime = 'nodejs';

/** POST /api/auth/logout */
export const POST = ruta(async (req) => {
  const sesion = await requiereUsuarioApi();
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  await cerrarSesion();
  await auditar({ accion: ACCIONES.LOGOUT, actorId: sesion.usuario.id, ip });

  return respuestaOk({ cerrada: true });
});
