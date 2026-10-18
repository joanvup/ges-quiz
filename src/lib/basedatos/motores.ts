/**
 * Motores de base de datos soportados por QuizColegio.
 *
 * Prisma exige que el `provider` del esquema sea un literal (no admite
 * `env(...)`), por eso el motor activo se deduce siempre de `DATABASE_URL` y
 * `scripts/preparar-base.ts` mantiene `prisma/schema.prisma` en sincronia.
 *
 * Modulo SOLO de servidor.
 */

export type MotorBd = 'sqlite' | 'postgresql' | 'mysql';

export type DefinicionMotor = {
  id: MotorBd;
  etiqueta: string;
  /** Valor de `datasource db { provider = ... }` en el esquema de Prisma. */
  proveedor: string;
  /** Puerto habitual (null si no aplica). */
  puertoPorDefecto: number | null;
  /** Comilla para los identificadores en SQL. */
  comilla: string;
  /** Literales booleanos del motor. */
  verdadero: string;
  falso: string;
  /** Ejemplo de cadena de conexion, para la ayuda de la interfaz. */
  urlEjemplo: string;
  descripcion: string;
  /** Indica si puede aparecer en el selector de motor destino. */
  destino: boolean;
};

export const DEFINICION_MOTOR: Record<MotorBd, DefinicionMotor> = {
  sqlite: {
    id: 'sqlite',
    etiqueta: 'SQLite',
    proveedor: 'sqlite',
    puertoPorDefecto: null,
    comilla: '"',
    verdadero: '1',
    falso: '0',
    urlEjemplo: 'file:./dev.db',
    descripcion: 'Base de datos en un solo archivo. Ideal para desarrollo y equipos pequenos.',
    destino: true,
  },
  postgresql: {
    id: 'postgresql',
    etiqueta: 'PostgreSQL',
    proveedor: 'postgresql',
    puertoPorDefecto: 5432,
    comilla: '"',
    verdadero: 'TRUE',
    falso: 'FALSE',
    urlEjemplo: 'postgresql://usuario:clave@localhost:5432/quizcolegio?schema=public',
    descripcion: 'Motor robusto, recomendado para produccion.',
    destino: true,
  },
  mysql: {
    id: 'mysql',
    etiqueta: 'MySQL / MariaDB',
    proveedor: 'mysql',
    puertoPorDefecto: 3306,
    comilla: '`',
    verdadero: '1',
    falso: '0',
    urlEjemplo: 'mysql://usuario:clave@localhost:3306/quizcolegio',
    descripcion: 'Ampliamente disponible en hospedajes compartidos.',
    destino: true,
  },
};

/** Motores que se pueden usar como origen (todos). */
export const MOTORES: MotorBd[] = ['sqlite', 'postgresql', 'mysql'];

/** Motores a los que se puede migrar desde la interfaz. */
export const MOTORES_DESTINO: MotorBd[] = MOTORES.filter((m) => DEFINICION_MOTOR[m].destino);

/** Deduce el motor a partir de una cadena de conexion. */
export function motorDeUrl(url: string | null | undefined): MotorBd | null {
  if (!url) return null;
  const texto = url.trim().toLowerCase();
  if (texto.startsWith('file:')) return 'sqlite';
  if (texto.startsWith('postgresql:') || texto.startsWith('postgres:')) return 'postgresql';
  if (texto.startsWith('mysql:')) return 'mysql';
  return null;
}

/** Motor activo segun `DATABASE_URL` (o `null` si no se reconoce). */
export function motorActivo(): MotorBd | null {
  return motorDeUrl(process.env.DATABASE_URL);
}

export function esMotorDestino(valor: string): valor is MotorBd {
  return MOTORES_DESTINO.includes(valor as MotorBd);
}

export function etiquetaMotor(motor: MotorBd): string {
  return DEFINICION_MOTOR[motor].etiqueta;
}

/** Oculta la contrasena de una cadena de conexion para poder mostrarla. */
export function enmascararUrl(url: string | null | undefined): string {
  if (!url) return '(sin configurar)';
  const texto = url.trim();
  if (texto.toLowerCase().startsWith('file:')) return texto;

  // esquema://usuario:clave@resto  ->  esquema://usuario:***@resto
  const coincidencia = /^([a-z0-9+.-]+:\/\/)([^/@]*?)@(.*)$/i.exec(texto);
  if (!coincidencia) return texto;

  const [, esquema, credenciales, resto] = coincidencia;
  const separador = credenciales!.indexOf(':');
  const usuario = separador >= 0 ? credenciales!.slice(0, separador) : credenciales!;
  return `${esquema}${usuario}:***@${resto}`;
}

/** Ruta del archivo cuando el motor activo es SQLite. */
export function archivoSqlite(url: string | null | undefined): string | null {
  if (!url) return null;
  const texto = url.trim();
  return texto.toLowerCase().startsWith('file:') ? texto.slice(5) : null;
}
