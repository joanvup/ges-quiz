import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { env } from '@/lib/env';
import { obtenerAjusteNumero } from '@/lib/settings';
import type { DocumentoDto } from '@/lib/cliente/tipos';
import { SubidorDocumentos } from './SubidorDocumentos';
import { ListaDocumentos } from './ListaDocumentos';

export const dynamic = 'force-dynamic';

export default async function PaginaDocumentos() {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');
  const maxMb = await obtenerAjusteNumero('archivos.maxMB', env.maxUploadMb);

  const documentos = await prisma.document.findMany({
    where: usuario.role === 'ADMIN' ? {} : { uploadedById: usuario.id },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });

  const lista: DocumentoDto[] = documentos.map((documento) => ({
    id: documento.id,
    titulo: documento.title,
    nombreArchivo: documento.originalName,
    bytes: documento.sizeBytes,
    paginas: documento.pageCount,
    caracteres: documento.charCount,
    fragmentos: documento.chunkCount,
    estado: documento.status,
    error: documento.errorMessage,
    usoOcr: documento.usedOcr,
    subidoPor: documento.uploadedBy.name,
    preguntas: documento._count.questions,
    creadoEn: documento.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sube el material de estudio, un examen existente o un banco de preguntas en PDF. El sistema
          extrae el texto y lo divide en fragmentos para generar o importar preguntas.
        </p>
      </div>

      <SubidorDocumentos maxMb={maxMb} />
      <ListaDocumentos documentos={lista} />
    </div>
  );
}
