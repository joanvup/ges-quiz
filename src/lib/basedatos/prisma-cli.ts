/**
 * Puente con el CLI de Prisma.
 *
 * Prisma solo sabe hablar con un motor a la vez (el `provider` del esquema es
 * fijo), asi que para preparar una base de datos destino se usa el propio CLI:
 *
 *   - `migrate diff`   genera el DDL del motor destino (sin conectarse).
 *   - `db push`        crea las tablas en el destino (falla si habria perdida
 *                      de datos, es decir, si el destino ya tiene contenido).
 *   - `db execute`     ejecuta los `INSERT` de la copia de datos.
 *
 * Se lanza el CLI con `node node_modules/prisma/build/index.js`, que evita
 * depender de `npx` y del quoting de la shell en Windows.
 *
 * Modulo SOLO de servidor.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFINICION_MOTOR, type MotorBd } from './motores';

const RUTA_ESQUEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');
const RUTA_CLI = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

const TIMEOUT_POR_DEFECTO = 180_000;

export type ResultadoCli = { codigo: number; stdout: string; stderr: string };

export class ErrorCli extends Error {
  readonly args: string[];
  readonly detalle: string;

  constructor(mensaje: string, args: string[], detalle: string) {
    super(mensaje);
    this.name = 'ErrorCli';
    this.args = args;
    this.detalle = detalle;
  }
}

/** Ejecuta el CLI de Prisma y devuelve su salida. */
export function ejecutarPrisma(
  args: string[],
  opciones: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<ResultadoCli> {
  return new Promise((resolver, rechazar) => {
    if (!fs.existsSync(RUTA_CLI)) {
      rechazar(
        new ErrorCli(
          'No se encontro el CLI de Prisma. Ejecuta "npm install" antes de continuar.',
          args,
          RUTA_CLI,
        ),
      );
      return;
    }

    const hijo = spawn(process.execPath, [RUTA_CLI, ...args], {
      env: { ...process.env, ...opciones.env },
      cwd: process.cwd(),
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let terminado = false;

    const temporizador = setTimeout(() => {
      terminado = true;
      hijo.kill('SIGKILL');
      rechazar(
        new ErrorCli('La operacion tardo demasiado y se cancelo.', args, `timeout ${opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO}ms`),
      );
    }, opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO);

    hijo.stdout.on('data', (dato: Buffer) => {
      stdout += dato.toString('utf8');
    });
    hijo.stderr.on('data', (dato: Buffer) => {
      stderr += dato.toString('utf8');
    });

    hijo.on('error', (error) => {
      clearTimeout(temporizador);
      if (!terminado) rechazar(new ErrorCli('No se pudo ejecutar el CLI de Prisma.', args, String(error)));
    });

    hijo.on('close', (codigo) => {
      clearTimeout(temporizador);
      if (terminado) return;
      resolver({ codigo: codigo ?? -1, stdout, stderr });
    });
  });
}

/* ------------------------------------------------------------------ *
 * Esquema
 * ------------------------------------------------------------------ */

/** Contenido actual de `prisma/schema.prisma`. */
export function leerEsquema(): string {
  return fs.readFileSync(RUTA_ESQUEMA, 'utf8');
}

export function escribirEsquema(contenido: string): void {
  fs.writeFileSync(RUTA_ESQUEMA, contenido, 'utf8');
}

/** Devuelve el `provider` declarado en el bloque `datasource`. */
export function proveedorDelEsquema(contenido: string): string | null {
  const bloque = /datasource\s+\w+\s*\{[\s\S]*?\}/.exec(contenido)?.[0];
  if (!bloque) return null;
  const valor = /(\bprovider\s*=\s*)("[^"]*"|[A-Za-z_]+)/.exec(bloque)?.[2];
  return valor ? valor.replace(/"/g, '') : null;
}

/** Devuelve una copia del esquema con el `provider` del motor indicado. */
export function esquemaConProveedor(contenido: string, motor: MotorBd): string {
  const proveedor = DEFINICION_MOTOR[motor].proveedor;
  return contenido.replace(/datasource\s+\w+\s*\{[\s\S]*?\}/, (bloque) =>
    bloque.replace(/(\bprovider\s*=\s*)("[^"]*"|[A-Za-z_]+)/, `$1"${proveedor}"`),
  );
}

export type EsquemaTemporal = { ruta: string; dir: string; limpiar: () => void };

/** Escribe un esquema temporal con el `provider` del motor destino. */
export function crearEsquemaTemporal(motor: MotorBd): EsquemaTemporal {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizcolegio-bd-'));
  const ruta = path.join(dir, 'schema.prisma');
  fs.writeFileSync(ruta, esquemaConProveedor(leerEsquema(), motor), 'utf8');
  return {
    ruta,
    dir,
    limpiar: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* limpieza best-effort */
      }
    },
  };
}

/** Genera el DDL completo (CREATE TABLE + indices) del motor indicado. */
export async function generarDdl(motor: MotorBd, destino: string): Promise<string> {
  const temporal = crearEsquemaTemporal(motor);
  try {
    const resultado = await ejecutarPrisma([
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      temporal.ruta,
      '--script',
      '--output',
      destino,
    ]);
    if (resultado.codigo !== 0) {
      throw new ErrorCli('No se pudo generar el DDL.', ['migrate diff'], resultado.stderr || resultado.stdout);
    }
    return fs.readFileSync(destino, 'utf8');
  } finally {
    temporal.limpiar();
  }
}

/* ------------------------------------------------------------------ *
 * Operaciones contra un destino
 * ------------------------------------------------------------------ */

/**
 * Crea las tablas en el destino. Falla si el destino ya tiene datos que se
 * perderian (nunca usa `--accept-data-loss`).
 *
 * `contexto` solo cambia el mensaje: `activa` cuando se sincroniza la base de
 * datos de la propia aplicacion (los cambios destructivos hay que aplicarlos a
 * mano) y `destino` cuando es una migracion a otra base.
 */
export async function crearEsquemaEnDestino(
  rutaEsquema: string,
  url: string,
  contexto: 'destino' | 'activa' = 'destino',
): Promise<void> {
  const resultado = await ejecutarPrisma(
    ['db', 'push', '--schema', rutaEsquema, '--skip-generate'],
    { env: { DATABASE_URL: url } },
  );

  if (resultado.codigo !== 0) {
    const detalle = `${resultado.stdout}\n${resultado.stderr}`;
    const perdida = /accept-data-loss|data loss/i.test(detalle);
    throw new ErrorCli(
      perdida
        ? contexto === 'activa'
          ? 'El modelo de Prisma cambio de una forma que borraria datos (por ejemplo, quitar una columna o una tabla). Aplica ese cambio a mano si de verdad lo quieres.'
          : 'La base de datos destino ya tiene contenido distinto. Usa una base vacia.'
        : contexto === 'activa'
          ? 'No se pudieron crear o actualizar las tablas de la base de datos activa.'
          : 'No se pudieron crear las tablas en la base de datos destino.',
      ['db push'],
      detalle.trim(),
    );
  }
}

export type EstadoEsquemaBd = 'sincronizado' | 'diferente' | 'sin-conexion';

/**
 * Compara el modelo de Prisma con la base de datos indicada SIN modificarla.
 *
 * Codigos de `migrate diff --exit-code`: 0 = sin diferencias, 2 = hay
 * diferencias, cualquier otro = no se pudo conectar (la base no existe).
 */
export async function estadoEsquema(rutaEsquema: string, url: string): Promise<EstadoEsquemaBd> {
  const resultado = await ejecutarPrisma(
    [
      'migrate',
      'diff',
      '--from-schema-datasource',
      rutaEsquema,
      '--to-schema-datamodel',
      rutaEsquema,
      '--exit-code',
    ],
    { env: { DATABASE_URL: url } },
  );

  if (resultado.codigo === 0) return 'sincronizado';
  if (resultado.codigo === 2) return 'diferente';
  return 'sin-conexion';
}

/** Ejecuta un script SQL contra el destino indicado. */
export async function ejecutarScript(
  rutaEsquema: string,
  url: string,
  archivo: string,
): Promise<void> {
  const resultado = await ejecutarPrisma(
    ['db', 'execute', '--schema', rutaEsquema, '--file', archivo],
    { env: { DATABASE_URL: url } },
  );

  if (resultado.codigo !== 0) {
    throw new ErrorCli(
      'No se pudo ejecutar el script SQL en el destino.',
      ['db execute'],
      `${resultado.stdout}\n${resultado.stderr}`.trim(),
    );
  }
}
