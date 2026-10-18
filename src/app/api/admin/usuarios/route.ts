import { prisma } from '@/lib/db';
import {
  ruta,
  leerCuerpo,
  respuestaOk,
  infoCliente,
  conflicto,
  solicitudInvalida,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { hashearContrasena } from '@/lib/auth/password';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaCrearUsuario } from '@/lib/esquemas/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/usuarios?rol=&buscar= */
export const GET = ruta(async (req) => {
  await requiereRolApi('ADMIN');

  const url = new URL(req.url);
  const rol = url.searchParams.get('rol') ?? undefined;
  const buscar = url.searchParams.get('buscar')?.trim();

  const usuarios = await prisma.user.findMany({
    where: {
      ...(rol ? { role: rol } : {}),
      ...(buscar
        ? {
            OR: [
              { name: { contains: buscar } },
              { email: { contains: buscar } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    include: { memberships: { include: { group: true } } },
  });

  return respuestaOk({
    usuarios: usuarios.map((u) => ({
      id: u.id,
      nombre: u.name,
      correo: u.email,
      rol: u.role,
      activo: u.active,
      creadoEn: u.createdAt,
      grupos: u.memberships.map((m) => ({ id: m.group.id, nombre: m.group.name })),
    })),
  });
});

/** POST /api/admin/usuarios */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const datos = await leerCuerpo(req, esquemaCrearUsuario);

  const existente = await prisma.user.findUnique({ where: { email: datos.correo } });
  if (existente) throw conflicto('Ya existe un usuario con ese correo electronico.');

  const grupos = datos.grupos.length
    ? await prisma.group.findMany({ where: { id: { in: datos.grupos } }, select: { id: true } })
    : [];
  if (grupos.length !== datos.grupos.length) {
    throw solicitudInvalida('Alguno de los grupos seleccionados no existe.');
  }
  if (grupos.length > 0 && datos.rol !== 'STUDENT') {
    throw solicitudInvalida('Solo los estudiantes pueden pertenecer a grupos.');
  }

  const contrasenaHash = await hashearContrasena(datos.contrasena);

  const usuario = await prisma.$transaction(async (tx) => {
    const creado = await tx.user.create({
      data: {
        name: datos.nombre,
        email: datos.correo,
        passwordHash: contrasenaHash,
        role: datos.rol,
        active: datos.activo,
      },
    });
    if (grupos.length) {
      await tx.groupMembership.createMany({
        data: grupos.map((g) => ({ userId: creado.id, groupId: g.id })),
      });
    }
    return creado;
  });

  await auditar({
    accion: ACCIONES.USUARIO_CREADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'User',
    entidadId: usuario.id,
    meta: { correo: usuario.email, rol: usuario.role },
    ip,
  });

  return respuestaOk(
    {
      usuario: {
        id: usuario.id,
        nombre: usuario.name,
        correo: usuario.email,
        rol: usuario.role,
        activo: usuario.active,
      },
    },
    201,
  );
});
