import { ruta, respuestaOk, solicitudInvalida } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { leerArchivoImportado } from '@/lib/importacion/archivo';
import { analizarArchivo } from '@/lib/importacion/servicio';
import { ErrorImportacion } from '@/lib/importacion/tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/importar/validar
 * Lee el archivo y devuelve el resultado de validar cada fila, SIN escribir en
 * la base. Sirve para previsualizar y corregir errores antes de importar.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);

  const { nombre, contenido } = await leerArchivoImportado(req);

  try {
    const analisis = await analizarArchivo(nombre, contenido);
    return respuestaOk({ filas: analisis.filas, resumen: analisis.resumen });
  } catch (error) {
    if (error instanceof ErrorImportacion) throw solicitudInvalida(error.message);
    throw error;
  }
});
