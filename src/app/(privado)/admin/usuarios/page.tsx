import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import type { GrupoDto, UsuarioDto } from '@/lib/cliente/tipos';
import { GestorUsuarios } from './GestorUsuarios';

export const dynamic = 'force-dynamic';

export default async function PaginaUsuarios() {
  await requiereRol('ADMIN');

  const [usuarios, grupos] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      include: { memberships: { include: { group: true } } },
    }),
    prisma.group.findMany({ where: { active: true }, orderBy: [{ year: 'desc' }, { name: 'asc' }] }),
  ]);

  const usuariosDto: UsuarioDto[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.name,
    correo: u.email,
    rol: u.role,
    activo: u.active,
    grupos: u.memberships.map((m) => ({ id: m.group.id, nombre: m.group.name })),
  }));

  const gruposDto: GrupoDto[] = grupos.map((g) => ({
    id: g.id,
    nombre: g.name,
    grado: g.grade,
    anio: g.year,
    descripcion: g.description,
    activo: g.active,
    miembros: 0,
    asignaciones: 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="mt-1 text-sm text-slate-600">
          Crea administradores, docentes y estudiantes, asignalos a grupos y controla su acceso.
        </p>
      </div>
      <GestorUsuarios usuariosIniciales={usuariosDto} grupos={gruposDto} />
    </div>
  );
}
