import { prisma } from '@/lib/db';
import { ruta, leerCuerpo, respuestaOk, infoCliente, conflicto } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaCrearGrupo } from '@/lib/esquemas/grupos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/grupos?anio=&buscar= */
export const GET = ruta(async (req) => {
  await requiereRolApi('ADMIN', 'TEACHER');

  const url = new URL(req.url);
  const anioParam = url.searchParams.get('anio');
  const buscar = url.searchParams.get('buscar')?.trim();

  const grupos = await prisma.group.findMany({
    where: {
      ...(anioParam ? { year: anioParam } : {}),
      ...(buscar ? { name: { contains: buscar } } : {}),
    },
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { memberships: true, assignments: true } },
    },
  });

  return respuestaOk({
    grupos: grupos.map((g) => ({
      id: g.id,
      nombre: g.name,
      grado: g.grade,
      anio: g.year,
      descripcion: g.description,
      activo: g.active,
      miembros: g._count.memberships,
      asignaciones: g._count.assignments,
      creadoEn: g.createdAt,
    })),
  });
});

/** POST /api/admin/grupos */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const datos = await leerCuerpo(req, esquemaCrearGrupo);

  const existente = await prisma.group.findFirst({
    where: { name: datos.nombre, year: datos.anio },
  });
  if (existente) throw conflicto('Ya existe un grupo con ese nombre en el mismo ano.');

  const grupo = await prisma.group.create({
    data: {
      name: datos.nombre,
      grade: datos.grado || null,
      year: datos.anio,
      description: datos.descripcion || null,
      createdById: sesion.usuario.id,
    },
  });

  await auditar({
    accion: ACCIONES.GRUPO_CREADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Group',
    entidadId: grupo.id,
    meta: { nombre: grupo.name, anio: grupo.year },
    ip,
  });

  return respuestaOk(
    {
      grupo: {
        id: grupo.id,
        nombre: grupo.name,
        grado: grupo.grade,
        anio: grupo.year,
        descripcion: grupo.description,
        activo: grupo.active,
        miembros: 0,
        asignaciones: 0,
      },
    },
    201,
  );
});
