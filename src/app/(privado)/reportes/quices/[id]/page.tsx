import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { obtenerReporteQuiz } from '@/lib/reportes/servicio';
import { formatearDuracion } from '@/lib/formato';
import { Alerta, EnlaceBoton, Estadistica, Insignia, Tabla, Tarjeta, Vacio, cx } from '@/components/ui';
import {
  ETIQUETA_ACCION_INFRACCION,
  ETIQUETA_ESTADO_QUIZ,
  ETIQUETA_TIPO_PREGUNTA,
  type AccionInfraccion,
  type EstadoQuiz,
  type TipoPregunta,
} from '@/lib/dominio/constantes';

export const dynamic = 'force-dynamic';

const TONO_ESTADO: Record<string, 'gris' | 'verde' | 'azul'> = {
  DRAFT: 'gris',
  PUBLISHED: 'verde',
  CLOSED: 'azul',
};

const TONO_ESTUDIANTE: Record<string, 'gris' | 'verde' | 'ambar' | 'rojo' | 'azul'> = {
  SIN_INTENTAR: 'gris',
  EN_PROGRESO: 'ambar',
  ENVIADO: 'verde',
  ANULADO: 'rojo',
};

function tonoAcierto(porcentaje: number): string {
  if (porcentaje >= 70) return 'bg-emerald-500';
  if (porcentaje >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

export default async function PaginaReporteQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');
  const { id } = await params;

  const quizDb = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!quizDb) notFound();
  if (usuario.role !== 'ADMIN' && quizDb.authorId !== usuario.id) redirect('/reportes');

  const reporte = await obtenerReporteQuiz(id);
  if (!reporte) notFound();

  const r = reporte.resumen;
  const base = `/api/reportes/quices/${reporte.quizId}/exportar`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link href="/reportes" className="hover:text-brand-700">
              Reportes
            </Link>{' '}
            / Resultados
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{reporte.titulo}</h1>
            <Insignia tono={TONO_ESTADO[reporte.estado] ?? 'gris'}>
              {ETIQUETA_ESTADO_QUIZ[reporte.estado as EstadoQuiz] ?? reporte.estado}
            </Insignia>
            {reporte.modoSeguro && <Insignia tono="violeta">modo seguro</Insignia>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {reporte.totalPreguntas} pregunta(s) · {reporte.totalPuntos} punto(s) · aprueba con{' '}
            {reporte.notaAprobacion}/{reporte.notaMaxima} ·{' '}
            {reporte.grupos.length === 0
              ? 'sin grupos'
              : reporte.grupos.map((grupo) => grupo.nombre).join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnlaceBoton href={`${base}?formato=csv&tabla=estudiantes`} tamano="sm" descarga>
            CSV estudiantes
          </EnlaceBoton>
          <EnlaceBoton
            href={`${base}?formato=csv&tabla=preguntas`}
            variante="secundario"
            tamano="sm"
            descarga
          >
            CSV preguntas
          </EnlaceBoton>
          <EnlaceBoton
            href={`${base}?formato=excel`}
            variante="secundario"
            tamano="sm"
            descarga
          >
            Excel (.xls)
          </EnlaceBoton>
        </div>
      </div>

      {r.enviados === 0 && (
        <Alerta tipo="info" titulo="Todavia no hay intentos enviados">
          El reporte se completara a medida que los estudiantes envien sus intentos. Los datos
          actuales muestran el grupo objetivo y la estructura del quiz.
        </Alerta>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Estadistica etiqueta="Estudiantes" valor={r.estudiantesAsignados} tono="azul" />
        <Estadistica etiqueta="Intentos enviados" valor={r.enviados} tono="verde" />
        <Estadistica
          etiqueta="Promedio de notas"
          valor={r.promedioNota ?? '-'}
          tono="violeta"
        />
        <Estadistica etiqueta="Tasa de aprobacion" valor={`${r.tasaAprobacion}%`} tono="ambar" />
        <Estadistica etiqueta="Sin intentar" valor={r.sinIntentar} tono="gris" />
        <Estadistica etiqueta="En progreso" valor={r.enProgreso} tono="ambar" />
        <Estadistica etiqueta="Anulados" valor={r.anulados} tono="rojo" />
        <Estadistica
          etiqueta="Tiempo promedio"
          valor={r.tiempoPromedioSeg === null ? '-' : formatearDuracion(r.tiempoPromedioSeg)}
          tono="azul"
        />
      </div>

      {reporte.modoSeguro && r.infraccionesTotales > 0 && (
        <Alerta tipo="aviso" titulo={`${r.infraccionesTotales} infraccion(es) registradas`}>
          Umbral configurado: {reporte.umbralInfracciones} · accion:{' '}
          {ETIQUETA_ACCION_INFRACCION[reporte.accionInfraccion as AccionInfraccion] ??
            reporte.accionInfraccion}
          . Revisa la linea de tiempo completa en{' '}
          <Link href={`/docentes/quices/${reporte.quizId}/intentos`} className="underline">
            Intentos e infracciones
          </Link>
          .
        </Alerta>
      )}

      {reporte.porGrupo.length > 0 && (
        <Tarjeta titulo="Comparativa por grupo" descripcion="Promedio de la mejor nota y aprobacion por grupo.">
          <Tabla cabeceras={['Grupo', 'Estudiantes', 'Intentos enviados', 'Promedio', 'Aprobados', 'Aprobacion']}>
            {reporte.porGrupo.map((grupo) => (
              <tr key={grupo.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{grupo.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.estudiantes}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.enviados}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.promedioNota ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.aprobados}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.tasaAprobacion}%</td>
              </tr>
            ))}
          </Tabla>
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Detalle por estudiante"
        descripcion="Mejor y ultima nota, tiempo total invertido, intentos e infracciones."
      >
        {reporte.estudiantes.length === 0 ? (
          <Vacio mensaje="El quiz no tiene estudiantes asignados ni intentos registrados." />
        ) : (
          <Tabla
            cabeceras={[
              'Estudiante',
              'Grupos',
              'Intentos',
              'Mejor nota',
              'Ultima nota',
              'Tiempo total',
              'Infracciones',
              'Estado',
            ]}
          >
            {reporte.estudiantes.map((estudiante) => (
              <tr key={estudiante.id}>
                <td className="px-3 py-2">
                  <span className="block font-medium text-slate-800">{estudiante.nombre}</span>
                  <span className="block text-xs text-slate-500">{estudiante.correo}</span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {estudiante.grupos.length === 0 ? '-' : estudiante.grupos.join(', ')}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {estudiante.enviados}/{estudiante.intentos}
                </td>
                <td className="px-3 py-2">
                  {estudiante.mejorNota === null ? (
                    <span className="text-slate-400">-</span>
                  ) : (
                    <span
                      className={cx(
                        'font-semibold',
                        estudiante.aprobada ? 'text-emerald-700' : 'text-red-700',
                      )}
                    >
                      {estudiante.mejorNota}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{estudiante.ultimaNota ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {estudiante.tiempoTotalSeg > 0 ? formatearDuracion(estudiante.tiempoTotalSeg) : '-'}
                </td>
                <td className="px-3 py-2">
                  {estudiante.infracciones > 0 ? (
                    <Insignia tono="rojo">{estudiante.infracciones}</Insignia>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Insignia tono={TONO_ESTUDIANTE[estudiante.estado] ?? 'gris'}>
                    {estudiante.estado === 'SIN_INTENTAR'
                      ? 'Sin intentar'
                      : estudiante.estado === 'EN_PROGRESO'
                        ? 'En progreso'
                        : estudiante.estado === 'ENVIADO'
                          ? 'Enviado'
                          : 'Anulado'}
                  </Insignia>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Analisis por pregunta"
        descripcion="Porcentaje de aciertos y opciones mas elegidas (distractores)."
      >
        {reporte.preguntas.length === 0 ? (
          <Vacio mensaje="El quiz no tiene preguntas." />
        ) : (
          <ol className="flex flex-col gap-4">
            {reporte.preguntas.map((pregunta) => (
              <li key={pregunta.questionId} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs font-semibold text-slate-500">
                        {pregunta.posicion}.
                      </span>
                      <Insignia tono="azul">
                        {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo as TipoPregunta] ?? pregunta.tipo}
                      </Insignia>
                      <Insignia tono="gris">{pregunta.puntos} pt</Insignia>
                      {pregunta.tema && <Insignia tono="gris">{pregunta.tema}</Insignia>}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{pregunta.enunciado}</p>
                  </div>
                  <div className="w-40 shrink-0">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Aciertos</span>
                      <span className="font-semibold text-slate-800">
                        {pregunta.porcentajeAcierto}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cx('h-full rounded-full', tonoAcierto(pregunta.porcentajeAcierto))}
                        style={{ width: `${pregunta.porcentajeAcierto}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Presentada {pregunta.presentadas} vez/veces · respondida {pregunta.respondidas} ·
                  correcta {pregunta.correctas} · omitida {pregunta.omitidas}
                </p>

                {pregunta.opciones.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {pregunta.opciones.map((opcion) => (
                      <li key={opcion.id} className="flex items-center gap-3">
                        <span
                          className={cx(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            opcion.correcta
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {opcion.etiqueta}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-slate-700">
                              {opcion.texto}
                              {opcion.correcta && (
                                <span className="ml-1 font-semibold text-emerald-700">
                                  (correcta)
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              {opcion.elegidas} ({opcion.porcentaje}%)
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cx(
                                'h-full rounded-full',
                                opcion.correcta ? 'bg-emerald-500' : 'bg-slate-400',
                              )}
                              style={{ width: `${Math.min(100, opcion.porcentaje)}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>

      <p className="text-xs text-slate-500">
        <Link href="/reportes" className="font-medium text-brand-700 underline">
          Volver a reportes
        </Link>
      </p>
    </div>
  );
}
