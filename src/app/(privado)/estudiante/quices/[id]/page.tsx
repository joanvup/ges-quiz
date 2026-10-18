import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requiereRol } from '@/lib/auth/guard';
import { obtenerResumenQuizEstudiante } from '@/lib/intentos/servicio';
import { formatearDuracion, formatearFechaHora, formatearReloj } from '@/lib/formato';
import {
  ETIQUETA_MODO_NAVEGACION,
  ETIQUETA_MODO_RESULTADO,
  etiqueta,
} from '@/lib/dominio/constantes';
import { Alerta, EnlaceBoton, Insignia, Tarjeta } from '@/components/ui';
import { IniciarQuiz } from './IniciarQuiz';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function PaginaDetalleQuizEstudiante({ params }: Props) {
  const { usuario } = await requiereRol('STUDENT');
  const { id } = await params;

  const quiz = await obtenerResumenQuizEstudiante(id, usuario.id);
  if (!quiz) notFound();

  const puedeComenzar = quiz.estado === 'DISPONIBLE';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link href="/estudiante/quices" className="underline">
              Mis quices
            </Link>{' '}
            / Ficha del quiz
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{quiz.titulo}</h1>
        </div>
        <Insignia tono={quiz.estado === 'DISPONIBLE' ? 'verde' : quiz.estado === 'PROXIMO' ? 'azul' : 'gris'}>
          {quiz.estado === 'EN_PROGRESO'
            ? 'En progreso'
            : quiz.estado === 'DISPONIBLE'
              ? 'Disponible'
              : quiz.estado === 'PROXIMO'
                ? 'Proximo'
                : quiz.estado === 'COMPLETADO'
                  ? 'Completado'
                  : 'Cerrado'}
        </Insignia>
      </div>

      {quiz.descripcion && (
        <Tarjeta titulo="Indicaciones del docente">
          <p className="whitespace-pre-line text-sm text-slate-700">{quiz.descripcion}</p>
        </Tarjeta>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Tarjeta titulo="Reglas del quiz" className="lg:col-span-2">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Preguntas</dt>
              <dd className="font-medium text-slate-900">{quiz.totalPreguntas}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Puntos totales</dt>
              <dd className="font-medium text-slate-900">{quiz.totalPuntos}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Tiempo total</dt>
              <dd className="font-medium text-slate-900">{formatearDuracion(quiz.tiempoTotalSeg)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Tiempo por pregunta</dt>
              <dd className="font-medium text-slate-900">
                {quiz.tiempoPorPreguntaSeg ? formatearReloj(quiz.tiempoPorPreguntaSeg) : 'Sin limite'}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Intentos</dt>
              <dd className="font-medium text-slate-900">
                {quiz.intentosUsados} usado(s) de {quiz.intentosMaximos}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Navegacion</dt>
              <dd className="font-medium text-slate-900">
                {etiqueta(ETIQUETA_MODO_NAVEGACION, quiz.navegacion)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Resultados al terminar</dt>
              <dd className="font-medium text-slate-900">
                {etiqueta(ETIQUETA_MODO_RESULTADO, quiz.mostrarResultados)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Revision final antes de enviar</dt>
              <dd className="font-medium text-slate-900">{quiz.permitirRevision ? 'Si' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Nota minima de aprobacion</dt>
              <dd className="font-medium text-slate-900">
                {quiz.notaAprobacion} de {quiz.notaMaxima}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <dt className="text-slate-600">Disponible</dt>
              <dd className="font-medium text-slate-900">
                {formatearFechaHora(quiz.disponibleDesde)} - {formatearFechaHora(quiz.disponibleHasta)}
              </dd>
            </div>
          </dl>
        </Tarjeta>

        <Tarjeta titulo="Antes de comenzar" descripcion="Verifica las condiciones del intento.">
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2 text-sm text-slate-700">
              <li>Se muestra una pregunta a la vez.</li>
              <li>
                {quiz.navegacion === 'FORWARD_ONLY'
                  ? 'No podras volver a preguntas anteriores.'
                  : 'Puedes retroceder y cambiar tus respuestas.'}
              </li>
              <li>
                {quiz.tiempoTotalSeg
                  ? 'El temporizador corre desde el primer momento y no se detiene.'
                  : 'No hay limite de tiempo total.'}
              </li>
              <li>Tus respuestas se guardan automaticamente.</li>
              {quiz.modoSeguro && (
                <li className="font-medium text-amber-700">
                  Modo seguro activado: el intento se vigila y las infracciones repetidas pueden
                  anular tu intento o enviarlo automaticamente.
                </li>
              )}
            </ul>

            {quiz.estado === 'EN_PROGRESO' && quiz.intentoEnProgresoId ? (
              <Alerta tipo="aviso" titulo="Tienes un intento sin terminar">
                Reanuda donde lo dejaste. El tiempo del intento sigue corriendo.
                <div className="mt-3">
                  <EnlaceBoton href={`/estudiante/intentos/${quiz.intentoEnProgresoId}`}>
                    Reanudar intento
                  </EnlaceBoton>
                </div>
              </Alerta>
            ) : puedeComenzar ? (
              <IniciarQuiz quizId={quiz.id} modoSeguro={quiz.modoSeguro} />
            ) : quiz.estado === 'PROXIMO' ? (
              <Alerta tipo="info">
                Este quiz se habilitara el {formatearFechaHora(quiz.disponibleDesde)}.
              </Alerta>
            ) : quiz.estado === 'COMPLETADO' ? (
              <Alerta tipo="info">
                Ya usaste todos los intentos permitidos para este quiz.
              </Alerta>
            ) : (
              <Alerta tipo="info">Este quiz ya no esta disponible.</Alerta>
            )}

            {quiz.modoSeguro && (
              <p className="text-xs text-slate-500">
                Si tu navegador no admite pantalla completa, el intento puede bloquearse por
                seguridad. Se recomienda usar un computador de escritorio.
              </p>
            )}
          </div>
        </Tarjeta>
      </div>

      <p className="text-xs text-slate-500">
        <Link href="/estudiante/quices" className="font-medium text-brand-700 underline">
          Volver a mis quices
        </Link>
      </p>
    </div>
  );
}
