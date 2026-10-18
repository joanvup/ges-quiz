import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { obtenerAjuste } from '@/lib/settings';
import { anioEscolarActual } from '@/lib/dominio/anio';
import type { GrupoDto, UsuarioDto } from '@/lib/cliente/tipos';
import { GestorGrupos } from './GestorGrupos';

export const dynamic = 'force-dynamic';

export default async function PaginaGrupos() {
  await requiereRol('ADMIN');

  const [grupos, estudiantes, anioActual] = await Promise.all([
    prisma.group.findMany({
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { memberships: true, assignments: true } } },
    }),
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { name: 'asc' },
      include: { memberships: { include: { group: true } } },
    }),
    obtenerAjuste('institucion.anio') || anioEscolarActual(),
  ]);

  const gruposDto: GrupoDto[] = grupos.map((g) => ({
    id: g.id,
    nombre: g.name,
    grado: g.grade,
    anio: g.year,
    descripcion: g.description,
    activo: g.active,
    miembros: g._count.memberships,
    asignaciones: g._count.assignments,
  }));

  const estudiantesDto: UsuarioDto[] = estudiantes.map((e) => ({
    id: e.id,
    nombre: e.name,
    correo: e.email,
    rol: e.role,
    activo: e.active,
    grupos: e.memberships.map((m) => ({ id: m.group.id, nombre: m.group.name })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Grupos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Organiza a los estudiantes en cursos o grupos y administra sus miembros.
        </p>
      </div>
      <GestorGrupos gruposIniciales={gruposDto} estudiantes={estudiantesDto} anioActual={anioActual} />
    </div>
  );
}
