import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { INCLUDE_QUIZ, aQuizDetalleDto } from '@/lib/quices/servicio';
import { listarIntentosDocente } from '@/lib/intentos/servicio';
import { formatearDuracion, formatearFechaHora } from '@/lib/formato';
import { Alerta, EnlaceBoton, Insignia, Tarjeta, Vacio } from '@/components/ui';
import {
  ETIQUETA_ACCION_INFRACCION,
  ETIQUETA_ESTADO_INTENTO,
  ETIQUETA_EVENTO_PROCTOR,
  ETIQUETA_MOTIVO_ENVIO,
  type AccionInfraccion,
  type EstadoIntento,
  type MotivoEnvio,
  type TipoEventoProctor,
} from '@/lib/dominio/constantes';

export const dynamic = 'force-dynamic';

const TONO_ESTADO: Record<string, 'verde' | 'ambar' | 'rojo' | 'gris'> = {
  IN_PROGRESS: 'ambar',
  SUBMITTED: 'verde',
  VOIDED: 'rojo',
};

function duracionIntento(iniciadoEn: string, enviadoEn: string | null): number | null {
  if (!enviadoEn) return null;
  const inicio = new Date(iniciadoEn).getTime();
  const fin = new Date(enviadoEn).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return null;
  return Math.max(0, Math.round((fin - inicio) / 1000));
}

export default async function PaginaIntentosQuiz({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');
  const { id } = await params;

  const quizDb = await prisma.quiz.findUnique({ where: { id }, include: INCLUDE_QUIZ });
  if (!quizDb) notFound();
  if (usuario.role !== 'ADMIN' && quizDb.authorId !== usuario.id) {
    redirect('/docentes/quices');
  }

  const quiz = aQuizDetalleDto(quizDb);
  const intentos = await listarIntentosDocente(quiz.id);
  const conInfracciones = intentos.filter((intento) => intento.infracciones > 0).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link href="/docentes/quices" className="hover:text-brand-700">
              Quices
            </Link>{' '}
            /{' '}
            <Link href={`/docentes/quices/${quiz.id}`} className="hover:text-brand-700">
              Editor
            </Link>{' '}
            / Intentos
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{quiz.titulo}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {intentos.length} intento(s) · {conInfracciones} con infracciones registradas
          </p>
        </div>
        <EnlaceBoton href={`/docentes/quices/${quiz.id}`} variante="secundario" tamano="sm">
          Volver al editor
        </EnlaceBoton>
      </div>

      {quiz.modoSeguro ? (
        <Alerta tipo="info" titulo={`Modo seguro · umbral ${quiz.umbralInfracciones} infraccion(es)`}>
          Al alcanzar el umbral, la accion configurada es:{' '}
          <span className="font-medium">
            {ETIQUETA_ACCION_INFRACCION[quiz.accionInfraccion as AccionInfraccion] ?? quiz.accionInfraccion}
          </span>
          . Recuerda que ningun navegador puede impedir por completo cambiar de pestana; el registro
          es evidencia, no una garantia.
        </Alerta>
      ) : (
        <Alerta tipo="info" titulo="Modo seguro desactivado">
          Este quiz no se configuro en modo seguro, por lo que no se esperan eventos de proctoring.
          La linea de tiempo se mantiene vacia salvo que la configuracion haya cambiado.
        </Alerta>
      )}

      {intentos.length === 0 ? (
        <Vacio mensaje="Todavia no hay intentos registrados para este quiz." />
      ) : (
        <ol className="flex flex-col gap-4">
          {intentos.map((intento) => {
            const duracion = duracionIntento(intento.iniciadoEn, intento.enviadoEn);
            const estado = (intento.estado as EstadoIntento) ?? 'IN_PROGRESS';
            return (
              <li key={intento.id}>
                <Tarjeta>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-900">
                            {intento.estudiante.nombre}
                          </p>
                          <Insignia tono={TONO_ESTADO[estado] ?? 'gris'}>
                            {ETIQUETA_ESTADO_INTENTO[estado] ?? estado}
                          </Insignia>
                          <Insignia tono="gris">Intento {intento.numero}</Insignia>
                          {intento.infracciones > 0 ? (
                            <Insignia tono="rojo">
                              {intento.infracciones} infraccion(es)
                            </Insignia>
                          ) : (
                            <Insignia tono="verde">Sin infracciones</Insignia>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{intento.estudiante.correo}</p>
                      </div>
                      <div className="text-right text-sm">
                        {intento.estado === 'SUBMITTED' ? (
                          <>
                            <p className="font-semibold text-slate-900">
                              {intento.puntaje ?? 0} / {intento.puntajeMaximo} puntos
                            </p>
                            <p className={intento.aprobada ? 'text-emerald-700' : 'text-red-700'}>
                              Nota {intento.nota ?? '-'} ·{' '}
                              {intento.aprobada ? 'Aprobado' : 'No aprobado'}
                            </p>
                          </>
                        ) : intento.estado === 'VOIDED' ? (
                          <p className="font-medium text-red-700">Intento anulado</p>
                        ) : (
                          <p className="font-medium text-amber-700">Aun en progreso</p>
                        )}
                      </div>
                    </div>

                    <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-400">
                          Iniciado
                        </dt>
                        <dd>{formatearFechaHora(intento.iniciadoEn)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-400">
                          Enviado
                        </dt>
                        <dd>{formatearFechaHora(intento.enviadoEn)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-slate-400">
                          Duracion
                        </dt>
                        <dd>{duracion === null ? 'En curso' : formatearDuracion(duracion)}</dd>
                      </div>
                      {intento.motivo && (
                        <div>
                          <dt className="font-semibold uppercase tracking-wide text-slate-400">
                            Motivo de envio
                          </dt>
                          <dd>
                            {ETIQUETA_MOTIVO_ENVIO[intento.motivo as MotivoEnvio] ?? intento.motivo}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {intento.eventos.length === 0 ? (
                      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Sin eventos de proctoring registrados.
                      </p>
                    ) : (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Linea de tiempo de eventos
                        </p>
                        <ol className="flex flex-col gap-1">
                          {intento.eventos.map((evento) => (
                            <li
                              key={evento.id}
                              className={
                                evento.infraccion
                                  ? 'flex flex-wrap items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-900'
                                  : 'flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-600'
                              }
                            >
                              <span className="font-mono text-[11px] text-slate-500">
                                {formatearFechaHora(evento.ocurridoEn)}
                              </span>
                              <span className="font-medium">
                                {ETIQUETA_EVENTO_PROCTOR[evento.tipo as TipoEventoProctor] ??
                                  evento.tipo}
                              </span>
                              {evento.infraccion && <Insignia tono="rojo">infraccion</Insignia>}
                              {evento.detalle && (
                                <span className="text-slate-500">· {evento.detalle}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
