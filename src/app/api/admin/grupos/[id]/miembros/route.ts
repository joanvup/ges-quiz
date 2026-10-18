import { prisma } from '@/lib/db';
import { ruta, leerCuerpo, respuestaOk, infoCliente, solicitudInvalida, noEncontrado } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaMiembros, esquemaQuitarMiembro } from '@/lib/esquemas/grupos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/grupos/[id]/miembros */
export const GET = ruta<Ctx['params']>(async (_req, ctx) => {
  await requiereRolApi('ADMIN', 'TEACHER');
  const { id } = await ctx.params;

  const grupo = await prisma.group.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!grupo) throw noEncontrado('Grupo');

  return respuestaOk({
    grupo: { id: grupo.id, nombre: grupo.name, anio: grupo.year },
    miembros: grupo.memberships.map((m) => ({
      id: m.user.id,
      nombre: m.user.name,
      correo: m.user.email,
      activo: m.user.active,
    })),
  });
});

/** POST /api/admin/grupos/[id]/miembros */
export const POST = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;
  const datos = await leerCuerpo(req, esquemaMiembros);

  const grupo = await prisma.group.findUnique({ where: { id } });
  if (!grupo) throw noEncontrado('Grupo');

  const estudiantes = await prisma.user.findMany({
    where: { id: { in: datos.usuarioIds }, role: 'STUDENT' },
    select: { id: true },
  });
  if (estudiantes.length !== datos.usuarioIds.length) {
    throw solicitudInvalida('Todos los usuarios seleccionados deben existir y ser estudiantes.');
  }

  const existentes = await prisma.groupMembership.findMany({
    where: { groupId: id, userId: { in: datos.usuarioIds } },
    select: { userId: true },
  });
  const yaEstan = new Set(existentes.map((e) => e.userId));
  const nuevos = estudiantes.filter((e) => !yaEstan.has(e.id));

  if (nuevos.length) {
    await prisma.groupMembership.createMany({
      data: nuevos.map((e) => ({ userId: e.id, groupId: id })),
    });
  }

  await auditar({
    accion: ACCIONES.MIEMBRO_AGREGADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Group',
    entidadId: id,
    meta: { agregados: nuevos.length, yaEstaban: yaEstan.size },
    ip,
  });

  return respuestaOk({ agregados: nuevos.length, yaEstaban: yaEstan.size });
});

/** DELETE /api/admin/grupos/[id]/miembros  (body: { usuarioId }) */
export const DELETE = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;
  const { usuarioId } = await leerCuerpo(req, esquemaQuitarMiembro);

  const eliminados = await prisma.groupMembership.deleteMany({
    where: { groupId: id, userId: usuarioId },
  });

  await auditar({
    accion: ACCIONES.MIEMBRO_ELIMINADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Group',
    entidadId: id,
    meta: { usuarioId, eliminados: eliminados.count },
    ip,
  });

  return respuestaOk({ eliminado: eliminados.count > 0 });
});
