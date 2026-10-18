import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { INCLUDE_PREGUNTA_DTO, aPreguntaDto } from '@/lib/preguntas/dto';
import { INCLUDE_QUIZ, aQuizDetalleDto } from '@/lib/quices/servicio';
import type { GrupoQuizDto, PreguntaDto } from '@/lib/cliente/tipos';
import { EditorQuiz } from './EditorQuiz';

export const dynamic = 'force-dynamic';

export default async function PaginaEditorQuiz({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');
  const { id } = await params;

  const quizDb = await prisma.quiz.findUnique({ where: { id }, include: INCLUDE_QUIZ });
  if (!quizDb) notFound();
  if (usuario.role !== 'ADMIN' && quizDb.authorId !== usuario.id) {
    redirect('/docentes/quices');
  }

  const [preguntasDb, gruposDb] = await Promise.all([
    prisma.question.findMany({
      where: usuario.role === 'ADMIN' ? {} : { authorId: usuario.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: INCLUDE_PREGUNTA_DTO,
    }),
    prisma.group.findMany({
      where: { active: true },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { memberships: true } } },
    }),
  ]);

  const banco: PreguntaDto[] = preguntasDb.map(aPreguntaDto);
  const grupos: GrupoQuizDto[] = gruposDb.map((grupo) => ({
    id: grupo.id,
    nombre: grupo.name,
    grado: grupo.grade,
    anio: grupo.year,
    miembros: grupo._count.memberships,
  }));

  return <EditorQuiz inicial={aQuizDetalleDto(quizDb)} banco={banco} grupos={grupos} />;
}
