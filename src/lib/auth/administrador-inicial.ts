import { randomBytes } from 'node:crypto';

/** Cuenta de administrador que crea `npm run db:inicializar`. */
export const CORREO_ADMIN_POR_DEFECTO = 'admin@colegio.edu';
export const NOMBRE_ADMIN_POR_DEFECTO = 'Administrador';
/** Misma regla que la validacion de usuarios del sistema. */
export const LARGO_MINIMO_CONTRASENA = 8;

export type AdministradorInicial = {
  correo: string;
  nombre: string;
  contrasena: string;
  /** `true` cuando la contrasena se genero (no vino de `ADMIN_PASSWORD`). */
  generada: boolean;
  /** Aviso cuando `ADMIN_PASSWORD` se ignora por no cumplir el minimo. */
  aviso: string | null;
};

/**
 * Contrasena aleatoria en base64url (letras, digitos, "-" y "_"): se puede
 * copiar y pegar sin escapes y cumple el minimo de 8 caracteres.
 */
export function generarContrasena(longitud = 16): string {
  const bytes = Math.max(12, Math.ceil((longitud * 3) / 4));
  return randomBytes(bytes).toString('base64url').slice(0, Math.max(longitud, LARGO_MINIMO_CONTRASENA));
}

/**
 * Decide el administrador que creara `npm run db:inicializar`.
 *
 * Usa `ADMIN_EMAIL` y `ADMIN_PASSWORD` si estan definidos en el entorno.
 * Si falta la contrasena (o es demasiado corta) genera una aleatoria.
 */
export function resolverAdministradorInicial(
  entorno: Record<string, string | undefined> = process.env,
): AdministradorInicial {
  const correo = (entorno.ADMIN_EMAIL ?? '').trim() || CORREO_ADMIN_POR_DEFECTO;
  const nombre = (entorno.ADMIN_NAME ?? '').trim() || NOMBRE_ADMIN_POR_DEFECTO;
  const definida = (entorno.ADMIN_PASSWORD ?? '').trim();

  if (definida.length >= LARGO_MINIMO_CONTRASENA) {
    return { correo, nombre, contrasena: definida, generada: false, aviso: null };
  }

  return {
    correo,
    nombre,
    contrasena: generarContrasena(),
    generada: true,
    aviso: definida
      ? `ADMIN_PASSWORD debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres; se genero una contrasena nueva.`
      : null,
  };
}
