/**
 * Construccion y lectura de cadenas de conexion para los motores soportados.
 */

import { DEFINICION_MOTOR, type MotorBd } from './motores';

export type ConfiguracionConexion = {
  motor: MotorBd;
  /** PostgreSQL / MySQL */
  host?: string;
  puerto?: number;
  baseDatos?: string;
  usuario?: string;
  contrasena?: string;
  ssl?: boolean;
  /** SQLite: ruta del archivo (relativa o absoluta). */
  archivo?: string;
};

const codificar = encodeURIComponent;

/**
 * Comprueba que una ruta sea absoluta. Es necesario para las bases destino:
 * Prisma resuelve las rutas relativas de `file:` respecto al esquema temporal
 * que se usa para crear la estructura, asi que una ruta relativa acabaria en
 * una carpeta impredecible.
 */
export function esRutaAbsoluta(ruta: string): boolean {
  const valor = ruta.trim();
  if (valor === '') return false;
  if (/^[a-zA-Z]:[\\/]/.test(valor)) return true; // Windows: C:\ o C:/
  if (/^\\\\/.test(valor)) return true; // Windows: \\servidor\recurso
  if (valor.startsWith('/')) return true; // POSIX
  return false;
}

/** Arma la cadena de conexion a partir de los campos del formulario. */
export function construirUrl(config: ConfiguracionConexion): string {
  if (config.motor === 'sqlite') {
    // Las barras invertidas de Windows se convierten para que la URL sea valida.
    const archivo = (config.archivo ?? '').trim().replace(/\\/g, '/');
    return archivo.startsWith('file:') ? archivo : `file:${archivo}`;
  }

  const host = (config.host ?? '').trim();
  const puerto = config.puerto ?? DEFINICION_MOTOR[config.motor].puertoPorDefecto ?? 0;
  const baseDatos = (config.baseDatos ?? '').trim();
  const usuario = (config.usuario ?? '').trim();
  const contrasena = config.contrasena ?? '';
  const credenciales = `${codificar(usuario)}:${codificar(contrasena)}`;

  if (config.motor === 'postgresql') {
    const parametros = ['schema=public', ...(config.ssl ? ['sslmode=require'] : [])];
    return `postgresql://${credenciales}@${host}:${puerto}/${codificar(baseDatos)}?${parametros.join('&')}`;
  }

  const sufijo = config.ssl ? '?sslaccept=strict' : '';
  return `mysql://${credenciales}@${host}:${puerto}/${codificar(baseDatos)}${sufijo}`;
}

/** Lee una cadena de conexion y devuelve sus campos (para precargar el formulario). */
export function parsearUrl(motor: MotorBd, url: string): ConfiguracionConexion {
  if (motor === 'sqlite') {
    const archivo = url.trim().replace(/^file:/i, '');
    return { motor: 'sqlite', archivo };
  }

  try {
    const partes = new URL(url);
    const puerto = partes.port ? Number(partes.port) : DEFINICION_MOTOR[motor].puertoPorDefecto ?? undefined;
    return {
      motor,
      host: partes.hostname,
      puerto: puerto ?? undefined,
      baseDatos: decodeURIComponent(partes.pathname.replace(/^\//, '')),
      usuario: decodeURIComponent(partes.username),
      contrasena: decodeURIComponent(partes.password),
      ssl: /sslmode=require|sslaccept=strict/i.test(partes.search),
    };
  } catch {
    return { motor };
  }
}

/** Descripcion corta del destino, sin mostrar la contrasena. */
export function describirConexion(config: ConfiguracionConexion): string {
  if (config.motor === 'sqlite') return `Archivo ${config.archivo ?? ''}`;
  const puerto = config.puerto ?? DEFINICION_MOTOR[config.motor].puertoPorDefecto;
  return `${config.usuario ?? ''}@${config.host ?? ''}:${puerto}/${config.baseDatos ?? ''}`;
}
