import { prisma } from '@/lib/db';
import { noEncontrado } from '@/lib/http';
import { fragmentarPaginas, type Fragmento } from '@/lib/pdf/chunking';
import type { UsuarioSesion } from '@/lib/auth/session';

export type DocumentoVisible = {
  id: string;
  title: string;
  originalName: string;
  storagePath: string;
  sizeBytes: number;
  pageCount: number;
  charCount: number;
  chunkCount: number;
  status: string;
  errorMessage: string | null;
  usedOcr: boolean;
  uploadedById: string;
  createdAt: Date;
  extractedText: string;
  pagesJson: string;
};

/** Lee todas las paginas guardadas de un documento. */
export function paginasDeDocumento(documento: { pagesJson: string; extractedText: string }): string[] {
  try {
    const paginas = JSON.parse(documento.pagesJson || '[]');
    if (Array.isArray(paginas) && paginas.every((p) => typeof p === 'string')) {
      return paginas as string[];
    }
  } catch {
    // Si el JSON esta corrupto se usa el texto completo como una sola pagina.
  }
  return documento.extractedText ? [documento.extractedText] : [];
}

/** Reconstruye los fragmentos (chunks) de un documento. */
export function fragmentosDeDocumento(documento: {
  pagesJson: string;
  extractedText: string;
}): Fragmento[] {
  return fragmentarPaginas(paginasDeDocumento(documento));
}

/**
 * Devuelve el documento si el usuario puede verlo.
 * Los docentes solo ven sus propios documentos; los administradores ven todos.
 */
export async function obtenerDocumentoVisible(
  id: string,
  usuario: UsuarioSesion,
): Promise<DocumentoVisible> {
  const documento = await prisma.document.findUnique({ where: { id } });
  if (!documento) throw noEncontrado('Documento');
  if (usuario.role !== 'ADMIN' && documento.uploadedById !== usuario.id) {
    throw noEncontrado('Documento');
  }
  return documento;
}
