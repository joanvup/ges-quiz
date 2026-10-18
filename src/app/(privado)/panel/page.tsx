import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requiereUsuario } from '@/lib/auth/guard';
import { ETIQUETA_ROL, type Rol } from '@/lib/dominio/constantes';
import { obtenerAjustes } from '@/lib/settings';
import { Estadistica, EnlaceBoton, Insignia, Tarjeta } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaPanel() {
  const { usuario } = await requiereUsuario();
  const rol = usuario.role as Rol;
  const ajustes = await obtenerAjustes();

  const [usuarios, grupos, documentos, quices, intentos] = await Promise.all([
    prisma.user.count(),
    prisma.group.count({ where: { active: true } }),
    prisma.document.count(),
    prisma.quiz.count(),
    prisma.attempt.count(),
  ]);

  const asignacionesEstudiante =
    rol === 'STUDENT'
      ? await prisma.quizAssignment.findMany({
          where: { group: { memberships: { some: { userId: usuario.id } } }, quiz: { status: 'PUBLISHED' } },
          include: { quiz: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hola, {usuario.name.split(' ')[0]}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            Has iniciado sesion como
            <Insignia tono={rol === 'ADMIN' ? 'violeta' : rol === 'TEACHER' ? 'azul' : 'verde'}>
              {ETIQUETA_ROL[rol]}
            </Insignia>
          </p>
        </div>
        <p className="text-sm text-slate-500">Ano escolar {ajustes['institucion.anio']}</p>
      </div>

      {rol !== 'STUDENT' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Estadistica etiqueta="Usuarios" valor={usuarios} />
          <Estadistica etiqueta="Grupos activos" valor={grupos} tono="violeta" />
          <Estadistica etiqueta="Documentos" valor={documentos} tono="ambar" />
          <Estadistica etiqueta="Quices" valor={quices} tono="verde" />
        </div>
      )}

      {rol === 'ADMIN' && (
        <Tarjeta
          titulo="Administracion"
          descripcion="Gestiona usuarios, grupos y la configuracion global del colegio."
        >
          <div className="flex flex-wrap gap-2">
            <EnlaceBoton href="/admin/usuarios">Gestionar usuarios</EnlaceBoton>
            <EnlaceBoton href="/admin/grupos" variante="secundario">
              Gestionar grupos
            </EnlaceBoton>
            <EnlaceBoton href="/admin/importar" variante="secundario">
              Importar estudiantes y grupos
            </EnlaceBoton>
            <EnlaceBoton href="/admin/base-datos" variante="secundario">
              Base de datos y respaldos
            </EnlaceBoton>
            <EnlaceBoton href="/admin/configuracion" variante="secundario">
              Configuracion global
            </EnlaceBoton>
            <EnlaceBoton href="/admin/auditoria" variante="secundario">
              Ver auditoria
            </EnlaceBoton>
          </div>
        </Tarjeta>
      )}

      {rol === 'TEACHER' && (
        <Tarjeta
          titulo="Tu trabajo"
          descripcion="Sube material de estudio y crea quices para tus grupos."
        >
          <div className="flex flex-wrap gap-2">
            <EnlaceBoton href="/docentes/documentos">Subir documentos</EnlaceBoton>
            <EnlaceBoton href="/docentes/quices" variante="secundario">
              Mis quices
            </EnlaceBoton>
            <EnlaceBoton href="/reportes" variante="secundario">
              Reportes
            </EnlaceBoton>
          </div>
        </Tarjeta>
      )}

      {rol === 'STUDENT' && (
        <Tarjeta
          titulo="Quices disponibles"
          descripcion="Estos son los quices publicados para tus grupos."
        >
          {asignacionesEstudiante.length === 0 ? (
            <p className="text-sm text-slate-600">
              Todavia no tienes quices publicados. Cuando tu docente publique uno, aparecera aqui y en
              <Link href="/estudiante/quices" className="ml-1 font-medium text-brand-700 underline">
                Mis quices
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {asignacionesEstudiante.map((asignacion) => (
                <li key={asignacion.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{asignacion.quiz.title}</p>
                    <p className="text-xs text-slate-500">
                      {asignacion.quiz.availableFrom
                        ? `Disponible desde ${asignacion.quiz.availableFrom.toLocaleString('es-CO')}`
                        : 'Disponible ahora'}
                    </p>
                  </div>
                  <EnlaceBoton href={`/estudiante/quices`} tamano="sm" variante="secundario">
                    Ver
                  </EnlaceBoton>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Estado del sistema" descripcion="Resumen rapido del uso de la plataforma.">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-600">Intentos de quiz registrados</dt>
            <dd className="font-semibold text-slate-900">{intentos}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-600">Nota minina de aprobacion</dt>
            <dd className="font-semibold text-slate-900">{ajustes['academico.notaMinima']}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-600">Intentos maximos por defecto</dt>
            <dd className="font-semibold text-slate-900">{ajustes['quiz.intentosMaximos']}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
            <dt className="text-slate-600">Tamano maximo de PDF</dt>
            <dd className="font-semibold text-slate-900">{ajustes['archivos.maxMB']} MB</dd>
          </div>
        </dl>
      </Tarjeta>
    </div>
  );
}
