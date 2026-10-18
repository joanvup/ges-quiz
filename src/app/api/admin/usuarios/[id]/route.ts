import { prisma } from '@/lib/db';
import {
  ruta,
  leerCuerpo,
  respuestaOk,
  infoCliente,
  conflicto,
  noEncontrado,
  solicitudInvalida,
  ErrorApi,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { hashearContrasena } from '@/lib/auth/password';
import { revocarSesionesDeUsuario as revocarSesiones } from '@/lib/auth/session';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaActualizarUsuario } from '@/lib/esquemas/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/usuarios/[id] */
export const PATCH = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;
  const datos = await leerCuerpo(req, esquemaActualizarUsuario);

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) throw noEncontrado('Usuario');

  if (datos.correo && datos.correo !== usuario.email) {
    const ocupado = await prisma.user.findUnique({ where: { email: datos.correo } });
    if (ocupado) throw conflicto('Ya existe otro usuario con ese correo electronico.');
  }

  const rolFinal = datos.rol ?? usuario.role;

  // No permitir dejar el sistema sin administradores activos.
  if (usuario.role === 'ADMIN' && (rolFinal !== 'ADMIN' || datos.activo === false)) {
    const adminsActivos = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (adminsActivos <= 1) {
      throw new ErrorApi(
        409,
        'ULTIMO_ADMIN',
        'No puedes quitar el rol ni desactivar al ultimo administrador activo.',
      );
    }
  }

  if (datos.grupos && datos.grupos.length > 0 && rolFinal !== 'STUDENT') {
    throw solicitudInvalida('Solo los estudiantes pueden pertenecer a grupos.');
  }

  const hashNueva = datos.contrasena ? await hashearContrasena(datos.contrasena) : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { name: datos.nombre } : {}),
        ...(datos.correo !== undefined ? { email: datos.correo } : {}),
        ...(datos.rol !== undefined ? { role: datos.rol } : {}),
        ...(datos.activo !== undefined ? { active: datos.activo } : {}),
        ...(hashNueva ? { passwordHash: hashNueva } : {}),
      },
    });

    if (datos.grupos !== undefined) {
      await tx.groupMembership.deleteMany({ where: { userId: id } });
      const validos = await tx.group.findMany({
        where: { id: { in: datos.grupos } },
        select: { id: true },
      });
      if (validos.length !== datos.grupos.length) {
        throw solicitudInvalida('Alguno de los grupos seleccionados no existe.');
      }
      if (validos.length) {
        await tx.groupMembership.createMany({
          data: validos.map((g) => ({ userId: id, groupId: g.id })),
        });
      }
    }
  });

  // Si cambia la contrasena o se desactiva, cerramos sus sesiones abiertas.
  if (hashNueva || datos.activo === false) {
    await revocarSesiones(id);
  }

  await auditar({
    accion: ACCIONES.USUARIO_ACTUALIZADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'User',
    entidadId: id,
    meta: {
      campos: Object.keys(datos),
      contrasenaCambiada: Boolean(hashNueva),
    },
    ip,
  });

  return respuestaOk({ actualizado: true });
});

/** DELETE /api/admin/usuarios/[id] */
export const DELETE = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  if (id === sesion.usuario.id) {
    throw new ErrorApi(409, 'AUTO_ELIMINACION', 'No puedes eliminar tu propia cuenta.');
  }

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) throw noEncontrado('Usuario');

  if (usuario.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (admins <= 1) {
      throw new ErrorApi(409, 'ULTIMO_ADMIN', 'No puedes eliminar al ultimo administrador.');
    }
  }

  await revocarSesiones(id);
  await prisma.user.delete({ where: { id } });

  await auditar({
    accion: ACCIONES.USUARIO_ELIMINADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'User',
    entidadId: id,
    meta: { correo: usuario.email },
    ip,
  });

  return respuestaOk({ eliminado: true });
});
