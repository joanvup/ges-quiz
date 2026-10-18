'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type {
  GrupoQuizDto,
  PreguntaDto,
  PreguntaQuizDto,
  QuizDetalleDto,
} from '@/lib/cliente/tipos';
import { formatearDuracion, formatearFecha } from '@/lib/cliente/formato';
import {
  Alerta,
  AreaTexto,
  Boton,
  Campo,
  Casilla,
  Entrada,
  EnlaceBoton,
  Insignia,
  Selector,
  Tarjeta,
  Vacio,
  cx,
} from '@/components/ui';
import { BotonEliminarQuiz } from '../BotonEliminarQuiz';
import {
  ACCIONES_INFRACCION,
  ETIQUETA_ACCION_INFRACCION,
  ETIQUETA_DIFICULTAD,
  ETIQUETA_ESTADO_QUIZ,
  ETIQUETA_MODO_NAVEGACION,
  ETIQUETA_MODO_RESULTADO,
  ETIQUETA_TIPO_PREGUNTA,
  MODOS_NAVEGACION,
  MODOS_RESULTADO,
  TIPOS_PREGUNTA,
  type AccionInfraccion,
  type Dificultad,
  type EstadoQuiz,
  type ModoNavegacion,
  type ModoResultado,
  type TipoPregunta,
} from '@/lib/dominio/constantes';

/* ------------------------------------------------------------------ *
 * Tipos auxiliares
 * ------------------------------------------------------------------ */

type PreguntaVista = {
  id: string;
  tipo: string;
  enunciado: string;
  explicacion: string | null;
  dificultad: string;
  estado: string;
  respuestaPendiente: boolean;
  banco: { id: string; titulo: string } | null;
  opciones: { id: string; etiqueta: string; texto: string; correcta: boolean }[];
};

type Formulario = {
  titulo: string;
  descripcion: string;
  grupoIds: string[];
  fechaDesde: string;
  fechaHasta: string;
  navegacion: ModoNavegacion;
  tiempoTotalMin: string;
  tiempoPorPregunta: string;
  mezclarPreguntas: boolean;
  mezclarOpciones: boolean;
  intentosMaximos: number;
  cantidadPreguntas: string;
  puntosPorDefecto: number;
  notaAprobacion: number;
  notaMaxima: number;
  mostrarResultados: ModoResultado;
  permitirRevision: boolean;
  modoSeguro: boolean;
  umbralInfracciones: number;
  accionInfraccion: AccionInfraccion;
  bloquearSinPantallaCompleta: boolean;
};

type Seleccion = { id: string; puntos: number };

const ETIQUETA_ESTADO_PREGUNTA: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'Pendiente de revision',
  APPROVED: 'Aprobada',
};

