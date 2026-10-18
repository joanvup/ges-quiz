import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';

/** Utilidades de almacenamiento local de los PDFs subidos. */

export function directorioUploads(): string {
  return path.resolve(process.cwd(), env.uploadDir);
}

export async function asegurarDirectorioUploads(): Promise<string> {
  const dir = directorioUploads();
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Guarda un archivo dentro del directorio de subidas y devuelve su ruta
 * absoluta. El nombre se compone de la fecha y un identificador aleatorio
 * para evitar colisiones y ataques de "path traversal".
 */
export async function guardarArchivo(nombreOriginal: string, datos: Buffer): Promise<string> {
  const dir = await asegurarDirectorioUploads();
  const extension = path.extname(nombreOriginal).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.pdf';
  const base = path
    .basename(nombreOriginal, path.extname(nombreOriginal))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'documento';
  const identificador = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const destino = path.join(dir, `${base}-${identificador}${extension}`);
  await writeFile(destino, datos);
  return destino;
}

/** Verifica que una ruta este dentro del directorio de subidas (anti traversal). */
export function rutaPermitida(ruta: string): boolean {
  const absoluta = path.resolve(ruta);
  const base = directorioUploads();
  const relativa = path.relative(base, absoluta);
  return relativa !== '' && !relativa.startsWith('..') && !path.isAbsolute(relativa);
}

export async function leerArchivo(ruta: string): Promise<Buffer> {
  if (!rutaPermitida(ruta)) throw new Error('Ruta de archivo no permitida.');
  return readFile(ruta);
}

export async function borrarArchivo(ruta: string): Promise<void> {
  if (!rutaPermitida(ruta)) return;
  try {
    await unlink(ruta);
  } catch {
    // Si el archivo ya no existe, no es un error relevante.
  }
}

export async function existeArchivo(ruta: string): Promise<boolean> {
  if (!rutaPermitida(ruta)) return false;
  try {
    const info = await stat(ruta);
    return info.isFile();
  } catch {
    return false;
  }
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
