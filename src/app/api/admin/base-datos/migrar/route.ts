import { ruta, respuestaOk, leerCuerpo, infoCliente } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaMigracion } from '@/lib/esquemas/base-datos';
import { convertirError, migrarBaseDatos, type InformeMigracion } from '@/lib/basedatos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/base-datos/migrar
 * Crea el esquema en la base destino y copia todos los datos.
 * Si `cambiarConfiguracion` es true, tambien deja .env y el esquema de Prisma
 * apuntando al nuevo motor (el cambio se aplica al reiniciar el servidor).
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  const { conexion, cambiarConfiguracion } = await leerCuerpo(req, esquemaMigracion);

  let informe: InformeMigracion;
  try {
    informe = await migrarBaseDatos(conexion, {
      cambiarConfiguracion: cambiarConfiguracion === true,
    });
  } catch (error) {
    throw convertirError(error);
  }

  await auditar({
    accion: ACCIONES.BASE_DATOS_MIGRADA,
    actorId: sesion.usuario.id,
    tipoEntidad: 'BaseDatos',
    meta: {
      motorOrigen: informe.motorOrigen,
      motorDestino: informe.motorDestino,
      destino: informe.destino,
      totalFilas: informe.totalFilas,
      configuracionActualizada: informe.configuracionActualizada,
    },
    ip,
  });

  return respuestaOk({ informe });
});
