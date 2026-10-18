import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requiereRol } from '@/lib/auth/guard';
import {
  obtenerIntentoAutorizado,
  resolverTiempos,
  resultadoIntentoDto,
} from '@/lib/intentos/servicio';
import { formatearFechaHora } from '@/lib/formato';
import {
  ETIQUETA_MOTIVO_ENVIO,
  ETIQUETA_TIPO_PREGUNTA,
  etiqueta,
  type MotivoEnvio,
  type TipoPregunta,
} from '@/lib/dominio/constantes';
import { Alerta, EnlaceBoton, Estadistica, Insignia, Tarjeta } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function PaginaResultado({ params }: Props) {
  const { usuario } = await requiereRol('STUDENT');
  const { id } = await params;

  const intento = await obtenerIntentoAutorizado(id, usuario.id);
  const procesado = await resolverTiempos(intento);

  if (procesado.status === 'IN_PROGRESS') {
    redirect(`/estudiante/intentos/${id}`);
  }

  const resultado = resultadoIntentoDto(procesado);
  const anulado = resultado.estado === 'VOIDED';
  const oculto = resultado.mostrar === 'NONE';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          <Link href="/estudiante/quices" className="underline">
            Mis quices
          </Link>{' '}
          / Resultado
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{resultado.tituloQuiz}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {anulado ? 'Intento anulado' : 'Intento enviado'}
          {resultado.enviadoEn ? ` el ${formatearFechaHora(resultado.enviadoEn)}` : ''}
          {resultado.motivo
            ? ` · ${etiqueta(ETIQUETA_MOTIVO_ENVIO, resultado.motivo as MotivoEnvio)}`
            : ''}
        </p>
      </div>

      {anulado && (
        <Alerta tipo="error" titulo="Intento anulado">
          Este intento fue anulado por el docente o por el sistema de seguridad. Consulta con tu
          docente si tienes dudas.
        </Alerta>
      )}

      {oculto && !anulado && (
        <Alerta tipo="info">
          El docente configuro este quiz para no mostrar la calificacion. Tus respuestas ya fueron
          registradas.
        </Alerta>
      )}

      {!oculto && !anulado && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Estadistica
            etiqueta="Puntaje"
            valor={`${resultado.puntaje ?? 0} / ${resultado.puntajeMaximo ?? 0}`}
          />
          <Estadistica etiqueta="Nota" valor={resultado.nota ?? 0} tono="violeta" />
          <Estadistica
            etiqueta="Resultado"
            valor={resultado.aprobada ? 'Aprobado' : 'Reprobado'}
            tono={resultado.aprobada ? 'verde' : 'rojo'}
          />
          <Estadistica etiqueta="Preguntas" valor={resultado.preguntas.length} tono="ambar" />
        </div>
      )}

      {resultado.preguntas.length > 0 && (
        <Tarjeta
          titulo="Detalle de tus respuestas"
          descripcion="Se muestran tu respuesta y la respuesta correcta de cada pregunta."
        >
          <ol className="flex flex-col gap-4">
            {resultado.preguntas.map((pregunta) => (
              <li key={pregunta.preguntaId} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {pregunta.posicion}. {pregunta.enunciado}
                  </p>
                  <Insignia tono={pregunta.correcta ? 'verde' : 'rojo'}>
                    {pregunta.correcta ? 'Correcta' : 'Incorrecta'} · {pregunta.puntosObtenidos}/
                    {pregunta.puntos}
                  </Insignia>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {etiqueta(ETIQUETA_TIPO_PREGUNTA, pregunta.tipo as TipoPregunta)}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tu respuesta
                    </p>
                    {pregunta.tipo === 'SHORT_ANSWER' ? (
                      <p className="mt-1 text-slate-800">
                        {pregunta.textoRespuesta || (
                          <span className="italic text-slate-400">Sin responder</span>
                        )}
                      </p>
                    ) : pregunta.seleccion.length === 0 ? (
                      <p className="mt-1 italic text-slate-400">Sin responder</p>
                    ) : (
                      <ul className="mt-1 list-inside list-disc text-slate-800">
                        {pregunta.seleccion.map((opcion) => (
                          <li key={opcion.id}>{opcion.texto}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Respuesta correcta
                    </p>
                    {pregunta.correctas.length === 0 ? (
                      <p className="mt-1 italic text-slate-400">No disponible</p>
                    ) : (
                      <ul className="mt-1 list-inside list-disc text-emerald-800">
                        {pregunta.correctas.map((opcion) => (
                          <li key={opcion.id}>{opcion.texto}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {pregunta.explicacion && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold">Explicacion: </span>
                    {pregunta.explicacion}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}

      <div className="flex flex-wrap gap-2">
        <EnlaceBoton href="/estudiante/quices">Volver a mis quices</EnlaceBoton>
        <EnlaceBoton href="/panel" variante="secundario">
          Ir al panel
        </EnlaceBoton>
      </div>
    </div>
  );
}
