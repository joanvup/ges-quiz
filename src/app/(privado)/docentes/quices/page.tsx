import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { INCLUDE_QUIZ, aQuizResumenDto } from '@/lib/quices/servicio';
import { formatearFecha } from '@/lib/cliente/formato';
import { EnlaceBoton, Estadistica, Insignia, Tarjeta, Vacio } from '@/components/ui';
import { ETIQUETA_ESTADO_QUIZ, type EstadoQuiz } from '@/lib/dominio/constantes';
import { NuevoQuiz } from './NuevoQuiz';
import { BotonEliminarQuiz } from './BotonEliminarQuiz';

export const dynamic = 'force-dynamic';

const TONO_ESTADO: Record<string, 'gris' | 'verde' | 'azul'> = {
  DRAFT: 'gris',
  PUBLISHED: 'verde',
  CLOSED: 'azul',
};

export default async function PaginaQuicesDocente() {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');

  const quicesDb = await prisma.quiz.findMany({
    where: usuario.role === 'ADMIN' ? {} : { authorId: usuario.id },
    orderBy: [{ updatedAt: 'desc' }],
    include: INCLUDE_QUIZ,
  });
  const quices = quicesDb.map(aQuizResumenDto);

  const borradores = quices.filter((quiz) => quiz.estado === 'DRAFT').length;
  const publicados = quices.filter((quiz) => quiz.estado === 'PUBLISHED').length;
  const cerrados = quices.filter((quiz) => quiz.estado === 'CLOSED').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quices</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Arma quices a partir del banco de preguntas, configura las reglas de aplicacion y
            publica solo cuando hayas revisado todo.
          </p>
        </div>
        {quices.length > 0 && <NuevoQuiz />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Estadistica etiqueta="Total" valor={quices.length} tono="azul" />
        <Estadistica etiqueta="Borradores" valor={borradores} tono="gris" />
        <Estadistica etiqueta="Publicados" valor={publicados} tono="verde" />
        <Estadistica etiqueta="Cerrados" valor={cerrados} tono="ambar" />
      </div>

      {quices.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Vacio mensaje="Todavia no hay quices. Crea el primero y agregale preguntas del banco." />
          <div className="flex justify-center">
            <NuevoQuiz />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quices.map((quiz) => (
            <Tarjeta key={quiz.id} className="flex flex-col">
              <div className="flex h-full flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Insignia tono={TONO_ESTADO[quiz.estado] ?? 'gris'}>
                      {ETIQUETA_ESTADO_QUIZ[quiz.estado as EstadoQuiz] ?? quiz.estado}
                    </Insignia>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">
                      <Link href={`/docentes/quices/${quiz.id}`} className="hover:text-brand-700">
                        {quiz.titulo}
                      </Link>
                    </h2>
                  </div>
                  {quiz.modoSeguro && <Insignia tono="violeta">modo seguro</Insignia>}
                </div>

                {quiz.descripcion && (
                  <p className="line-clamp-2 text-sm text-slate-600">{quiz.descripcion}</p>
                )}

                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Preguntas</dt>
                    <dd>
                      {quiz.totalPreguntas}
                      {quiz.cantidadPreguntas ? ` (se aplican ${quiz.cantidadPreguntas})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Puntaje</dt>
                    <dd>{quiz.totalPuntos} puntos</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Grupos</dt>
                    <dd>
                      {quiz.grupos.length === 0
                        ? 'Sin asignar'
                        : quiz.grupos.map((grupo) => grupo.nombre).join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">Intentos</dt>
                    <dd>
                      {quiz.intentos} realizado(s) · max. {quiz.intentosMaximos}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Disponibilidad
                    </dt>
                    <dd>
                      {quiz.disponibleDesde ? formatearFecha(quiz.disponibleDesde) : 'Al publicar'}
                      {' → '}
                      {quiz.disponibleHasta ? formatearFecha(quiz.disponibleHasta) : 'sin cierre'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <EnlaceBoton href={`/docentes/quices/${quiz.id}`} tamano="sm">
                    {quiz.estado === 'CLOSED' ? 'Ver quiz' : 'Configurar'}
                  </EnlaceBoton>
                  <EnlaceBoton
                    href={`/docentes/quices/${quiz.id}/vista-previa`}
                    variante="secundario"
                    tamano="sm"
                  >
                    Vista previa
                  </EnlaceBoton>
                  <BotonEliminarQuiz
                    quizId={quiz.id}
                    titulo={quiz.titulo}
                    intentos={quiz.intentos}
                  />
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}
