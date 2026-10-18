/**
 * Servicio de base de datos: estado, respaldo, restauracion y migracion.
 *
 * Modulo SOLO de servidor.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ErrorApi, conflicto, solicitudInvalida } from '@/lib/http';
import { TABLAS } from './catalogo';
import { construirUrl, describirConexion, type ConfiguracionConexion } from './conexion';
import {
  ErrorCli,
  crearEsquemaEnDestino,
  crearEsquemaTemporal,
  ejecutarPrisma,
  ejecutarScript,
  escribirEsquema,
  esquemaConProveedor,
  generarDdl,
  leerEsquema,
  proveedorDelEsquema,
  type EsquemaTemporal,
} from './prisma-cli';
import { sentenciasBorrado } from './sql';
import {
  archivoSqlite,
  enmascararUrl,
  etiquetaMotor,
  motorActivo,
  type MotorBd,
} from './motores';
import { leerTodo, delegadoPrisma } from './lectura';
import { filtroVaciar, tablasQueSeVacian } from './limpieza';
import {
  resumenVolcado,
  sentenciasInsert,
  volcadoAJson,
  volcadoDesdeJson,
  type DatosVolcadoJson,
  type Volcado,
} from './volcado';

const DIR_RESPALDOS = path.join(process.cwd(), 'storage', 'backups');

/**
 * Convierte los errores del CLI de Prisma en errores de API con un mensaje
 * claro para el usuario (y el detalle tecnico recortado).
 */
export function convertirError(error: unknown): unknown {
  if (error instanceof ErrorCli) {
    return new ErrorApi(400, 'OPERACION_BD_FALLIDA', error.message, {
      detalle: error.detalle.slice(-1500),
    });
  }
  return error;
}

/* ------------------------------------------------------------------ *
 * Estado
 * ------------------------------------------------------------------ */

export type FilaEstado = { tabla: string; etiqueta: string; filas: number };

export type EstadoBaseDatos = {
  motor: MotorBd | null;
  motorEtiqueta: string;
  /** Cadena de conexion con la contrasena oculta. */
  conexion: string;
  archivo: string | null;
  tablas: FilaEstado[];
  totalFilas: number;
  proveedorEsquema: string | null;
  sincronizado: boolean;
  respaldosEnDisco: string[];
};

export async function estadoBaseDatos(): Promise<EstadoBaseDatos> {
  const motor = motorActivo();
  const url = process.env.DATABASE_URL ?? null;

  const tablas = await Promise.all(
    TABLAS.map(async (definicion) => {
      const filas = await delegadoPrisma(definicion.modelo).count();
      return { tabla: definicion.tabla, etiqueta: definicion.etiqueta, filas };
    }),
  );

  const proveedor = proveedorDelEsquema(leerEsquema());
  const totalFilas = tablas.reduce((suma, fila) => suma + fila.filas, 0);

  return {
    motor,
    motorEtiqueta: motor ? etiquetaMotor(motor) : 'Desconocido',
    conexion: enmascararUrl(url),
    archivo: archivoSqlite(url),
    tablas,
    totalFilas,
    proveedorEsquema: proveedor,
    sincronizado: motor !== null && proveedor === motor,
    respaldosEnDisco: listarRespaldos(),
  };
}

/* ------------------------------------------------------------------ *
 * Respaldo
 * ------------------------------------------------------------------ */

export type FormatoRespaldo = 'sql' | 'json';

export type Respaldo = { nombre: string; mime: string; contenido: string };

