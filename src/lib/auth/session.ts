import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { generarToken, hashearToken } from '@/lib/auth/password';

export const COOKIE_SESION = 'qc_session';
export const COOKIE_CSRF = 'qc_csrf';

export type UsuarioSesion = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

export type SesionConUsuario = {
  sesionId: string;
  csrfToken: string;
  usuario: UsuarioSesion;
};

function opcionesCookie(expira: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.esProduccion,
    expires: expira,
  };
}

/**
 * Crea una sesion nueva y escribe las cookies.
 * - `qc_session`: cookie httpOnly + SameSite=Strict con el token de sesion.
 * - `qc_csrf`: cookie legible por JS con el token CSRF (double submit).
 */
export async function crearSesion(datos: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; csrfToken: string; expira: Date }> {
  const token = generarToken(32);
  const csrfToken = generarToken(24);
  const expira = new Date(Date.now() + env.sessionTtlHoras * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: datos.userId,
      tokenHash: hashearToken(token),
      csrfToken,
      ip: datos.ip ?? null,
      userAgent: datos.userAgent?.slice(0, 300) ?? null,
      expiresAt: expira,
    },
  });

  const store = await cookies();
  store.set(COOKIE_SESION, token, opcionesCookie(expira));
  store.set(COOKIE_CSRF, csrfToken, { ...opcionesCookie(expira), httpOnly: false });

  return { token, csrfToken, expira };
}

/** Recupera la sesion y el usuario actual a partir de la cookie. */
export async function sesionActual(): Promise<SesionConUsuario | null> {
  const store = await cookies();
  const token = store.get(COOKIE_SESION)?.value;
  if (!token) return null;

  const sesion = await prisma.session.findUnique({
    where: { tokenHash: hashearToken(token) },
    include: { user: true },
  });

  if (!sesion) return null;
  if (sesion.revokedAt) return null;
  if (sesion.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: sesion.id } }).catch(() => undefined);
    return null;
  }
  if (!sesion.user.active) return null;

  // Marca de actividad (sin bloquear la respuesta si falla).
  const hace5Min = Date.now() - 5 * 60 * 1000;
  if (sesion.lastSeenAt.getTime() < hace5Min) {
    prisma.session
      .update({ where: { id: sesion.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    sesionId: sesion.id,
    csrfToken: sesion.csrfToken,
    usuario: {
      id: sesion.user.id,
      email: sesion.user.email,
      name: sesion.user.name,
      role: sesion.user.role,
      active: sesion.user.active,
    },
  };
}

/** Cierra la sesion actual y borra las cookies. */
export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_SESION)?.value;
  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashearToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  store.delete(COOKIE_SESION);
  store.delete(COOKIE_CSRF);
}

/** Revoca todas las sesiones de un usuario (util al cambiar la contrasena). */
export async function revocarSesionesDeUsuario(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
