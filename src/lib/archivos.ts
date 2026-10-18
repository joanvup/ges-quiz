import type { NextRequest } from 'next/server';
import { ErrorApi, solicitudInvalida } from '@/lib/http';

export type OpcionesArchivo = {
  /** Nombre del campo del formulario multipart (por defecto `archivo`). */
  campo?: string;
  /** Tamano maximo en bytes. */
  maxBytes?: number;
  /** Mensaje cuando no llega ningun archivo. */
  mensajeFaltante?: string;
  /** Nombre a usar si el navegador no envia uno. */
  nombrePorDefecto?: string;
};

function formatearMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Lee un archivo subido en un formulario multipart.
 * Lanza `ErrorApi` con mensajes en espanol si falta o excede el limite.
 */
export async function leerArchivoMultipart(
  req: NextRequest,
  opciones: OpcionesArchivo = {},
): Promise<{ nombre: string; contenido: Buffer }> {
  const campo = opciones.campo ?? 'archivo';
  const maxBytes = opciones.maxBytes ?? 2 * 1024 * 1024;

  let formulario: FormData;
  try {
    formulario = await req.formData();
  } catch {
    throw solicitudInvalida('No se pudo leer el archivo subido (revisa su tamano).');
  }

  const archivo = formulario.get(campo);
  if (!archivo || typeof archivo !== 'object' || !('arrayBuffer' in archivo)) {
    throw solicitudInvalida(opciones.mensajeFaltante ?? 'Adjunta un archivo.');
  }

  const file = archivo as File;
  if (file.size === 0) throw solicitudInvalida('El archivo esta vacio (0 bytes).');
  if (file.size > maxBytes) {
    throw new ErrorApi(
      413,
      'ARCHIVO_MUY_GRANDE',
      `El archivo supera el limite de ${formatearMb(maxBytes)}.`,
    );
  }

  return {
    nombre: file.name || opciones.nombrePorDefecto || 'archivo',
    contenido: Buffer.from(await file.arrayBuffer()),
  };
}
