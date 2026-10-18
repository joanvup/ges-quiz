import { ruta, respuestaOk, solicitudInvalida, validar, infoCliente } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { leerArchivoMultipart } from '@/lib/archivos';
import { esquemaRespaldo } from '@/lib/esquemas/base-datos';
import { convertirError, restaurarRespaldo, type InformeRestauracion } from '@/lib/basedatos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 64 * 1024 * 1024;

/**
 * POST /api/admin/base-datos/restaurar
 * Reemplaza los datos actuales con los de un respaldo JSON.
 * Antes de sobrescribir guarda una copia de seguridad en disco.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  const { nombre, contenido } = await leerArchivoMultipart(req, {
    maxBytes: MAX_BYTES,
    mensajeFaltante: 'Adjunta un respaldo en formato JSON.',
    nombrePorDefecto: 'respaldo.json',
  });

  let json: unknown;
  try {
    json = JSON.parse(contenido.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw solicitudInvalida('El archivo no es un respaldo JSON valido.');
  }

  const datos = validar(esquemaRespaldo, json);

  let informe: InformeRestauracion;
  try {
    informe = await restaurarRespaldo(datos);
  } catch (error) {
    throw convertirError(error);
  }

  await auditar({
    accion: ACCIONES.RESPALDO_RESTAURADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'BaseDatos',
    meta: {
      archivo: nombre,
      totalFilas: informe.totalFilas,
      respaldoPrevio: informe.respaldoPrevio,
    },
    ip,
  });

  return respuestaOk({ informe });
});
