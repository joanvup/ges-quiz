import { ruta, leerCuerpo, respuestaOk, infoCliente } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaAjustes, guardarAjustes, obtenerAjustes, DEFINICIONES_AJUSTES } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/ajustes */
export const GET = ruta(async () => {
  await requiereRolApi('ADMIN');
  const valores = await obtenerAjustes();
  return respuestaOk({ valores, definiciones: DEFINICIONES_AJUSTES });
});

/** PUT /api/admin/ajustes */
export const PUT = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  const datos = await leerCuerpo(req, esquemaAjustes);

  await guardarAjustes(datos);
  await auditar({
    accion: ACCIONES.AJUSTES_ACTUALIZADOS,
    actorId: sesion.usuario.id,
    meta: { claves: Object.keys(datos) },
    ip,
  });

  const valores = await obtenerAjustes();
  return respuestaOk({ valores });
});
