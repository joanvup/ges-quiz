'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import { formatearReloj } from '@/lib/formato';
import { Alerta, Boton, Insignia, cx } from '@/components/ui';
import type { EstadoIntentoDto, ResumenIntentoDto } from '@/lib/cliente/tipos';
import type { TipoEventoProctor } from '@/lib/dominio/constantes';
import { AvisoModoSeguro, ModoSeguroNoDisponible, useModoSeguro } from './ModoSeguro';

const ETIQUETA_TIPO: Record<string, string> = {
  MCQ_SINGLE: 'Opcion multiple',
  MCQ_MULTI: 'Seleccion multiple',
  TRUE_FALSE: 'Verdadero / Falso',
  SHORT_ANSWER: 'Respuesta corta',
};

type EstadoGuardado = 'guardando' | 'ok' | 'error' | null;

export function MotorIntento({ estadoInicial }: { estadoInicial: EstadoIntentoDto }) {
  const router = useRouter();
  const intentoId = estadoInicial.id;

  const [estado, setEstado] = useState<EstadoIntentoDto>(estadoInicial);
  const [marcaTiempo, setMarcaTiempo] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());

  const preguntaId = estado.pregunta?.id ?? null;
  const [seleccion, setSeleccion] = useState<string[]>(estadoInicial.pregunta?.respuesta.opciones ?? []);
  const [texto, setTexto] = useState(estadoInicial.pregunta?.respuesta.texto ?? '');
  const [guardado, setGuardado] = useState<EstadoGuardado>(null);
  const [accion, setAccion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [resumen, setResumen] = useState<ResumenIntentoDto | null>(null);

  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoRefrescoRef = useRef(0);

  /* --- Sincronizacion del tiempo con el servidor ------------------------- */

  const aplicar = useCallback((nuevo: EstadoIntentoDto) => {
    setEstado(nuevo);
    setMarcaTiempo(Date.now());
    setAhora(Date.now());
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Reinicia la base del temporizador local cuando llega un estado nuevo.
  useEffect(() => {
    setMarcaTiempo(Date.now());
  }, [estado]);

  // Al cambiar de pregunta se recarga la respuesta guardada de esa pregunta.
  useEffect(() => {
    setSeleccion(estado.pregunta?.respuesta.opciones ?? []);
    setTexto(estado.pregunta?.respuesta.texto ?? '');
    setModalAbierto(false);
    setResumen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preguntaId]);

  const transcurrido = (ahora - marcaTiempo) / 1000;
  const restanteTotal =
    estado.segundosRestantes === null ? null : Math.max(0, estado.segundosRestantes - transcurrido);
  const restantePregunta =
    estado.segundosPreguntaRestantes === null
      ? null
      : Math.max(0, estado.segundosPreguntaRestantes - transcurrido);

  // Cuando el intento deja de estar en progreso, se va al resultado.
  useEffect(() => {
    if (estado.estado !== 'IN_PROGRESS') {
      router.push(`/estudiante/intentos/${intentoId}/resultado`);
      router.refresh();
    }
  }, [estado.estado, intentoId, router]);

  const refrescarEstado = useCallback(async () => {
    if (Date.now() - ultimoRefrescoRef.current < 1500) return;
    ultimoRefrescoRef.current = Date.now();
    try {
      const datos = await api.get<{ estado: EstadoIntentoDto }>(`/api/intentos/${intentoId}`);
      aplicar(datos.estado);
    } catch {
      /* se reintentara en el siguiente ciclo del temporizador */
    }
  }, [intentoId, aplicar]);

  const registrarEvento = useCallback(
    async (tipo: TipoEventoProctor, detalle?: string) => {
      try {
        const datos = await api.post<{ estado: EstadoIntentoDto }>(
          `/api/intentos/${intentoId}/eventos`,
          { tipo, detalle: detalle ?? null, clientTs: new Date().toISOString() },
        );
        setEstado(datos.estado);
        setMarcaTiempo(Date.now());
      } catch {
        /* el registro de seguridad no debe interrumpir el intento */
      }
    },
    [intentoId],
  );

  // El servidor manda: al agotarse un tiempo se le pide el estado vigente.
  useEffect(() => {
    if (estado.estado !== 'IN_PROGRESS') return;
    const expiro =
      (restanteTotal !== null && restanteTotal <= 0) ||
      (restantePregunta !== null && restantePregunta <= 0);
    if (expiro) void refrescarEstado();
  }, [restanteTotal, restantePregunta, estado.estado, refrescarEstado]);

  /* --- Autoguardado ------------------------------------------------------ */

  const enviarRespuesta = useCallback(
    async (pid: string, opciones: string[], textoValor: string) => {
      setGuardado('guardando');
      try {
        const datos = await api.post<{ estado: EstadoIntentoDto; guardada: boolean }>(
          `/api/intentos/${intentoId}/respuesta`,
          { preguntaId: pid, opciones, texto: textoValor.trim() || null },
        );
        setGuardado('ok');
        setEstado(datos.estado);
        setMarcaTiempo(Date.now());
      } catch {
        setGuardado('error');
      }
    },
    [intentoId],
  );

  const agendarGuardado = useCallback(
    (opciones: string[], textoValor: string) => {
      if (!preguntaId) return;
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      temporizadorRef.current = setTimeout(() => {
        void enviarRespuesta(preguntaId, opciones, textoValor);
      }, 600);
    },
    [preguntaId, enviarRespuesta],
  );

  const volcarGuardado = useCallback(async () => {
    if (temporizadorRef.current) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    if (preguntaId) await enviarRespuesta(preguntaId, seleccion, texto);
  }, [preguntaId, seleccion, texto, enviarRespuesta]);

  useEffect(() => {
    const antesDeSalir = (evento: BeforeUnloadEvent) => {
      if (estado.estado !== 'IN_PROGRESS') return;
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', antesDeSalir);
    return () => window.removeEventListener('beforeunload', antesDeSalir);
  }, [estado.estado]);

  /* --- Navegacion -------------------------------------------------------- */

  async function ejecutar(operacion: () => Promise<void>) {
    setError(null);
    setAccion(true);
    try {
      await operacion();
    } catch (fallo) {
      setError(fallo instanceof ErrorPeticion ? fallo.message : 'Ocurrio un error. Intenta de nuevo.');
    } finally {
      setAccion(false);
    }
  }

  async function avanzar() {
    await ejecutar(async () => {
      await volcarGuardado();
      const datos = await api.post<{ estado: EstadoIntentoDto }>(
        `/api/intentos/${intentoId}/avanzar`,
        {},
      );
      aplicar(datos.estado);
    });
  }

  async function retroceder() {
    await ejecutar(async () => {
      await volcarGuardado();
      const datos = await api.post<{ estado: EstadoIntentoDto }>(
        `/api/intentos/${intentoId}/retroceder`,
        {},
      );
      aplicar(datos.estado);
    });
  }

  async function abrirConfirmacion() {
    setError(null);
    setModalAbierto(true);
    try {
      const datos = await api.get<{ resumen: ResumenIntentoDto }>(
        `/api/intentos/${intentoId}/resumen`,
      );
      setResumen(datos.resumen);
    } catch {
      setResumen(null);
    }
  }

  async function entregar() {
    await ejecutar(async () => {
      await volcarGuardado();
      const datos = await api.post<{ estado: EstadoIntentoDto }>(
        `/api/intentos/${intentoId}/entregar`,
        { confirmado: true },
      );
      aplicar(datos.estado);
    });
  }

  /* --- Interacciones ----------------------------------------------------- */

  const multiple = estado.pregunta?.tipo === 'MCQ_MULTI';

  function alternarOpcion(opcionId: string) {
    let nueva: string[];
    if (multiple) {
      nueva = seleccion.includes(opcionId)
        ? seleccion.filter((id) => id !== opcionId)
        : [...seleccion, opcionId];
    } else {
      nueva = [opcionId];
    }
    setSeleccion(nueva);
    agendarGuardado(nueva, texto);
  }

  function cambiarTexto(valor: string) {
    setTexto(valor);
    agendarGuardado(seleccion, valor);
  }

  const porcentaje = estado.total > 0 ? Math.round(((estado.posicion + 1) / estado.total) * 100) : 0;
  const avisoPocoTiempo = useMemo(
    () =>
      (restanteTotal !== null && restanteTotal <= 60) ||
      (restantePregunta !== null && restantePregunta <= 15),
    [restanteTotal, restantePregunta],
  );

  const modoSeguro = useModoSeguro({
    activo: estado.modoSeguro,
    bloquearSinSoporte: estado.bloquearSinPantallaCompleta,
    onEvento: registrarEvento,
  });

  if (modoSeguro.bloqueado) {
    return <ModoSeguroNoDisponible />;
  }

  if (!estado.pregunta) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tipo="aviso">Este quiz no tiene preguntas disponibles.</Alerta>
        <Boton onClick={() => void entregar()} disabled={accion}>
          Enviar intento
        </Boton>
      </div>
    );
  }

  const esUltima = estado.esUltima;

  return (
    <div className={cx('flex flex-col gap-4', modoSeguro.activo && 'select-none')}>
      <AvisoModoSeguro modo={modoSeguro} />
      {/* Encabezado con progreso y temporizadores */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">{estado.tituloQuiz}</h1>
            <p className="text-xs text-slate-500">
              Pregunta {estado.posicion + 1} de {estado.total} · {estado.respondidas} respondida(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {estado.modoSeguro && <Insignia tono="ambar">Modo seguro</Insignia>}
            {restanteTotal !== null && (
              <div
                className={
                  avisoPocoTiempo
                    ? 'rounded-lg bg-red-50 px-3 py-1.5 text-center'
                    : 'rounded-lg bg-slate-100 px-3 py-1.5 text-center'
                }
                aria-live="polite"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Tiempo restante
                </p>
                <p
                  className={
                    avisoPocoTiempo
                      ? 'font-mono text-lg font-bold text-red-700'
                      : 'font-mono text-lg font-bold text-slate-800'
                  }
                >
                  {formatearReloj(restanteTotal)}
                </p>
              </div>
            )}
            {restantePregunta !== null && (
              <div
                className={
                  avisoPocoTiempo
                    ? 'rounded-lg bg-red-50 px-3 py-1.5 text-center'
                    : 'rounded-lg bg-slate-100 px-3 py-1.5 text-center'
                }
                aria-live="polite"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Esta pregunta
                </p>
                <p
                  className={
                    avisoPocoTiempo
                      ? 'font-mono text-lg font-bold text-red-700'
                      : 'font-mono text-lg font-bold text-slate-800'
                  }
                >
                  {formatearReloj(restantePregunta)}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${porcentaje}%` }}
            role="progressbar"
            aria-valuenow={estado.posicion + 1}
            aria-valuemin={1}
            aria-valuemax={estado.total}
          />
        </div>
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}

      {/* Pregunta */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <legend className="sr-only">Pregunta {estado.posicion + 1}</legend>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Insignia tono="azul">{ETIQUETA_TIPO[estado.pregunta.tipo] ?? estado.pregunta.tipo}</Insignia>
          <span className="text-xs text-slate-500">
            {estado.pregunta.puntos} punto(s)
            {estado.pregunta.tema ? ` · ${estado.pregunta.tema}` : ''}
          </span>
        </div>
        <p className="text-base font-medium text-slate-900">{estado.pregunta.enunciado}</p>
        <p className="mt-1 text-xs text-slate-500">{estado.pregunta.ayuda}</p>

        {estado.pregunta.tipo === 'SHORT_ANSWER' ? (
          <div className="mt-4">
            <label htmlFor="respuesta-corta" className="sr-only">
              Tu respuesta
            </label>
            <textarea
              id="respuesta-corta"
              value={texto}
              onChange={(evento) => cambiarTexto(evento.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full min-h-[110px] rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-brand-500 sm:text-sm"
              placeholder="Escribe tu respuesta..."
            />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {estado.pregunta.opciones.map((opcion) => {
              const activa = seleccion.includes(opcion.id);
              return (
                <li key={opcion.id}>
                  <label
                    className={
                      activa
                        ? 'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border-2 border-brand-500 bg-brand-50 p-3.5'
                        : 'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3.5 hover:bg-slate-50'
                    }
                  >
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name="opcion"
                      checked={activa}
                      onChange={() => alternarOpcion(opcion.id)}
                      className={
                        multiple
                          ? 'mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500'
                          : 'mt-0.5 h-5 w-5 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500'
                      }
                    />
                    <span className="flex items-start gap-2">
                      <span className="font-semibold text-slate-500">{opcion.etiqueta}.</span>
                      <span className="text-sm text-slate-800">{opcion.texto}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* Pie con acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500" role="status">
          {guardado === 'guardando' && 'Guardando...'}
          {guardado === 'ok' && 'Respuesta guardada.'}
          {guardado === 'error' && (
            <span className="font-medium text-red-600">
              No se pudo guardar. Revisa tu conexion.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estado.navegacion === 'FREE' && (
            <Boton variante="secundario" onClick={() => void retroceder()} disabled={!estado.puedeRetroceder || accion}>
              Anterior
            </Boton>
          )}
          {esUltima ? (
            <Boton variante="exito" onClick={() => void abrirConfirmacion()} disabled={accion}>
              {estado.permitirRevision ? 'Revisar y enviar' : 'Enviar intento'}
            </Boton>
          ) : (
            <Boton onClick={() => void avanzar()} disabled={accion}>
              {accion ? 'Guardando...' : 'Siguiente'}
            </Boton>
          )}
        </div>
      </div>

      {/* Confirmacion de envio */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmacion"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 id="titulo-confirmacion" className="text-lg font-semibold text-slate-900">
              {estado.permitirRevision ? 'Revision final' : 'Confirmar envio'}
            </h2>
            {resumen ? (
              <p className="mt-1 text-sm text-slate-600">
                Has respondido {resumen.respondidas} de {resumen.total} preguntas.
                {resumen.respondidas < resumen.total && (
                  <span className="font-medium text-amber-700">
                    {' '}
                    Quedan {resumen.total - resumen.respondidas} sin responder.
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Cargando resumen...</p>
            )}

            {estado.permitirRevision && resumen && (
              <ul className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {resumen.preguntas.map((pregunta) => (
                  <li
                    key={pregunta.posicion}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-slate-700">
                      {pregunta.posicion}. {pregunta.enunciado}
                    </span>
                    <Insignia tono={pregunta.respondida ? 'verde' : 'ambar'}>
                      {pregunta.respondida ? 'Respondida' : 'Sin responder'}
                    </Insignia>
                  </li>
                ))}
              </ul>
            )}

            <Alerta tipo="aviso">
              Una vez enviado no podras cambiar tus respuestas. El quiz se califica en el servidor.
            </Alerta>

            <div className="mt-4 flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => setModalAbierto(false)} disabled={accion}>
                {estado.permitirRevision ? 'Seguir respondiendo' : 'Cancelar'}
              </Boton>
              <Boton variante="exito" onClick={() => void entregar()} disabled={accion}>
                {accion ? 'Enviando...' : 'Confirmar y enviar'}
              </Boton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
