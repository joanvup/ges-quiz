import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ruta, leerCuerpo, respuestaOk, infoCliente, ErrorApi, demasiadasPeticiones } from '@/lib/http';
import { limitar, reiniciarLimite } from '@/lib/rate-limit';
import { compararSenuelo, verificarContrasena } from '@/lib/auth/password';
import { crearSesion } from '@/lib/auth/session';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaLogin } from '@/lib/esquemas/auth';

export const runtime = 'nodejs';

/** POST /api/auth/login */
export const POST = ruta(async (req) => {
  const { ip, userAgent } = infoCliente(req);

  const porIp = limitar(`login:ip:${ip ?? 'desconocida'}`, env.limites.loginMax, env.limites.loginVentanaSeg);
  if (!porIp.permitido) {
    throw demasiadasPeticiones(
      'Demasiados intentos de inicio de sesion. Espera un momento e intentalo de nuevo.',
      porIp.reintentarEn,
    );
  }

  const datos = await leerCuerpo(req, esquemaLogin);

  const porCuenta = limitar(
    `login:cuenta:${datos.correo}`,
    env.limites.loginMax,
    env.limites.loginVentanaSeg,
  );
  if (!porCuenta.permitido) {
    throw demasiadasPeticiones(
      'Esta cuenta esta temporalmente bloqueada por demasiados intentos fallidos.',
      porCuenta.reintentarEn,
    );
  }

  const usuario = await prisma.user.findUnique({ where: { email: datos.correo } });

  if (!usuario) {
    await compararSenuelo(datos.contrasena);
    await auditar({ accion: ACCIONES.LOGIN_FALLO, meta: { email: datos.correo, motivo: 'no_existe' }, ip });
    throw new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'Correo o contrasena incorrectos.');
  }

  const correcta = await verificarContrasena(datos.contrasena, usuario.passwordHash);
  if (!correcta) {
    await auditar({
      accion: ACCIONES.LOGIN_FALLO,
      actorId: usuario.id,
      meta: { email: datos.correo, motivo: 'clave_incorrecta' },
      ip,
    });
    throw new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'Correo o contrasena incorrectos.');
  }

  if (!usuario.active) {
    await auditar({ accion: ACCIONES.LOGIN_FALLO, actorId: usuario.id, meta: { motivo: 'inactivo' }, ip });
    throw new ErrorApi(403, 'USUARIO_INACTIVO', 'Tu cuenta esta desactivada. Contacta al administrador.');
  }

  await crearSesion({ userId: usuario.id, ip, userAgent });
  reiniciarLimite(`login:cuenta:${datos.correo}`);
  await auditar({ accion: ACCIONES.LOGIN_OK, actorId: usuario.id, ip });

  return respuestaOk({
    usuario: {
      id: usuario.id,
      nombre: usuario.name,
      correo: usuario.email,
      rol: usuario.role,
    },
  });
});
