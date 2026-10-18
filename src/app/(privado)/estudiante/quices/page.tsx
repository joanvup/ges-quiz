import Link from 'next/link';
import { requiereRol } from '@/lib/auth/guard';
import { listarQuicesEstudiante } from '@/lib/intentos/servicio';
import { formatearDuracion, formatearFechaHora } from '@/lib/formato';
import type { EstadoQuizEstudiante, QuizEstudianteDto } from '@/lib/cliente/tipos';
import { EnlaceBoton, Insignia, Tarjeta, Vacio } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ETIQUETA_ESTADO: Record<EstadoQuizEstudiante, string> = {
  EN_PROGRESO: 'En progreso',
  DISPONIBLE: 'Disponible',
  PROXIMO: 'Proximo',
  COMPLETADO: 'Completado',
  CERRADO: 'Cerrado',
};

const TONO_ESTADO: Record<
  EstadoQuizEstudiante,
  'gris' | 'azul' | 'verde' | 'ambar' | 'rojo' | 'violeta'
> = {
  EN_PROGRESO: 'ambar',
  DISPONIBLE: 'verde',
  PROXIMO: 'azul',
  COMPLETADO: 'violeta',
  CERRADO: 'gris',
};

function DatosQuiz({ quiz }: { quiz: QuizEstudianteDto }) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
      <div className="flex gap-1">
        <dt>Preguntas:</dt>
        <dd className="font-medium text-slate-700">{quiz.totalPreguntas}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Puntos:</dt>
        <dd className="font-medium text-slate-700">{quiz.totalPuntos}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Tiempo:</dt>
        <dd className="font-medium text-slate-700">{formatearDuracion(quiz.tiempoTotalSeg)}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Intentos:</dt>
        <dd className="font-medium text-slate-700">
          {quiz.intentosUsados}/{quiz.intentosMaximos}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Navegacion:</dt>
        <dd className="font-medium text-slate-700">
          {quiz.navegacion === 'FORWARD_ONLY' ? 'Solo adelante' : 'Libre'}
        </dd>
      </div>
      {quiz.modoSeguro && (
        <div className="flex gap-1">
          <dt>Modo seguro:</dt>
          <dd className="font-medium text-amber-700">Activado</dd>
        </div>
      )}
    </dl>
  );
}

function AccionesQuiz({ quiz }: { quiz: QuizEstudianteDto }) {
  const resultadoVisible =
    quiz.mostrarResultados !== 'NONE' && Boolean(quiz.ultimoIntentoId) && quiz.estado === 'COMPLETADO';
  const resultadoCerrado =
    quiz.mostrarResultados !== 'NONE' && Boolean(quiz.ultimoIntentoId) && quiz.estado === 'CERRADO';

  if (quiz.estado === 'EN_PROGRESO' && quiz.intentoEnProgresoId) {
    return (
      <EnlaceBoton href={`/estudiante/intentos/${quiz.intentoEnProgresoId}`} tamano="sm">
        Reanudar intento
      </EnlaceBoton>
    );
  }

  if (quiz.estado === 'DISPONIBLE') {
    return (
      <EnlaceBoton href={`/estudiante/quices/${quiz.id}`} tamano="sm">
        Comenzar
      </EnlaceBoton>
    );
  }

  if (quiz.estado === 'PROXIMO') {
    return (
      <span className="text-xs text-slate-500">
        Se habilita el {formatearFechaHora(quiz.disponibleDesde)}
      </span>
    );
  }

  if ((resultadoVisible || resultadoCerrado) && quiz.ultimoIntentoId) {
    return (
      <EnlaceBoton
        href={`/estudiante/intentos/${quiz.ultimoIntentoId}/resultado`}
        tamano="sm"
        variante="secundario"
      >
        Ver resultado
      </EnlaceBoton>
    );
  }

  return null;
}

function Seccion({
  titulo,
  descripcion,
  quices,
}: {
  titulo: string;
  descripcion: string;
  quices: QuizEstudianteDto[];
}) {
  if (quices.length === 0) return null;
  return (
    <Tarjeta titulo={titulo} descripcion={descripcion}>
      <ul className="flex flex-col divide-y divide-slate-100">
        {quices.map((quiz) => (
          <li key={quiz.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{quiz.titulo}</p>
                <Insignia tono={TONO_ESTADO[quiz.estado]}>{ETIQUETA_ESTADO[quiz.estado]}</Insignia>
                {quiz.mejorNota !== null && (
                  <Insignia tono={quiz.aprobada ? 'verde' : 'rojo'}>
                    Mejor nota: {quiz.mejorNota} / {quiz.notaMaxima}
                  </Insignia>
                )}
              </div>
              {quiz.descripcion && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{quiz.descripcion}</p>
              )}
              <DatosQuiz quiz={quiz} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <AccionesQuiz quiz={quiz} />
            </div>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export default async function PaginaQuicesEstudiante() {
  const { usuario } = await requiereRol('STUDENT');
  const quices = await listarQuicesEstudiante(usuario.id);

  const enProgreso = quices.filter((quiz) => quiz.estado === 'EN_PROGRESO');
  const disponibles = quices.filter((quiz) => quiz.estado === 'DISPONIBLE');
  const proximos = quices.filter((quiz) => quiz.estado === 'PROXIMO');
  const completados = quices.filter((quiz) => quiz.estado === 'COMPLETADO');
  const cerrados = quices.filter((quiz) => quiz.estado === 'CERRADO');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mis quices</h1>
        <p className="mt-1 text-sm text-slate-600">
          Aqui ves los quices publicados para tus grupos, con su estado y tus intentos.
        </p>
      </div>

      {quices.length === 0 ? (
        <Vacio mensaje="Todavia no tienes quices asignados. Cuando tu docente publique uno para tu grupo, aparecera aqui." />
      ) : (
        <>
          <Seccion
            titulo="En progreso"
            descripcion="Tienes un intento sin terminar. Reanudalo para continuar donde lo dejaste."
            quices={enProgreso}
          />
          <Seccion
            titulo="Disponibles ahora"
            descripcion="Puedes presentarlos en este momento."
            quices={disponibles}
          />
          <Seccion
            titulo="Proximos"
            descripcion="Se habilitaran en la fecha indicada."
            quices={proximos}
          />
          <Seccion
            titulo="Completados"
            descripcion="Ya usaste todos los intentos permitidos."
            quices={completados}
          />
          <Seccion
            titulo="Cerrados"
            descripcion="Su ventana de disponibilidad termino."
            quices={cerrados}
          />
        </>
      )}

      <p className="text-xs text-slate-500">
        La navegacion y la visibilidad de resultados de cada quiz las define tu docente. Revisa la
        ficha de cada quiz antes de comenzar.{' '}
        <Link href="/panel" className="font-medium text-brand-700 underline">
          Volver al panel
        </Link>
      </p>
    </div>
  );
}
