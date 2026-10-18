import { prisma } from '@/lib/db';

type EntradaAuditoria = {
  actorId?: string | null;
  accion: string;
  tipoEntidad?: string | null;
  entidadId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
};

/**
 * Registra una accion en el log de auditoria.
 * Nunca lanza: la auditoria no debe romper la operacion principal.
 */
export async function auditar(entrada: EntradaAuditoria): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entrada.actorId ?? null,
        action: entrada.accion,
        entityType: entrada.tipoEntidad ?? null,
        entityId: entrada.entidadId ?? null,
        meta: entrada.meta ? JSON.stringify(entrada.meta) : null,
        ip: entrada.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[auditoria] no se pudo registrar el evento', entrada.accion, error);
  }
}

export const ACCIONES = {
  LOGIN_OK: 'LOGIN_OK',
  LOGIN_FALLO: 'LOGIN_FALLO',
  LOGOUT: 'LOGOUT',
  USUARIO_CREADO: 'USUARIO_CREADO',
  USUARIO_ACTUALIZADO: 'USUARIO_ACTUALIZADO',
  USUARIO_ELIMINADO: 'USUARIO_ELIMINADO',
  GRUPO_CREADO: 'GRUPO_CREADO',
  GRUPO_ACTUALIZADO: 'GRUPO_ACTUALIZADO',
  GRUPO_ELIMINADO: 'GRUPO_ELIMINADO',
  MIEMBRO_AGREGADO: 'MIEMBRO_AGREGADO',
  MIEMBRO_ELIMINADO: 'MIEMBRO_ELIMINADO',
  AJUSTES_ACTUALIZADOS: 'AJUSTES_ACTUALIZADOS',
  DOCUMENTO_SUBIDO: 'DOCUMENTO_SUBIDO',
  DOCUMENTO_ELIMINADO: 'DOCUMENTO_ELIMINADO',
  PREGUNTAS_GENERADAS: 'PREGUNTAS_GENERADAS',
  PREGUNTAS_IMPORTADAS: 'PREGUNTAS_IMPORTADAS',
  BANCO_PREGUNTAS_ELIMINADO: 'BANCO_PREGUNTAS_ELIMINADO',
  QUIZ_CREADO: 'QUIZ_CREADO',
  QUIZ_ACTUALIZADO: 'QUIZ_ACTUALIZADO',
  QUIZ_PUBLICADO: 'QUIZ_PUBLICADO',
  QUIZ_CERRADO: 'QUIZ_CERRADO',
  QUIZ_ELIMINADO: 'QUIZ_ELIMINADO',
  INTENTO_INICIADO: 'INTENTO_INICIADO',
  INTENTO_ENVIADO: 'INTENTO_ENVIADO',
  INTENTO_ANULADO: 'INTENTO_ANULADO',
  INFRACCION: 'INFRACCION',
  REPORTE_EXPORTADO: 'REPORTE_EXPORTADO',
  DATOS_IMPORTADOS: 'DATOS_IMPORTADOS',
  RESPALDO_GENERADO: 'RESPALDO_GENERADO',
  RESPALDO_RESTAURADO: 'RESPALDO_RESTAURADO',
  BASE_DATOS_MIGRADA: 'BASE_DATOS_MIGRADA',
  BASE_DATOS_INICIALIZADA: 'BASE_DATOS_INICIALIZADA',
} as const;