function marcaDeTiempo(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function cabeceraSql(motor: MotorBd, volcado: Volcado): string {
  return [
    '-- Respaldo de QuizColegio',
    `-- Generado: ${volcado.generadoEn}`,
    `-- Motor de origen: ${etiquetaMotor(motor)}`,
    `-- Filas: ${volcado.totalFilas}`,
    '--',
    '-- Restauracion: ejecuta este archivo sobre una base de datos VACIA del mismo motor',
    `--   PostgreSQL : psql -U usuario -d basededatos -f ${'<archivo>'}`,
    `--   MySQL      : mysql -u usuario -p basededatos < ${'<archivo>'}`,
    `--   SQLite     : sqlite3 nueva.db < ${'<archivo>'}`,
    '--',
    '-- Para restaurar desde la interfaz de QuizColegio usa el respaldo en formato JSON.',
    '',
  ].join('\n');
}

/** Genera el respaldo (SQL completo o JSON) de la base activa. */
export async function crearRespaldo(formato: FormatoRespaldo): Promise<Respaldo> {
  const motor = motorActivo();
  if (!motor) {
    throw new ErrorApi(
      500,
      'MOTOR_DESCONOCIDO',
      'No se pudo determinar el motor de la base de datos activa (revisa DATABASE_URL).',
    );
  }

  const volcado = await leerTodo(motor);
  const marca = marcaDeTiempo();

  if (formato === 'json') {
    return {
      nombre: `respaldo-quizcolegio-${marca}.json`,
      mime: 'application/json; charset=utf-8',
      contenido: volcadoAJson(volcado),
    };
  }

  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'quizcolegio-ddl-'));
  try {
    const ddl = await generarDdl(motor, path.join(temporal, 'ddl.sql'));
    const partes = [
      cabeceraSql(motor, volcado),
      ddl.trim(),
      '',
      ...sentenciasInsert(volcado, motor),
      '',
    ];
    return {
      nombre: `respaldo-quizcolegio-${marca}.sql`,
      mime: 'application/sql; charset=utf-8',
      contenido: partes.join('\n'),
    };
  } finally {
    fs.rmSync(temporal, { recursive: true, force: true });
  }
}

function listarRespaldos(): string[] {
  try {
    if (!fs.existsSync(DIR_RESPALDOS)) return [];
    return fs
      .readdirSync(DIR_RESPALDOS)
      .filter((nombre) => nombre.endsWith('.json') || nombre.endsWith('.sql'))
      .sort()
      .reverse()
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** Guarda una copia en disco (red de seguridad antes de restaurar). */
function guardarRespaldoEnDisco(volcado: Volcado, prefijo: string): string {
  fs.mkdirSync(DIR_RESPALDOS, { recursive: true });
  const nombre = `${prefijo}-${marcaDeTiempo()}.json`;
  fs.writeFileSync(path.join(DIR_RESPALDOS, nombre), volcadoAJson(volcado), 'utf8');
  return nombre;
}

/* ------------------------------------------------------------------ *
 * Restauracion
 * ------------------------------------------------------------------ */

export type InformeRestauracion = {
  motor: MotorBd;
  tablas: FilaEstado[];
  totalFilas: number;
  respaldoPrevio: string;
};

/** Restaura un respaldo JSON sobre la base de datos activa. */
export async function restaurarRespaldo(datos: DatosVolcadoJson): Promise<InformeRestauracion> {
  const motor = motorActivo();
  if (!motor) {
    throw new ErrorApi(500, 'MOTOR_DESCONOCIDO', 'No se pudo determinar el motor de la base de datos activa.');
  }

  const nuevo = volcadoDesdeJson(datos);
  const actual = await leerTodo(motor);

  if (nuevo.totalFilas === 0) {
    throw solicitudInvalida('El respaldo no contiene filas.');
  }

  // Red de seguridad: guardamos el estado actual en disco antes de sobrescribir.
  const respaldoPrevio = guardarRespaldoEnDisco(actual, 'pre-restauracion');

  const sentencias = [
    ...sentenciasBorrado([...TABLAS].reverse(), motor),
    ...sentenciasInsert(nuevo, motor),
  ];

  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'quizcolegio-restaurar-'));
  try {
    const archivo = path.join(temporal, 'restaurar.sql');
    fs.writeFileSync(archivo, `${sentencias.join('\n')}\n`, 'utf8');
    await ejecutarScriptConEsquemaActivo(archivo);
  } finally {
    fs.rmSync(temporal, { recursive: true, force: true });
  }

  return {
    motor,
    tablas: resumenVolcado(nuevo).map((fila) => ({
      tabla: fila.tabla,
      etiqueta: fila.etiqueta,
      filas: fila.filas,
    })),
    totalFilas: nuevo.totalFilas,
    respaldoPrevio,
  };
}

