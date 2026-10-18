import { ruta, respuestaOk, solicitudInvalida, infoCliente } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { leerArchivoImportado } from '@/lib/importacion/archivo';
import { analizarArchivo, importarAnalisis } from '@/lib/importacion/servicio';
import { ErrorImportacion } from '@/lib/importacion/tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/admin/importar
 * Vuelve a validar el archivo y crea los grupos y estudiantes validos.
 * Los correos o nombres ya existentes se omiten y se reportan como errores.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  const { nombre, contenido } = await leerArchivoImportado(req);

  let analisis;
  try {
    analisis = await analizarArchivo(nombre, contenido);
  } catch (error) {
    if (error instanceof ErrorImportacion) throw solicitudInvalida(error.message);
    throw error;
  }

  if (analisis.listas.length === 0) {
    throw solicitudInvalida(
      'No hay filas validas para importar. Corrige los errores y vuelve a intentarlo.',
    );
  }

  const resultado = await importarAnalisis(analisis, sesion.usuario.id);

  await auditar({
    accion: ACCIONES.DATOS_IMPORTADOS,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Importacion',
    meta: {
      archivo: nombre,
      usuariosCreados: resultado.usuariosCreados,
      gruposCreados: resultado.gruposCreados,
      membresiasCreadas: resultado.membresiasCreadas,
      filasConError: resultado.errores.length,
    },
    ip,
  });

  return respuestaOk({ resultado, filas: analisis.filas, resumen: analisis.resumen }, 201);
});
