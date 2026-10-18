import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { Tarjeta, Tabla, Insignia, Vacio } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ETIQUETAS_ACCION: Record<string, string> = {
  LOGIN_OK: 'Inicio de sesion correcto',
  LOGIN_FALLO: 'Intento de sesion fallido',
  LOGOUT: 'Cierre de sesion',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_ACTUALIZADO: 'Usuario actualizado',
  USUARIO_ELIMINADO: 'Usuario eliminado',
  GRUPO_CREADO: 'Grupo creado',
  GRUPO_ACTUALIZADO: 'Grupo actualizado',
  GRUPO_ELIMINADO: 'Grupo eliminado',
  MIEMBRO_AGREGADO: 'Estudiante agregado a grupo',
  MIEMBRO_ELIMINADO: 'Estudiante retirado de grupo',
  AJUSTES_ACTUALIZADOS: 'Configuracion actualizada',
  DOCUMENTO_SUBIDO: 'Documento subido',
  PREGUNTAS_GENERADAS: 'Preguntas generadas',
  PREGUNTAS_IMPORTADAS: 'Preguntas importadas',
  DATOS_IMPORTADOS: 'Datos importados (estudiantes/grupos)',
  RESPALDO_GENERADO: 'Respaldo de base de datos generado',
  RESPALDO_RESTAURADO: 'Respaldo restaurado',
  BASE_DATOS_MIGRADA: 'Base de datos migrada',
  BASE_DATOS_INICIALIZADA: 'Base de datos inicializada sin datos de prueba',
  QUIZ_CREADO: 'Quiz creado',
  QUIZ_PUBLICADO: 'Quiz publicado',
  INTENTO_INICIADO: 'Intento iniciado',
  INTENTO_ENVIADO: 'Intento enviado',
  INTENTO_ANULADO: 'Intento anulado',
  INFRACCION: 'Infraccion de modo seguro',
};

export default async function PaginaAuditoria() {
  await requiereRol('ADMIN');

  const registros = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { name: true, email: true, role: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Auditoria</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ultimos 200 eventos registrados en el sistema.
        </p>
      </div>

      <Tarjeta>
        {registros.length === 0 ? (
          <Vacio mensaje="Todavia no hay eventos registrados." />
        ) : (
          <Tabla cabeceras={['Fecha', 'Accion', 'Actor', 'Entidad', 'IP']} principal={1}>
            {registros.map((registro) => (
              <tr key={registro.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {registro.createdAt.toLocaleString('es-CO')}
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-800">
                    {ETIQUETAS_ACCION[registro.action] ?? registro.action}
                  </span>
                  {registro.meta && (
                    <span className="block max-w-md truncate text-xs text-slate-500">
                      {registro.meta}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {registro.actor ? (
                    <>
                      {registro.actor.name}
                      <span className="block text-xs text-slate-500">{registro.actor.email}</span>
                    </>
                  ) : (
                    <Insignia>Anonimo</Insignia>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {registro.entityType ?? '-'}
                  {registro.entityId && (
                    <span className="block text-xs text-slate-400">{registro.entityId.slice(0, 12)}…</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{registro.ip ?? '-'}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>
    </div>
  );
}