/** Ejecuta un script contra la base de datos activa usando el esquema real. */
async function ejecutarScriptConEsquemaActivo(archivo: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  const esquema = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const resultado = await ejecutarPrisma(
    ['db', 'execute', '--schema', esquema, '--file', archivo],
    url ? { env: { DATABASE_URL: url } } : {},
  );
  if (resultado.codigo !== 0) {
    throw new ErrorCli(
      'No se pudo restaurar el respaldo en la base de datos activa.',
      ['db execute'],
      `${resultado.stdout}\n${resultado.stderr}`.trim(),
    );
  }
}

/* ------------------------------------------------------------------ *
 * Inicializacion sin datos de prueba
 * ------------------------------------------------------------------ */

export type InformeInicializacion = {
  motor: MotorBd;
  /** Filas borradas por tabla (solo las que tenian datos). */
  tablas: FilaEstado[];
  totalFilas: number;
  /** Copia de seguridad guardada antes de vaciar. */
  respaldoPrevio: string;
  conservado: { usuarios: number; configuracion: number; auditoria: number };
};

/**
 * Vacia los datos de trabajo y deja la base como recien instalada.
 *
 * Conserva el esquema, la configuracion, la auditoria y la cuenta que ejecuta
 * la accion (con sus sesiones abiertas), para no dejar el sistema sin acceso.
 * Antes de borrar nada guarda una copia completa en disco.
 */
export async function inicializarSinDatos(usuarioId: string): Promise<InformeInicializacion> {
  const motor = motorActivo();
  if (!motor) {
    throw new ErrorApi(500, 'MOTOR_DESCONOCIDO', 'No se pudo determinar el motor de la base de datos activa.');
  }

  // Red de seguridad: copia completa antes de vaciar.
  const actual = await leerTodo(motor);
  const respaldoPrevio = guardarRespaldoEnDisco(actual, 'pre-inicializacion');

  const tablas: FilaEstado[] = [];
  for (const definicion of tablasQueSeVacian()) {
    const filtro = filtroVaciar(definicion.modelo, usuarioId);
    const delegado = delegadoPrisma(definicion.modelo);
    const resultado = filtro ? await delegado.deleteMany(filtro) : await delegado.deleteMany({});
    tablas.push({
      tabla: definicion.tabla,
      etiqueta: definicion.etiqueta,
      filas: resultado.count,
    });
  }

  const conservado = {
    usuarios: await delegadoPrisma('user').count(),
    configuracion: await delegadoPrisma('setting').count(),
    auditoria: await delegadoPrisma('auditLog').count(),
  };

  return {
    motor,
    tablas,
    totalFilas: tablas.reduce((suma, fila) => suma + fila.filas, 0),
    respaldoPrevio,
    conservado,
  };
}

/* ------------------------------------------------------------------ *
 * Migracion
 * ------------------------------------------------------------------ */

export type OpcionesMigracion = { cambiarConfiguracion: boolean };

export type InformeMigracion = {
  motorOrigen: MotorBd;
  motorDestino: MotorBd;
  destino: string;
  tablas: FilaEstado[];
  totalFilas: number;
  esquemaVerificado: boolean;
  configuracionActualizada: boolean;
  pasos: string[];
};

/** Comprueba que se puede conectar al destino (sin crear nada). */
export async function probarConexion(config: ConfiguracionConexion): Promise<{ motor: MotorBd; destino: string }> {
  const url = construirUrl(config);
  const temporal = crearEsquemaTemporal(config.motor);
  try {
    const archivo = path.join(temporal.dir, 'probar.sql');
    fs.writeFileSync(archivo, 'SELECT 1;\n', 'utf8');
    await ejecutarScript(temporal.ruta, url, archivo);
    return { motor: config.motor, destino: describirConexion(config) };
  } finally {
    temporal.limpiar();
  }
}

