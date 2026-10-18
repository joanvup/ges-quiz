import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { aPreguntaDto, INCLUDE_PREGUNTA_DTO } from '@/lib/preguntas/dto';
import type { PreguntaDto } from '@/lib/cliente/tipos';
import { BancoPreguntas } from '@/components/preguntas/BancoPreguntas';

export const dynamic = 'force-dynamic';

export default async function PaginaBancoPreguntas() {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');

  const [preguntasDb, documentos] = await Promise.all([
    prisma.question.findMany({
      where: usuario.role === 'ADMIN' ? {} : { authorId: usuario.id },
      orderBy: { createdAt: 'desc' },
      take: 400,
      include: INCLUDE_PREGUNTA_DTO,
    }),
    prisma.document.findMany({
      where: usuario.role === 'ADMIN' ? {} : { uploadedById: usuario.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    }),
  ]);

  const preguntas: PreguntaDto[] = preguntasDb.map((pregunta) => aPreguntaDto(pregunta));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Banco de preguntas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Todas tus preguntas en un solo lugar. Edita, aprueba o elimina preguntas antes de armar un quiz.
        </p>
      </div>

      <BancoPreguntas
        iniciales={preguntas}
        documentos={documentos.map((documento) => ({ id: documento.id, titulo: documento.title }))}
        descripcion={`${preguntas.length} pregunta(s) en el banco`}
      />
    </div>
  );
}
