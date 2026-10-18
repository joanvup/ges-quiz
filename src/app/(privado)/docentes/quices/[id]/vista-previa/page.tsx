import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { INCLUDE_QUIZ, aQuizDetalleDto } from '@/lib/quices/servicio';
import { formatearDuracion, formatearFecha } from '@/lib/cliente/formato';
import { Alerta, EnlaceBoton, Insignia, Tarjeta, Vacio } from '@/components/ui';
import {
  ETIQUETA_MODO_NAVEGACION,
  ETIQUETA_MODO_RESULTADO,
  ETIQUETA_TIPO_PREGUNTA,
  type ModoNavegacion,
  type ModoResultado,
  type TipoPregunta,
} from '@/lib/dominio/constantes';

export const dynamic = 'force-dynamic';

export default async function PaginaVistaPreviaQuiz({
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link href="/docentes/quices" className="hover:text-brand-700">
              Quices
            </Link>{' '}
            / Vista previa
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{quiz.titulo}</h1>
        </div>
        <div className="flex gap-2">
          <EnlaceBoton href={`/docentes/quices/${quiz.id}`} variante="secundario" tamano="sm">
            Volver al editor
          </EnlaceBoton>
        </div>
      </div>

      <Alerta tipo="info" titulo="Vista previa para docentes">
        Asi veran el quiz los estudiantes. Esta pagina muestra las respuestas correctas y no
        registra intentos ni eventos de proctoring.
      </Alerta>

      <Tarjeta>
        <div className="flex flex-col gap-3">
          {quiz.descripcion && <p className="text-sm text-slate-700">{quiz.descripcion}</p>}
          <div className="flex flex-wrap gap-2">
            <Insignia tono="azul">{quiz.totalPreguntas} pregunta(s)</Insignia>
            <Insignia tono="verde">{quiz.totalPuntos} punto(s)</Insignia>
            <Insignia tono="gris">
              {ETIQUETA_MODO_NAVEGACION[quiz.navegacion as ModoNavegacion]}
            </Insignia>
            <Insignia tono="gris">
              {quiz.tiempoTotalSeg ? formatearDuracion(quiz.tiempoTotalSeg) : 'Sin limite total'}
            </Insignia>
            {quiz.tiempoPorPreguntaSeg && (
              <Insignia tono="gris">
                {formatearDuracion(quiz.tiempoPorPreguntaSeg)} por pregunta
              </Insignia>
            )}
            {quiz.modoSeguro && <Insignia tono="violeta">modo seguro</Insignia>}
          </div>
          <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-400">Grupos</dt>
              <dd>
                {quiz.grupos.length === 0
                  ? 'Sin asignar'
                  : quiz.grupos.map((grupo) => grupo.nombre).join(', ')}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-400">Disponibilidad</dt>
              <dd>
                {quiz.disponibleDesde ? formatearFecha(quiz.disponibleDesde) : 'Al publicar'}
                {' → '}
                {quiz.disponibleHasta ? formatearFecha(quiz.disponibleHasta) : 'sin cierre'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-400">Intentos</dt>
              <dd>Maximo {quiz.intentosMaximos}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-400">Resultados</dt>
              <dd>{ETIQUETA_MODO_RESULTADO[quiz.mostrarResultados as ModoResultado]}</dd>
            </div>
          </dl>
        </div>
      </Tarjeta>

      {quiz.preguntas.length === 0 ? (
        <Vacio mensaje="El quiz no tiene preguntas todavia." />
      ) : (
        <ol className="flex flex-col gap-4">
          {quiz.preguntas.map((pregunta, indice) => (
            <li key={pregunta.id}>
              <Tarjeta>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                        {indice + 1}
                      </span>
                      <Insignia tono="azul">
                        {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo as TipoPregunta]}
                      </Insignia>
                      <Insignia tono="gris">{pregunta.puntos} punto(s)</Insignia>
                      {pregunta.respuestaPendiente && (
                        <Insignia tono="rojo">respuesta por confirmar</Insignia>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {indice + 1} de {quiz.preguntas.length}
                    </span>
                  </div>

                  <p className="text-base font-medium text-slate-900">{pregunta.enunciado}</p>

                  <ul className="flex flex-col gap-2">
                    {pregunta.opciones.map((opcion) => (
                      <li
                        key={opcion.id}
                        className={
                          opcion.correcta
                            ? 'flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900'
                            : 'flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700'
                        }
                      >
                        <span className="font-semibold">{opcion.etiqueta}.</span>
                        <span className="flex-1">{opcion.texto}</span>
                        {opcion.correcta && (
                          <span className="text-xs font-semibold uppercase">correcta</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {pregunta.explicacion && (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold">Explicacion: </span>
                      {pregunta.explicacion}
                    </p>
                  )}
                </div>
              </Tarjeta>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