/** Copia todos los datos de la base activa a la base destino. */
export async function migrarBaseDatos(
  config: ConfiguracionConexion,
  opciones: OpcionesMigracion,
): Promise<InformeMigracion> {
  const motorOrigen = motorActivo();
  if (!motorOrigen) {
    throw new ErrorApi(500, 'MOTOR_DESCONOCIDO', 'No se pudo determinar el motor de la base de datos activa.');
  }

  const motorDestino = config.motor;
  const urlDestino = construirUrl(config);

  if (motorDestino === motorOrigen && urlDestino === (process.env.DATABASE_URL ?? '').trim()) {
    throw conflicto('La base de datos destino es la misma que la actual.');
  }

  const volcado = await leerTodo(motorOrigen);

  const temporal = crearEsquemaTemporal(motorDestino);
  try {
    // 1. Crear las tablas en el destino (falla si ya tuviera contenido).
    await crearEsquemaEnDestino(temporal.ruta, urlDestino);

    // 2. Copiar los datos, tabla por tabla.
    const tablas: FilaEstado[] = [];
    for (const contenido of volcado.tablas) {
      const definicion = TABLAS.find((t) => t.tabla === contenido.tabla);
      if (!definicion) continue;
      if (contenido.filas.length > 0) {
        const archivo = path.join(temporal.dir, `datos-${contenido.tabla}.sql`);
        fs.writeFileSync(archivo, `${sentenciasInsert({ ...volcado, tablas: [contenido] }, motorDestino).join('\n')}\n`, 'utf8');
        await ejecutarScript(temporal.ruta, urlDestino, archivo);
      }
      tablas.push({ tabla: contenido.tabla, etiqueta: definicion.etiqueta, filas: contenido.filas.length });
    }

    // 3. Verificar que el esquema del destino coincide con el esperado.
    const esquemaVerificado = await verificarEsquema(temporal, urlDestino);

    // 4. Opcionalmente, dejar el sistema apuntando a la nueva base.
    let configuracionActualizada = false;
    if (opciones.cambiarConfiguracion) {
      escribirEsquema(esquemaConProveedor(leerEsquema(), motorDestino));
      actualizarEnv(urlDestino);
      configuracionActualizada = true;
    }

    return {
      motorOrigen,
      motorDestino,
      destino: describirConexion(config),
      tablas,
      totalFilas: volcado.totalFilas,
      esquemaVerificado,
      configuracionActualizada,
      pasos: configuracionActualizada
        ? [
            'Deten el servidor (Ctrl+C).',
            'Ejecuta: npm run dev  (regenera el cliente de Prisma automaticamente).',
            `Inicia sesion de nuevo. La aplicacion ya usara ${etiquetaMotor(motorDestino)}.`,
          ]
        : [
            'Edita .env y cambia DATABASE_URL por la cadena de la nueva base.',
            `En prisma/schema.prisma cambia provider a "${motorDestino}".`,
            'Deten el servidor, ejecuta "npm run db:preparar" y vuelve a iniciar.',
          ],
    };
  } finally {
    temporal.limpiar();
  }
}

/** Comprueba que el esquema del destino coincide con el modelo de Prisma. */
async function verificarEsquema(temporal: EsquemaTemporal, url: string): Promise<boolean> {
  const resultado = await ejecutarPrisma(
    [
      'migrate',
      'diff',
      '--from-schema-datasource',
      temporal.ruta,
      '--to-schema-datamodel',
      temporal.ruta,
      '--exit-code',
    ],
    { env: { DATABASE_URL: url } },
  );
  // Codigo 0 = sin diferencias entre el esquema real y el modelo.
  return resultado.codigo === 0;
}

/** Actualiza (o agrega) DATABASE_URL en el archivo .env. */
function actualizarEnv(url: string): void {
  const ruta = path.join(process.cwd(), '.env');
  const linea = `DATABASE_URL="${url}"`;
  let contenido = '';

  try {
    contenido = fs.readFileSync(ruta, 'utf8');
  } catch {
    contenido = '';
  }

  if (/^\s*DATABASE_URL\s*=.*$/m.test(contenido)) {
    contenido = contenido.replace(/^\s*DATABASE_URL\s*=.*$/m, linea);
  } else {
    contenido = `${contenido.trimEnd()}${contenido.trim() ? '\n' : ''}${linea}\n`;
  }

  fs.writeFileSync(ruta, contenido, 'utf8');
}
