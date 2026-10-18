/**
 * Reglas de la "inicializacion sin datos de prueba".
 *
 * Deja la base de datos como recien instalada: se vacian los datos de trabajo
 * (usuarios, grupos, documentos, preguntas, quices e intentos) y se conservan
 * el esquema, la configuracion del sistema, el registro de auditoria y la
 * cuenta del administrador que ejecuta la accion.
 *
 * Modulo PURO (sin acceso a la base de datos) para poder probarlo con Vitest.
 */

import { TABLAS_INVERSO, type DefinicionTabla, type ModeloPrisma } from './catalogo';

/**
 * Tablas que NO se vacian:
 *  - `Setting`   guarda la configuracion del sistema (nombre, ano escolar...).
 *  - `AuditLog`  es el rastro de auditoria; no debe borrarse nunca.
 */
export const TABLAS_CONSERVADAS: readonly string[] = ['Setting', 'AuditLog'];

export function esTablaConservada(tabla: string): boolean {
  return TABLAS_CONSERVADAS.includes(tabla);
}

/** Tablas que se vacian, en orden seguro (primero las que dependen de otras). */
export function tablasQueSeVacian(): DefinicionTabla[] {
  return TABLAS_INVERSO.filter((definicion) => !esTablaConservada(definicion.tabla));
}

/**
 * Filtro de borrado de un modelo, o `null` si hay que vaciar la tabla entera.
 * Se conservan la cuenta que ejecuta la accion y sus sesiones abiertas, para
 * que quien pulsa el boton no se quede fuera del sistema.
 */
export function filtroVaciar(
  modelo: ModeloPrisma,
  usuarioId: string,
): { where: Record<string, unknown> } | null {
  if (modelo === 'user') return { where: { id: { not: usuarioId } } };
  if (modelo === 'session') return { where: { userId: { not: usuarioId } } };
  return null;
}
