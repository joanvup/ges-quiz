/**
 * Volcado de datos y construccion del respaldo.
 *
 * Este modulo es PURO (no toca la base de datos): recibe el volcado ya leido
 * y lo serializa a JSON o a SQL del motor que se le indique. La lectura real
 * vive en `lectura.ts`.
 *
 * Modulo SOLO de servidor.
 */

import { TABLAS, type DefinicionTabla } from './catalogo';
import { sentenciaInsert } from './sql';
import type { MotorBd } from './motores';

/** Maximo de filas por tabla que se volcaran en memoria. */
export const LIMITE_FILAS = 500_000;

export type ContenidoTabla = {
  tabla: string;
  columnas: string[];
  filas: unknown[][];
};

export type Volcado = {
  version: 1;
  generadoEn: string;
  motor: MotorBd;
  tablas: ContenidoTabla[];
  totalFilas: number;
};

/** Forma del JSON de un respaldo (fechas en ISO 8601). */
export type DatosVolcadoJson = {
  version: number;
  generadoEn: string;
  motor: string;
  tablas: { tabla: string; columnas: string[]; filas: unknown[][] }[];
};

/** Convierte el valor del JSON al tipo que espera la columna. */
function coercionar(tipo: string, valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (tipo === 'fecha') return valor instanceof Date ? valor : new Date(String(valor));
  if (tipo === 'booleano') {
    if (typeof valor === 'boolean') return valor;
    return valor === 1 || valor === '1' || valor === 'true' || valor === true;
  }
  if (tipo === 'entero') return typeof valor === 'number' ? Math.trunc(valor) : Number(valor);
  if (tipo === 'real') return typeof valor === 'number' ? valor : Number(valor);
  return typeof valor === 'string' ? valor : String(valor);
}

/** Serializa el volcado a JSON (fechas en ISO 8601). */
export function volcadoAJson(volcado: Volcado): string {
  return JSON.stringify(volcado, null, 2);
}

/** Valida y convierte el JSON de un respaldo en un volcado utilizable. */
export function volcadoDesdeJson(datos: DatosVolcadoJson): Volcado {
  const tablas: ContenidoTabla[] = [];
  let totalFilas = 0;

  for (const definicion of TABLAS) {
    const entrada = datos.tablas.find((tabla) => tabla.tabla === definicion.tabla);
    if (!entrada) {
      tablas.push({
        tabla: definicion.tabla,
        columnas: definicion.columnas.map((columna) => columna.nombre),
        filas: [],
      });
      continue;
    }

    const tipos = new Map(definicion.columnas.map((columna) => [columna.nombre, columna.tipo]));
    // Se recorre el catalogo y no el archivo: asi se ignora cualquier columna
    // desconocida y se rellenan con null las que falten.
    const filas = entrada.filas.map((fila) =>
      definicion.columnas.map((columna, indice) => coercionar(tipos.get(columna.nombre) ?? 'texto', fila[indice])),
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
    generadoEn: datos.generadoEn,
    motor: (['sqlite', 'postgresql', 'mysql'] as const).includes(datos.motor as MotorBd)
      ? (datos.motor as MotorBd)
      : 'sqlite',
    tablas,
    totalFilas,
  };
}

/** Sentencias `INSERT` de todo el volcado, en lotes por tabla. */
export function sentenciasInsert(volcado: Volcado, motor: MotorBd, tamanoLote = 250): string[] {
  const definiciones = new Map(TABLAS.map((definicion) => [definicion.tabla, definicion]));
  const sentencias: string[] = [];

  for (const contenido of volcado.tablas) {
    const definicion = definiciones.get(contenido.tabla);
    if (!definicion || contenido.filas.length === 0) continue;
    for (let i = 0; i < contenido.filas.length; i += tamanoLote) {
      sentencias.push(sentenciaInsert(definicion, contenido.filas.slice(i, i + tamanoLote), motor));
    }
  }

  return sentencias;
}

/** Resumen de filas por tabla, con su etiqueta legible. */
export function resumenVolcado(
  volcado: Volcado,
): { tabla: string; etiqueta: string; filas: number }[] {
  const etiquetas = new Map(TABLAS.map((definicion) => [definicion.tabla, definicion.etiqueta]));
  return volcado.tablas.map((contenido) => ({
    tabla: contenido.tabla,
    etiqueta: etiquetas.get(contenido.tabla) ?? contenido.tabla,
    filas: contenido.filas.length,
  }));
}

export function definicionDeTabla(tabla: string): DefinicionTabla | undefined {
  return TABLAS.find((definicion) => definicion.tabla === tabla);
}
