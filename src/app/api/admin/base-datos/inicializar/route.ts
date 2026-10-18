import { ruta, respuestaOk, infoCliente } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { inicializarSinDatos, type InformeInicializacion, convertirError } from '@/lib/basedatos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/admin/base-datos/inicializar
 * Vacia los datos de trabajo (estudiantes, grupos, documentos, preguntas,
 * quices e intentos) y deja la base como recien instalada.
 *
 * Conserva el esquema, la configuracion, la auditoria y la cuenta que ejecuta
 * la accion (sin cerrarle la sesion). Antes de borrar guarda una copia de
 * seguridad en `storage/backups/`.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  let informe: InformeInicializacion;
  try {
    informe = await inicializarSinDatos(sesion.usuario.id);
  } catch (error) {
    throw convertirError(error);
  }

  await auditar({
    accion: ACCIONES.BASE_DATOS_INICIALIZADA,
    actorId: sesion.usuario.id,
    tipoEntidad: 'BaseDatos',
    meta: {
      totalFilas: informe.totalFilas,
      respaldoPrevio: informe.respaldoPrevio,
      conservado: informe.conservado,
    },
    ip,
  });

  return respuestaOk({ informe });
});
