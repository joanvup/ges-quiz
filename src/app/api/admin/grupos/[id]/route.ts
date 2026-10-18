import { prisma } from '@/lib/db';
import {
  ruta,
  leerCuerpo,
  respuestaOk,
  infoCliente,
  conflicto,
  noEncontrado,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaActualizarGrupo } from '@/lib/esquemas/grupos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/grupos/[id] */
export const PATCH = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;
  const datos = await leerCuerpo(req, esquemaActualizarGrupo);

  const grupo = await prisma.group.findUnique({ where: { id } });
  if (!grupo) throw noEncontrado('Grupo');

  const nombreFinal = datos.nombre ?? grupo.name;
  const anioFinal = datos.anio ?? grupo.year;

  if (nombreFinal !== grupo.name || anioFinal !== grupo.year) {
    const duplicado = await prisma.group.findFirst({
      where: { name: nombreFinal, year: anioFinal, id: { not: id } },
    });
    if (duplicado) throw conflicto('Ya existe otro grupo con ese nombre en el mismo ano.');
  }

  await prisma.group.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { name: datos.nombre } : {}),
      ...(datos.grado !== undefined ? { grade: datos.grado || null } : {}),
      ...(datos.anio !== undefined ? { year: datos.anio } : {}),
      ...(datos.descripcion !== undefined ? { description: datos.descripcion || null } : {}),
      ...(datos.activo !== undefined ? { active: datos.activo } : {}),
    },
  });

  await auditar({
    accion: ACCIONES.GRUPO_ACTUALIZADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Group',
    entidadId: id,
    meta: { campos: Object.keys(datos) },
    ip,
  });

  return respuestaOk({ actualizado: true });
});

/** DELETE /api/admin/grupos/[id] */
export const DELETE = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const grupo = await prisma.group.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!grupo) throw noEncontrado('Grupo');

  const intentos = await prisma.attempt.count({
    where: { quiz: { assignments: { some: { groupId: id } } } },
  });
  if (intentos > 0) {
    throw conflicto(
      'No se puede eliminar el grupo porque tiene intentos de quiz registrados. Desactivalo en su lugar.',
    );
  }

  await prisma.group.delete({ where: { id } });

  await auditar({
    accion: ACCIONES.GRUPO_ELIMINADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Group',
    entidadId: id,
    meta: { nombre: grupo.name, asignaciones: grupo._count.assignments },
    ip,
  });

  return respuestaOk({ eliminado: true });
});
