import Link from 'next/link';
import { requiereRol } from '@/lib/auth/guard';
import { listarReportesQuiz } from '@/lib/reportes/servicio';
import { formatearFechaHora } from '@/lib/formato';
import { EnlaceBoton, Estadistica, Insignia, Tarjeta, Vacio } from '@/components/ui';
import { ETIQUETA_ESTADO_QUIZ, type EstadoQuiz } from '@/lib/dominio/constantes';

export const dynamic = 'force-dynamic';

const TONO_ESTADO: Record<string, 'gris' | 'verde' | 'azul'> = {
  DRAFT: 'gris',
  PUBLISHED: 'verde',
  CLOSED: 'azul',
};

export default async function PaginaReportes() {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');
  const quices = await listarReportesQuiz(usuario);

  const conIntentos = quices.filter((quiz) => quiz.intentos > 0).length;
  const publicados = quices.filter((quiz) => quiz.estado === 'PUBLISHED').length;
  const totalIntentos = quices.reduce((suma, quiz) => suma + quiz.intentos, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Consulta los resultados por quiz, grupo y estudiante (nota, tiempo, intentos e
          infracciones), analiza el comportamiento por pregunta y exporta a CSV o Excel.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Estadistica etiqueta="Quices" valor={quices.length} tono="azul" />
        <Estadistica etiqueta="Publicados" valor={publicados} tono="verde" />
        <Estadistica etiqueta="Con intentos" valor={conIntentos} tono="violeta" />
        <Estadistica etiqueta="Intentos totales" valor={totalIntentos} tono="ambar" />
      </div>

      {quices.length === 0 ? (
        <Vacio mensaje="Todavia no hay quices para reportar. Crea y publica un quiz para ver resultados." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quices.map((quiz) => (
            <Tarjeta key={quiz.id}>
              <div className="flex h-full flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Insignia tono={TONO_ESTADO[quiz.estado] ?? 'gris'}>
                      {ETIQUETA_ESTADO_QUIZ[quiz.estado as EstadoQuiz] ?? quiz.estado}
                    </Insignia>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">
                      <Link href={`/reportes/quices/${quiz.id}`} className="hover:text-brand-700">
                        {quiz.titulo}
                      </Link>
                    </h2>
                    <p className="text-xs text-slate-500">Autor: {quiz.autor}</p>
                  </div>
                  {quiz.modoSeguro && <Insignia tono="violeta">modo seguro</Insignia>}
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Preguntas</dt>
                    <dd>{quiz.totalPreguntas}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Intentos</dt>
                    <dd>{quiz.intentos}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Grupos</dt>
                    <dd>{quiz.grupos.length === 0 ? 'Sin asignar' : quiz.grupos.join(', ')}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Actualizado
                    </dt>
                    <dd>{formatearFechaHora(quiz.actualizadoEn)}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <EnlaceBoton href={`/reportes/quices/${quiz.id}`} tamano="sm">
                    Ver reporte
                  </EnlaceBoton>
                  <EnlaceBoton
                    href={`/api/reportes/quices/${quiz.id}/exportar?formato=excel`}
                    variante="secundario"
                    tamano="sm"
                    descarga
                  >
                    Excel
                  </EnlaceBoton>
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}
