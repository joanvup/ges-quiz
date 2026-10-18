import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { sesionActual, type SesionConUsuario, type UsuarioSesion } from '@/lib/auth/session';
import { ErrorApi, noAutenticado, sinPermiso } from '@/lib/http';
import type { Rol } from '@/lib/dominio/constantes';

// --- Variantes para componentes de servidor (paginas) ----------------------

/** Devuelve el usuario o `null` (no redirige). */
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const sesion = await sesionActual();
  return sesion?.usuario ?? null;
}

/** Exige sesion; si no hay, redirige a /login. */
export async function requiereUsuario(): Promise<SesionConUsuario> {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  return sesion;
}

/** Exige sesion y rol; si el rol no coincide, redirige al panel. */
export async function requiereRol(...roles: Rol[]): Promise<SesionConUsuario> {
  const sesion = await requiereUsuario();
  if (!roles.includes(sesion.usuario.role as Rol)) redirect('/panel');
  return sesion;
}

// --- Variantes para route handlers (API) ----------------------------------

export async function requiereUsuarioApi(): Promise<SesionConUsuario> {
  const sesion = await sesionActual();
  if (!sesion) throw noAutenticado();
  return sesion;
}

export async function requiereRolApi(...roles: Rol[]): Promise<SesionConUsuario> {
  const sesion = await requiereUsuarioApi();
  if (!roles.includes(sesion.usuario.role as Rol)) throw sinPermiso();
  return sesion;
}

/**
 * Verifica el token CSRF (double submit) comparando la cabecera
 * `x-csrf-token` con el token guardado en la sesion.
 */
export function verificarCsrf(req: NextRequest, sesion: SesionConUsuario): void {
  const enviado = req.headers.get('x-csrf-token');
  if (!enviado || enviado !== sesion.csrfToken) {
    throw new ErrorApi(403, 'CSRF_INVALIDO', 'Token CSRF ausente o invalido. Recarga la pagina.');
  }
}
