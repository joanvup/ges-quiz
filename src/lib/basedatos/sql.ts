/**
 * Construccion de SQL portable entre motores (SQLite, PostgreSQL y MySQL).
 *
 * No se usan parametros porque el SQL se ejecuta con `prisma db execute`,
 * que recibe un archivo de script. Por eso los valores se convierten a
 * literales con el escapado de cada motor.
 */

import { DEFINICION_MOTOR, type MotorBd } from './motores';
import type { DefinicionTabla } from './catalogo';

/** Cita un identificador (tabla o columna) segun el motor. */
export function identificador(nombre: string, motor: MotorBd): string {
  const comilla = DEFINICION_MOTOR[motor].comilla;
  return `${comilla}${nombre}${comilla}`;
}

/**
 * Fecha en formato UTC sin zona: `2026-10-18 05:09:15.877`.
 * PostgreSQL y MySQL interpretan los `TIMESTAMP`/`DATETIME` como UTC, que es
 * justo como los lee Prisma.
 */
export function fechaSql(fecha: Date): string {
  return fecha.toISOString().slice(0, 23).replace('T', ' ');
}

/** Escapa un texto para incrustarlo entre comillas simples. */
export function escaparTexto(valor: string, motor: MotorBd): string {
  let texto = valor.replace(/\u0000/g, '');
  // MySQL trata la barra invertida como caracter de escape dentro de las cadenas.
  if (motor === 'mysql') texto = texto.replace(/\\/g, '\\\\');
  return texto.replace(/'/g, "''");
}

/** Convierte un valor de JavaScript en un literal SQL valido para el motor. */
export function literalSql(valor: unknown, motor: MotorBd): string {
  if (valor === null || valor === undefined) return 'NULL';

  if (typeof valor === 'boolean') {
    return valor ? DEFINICION_MOTOR[motor].verdadero : DEFINICION_MOTOR[motor].falso;
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return 'NULL';
    return String(valor);
  }
  // SQLite guarda las fechas como milisegundos desde la epoca (igual que Prisma).
  if (valor instanceof Date) {
    return motor === 'sqlite' ? String(valor.getTime()) : `'${fechaSql(valor)}'`;
  }
  if (typeof valor === 'string') {
    return `'${escaparTexto(valor, motor)}'`;
  }
  if (typeof valor === 'bigint') return String(valor);

  return `'${escaparTexto(JSON.stringify(valor), motor)}'`;
}

/**
 * Una sola sentencia `INSERT` con varias filas:
 * `INSERT INTO "Tabla" ("a", "b") VALUES (1, 2), (3, 4);`
 */
export function sentenciaInsert(
  definicion: DefinicionTabla,
  filas: unknown[][],
  motor: MotorBd,
): string {
  const columnas = definicion.columnas
    .map((columna) => identificador(columna.nombre, motor))
    .join(', ');
  const valores = filas
    .map((fila) => `(${fila.map((valor) => literalSql(valor, motor)).join(', ')})`)
    .join(', ');

  return `INSERT INTO ${identificador(definicion.tabla, motor)} (${columnas}) VALUES ${valores};`;
}

/** Sentencias para vaciar todas las tablas (hijos primero). */
export function sentenciasBorrado(
  tablas: DefinicionTabla[],
  motor: MotorBd,
): string[] {
  return tablas.map(
    (definicion) => `DELETE FROM ${identificador(definicion.tabla, motor)};`,
  );
}

/** Parte una lista en lotes de tamano fijo. */
export function lotes<T>(elementos: T[], tamano: number): T[][] {
  if (tamano <= 0) return [elementos];
  const resultado: T[][] = [];
  for (let i = 0; i < elementos.length; i += tamano) {
    resultado.push(elementos.slice(i, i + tamano));
  }
  return resultado;
}
