import type { NextRequest } from 'next/server';
import { leerArchivoMultipart } from '@/lib/archivos';

const MAX_BYTES = 2 * 1024 * 1024;

/** Lee el archivo subido en el campo `archivo` de un formulario multipart. */
export function leerArchivoImportado(
  req: NextRequest,
): Promise<{ nombre: string; contenido: Buffer }> {
  return leerArchivoMultipart(req, {
    maxBytes: MAX_BYTES,
    mensajeFaltante: 'Adjunta un archivo (.xls, .xml o .csv).',
    nombrePorDefecto: 'datos.csv',
  });
}
