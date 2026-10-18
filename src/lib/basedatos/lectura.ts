/**
 * Lectura de todos los datos del sistema a traves del cliente de Prisma.
 *
 * Modulo SOLO de servidor: importa el cliente de Prisma, por eso la logica
 * pura de volcado vive en `volcado.ts`.
 */

import { prisma } from '@/lib/db';
import { TABLAS, type ModeloPrisma } from './catalogo';
import { motorActivo, type MotorBd } from './motores';
import { LIMITE_FILAS, type ContenidoTabla, type Volcado } from './volcado';

/**
 * Vista minima y sin tipos genericos del delegado de un modelo: permite
 * recorrer todas las tablas del catalogo sin repetir 15 veces el mismo codigo.
 */
export type DelegadoPrisma = {
  findMany: (args?: unknown) => Promise<Array<Record<string, unknown>>>;
  count: (args?: unknown) => Promise<number>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
};

export function delegadoPrisma(modelo: ModeloPrisma): DelegadoPrisma {
  const cliente = prisma as unknown as Record<ModeloPrisma, DelegadoPrisma>;
  const encontrado = cliente[modelo];
  if (!encontrado) throw new Error(`Modelo de Prisma desconocido: ${modelo}`);
  return encontrado;
}

/** Deja solo valores serializables con `JSON.stringify`. */
function valorPlano(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'bigint') return Number(valor);
  return valor;
}

/** Lee todas las tablas del sistema. */
export async function leerTodo(motor: MotorBd | null = motorActivo()): Promise<Volcado> {
  const tablas: ContenidoTabla[] = [];
  let totalFilas = 0;

  for (const definicion of TABLAS) {
    const registros = await delegadoPrisma(definicion.modelo).findMany();
    if (registros.length > LIMITE_FILAS) {
      throw new Error(
        `La tabla ${definicion.tabla} tiene demasiadas filas para volcarla (${registros.length}).`,
      );
    }
    const filas = registros.map((registro) =>
      definicion.columnas.map((columna) => valorPlano(registro[columna.nombre])),
    );
    totalFilas += filas.length;
    tablas.push({
      tabla: definicion.tabla,
      columnas: definicion.columnas.map((columna) => columna.nombre),
      filas,
    });
  }

  return {
    version: 1,
    generadoEn: new Date().toISOString(),
    motor: motor ?? 'sqlite',
    tablas,
    totalFilas,
  };
}
