/**
 * Utilidades compartidas por los scripts de base de datos.
 *
 * Las usan `preparar-base.ts` (ganchos predev/prebuild/preseed) e
 * `inicializar-base.ts` (`npm run db:inicializar`).
 *
 * Prisma exige que el `provider` de `prisma/schema.prisma` sea un literal, asi
 * que aqui se:
 *
 *   1. Sincroniza el motor declarado en el esquema con el de `DATABASE_URL`.
 *   2. Regenera el cliente de Prisma solo cuando el motor cambia.
 *   3. Aplica a la base de datos los cambios del modelo (`prisma db push`),
 *      pero solo si de verdad hay diferencias.
 *
 * NUNCA carga datos de prueba, resetea la base ni borra informacion.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { etiquetaMotor, motorDeUrl, type MotorBd } from '../src/lib/basedatos/motores';
import {
  crearEsquemaEnDestino,
  escribirEsquema,
  estadoEsquema,
  esquemaConProveedor,
  leerEsquema,
  proveedorDelEsquema,
  type EstadoEsquemaBd,
} from '../src/lib/basedatos/prisma-cli';

export const PREFIJO = '[base-datos]';
const RAIZ = process.cwd();
const RUTA_ESQUEMA = path.join(RAIZ, 'prisma', 'schema.prisma');
const RUTA_CLI = path.join(RAIZ, 'node_modules', 'prisma', 'build', 'index.js');
/** Marca con el motor para el que se genero el cliente de Prisma. */
const RUTA_MARCA = path.join(RAIZ, 'node_modules', '.prisma', 'motor.txt');

function leerMarca(): string | null {
  try {
    return fs.readFileSync(RUTA_MARCA, 'utf8').trim();
  } catch {
    return null;
  }
}

function escribirMarca(motor: MotorBd): void {
  fs.mkdirSync(path.dirname(RUTA_MARCA), { recursive: true });
  fs.writeFileSync(RUTA_MARCA, motor, 'utf8');
}

/**
 * Indica si hay que aplicar los cambios del modelo al arrancar o compilar.
 * Se puede desactivar con `DATABASE_AUTO_SYNC=false` (por ejemplo en un
 * servidor de compilacion que no deba tocar la base de datos).
 */
export function sincronizacionAutomatica(): boolean {
  const valor = (process.env.DATABASE_AUTO_SYNC ?? '').trim().toLowerCase();
  if (valor === '') return true;
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(valor);
}

export type ResultadoPreparacion = { motor: MotorBd | null; error: string | null };

/**
 * Deduce el motor desde `DATABASE_URL`, ajusta el `provider` del esquema y
 * regenera el cliente de Prisma solo si hizo falta.
 */
export async function asegurarProveedorYCliente(): Promise<ResultadoPreparacion> {
  const motor = motorDeUrl(process.env.DATABASE_URL);
  if (!motor) {
    console.warn(
      `${PREFIJO} No se pudo determinar el motor desde DATABASE_URL; se continua sin cambios.`,
    );
    return { motor: null, error: null };
  }

  if (!fs.existsSync(RUTA_ESQUEMA)) {
    return { motor, error: `No se encontro ${RUTA_ESQUEMA}.` };
  }

  const proveedor = proveedorDelEsquema(leerEsquema());
  const esquemaDesactualizado = proveedor !== motor;

  if (esquemaDesactualizado) {
    escribirEsquema(esquemaConProveedor(leerEsquema(), motor));
    console.log(`${PREFIJO} Esquema actualizado de "${proveedor ?? '?'}" a "${motor}".`);
  }

  if (!esquemaDesactualizado && leerMarca() === motor) {
    console.log(`${PREFIJO} Motor ${etiquetaMotor(motor)} listo.`);
    return { motor, error: null };
  }

  if (!fs.existsSync(RUTA_CLI)) {
    return { motor, error: 'No se encontro el CLI de Prisma. Ejecuta "npm install".' };
  }

  console.log(`${PREFIJO} Generando el cliente de Prisma para ${etiquetaMotor(motor)}...`);
  const resultado = spawnSync(process.execPath, [RUTA_CLI, 'generate'], {
    stdio: 'inherit',
    cwd: RAIZ,
  });

  if (resultado.status !== 0) {
    return {
      motor,
      error:
        'No se pudo generar el cliente de Prisma. Si el servidor esta en ejecucion, detenlo (Ctrl+C) y vuelve a intentarlo.',
    };
  }

  escribirMarca(motor);
  console.log(`${PREFIJO} Cliente de Prisma listo para ${etiquetaMotor(motor)}.`);
  return { motor, error: null };
}

export type ResultadoEsquema = {
  estado: EstadoEsquemaBd;
  aplicado: boolean;
  error: string | null;
};

/**
 * Crea o actualiza las tablas de la base de datos activa segun el modelo.
 *
 * Si el esquema ya coincide no hace absolutamente nada. Si hay diferencias
 * (o la base de datos todavia no existe) aplica los cambios con `db push`,
 * que nunca borra datos: si el cambio exigiera perdida de informacion, falla
 * y lo reporta.
 */
export async function asegurarEsquemaDeLaBase(): Promise<ResultadoEsquema> {
  const url = (process.env.DATABASE_URL ?? '').trim();

  let estado: EstadoEsquemaBd;
  try {
    estado = await estadoEsquema(RUTA_ESQUEMA, url);
  } catch (error) {
    return {
      estado: 'sin-conexion',
      aplicado: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (estado === 'sincronizado') {
    console.log(`${PREFIJO} Esquema al dia: no hay cambios en las tablas.`);
    return { estado, aplicado: false, error: null };
  }

  const motivo =
    estado === 'sin-conexion'
      ? 'la base de datos todavia no existe'
      : 'el modelo tiene cambios que aplicar';
  console.log(`${PREFIJO} Actualizando el esquema (${motivo})...`);

  try {
    await crearEsquemaEnDestino(RUTA_ESQUEMA, url, 'activa');
  } catch (error) {
    return {
      estado,
      aplicado: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  console.log(`${PREFIJO} Esquema de la base de datos actualizado.`);
  return { estado, aplicado: true, error: null };
}