function aFechaInput(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(
    fecha.getHours(),
  )}:${dos(fecha.getMinutes())}`;
}

function formularioDesde(quiz: QuizDetalleDto): Formulario {
  return {
    titulo: quiz.titulo,
    descripcion: quiz.descripcion ?? '',
    grupoIds: quiz.grupos.map((grupo) => grupo.id),
    fechaDesde: aFechaInput(quiz.disponibleDesde),
    fechaHasta: aFechaInput(quiz.disponibleHasta),
    navegacion: quiz.navegacion as ModoNavegacion,
    tiempoTotalMin: quiz.tiempoTotalSeg ? String(Math.round(quiz.tiempoTotalSeg / 60)) : '',
    tiempoPorPregunta: quiz.tiempoPorPreguntaSeg ? String(quiz.tiempoPorPreguntaSeg) : '',
    mezclarPreguntas: quiz.mezclarPreguntas,
    mezclarOpciones: quiz.mezclarOpciones,
    intentosMaximos: quiz.intentosMaximos,
    cantidadPreguntas: quiz.cantidadPreguntas ? String(quiz.cantidadPreguntas) : '',
    puntosPorDefecto: quiz.puntosPorDefecto,
    notaAprobacion: quiz.notaAprobacion,
    notaMaxima: quiz.notaMaxima,
    mostrarResultados: quiz.mostrarResultados as ModoResultado,
    permitirRevision: quiz.permitirRevision,
    modoSeguro: quiz.modoSeguro,
    umbralInfracciones: quiz.umbralInfracciones,
    accionInfraccion: quiz.accionInfraccion as AccionInfraccion,
    bloquearSinPantallaCompleta: quiz.bloquearSinPantallaCompleta,
  };
}

function seleccionDesde(quiz: QuizDetalleDto): Seleccion[] {
  return quiz.preguntas.map((pregunta) => ({
    id: pregunta.preguntaId,
    puntos: pregunta.puntos,
  }));
}

function preguntaDesdeDto(pregunta: PreguntaDto): PreguntaVista {
  return {
    id: pregunta.id,
    tipo: pregunta.tipo,
    enunciado: pregunta.enunciado,
    explicacion: pregunta.explicacion,
    dificultad: pregunta.dificultad,
    estado: pregunta.estado,
    respuestaPendiente: pregunta.respuestaPendiente,
    banco: pregunta.documento,
    opciones: pregunta.opciones.map((opcion) => ({
      id: opcion.id,
      etiqueta: opcion.etiqueta,
      texto: opcion.texto,
      correcta: opcion.correcta,
    })),
  };
}

function preguntaDesdeQuiz(pregunta: PreguntaQuizDto): PreguntaVista {
  return {
    id: pregunta.preguntaId,
    tipo: pregunta.tipo,
    enunciado: pregunta.enunciado,
    explicacion: pregunta.explicacion,
    dificultad: pregunta.dificultad,
    estado: pregunta.estado,
    respuestaPendiente: pregunta.respuestaPendiente,
    banco: pregunta.documento,
    opciones: pregunta.opciones,
  };
}

const TONO_ESTADO: Record<string, 'gris' | 'verde' | 'azul'> = {
  DRAFT: 'gris',
  PUBLISHED: 'verde',
  CLOSED: 'azul',
};

/* ------------------------------------------------------------------ *
 * Editor
 * ------------------------------------------------------------------ */

export function EditorQuiz({
  inicial,
  banco,
  grupos,
}: {
  inicial: QuizDetalleDto;
  banco: PreguntaDto[];
  grupos: GrupoQuizDto[];
}) {
  const [quiz, setQuiz] = useState(inicial);
  const [form, setForm] = useState<Formulario>(() => formularioDesde(inicial));
  const [seleccionadas, setSeleccionadas] = useState<Seleccion[]>(() => seleccionDesde(inicial));
  const [tab, setTab] = useState<'configuracion' | 'preguntas' | 'revision'>('configuracion');
  const [sucio, setSucio] = useState(false);
  const [preguntasSucias, setPreguntasSucias] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'aviso'; texto: string } | null>(
    null,
  );
  const [confirmoRevision, setConfirmoRevision] = useState(false);
  const [mostrarBanco, setMostrarBanco] = useState(false);
  const [buscarBanco, setBuscarBanco] = useState('');
  const [tipoBanco, setTipoBanco] = useState<'TODOS' | TipoPregunta>('TODOS');
  const [bancoSeleccionado, setBancoSeleccionado] = useState<string>('TODOS');
  const [expandida, setExpandida] = useState<string | null>(null);
  const router = useRouter();

  const bloqueado = quiz.estado === 'CLOSED';
  const intentosRegistrados = quiz.intentos > 0;

  const mapaPreguntas = useMemo(() => {
    const mapa = new Map<string, PreguntaVista>();
    for (const pregunta of banco) mapa.set(pregunta.id, preguntaDesdeDto(pregunta));
    for (const pregunta of quiz.preguntas) mapa.set(pregunta.preguntaId, preguntaDesdeQuiz(pregunta));
    return mapa;
  }, [banco, quiz.preguntas]);

  const seleccionDetalle = useMemo(
    () =>
      seleccionadas.map((seleccion, indice) => ({
        ...seleccion,
        posicion: indice + 1,
        datos: mapaPreguntas.get(seleccion.id),
      })),
    [seleccionadas, mapaPreguntas],
  );

  const totalPuntos = useMemo(
    () => seleccionadas.reduce((suma, pregunta) => suma + (Number(pregunta.puntos) || 0), 0),
    [seleccionadas],
  );

  // Cada documento (PDF) es un banco de preguntas; las creadas a mano sin
  // documento se agrupan en un banco "general".
  const bancos = useMemo(() => {
    const mapa = new Map<string, { clave: string; titulo: string; total: number }>();
    for (const pregunta of banco) {
      const clave = pregunta.documento?.id ?? 'GENERAL';
      const titulo = pregunta.documento?.titulo ?? 'Sin documento (manuales)';
      const entrada = mapa.get(clave);
      if (entrada) entrada.total += 1;
      else mapa.set(clave, { clave, titulo, total: 1 });
    }
    return Array.from(mapa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [banco]);

  const bancoFiltrado = useMemo(() => {
    const termino = buscarBanco.trim().toLowerCase();
    return banco
      .map(preguntaDesdeDto)
      .filter((pregunta) => {
        if (bancoSeleccionado !== 'TODOS') {
          const clave = pregunta.banco?.id ?? 'GENERAL';
          if (clave !== bancoSeleccionado) return false;
        }
        if (tipoBanco !== 'TODOS' && pregunta.tipo !== tipoBanco) return false;
        if (termino && !pregunta.enunciado.toLowerCase().includes(termino)) return false;
        return true;
      })
      .sort((a, b) => a.enunciado.localeCompare(b.enunciado, 'es'));
  }, [banco, buscarBanco, tipoBanco, bancoSeleccionado]);

  const porAgregar = useMemo(
    () => bancoFiltrado.filter((pregunta) => !seleccionadas.some((seleccion) => seleccion.id === pregunta.id)),
    [bancoFiltrado, seleccionadas],
  );

  const revisionLocal = useMemo(() => {
    const errores: string[] = [];
    const advertencias: string[] = [];

    if (form.titulo.trim().length < 5) {
      errores.push('El titulo debe tener al menos 5 caracteres.');
    }
    if (form.grupoIds.length === 0) {
      errores.push('Asigna el quiz a por lo menos un grupo.');
    }
    if (seleccionadas.length === 0) {
      errores.push('Agrega al menos una pregunta.');
    }

    const sinRespuesta = seleccionadas.filter((seleccion) => {
      const pregunta = mapaPreguntas.get(seleccion.id);
      if (!pregunta) return true;
      return pregunta.respuestaPendiente || !pregunta.opciones.some((opcion) => opcion.correcta);
    });
    if (sinRespuesta.length > 0) {
      errores.push(
        `${sinRespuesta.length} pregunta(s) no tienen una respuesta correcta confirmada.`,
      );
    }

    if (Number(form.notaAprobacion) > Number(form.notaMaxima)) {
      errores.push('La nota minima de aprobacion no puede superar la nota maxima.');
    }

    if (form.fechaDesde && form.fechaHasta) {
      const desde = new Date(form.fechaDesde);
      const hasta = new Date(form.fechaHasta);
      if (hasta <= desde) {
        errores.push('La fecha de cierre debe ser posterior a la fecha de apertura.');
      }
      if (hasta.getTime() <= Date.now()) {
        errores.push('La fecha de cierre ya paso.');
      }
    }

    if (form.cantidadPreguntas && Number(form.cantidadPreguntas) > seleccionadas.length) {
      errores.push(
        `Se piden ${form.cantidadPreguntas} preguntas por intento pero solo hay ${seleccionadas.length}.`,
      );
    }

    const pendientes = seleccionadas.filter(
      (seleccion) => mapaPreguntas.get(seleccion.id)?.estado === 'PENDING_REVIEW',
    ).length;
    if (pendientes > 0) {
      advertencias.push(
        `${pendientes} pregunta(s) estan pendientes de revision. Al publicar quedaran aprobadas.`,
      );
    }

    return { errores, advertencias };
  }, [form, seleccionadas, mapaPreguntas]);

  function actualizar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setSucio(true);
  }

  function alternarGrupo(id: string, activo: boolean) {
    actualizar(
      'grupoIds',
      activo ? Array.from(new Set([...form.grupoIds, id])) : form.grupoIds.filter((g) => g !== id),
    );
  }

  function agregarPregunta(id: string) {
    if (seleccionadas.some((seleccion) => seleccion.id === id)) return;
    setSeleccionadas((actual) => [...actual, { id, puntos: Number(form.puntosPorDefecto) || 1 }]);
    setPreguntasSucias(true);
    setSucio(true);
  }

  /** Agrega de una sola vez todas las preguntas visibles que aun no estan en el quiz. */
  function agregarTodasDelBanco() {
    const nuevas = porAgregar.map((pregunta) => pregunta.id);
    if (nuevas.length === 0) return;
    setSeleccionadas((actual) => [
      ...actual,
      ...nuevas.map((id) => ({ id, puntos: Number(form.puntosPorDefecto) || 1 })),
    ]);
    setPreguntasSucias(true);
    setSucio(true);
  }

  function quitarPregunta(id: string) {
    setSeleccionadas((actual) => actual.filter((seleccion) => seleccion.id !== id));
    setPreguntasSucias(true);
    setSucio(true);
  }

  function moverPregunta(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= seleccionadas.length) return;
    const copia = [...seleccionadas];
    const [movida] = copia.splice(indice, 1);
    copia.splice(destino, 0, movida!);
    setSeleccionadas(copia);
    setPreguntasSucias(true);
    setSucio(true);
  }

  function cambiarPuntos(id: string, valor: number) {
    setSeleccionadas((actual) =>
      actual.map((seleccion) =>
        seleccion.id === id ? { ...seleccion, puntos: Math.max(0.1, Number(valor) || 0.1) } : seleccion,
      ),
    );
    setPreguntasSucias(true);
    setSucio(true);
  }

  function construirPayload() {
    return {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      grupoIds: form.grupoIds,
      fechaDisponibleDesde: form.fechaDesde ? new Date(form.fechaDesde).toISOString() : null,
      fechaDisponibleHasta: form.fechaHasta ? new Date(form.fechaHasta).toISOString() : null,
      navegacion: form.navegacion,
      tiempoTotalSeg: form.tiempoTotalMin ? Math.round(Number(form.tiempoTotalMin) * 60) : null,
      tiempoPorPreguntaSeg: form.tiempoPorPregunta ? Math.round(Number(form.tiempoPorPregunta)) : null,
      mezclarPreguntas: form.mezclarPreguntas,
      mezclarOpciones: form.mezclarOpciones,
      intentosMaximos: Number(form.intentosMaximos),
      cantidadPreguntas: form.cantidadPreguntas ? Number(form.cantidadPreguntas) : null,
      puntosPorDefecto: Number(form.puntosPorDefecto),
      notaAprobacion: Number(form.notaAprobacion),
      notaMaxima: Number(form.notaMaxima),
      mostrarResultados: form.mostrarResultados,
      permitirRevision: form.permitirRevision,
      modoSeguro: form.modoSeguro,
      umbralInfracciones: Number(form.umbralInfracciones),
      accionInfraccion: form.accionInfraccion,
      bloquearSinPantallaCompleta: form.bloquearSinPantallaCompleta,
    };
  }

  function aplicarRespuesta(actualizado: QuizDetalleDto) {
    setQuiz(actualizado);
    setForm(formularioDesde(actualizado));
    setSeleccionadas(seleccionDesde(actualizado));
    setSucio(false);
    setPreguntasSucias(false);
  }

  async function guardar(mostrarMensaje = true): Promise<boolean> {
    setGuardando(true);
    setMensaje(null);
    try {
      let respuesta = await api.patch<{ quiz: QuizDetalleDto }>(
        `/api/quices/${quiz.id}`,
        construirPayload(),
      );

      if (preguntasSucias) {
        respuesta = await api.put<{ quiz: QuizDetalleDto }>(`/api/quices/${quiz.id}/preguntas`, {
          preguntas: seleccionadas.map((seleccion) => ({
            id: seleccion.id,
            puntos: Number(seleccion.puntos),
          })),
        });
      }

      aplicarRespuesta(respuesta.quiz);
      if (mostrarMensaje) {
        setMensaje({ tipo: 'exito', texto: 'Cambios guardados correctamente.' });
      }
      return true;
    } catch (fallo) {
      const detalle = fallo instanceof ErrorPeticion ? fallo.campos : null;
      const campos = detalle && typeof detalle === 'object' ? Object.values(detalle).flat() : [];
      setMensaje({
        tipo: 'error',
        texto:
          fallo instanceof ErrorPeticion
            ? [fallo.message, ...campos.filter((valor) => typeof valor === 'string')].join(' ')
            : 'No se pudieron guardar los cambios.',
      });
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function publicar() {
    setPublicando(true);
    setMensaje(null);
    try {
      if (sucio || preguntasSucias) {
        const guardado = await guardar(false);
        if (!guardado) return;
      }
      const respuesta = await api.post<{ quiz: QuizDetalleDto }>(
        `/api/quices/${quiz.id}/publicar`,
        { confirmoRevision: true },
      );
      aplicarRespuesta(respuesta.quiz);
      setConfirmoRevision(false);
      setMensaje({
        tipo: 'exito',
        texto: 'Quiz publicado. Ya esta disponible para los grupos asignados.',
      });
    } catch (fallo) {
      const detalle =
        fallo instanceof ErrorPeticion
          ? (fallo.campos as unknown as { errores?: string[]; advertencias?: string[] } | undefined)
          : undefined;
      const errores = detalle?.errores ?? [];
      setMensaje({
        tipo: 'error',
        texto:
          errores.length > 0
            ? `${fallo instanceof ErrorPeticion ? fallo.message : 'No se pudo publicar.'} ${errores.join(' ')}`
            : fallo instanceof ErrorPeticion
              ? fallo.message
              : 'No se pudo publicar el quiz.',
      });
    } finally {
      setPublicando(false);
    }
  }

  async function cerrar() {
    if (!window.confirm('¿Cerrar este quiz? Los estudiantes ya no podran iniciar nuevos intentos.')) {
      return;
    }
    setCerrando(true);
    setMensaje(null);
    try {
      const respuesta = await api.post<{ quiz: QuizDetalleDto }>(`/api/quices/${quiz.id}/cerrar`);
      aplicarRespuesta(respuesta.quiz);
      setMensaje({ tipo: 'aviso', texto: 'El quiz quedo cerrado.' });
    } catch (fallo) {
      setMensaje({
        tipo: 'error',
        texto: fallo instanceof ErrorPeticion ? fallo.message : 'No se pudo cerrar el quiz.',
      });
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link href="/docentes/quices" className="hover:text-brand-700">
              Quices
            </Link>{' '}
            / Editor
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{quiz.titulo}</h1>
            <Insignia tono={TONO_ESTADO[quiz.estado] ?? 'gris'}>
              {ETIQUETA_ESTADO_QUIZ[quiz.estado as EstadoQuiz] ?? quiz.estado}
            </Insignia>
            {sucio && <Insignia tono="ambar">cambios sin guardar</Insignia>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {quiz.totalPreguntas} pregunta(s) · {totalPuntos} punto(s) ·{' '}
            {form.grupoIds.length} grupo(s) asignado(s) · {quiz.intentos} intento(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnlaceBoton
            href={`/reportes/quices/${quiz.id}`}
            variante="secundario"
            tamano="sm"
          >
            Reporte
          </EnlaceBoton>
          <EnlaceBoton
            href={`/docentes/quices/${quiz.id}/intentos`}
            variante="secundario"
            tamano="sm"
          >
            Intentos e infracciones
          </EnlaceBoton>
          <EnlaceBoton
            href={`/docentes/quices/${quiz.id}/vista-previa`}
            variante="secundario"
            tamano="sm"
          >
            Vista previa
          </EnlaceBoton>
          {quiz.estado !== 'CLOSED' && (
            <Boton
              tamano="sm"
              onClick={() => void guardar()}
              disabled={guardando || (!sucio && !preguntasSucias)}
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </Boton>
          )}
          <BotonEliminarQuiz
            quizId={quiz.id}
            titulo={quiz.titulo}
            intentos={quiz.intentos}
            alEliminar={() => router.push('/docentes/quices')}
          />
        </div>
      </div>

      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      {quiz.estado === 'PUBLISHED' && (
        <Alerta tipo="exito" titulo="Quiz publicado">
          Publicado el {formatearFecha(quiz.publicadoEn)} — los estudiantes de los grupos asignados ya
          pueden presentarlo dentro de la ventana de disponibilidad.
        </Alerta>
      )}
      {quiz.estado === 'CLOSED' && (
        <Alerta tipo="aviso" titulo="Quiz cerrado">
          Este quiz es de solo lectura. Puedes consultar la configuracion y la vista previa.
        </Alerta>
      )}
      {intentosRegistrados && (
        <Alerta tipo="aviso">
          El quiz ya tiene intentos de estudiantes. Las preguntas no se pueden modificar; la
          configuracion general si puede ajustarse.
        </Alerta>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="Secciones del quiz">
        {[
          { clave: 'configuracion' as const, etiqueta: 'Configuracion' },
          { clave: 'preguntas' as const, etiqueta: `Preguntas (${seleccionadas.length})` },
          { clave: 'revision' as const, etiqueta: 'Revision y publicacion' },
        ].map((item) => (
          <button
            key={item.clave}
            type="button"
            onClick={() => setTab(item.clave)}
            className={cx(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              tab === item.clave
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
            aria-current={tab === item.clave ? 'page' : undefined}
          >
            {item.etiqueta}
          </button>
        ))}
      </nav>

      {tab === 'configuracion' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Datos generales">
            <div className="flex flex-col gap-4">
              <Campo etiqueta="Titulo" requerido htmlFor="quiz-titulo">
                <Entrada
                  id="quiz-titulo"
                  value={form.titulo}
                  disabled={bloqueado}
                  maxLength={160}
                  onChange={(evento) => actualizar('titulo', evento.target.value)}
                />
              </Campo>
              <Campo etiqueta="Descripcion" htmlFor="quiz-descripcion">
                <AreaTexto
                  id="quiz-descripcion"
                  value={form.descripcion}
                  disabled={bloqueado}
                  maxLength={3000}
                  onChange={(evento) => actualizar('descripcion', evento.target.value)}
                />
              </Campo>
              <Campo
                etiqueta="Ventana de disponibilidad"
                ayuda="Si dejas las fechas vacias, el quiz estara disponible desde que se publique y sin fecha de cierre."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Abre" htmlFor="quiz-desde">
                    <Entrada
                      id="quiz-desde"
                      type="datetime-local"
                      value={form.fechaDesde}
                      disabled={bloqueado}
                      onChange={(evento) => actualizar('fechaDesde', evento.target.value)}
                    />
                  </Campo>
                  <Campo etiqueta="Cierra" htmlFor="quiz-hasta">
                    <Entrada
                      id="quiz-hasta"
                      type="datetime-local"
                      value={form.fechaHasta}
                      disabled={bloqueado}
                      onChange={(evento) => actualizar('fechaHasta', evento.target.value)}
                    />
                  </Campo>
                </div>
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Grupos asignados" descripcion="Solo estos grupos podran presentar el quiz.">
            {grupos.length === 0 ? (
              <Vacio mensaje="No hay grupos creados. Un administrador debe crear grupos y estudiantes." />
            ) : (
              <div className="flex flex-col gap-2">
                {grupos.map((grupo) => (
                  <Casilla
                    key={grupo.id}
                    etiqueta={`${grupo.nombre}${grupo.grado ? ` (grado ${grupo.grado})` : ''}`}
                    descripcion={`${grupo.miembros} estudiante(s) · ano ${grupo.anio}`}
                    checked={form.grupoIds.includes(grupo.id)}
                    disabled={bloqueado}
                    onChange={(evento) => alternarGrupo(grupo.id, evento.target.checked)}
                  />
                ))}
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Navegacion y tiempo">
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-slate-700">Navegacion</legend>
                {MODOS_NAVEGACION.map((modo) => (
                  <label
                    key={modo}
                    className={cx(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                      form.navegacion === modo
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="quiz-navegacion"
                      className="mt-1"
                      value={modo}
                      checked={form.navegacion === modo}
                      disabled={bloqueado}
                      onChange={() => actualizar('navegacion', modo)}
                    />
                    <span className="text-sm text-slate-800">{ETIQUETA_MODO_NAVEGACION[modo]}</span>
                  </label>
                ))}
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  etiqueta="Tiempo total (minutos)"
                  ayuda="Vacio = sin limite total."
                  htmlFor="quiz-tiempo-total"
                >
                  <Entrada
                    id="quiz-tiempo-total"
                    type="number"
                    min={1}
                    max={1440}
                    value={form.tiempoTotalMin}
                    disabled={bloqueado}
                    onChange={(evento) => actualizar('tiempoTotalMin', evento.target.value)}
                  />
                </Campo>
                <Campo
                  etiqueta="Tiempo por pregunta (segundos)"
                  ayuda="Vacio = sin limite por pregunta."
                  htmlFor="quiz-tiempo-pregunta"
                >
                  <Entrada
                    id="quiz-tiempo-pregunta"
                    type="number"
                    min={5}
                    max={3600}
                    value={form.tiempoPorPregunta}
                    disabled={bloqueado}
                    onChange={(evento) => actualizar('tiempoPorPregunta', evento.target.value)}
                  />
                </Campo>
              </div>
              {form.navegacion === 'FORWARD_ONLY' && (
                <Alerta tipo="info">
                  En modo solo hacia adelante el servidor rechaza cualquier intento de volver a una
                  pregunta anterior, aunque el estudiante manipule el navegador.
                </Alerta>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Aleatorizacion e intentos">
            <div className="flex flex-col gap-4">
              <Casilla
                etiqueta="Mezclar el orden de las preguntas"
                descripcion="Cada intento recibe un orden distinto."
                checked={form.mezclarPreguntas}
                disabled={bloqueado}
                onChange={(evento) => actualizar('mezclarPreguntas', evento.target.checked)}
              />
              <Casilla
                etiqueta="Mezclar el orden de las opciones"
                descripcion="Se aplica a preguntas de opcion multiple y verdadero/falso."
                checked={form.mezclarOpciones}
                disabled={bloqueado}
                onChange={(evento) => actualizar('mezclarOpciones', evento.target.checked)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Intentos permitidos" htmlFor="quiz-intentos">
                  <Entrada
                    id="quiz-intentos"
                    type="number"
                    min={1}
                    max={10}
                    value={form.intentosMaximos}
                    disabled={bloqueado}
                    onChange={(evento) =>
                      actualizar('intentosMaximos', Math.max(1, Number(evento.target.value) || 1))
                    }
                  />
                </Campo>
                <Campo
                  etiqueta="Preguntas por intento"
                  ayuda={`Vacio = todas (${seleccionadas.length}).`}
                  htmlFor="quiz-cantidad"
                >
                  <Entrada
                    id="quiz-cantidad"
                    type="number"
                    min={1}
                    max={300}
                    value={form.cantidadPreguntas}
                    disabled={bloqueado}
                    onChange={(evento) => actualizar('cantidadPreguntas', evento.target.value)}
                  />
                </Campo>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Calificacion y resultados">
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo etiqueta="Puntos por defecto" htmlFor="quiz-puntos">
                  <Entrada
                    id="quiz-puntos"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={form.puntosPorDefecto}
                    disabled={bloqueado}
                    onChange={(evento) =>
                      actualizar('puntosPorDefecto', Number(evento.target.value) || 1)
                    }
                  />
                </Campo>
                <Campo etiqueta="Nota minima" htmlFor="quiz-nota-min">
                  <Entrada
                    id="quiz-nota-min"
                    type="number"
                    min={0}
                    step={0.1}
                    value={form.notaAprobacion}
                    disabled={bloqueado}
                    onChange={(evento) =>
                      actualizar('notaAprobacion', Number(evento.target.value) || 0)
                    }
                  />
                </Campo>
                <Campo etiqueta="Nota maxima" htmlFor="quiz-nota-max">
                  <Entrada
                    id="quiz-nota-max"
                    type="number"
                    min={1}
                    step={0.1}
                    value={form.notaMaxima}
                    disabled={bloqueado}
                    onChange={(evento) => actualizar('notaMaxima', Number(evento.target.value) || 1)}
                  />
                </Campo>
              </div>
              <Campo etiqueta="Resultados al terminar" htmlFor="quiz-resultados">
                <Selector
                  id="quiz-resultados"
                  value={form.mostrarResultados}
                  disabled={bloqueado}
                  onChange={(evento) =>
                    actualizar('mostrarResultados', evento.target.value as ModoResultado)
                  }
                >
                  {MODOS_RESULTADO.map((modo) => (
                    <option key={modo} value={modo}>
                      {ETIQUETA_MODO_RESULTADO[modo]}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Casilla
                etiqueta="Permitir revision final antes de enviar"
                descripcion="El estudiante ve un resumen de sus respuestas y confirma el envio."
                checked={form.permitirRevision}
                disabled={bloqueado}
                onChange={(evento) => actualizar('permitirRevision', evento.target.checked)}
              />
              <p className="text-xs text-slate-500">
                La nota se calcula sobre {totalPuntos} punto(s) y se escala a {form.notaMaxima}.
              </p>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Modo seguro (antiplagio)">
            <div className="flex flex-col gap-3">
              <Casilla
                etiqueta="Activar modo seguro"
                descripcion="Pantalla completa, bloqueo de copiar/seleccionar y registro de infracciones en el servidor."
                checked={form.modoSeguro}
                disabled={bloqueado}
                onChange={(evento) => actualizar('modoSeguro', evento.target.checked)}
              />
              {form.modoSeguro && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo
                      etiqueta="Umbral de infracciones"
                      ayuda="Al alcanzar esta cantidad de infracciones se aplica la accion."
                      htmlFor="quiz-umbral"
                    >
                      <Entrada
                        id="quiz-umbral"
                        type="number"
                        min={1}
                        max={50}
                        value={form.umbralInfracciones}
                        disabled={bloqueado}
                        onChange={(evento) =>
                          actualizar(
                            'umbralInfracciones',
                            Math.max(1, Number(evento.target.value) || 1),
                          )
                        }
                      />
                    </Campo>
                    <Campo etiqueta="Accion al superar el umbral" htmlFor="quiz-accion">
                      <Selector
                        id="quiz-accion"
                        value={form.accionInfraccion}
                        disabled={bloqueado}
                        onChange={(evento) =>
                          actualizar('accionInfraccion', evento.target.value as AccionInfraccion)
                        }
                      >
                        {ACCIONES_INFRACCION.map((accion) => (
                          <option key={accion} value={accion}>
                            {ETIQUETA_ACCION_INFRACCION[accion]}
                          </option>
                        ))}
                      </Selector>
                    </Campo>
                  </div>
                  <Casilla
                    etiqueta="Bloquear navegadores sin pantalla completa"
                    descripcion="Por ejemplo iPhone Safari, donde la API de pantalla completa no existe."
                    checked={form.bloquearSinPantallaCompleta}
                    disabled={bloqueado}
                    onChange={(evento) =>
                      actualizar('bloquearSinPantallaCompleta', evento.target.checked)
                    }
                  />
                  <Alerta tipo="aviso">
                    Ningun navegador puede impedir por completo cambiar de pestana o usar otro
                    dispositivo; el modo seguro disuade y deja evidencia, no garantiza un examen
                    presencial.
                  </Alerta>
                </>
              )}
            </div>
          </Tarjeta>
        </div>
      )}

      {tab === 'preguntas' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <Insignia tono="azul">{seleccionadas.length} pregunta(s)</Insignia>
              <Insignia tono="verde">{totalPuntos} punto(s)</Insignia>
              {preguntasSucias && <Insignia tono="ambar">orden sin guardar</Insignia>}
            </div>
            <div className="flex gap-2">
              <Boton
                variante="secundario"
                tamano="sm"
                onClick={() => setMostrarBanco((valor) => !valor)}
                disabled={bloqueado || intentosRegistrados}
              >
                {mostrarBanco ? 'Ocultar banco' : '+ Agregar preguntas'}
              </Boton>
              {quiz.estado !== 'CLOSED' && (
                <Boton
                  tamano="sm"
                  onClick={() => void guardar()}
                  disabled={guardando || (!sucio && !preguntasSucias)}
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </Boton>
              )}
            </div>
          </div>

          {mostrarBanco && !bloqueado && !intentosRegistrados && (
            <Tarjeta
              titulo="Bancos de preguntas"
              descripcion="Cada documento (PDF) es un banco propio. Elige un banco para ver sus preguntas y agregarlas todas de una vez, o selecciona preguntas sueltas."
              acciones={
                <Boton variante="secundario" tamano="sm" onClick={() => setMostrarBanco(false)}>
                  Cerrar
                </Boton>
              }
            >
              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                <Campo etiqueta="Banco" htmlFor="quiz-banco">
                  <Selector
                    id="quiz-banco"
                    value={bancoSeleccionado}
                    onChange={(evento) => setBancoSeleccionado(evento.target.value)}
                  >
                    <option value="TODOS">Todos los bancos ({banco.length})</option>
                    {bancos.map((opcion) => (
                      <option key={opcion.clave} value={opcion.clave}>
                        {opcion.titulo} ({opcion.total})
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Buscar">
                  <Entrada
                    type="search"
                    value={buscarBanco}
                    onChange={(evento) => setBuscarBanco(evento.target.value)}
                    placeholder="Texto del enunciado"
                  />
                </Campo>
                <Campo etiqueta="Tipo">
                  <Selector
                    value={tipoBanco}
                    onChange={(evento) => setTipoBanco(evento.target.value as typeof tipoBanco)}
                  >
                    <option value="TODOS">Todos</option>
                    {TIPOS_PREGUNTA.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {ETIQUETA_TIPO_PREGUNTA[tipo]}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {bancoFiltrado.length} pregunta(s) en la seleccion actual · ya agregadas{' '}
                  {bancoFiltrado.length - porAgregar.length}
                </p>
                <Boton
                  variante="exito"
                  tamano="sm"
                  disabled={porAgregar.length === 0}
                  onClick={agregarTodasDelBanco}
                >
                  {bancoSeleccionado === 'TODOS'
                    ? `Agregar todas las visibles (${porAgregar.length})`
                    : `Cargar todo el banco (${porAgregar.length})`}
                </Boton>
              </div>

              {bancoFiltrado.length === 0 ? (
                <Vacio mensaje="No hay preguntas que coincidan. Crea preguntas en el banco o genera nuevas desde un documento." />
              ) : (
                <ul className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
                  {bancoFiltrado.map((pregunta) => {
                    const agregada = seleccionadas.some(
                      (seleccion) => seleccion.id === pregunta.id,
                    );
                    return (
                      <li
                        key={pregunta.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap gap-1">
                            <Insignia tono="azul">
                              {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo as TipoPregunta]}
                            </Insignia>
                            <Insignia tono={pregunta.estado === 'APPROVED' ? 'verde' : 'ambar'}>
                              {ETIQUETA_ESTADO_PREGUNTA[pregunta.estado] ?? pregunta.estado}
                            </Insignia>
                            <Insignia tono="gris">
                              {ETIQUETA_DIFICULTAD[pregunta.dificultad as Dificultad]}
                            </Insignia>
                            <Insignia tono="violeta">
                              {pregunta.banco?.titulo ?? 'Manual'}
                            </Insignia>
                            {pregunta.respuestaPendiente && (
                              <Insignia tono="rojo">sin respuesta</Insignia>
                            )}
                          </div>
                          <p className="text-sm text-slate-800">{pregunta.enunciado}</p>
                        </div>
                        <Boton
                          variante={agregada ? 'secundario' : 'primario'}
                          tamano="sm"
                          disabled={agregada}
                          onClick={() => agregarPregunta(pregunta.id)}
                        >
                          {agregada ? 'Agregada' : 'Agregar'}
                        </Boton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>
          )}

          {seleccionadas.length === 0 ? (
            <Vacio
              mensaje="Este quiz todavia no tiene preguntas. Agrega algunas desde el banco."
              accion={
                !bloqueado && !intentosRegistrados ? (
                  <Boton onClick={() => setMostrarBanco(true)}>+ Agregar preguntas</Boton>
                ) : undefined
              }
            />
          ) : (
            <ol className="flex flex-col gap-3">
              {seleccionDetalle.map((seleccion, indice) => {
                const pregunta = seleccion.datos;
                const abierta = expandida === seleccion.id;
                return (
                  <li key={seleccion.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {seleccion.posicion}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1">
                          {pregunta ? (
                            <>
                              <Insignia tono="azul">
                                {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo as TipoPregunta]}
                              </Insignia>
                              <Insignia tono="gris">
                                {ETIQUETA_DIFICULTAD[pregunta.dificultad as Dificultad]}
                              </Insignia>
                              <Insignia tono={pregunta.estado === 'APPROVED' ? 'verde' : 'ambar'}>
                                {ETIQUETA_ESTADO_PREGUNTA[pregunta.estado] ?? pregunta.estado}
                              </Insignia>
                              <Insignia tono="violeta">
                                {pregunta.banco?.titulo ?? 'Manual'}
                              </Insignia>
                              {pregunta.respuestaPendiente && (
                                <Insignia tono="rojo">sin respuesta</Insignia>
                              )}
                            </>
                          ) : (
                            <Insignia tono="rojo">pregunta no disponible</Insignia>
                          )}
                        </div>
                        <p className="text-sm text-slate-800">
                          {pregunta?.enunciado ?? 'La pregunta fue eliminada del banco.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          Puntos
                          <Entrada
                            type="number"
                            min={0.1}
                            step={0.1}
                            className="w-20 py-1 text-sm"
                            value={seleccion.puntos}
                            disabled={bloqueado || intentosRegistrados}
                            onChange={(evento) =>
                              cambiarPuntos(seleccion.id, Number(evento.target.value))
                            }
                            aria-label={`Puntos de la pregunta ${seleccion.posicion}`}
                          />
                        </label>
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          disabled={bloqueado || intentosRegistrados || indice === 0}
                          onClick={() => moverPregunta(indice, -1)}
                          title="Subir"
                        >
                          ↑
                        </Boton>
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          disabled={
                            bloqueado || intentosRegistrados || indice === seleccionadas.length - 1
                          }
                          onClick={() => moverPregunta(indice, 1)}
                          title="Bajar"
                        >
                          ↓
                        </Boton>
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          onClick={() => setExpandida(abierta ? null : seleccion.id)}
                        >
                          {abierta ? 'Ocultar' : 'Opciones'}
                        </Boton>
                        <Boton
                          variante="peligro"
                          tamano="sm"
                          disabled={bloqueado || intentosRegistrados}
                          onClick={() => quitarPregunta(seleccion.id)}
                        >
                          Quitar
                        </Boton>
                      </div>
                    </div>
                    {abierta && pregunta && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <ul className="flex flex-col gap-1">
                          {pregunta.opciones.map((opcion) => (
                            <li
                              key={opcion.id}
                              className={cx(
                                'flex items-start gap-2 rounded-md px-2 py-1 text-sm',
                                opcion.correcta
                                  ? 'bg-emerald-50 text-emerald-900'
                                  : 'text-slate-700',
                              )}
                            >
                              <span className="font-semibold">{opcion.etiqueta}.</span>
                              <span>{opcion.texto}</span>
                              {opcion.correcta && (
                                <span className="text-xs font-semibold">(correcta)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {pregunta.explicacion && (
                          <p className="mt-2 text-xs text-slate-600">
                            <span className="font-semibold">Explicacion: </span>
                            {pregunta.explicacion}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'revision' && (
        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Lista de verificacion antes de publicar">
            <div className="flex flex-col gap-3">
              {revisionLocal.errores.length === 0 ? (
                <Alerta tipo="exito" titulo="Todo listo">
                  El quiz cumple los requisitos. Revisa las preguntas y confirma la publicacion.
                </Alerta>
              ) : (
                <Alerta tipo="error" titulo="Corrige estos puntos">
                  <ul className="list-disc pl-5">
                    {revisionLocal.errores.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </Alerta>
              )}
              {revisionLocal.advertencias.map((advertencia) => (
                <Alerta key={advertencia} tipo="aviso">
                  {advertencia}
                </Alerta>
              ))}
              {sucio && (
                <Alerta tipo="info">
                  Hay cambios sin guardar. Al publicar se guardan automaticamente.
                </Alerta>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Resumen de la configuracion">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Grupos</dt>
                <dd className="text-slate-800">
                  {form.grupoIds.length === 0
                    ? 'Sin asignar'
                    : form.grupoIds
                        .map((id) => grupos.find((grupo) => grupo.id === id)?.nombre ?? id)
                        .join(', ')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Navegacion</dt>
                <dd className="text-slate-800">
                  {ETIQUETA_MODO_NAVEGACION[form.navegacion]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Tiempo total</dt>
                <dd className="text-slate-800">
                  {form.tiempoTotalMin
                    ? formatearDuracion(Number(form.tiempoTotalMin) * 60)
                    : 'Sin limite'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Tiempo por pregunta
                </dt>
                <dd className="text-slate-800">
                  {form.tiempoPorPregunta
                    ? formatearDuracion(Number(form.tiempoPorPregunta))
                    : 'Sin limite'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Puntaje</dt>
                <dd className="text-slate-800">
                  {totalPuntos} punto(s) · aprueba con {form.notaAprobacion}/{form.notaMaxima}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Intentos</dt>
                <dd className="text-slate-800">
                  Maximo {form.intentosMaximos} · {form.mezclarPreguntas ? 'preguntas mezcladas' : 'orden fijo'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Disponibilidad</dt>
                <dd className="text-slate-800">
                  {form.fechaDesde ? formatearFecha(form.fechaDesde) : 'Al publicar'}
                  {' → '}
                  {form.fechaHasta ? formatearFecha(form.fechaHasta) : 'sin cierre'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Modo seguro</dt>
                <dd className="text-slate-800">
                  {form.modoSeguro
                    ? `Activo · umbral ${form.umbralInfracciones} · ${ETIQUETA_ACCION_INFRACCION[form.accionInfraccion]}`
                    : 'Desactivado'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Resultados</dt>
                <dd className="text-slate-800">{ETIQUETA_MODO_RESULTADO[form.mostrarResultados]}</dd>
              </div>
            </dl>
          </Tarjeta>

          <Tarjeta
            titulo={`Preguntas del quiz (${seleccionadas.length})`}
            descripcion="Revisa el enunciado y la respuesta correcta marcada en verde."
          >
            {seleccionadas.length === 0 ? (
              <Vacio mensaje="No hay preguntas para revisar." />
            ) : (
              <ol className="flex flex-col gap-4">
                {seleccionDetalle.map((seleccion) => (
                  <li key={seleccion.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs font-semibold text-slate-500">
                        {seleccion.posicion}.
                      </span>
                      <Insignia tono="azul">
                        {preguntaDesdeTipo(seleccion.datos?.tipo)}
                      </Insignia>
                      <Insignia tono="gris">{seleccion.puntos} pt</Insignia>
                      {seleccion.datos?.respuestaPendiente && (
                        <Insignia tono="rojo">respuesta pendiente</Insignia>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      {seleccion.datos?.enunciado ?? 'Pregunta no disponible'}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {seleccion.datos?.opciones.map((opcion) => (
                        <li
                          key={opcion.id}
                          className={cx(
                            'flex items-start gap-2 rounded-md px-2 py-1 text-sm',
                            opcion.correcta
                              ? 'bg-emerald-50 font-medium text-emerald-900'
                              : 'text-slate-700',
                          )}
                        >
                          <span className="font-semibold">{opcion.etiqueta}.</span>
                          <span>{opcion.texto}</span>
                          {opcion.correcta && <span className="text-xs">(correcta)</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>

          {quiz.estado === 'DRAFT' && (
            <Tarjeta titulo="Publicar">
              <div className="flex flex-col gap-3">
                <Casilla
                  etiqueta="He revisado las preguntas, las respuestas correctas y la configuracion"
                  descripcion="La publicacion es la confirmacion explicita de que el quiz puede aplicarse."
                  checked={confirmoRevision}
                  onChange={(evento) => setConfirmoRevision(evento.target.checked)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Boton
                    variante="exito"
                    onClick={() => void publicar()}
                    disabled={
                      publicando ||
                      !confirmoRevision ||
                      revisionLocal.errores.length > 0
                    }
                  >
                    {publicando ? 'Publicando...' : 'Publicar quiz'}
                  </Boton>
                  {revisionLocal.errores.length > 0 && (
                    <span className="text-sm text-slate-500">
                      Corrige los errores para habilitar la publicacion.
                    </span>
                  )}
                </div>
              </div>
            </Tarjeta>
          )}

          {quiz.estado === 'PUBLISHED' && (
            <Tarjeta titulo="Cerrar el quiz">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-sm text-slate-600">
                  Cerrar impide nuevos intentos. Los intentos ya enviados se conservan para los
                  reportes.
                </p>
                <Boton variante="peligro" onClick={() => void cerrar()} disabled={cerrando}>
                  {cerrando ? 'Cerrando...' : 'Cerrar quiz'}
                </Boton>
              </div>
            </Tarjeta>
          )}
        </div>
      )}
    </div>
  );
}

function preguntaDesdeTipo(tipo: string | undefined): string {
  if (!tipo) return 'Pregunta';
  return ETIQUETA_TIPO_PREGUNTA[tipo as TipoPregunta] ?? tipo;
}
