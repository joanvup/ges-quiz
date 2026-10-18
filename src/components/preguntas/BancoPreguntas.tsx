'use client';

import { useMemo, useState } from 'react';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type { PreguntaDto } from '@/lib/cliente/tipos';
import {
  Alerta,
  Boton,
  Campo,
  Entrada,
  Insignia,
  Selector,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import {
  DIFICULTADES,
  ETIQUETA_DIFICULTAD,
  ETIQUETA_ORIGEN_PREGUNTA,
  ETIQUETA_TIPO_PREGUNTA,
  TIPOS_PREGUNTA,
  type Dificultad,
  type OrigenPregunta,
  type TipoPregunta,
} from '@/lib/dominio/constantes';
import { EditorPregunta, preguntaAValores, valoresVacios, type ValoresPregunta } from './EditorPregunta';

const ETIQUETA_ESTADO_PREGUNTA: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'Pendiente de revision',
  APPROVED: 'Aprobada',
};

function tonoEstado(estado: string): 'gris' | 'ambar' | 'verde' {
  if (estado === 'APPROVED') return 'verde';
  if (estado === 'PENDING_REVIEW') return 'ambar';
  return 'gris';
}

export function BancoPreguntas({
  iniciales,
  documentos,
  documentoFijo = null,
  titulo = 'Banco de preguntas',
  descripcion,
}: {
  iniciales: PreguntaDto[];
  documentos: { id: string; titulo: string }[];
  documentoFijo?: string | null;
  titulo?: string;
  descripcion?: string;
}) {
  const [preguntas, setPreguntas] = useState(iniciales);
  const [editando, setEditando] = useState<ValoresPregunta | null>(null);
  const [buscar, setBuscar] = useState('');
  const [filtroBanco, setFiltroBanco] = useState<string>('TODOS');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | TipoPregunta>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED'>('TODOS');
  const [filtroDificultad, setFiltroDificultad] = useState<'TODAS' | Dificultad>('TODAS');
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'aviso'; texto: string } | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  // Cada documento (PDF) es un banco de preguntas; las manuales van al "general".
  const bancos = useMemo(() => {
    const mapa = new Map<string, { clave: string; titulo: string; total: number }>();
    for (const pregunta of preguntas) {
      const clave = pregunta.documento?.id ?? 'GENERAL';
      const titulo = pregunta.documento?.titulo ?? 'Sin documento (manuales)';
      const entrada = mapa.get(clave);
      if (entrada) entrada.total += 1;
      else mapa.set(clave, { clave, titulo, total: 1 });
    }
    return Array.from(mapa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [preguntas]);

  const filtradas = useMemo(() => {
    const termino = buscar.trim().toLowerCase();
    return preguntas.filter((pregunta) => {
      if (filtroBanco !== 'TODOS') {
        const clave = pregunta.documento?.id ?? 'GENERAL';
        if (clave !== filtroBanco) return false;
      }
      if (filtroTipo !== 'TODOS' && pregunta.tipo !== filtroTipo) return false;
      if (filtroEstado !== 'TODOS' && pregunta.estado !== filtroEstado) return false;
      if (filtroDificultad !== 'TODAS' && pregunta.dificultad !== filtroDificultad) return false;
      if (termino && !pregunta.enunciado.toLowerCase().includes(termino)) return false;
      return true;
    });
  }, [preguntas, buscar, filtroBanco, filtroTipo, filtroEstado, filtroDificultad]);

  const resumen = useMemo(() => {
    const pendientes = preguntas.filter((pregunta) => pregunta.estado === 'PENDING_REVIEW').length;
    const aprobadas = preguntas.filter((pregunta) => pregunta.estado === 'APPROVED').length;
    return { total: preguntas.length, pendientes, aprobadas };
  }, [preguntas]);

  // Banco sobre el que se puede actuar en bloque: el documento fijo (ficha del
  // documento) o el banco elegido en el filtro. Es null en "Todos los bancos".
  const bancoActivo = useMemo(() => {
    if (documentoFijo) {
      return { clave: documentoFijo, documentoId: documentoFijo as string | null };
    }
    if (filtroBanco === 'TODOS') return null;
    return {
      clave: filtroBanco,
      documentoId: filtroBanco === 'GENERAL' ? null : filtroBanco,
    };
  }, [documentoFijo, filtroBanco]);

  const totalBancoActivo = useMemo(() => {
    if (!bancoActivo) return 0;
    return preguntas.filter((pregunta) => (pregunta.documento?.id ?? 'GENERAL') === bancoActivo.clave)
      .length;
  }, [bancoActivo, preguntas]);

  const nombreBancoActivo = useMemo(() => {
    if (documentoFijo) return 'este documento';
    return bancos.find((banco) => banco.clave === bancoActivo?.clave)?.titulo ?? 'este banco';
  }, [documentoFijo, bancos, bancoActivo]);

  async function recargar() {
    setRecargando(true);
    try {
      const url = documentoFijo ? `/api/preguntas?documentoId=${documentoFijo}` : '/api/preguntas';
      const datos = await api.get<{ preguntas: PreguntaDto[] }>(url);
      setPreguntas(datos.preguntas);
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo recargar el listado de preguntas.' });
    } finally {
      setRecargando(false);
    }
  }

  async function eliminar(pregunta: PreguntaDto) {
    if (!window.confirm('¿Eliminar esta pregunta? Si ya fue usada en un quiz, se retirara pero se conservara.')) {
      return;
    }
    setOcupada(pregunta.id);
    setMensaje(null);
    try {
      const resultado = await api.del<{ eliminada: boolean; archivada?: boolean; mensaje?: string }>(
        `/api/preguntas/${pregunta.id}`,
      );
      setMensaje({
        tipo: resultado.archivada ? 'aviso' : 'exito',
        texto: resultado.archivada
          ? resultado.mensaje ?? 'La pregunta fue retirada de los quices pero se conserva.'
          : 'Pregunta eliminada.',
      });
      await recargar();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo eliminar la pregunta.',
      });
    } finally {
      setOcupada(null);
    }
  }

  async function eliminarBanco() {
    if (!bancoActivo || totalBancoActivo === 0) return;
    if (
      !window.confirm(
        `¿Eliminar TODO el banco de ${nombreBancoActivo} (${totalBancoActivo} pregunta(s))? ` +
          'Se borraran definitivamente. Las preguntas ya respondidas en algun intento se conservaran archivadas.',
      )
    ) {
      return;
    }
    setOcupada('__banco__');
    setMensaje(null);
    try {
      const resultado = await api.del<{ total: number; eliminadas: number; archivadas: number }>(
        '/api/preguntas/banco',
        { documentoId: bancoActivo.documentoId },
      );
      setMensaje({
        tipo: resultado.archivadas > 0 ? 'aviso' : 'exito',
        texto:
          `Banco vaciado: ${resultado.eliminadas} pregunta(s) eliminada(s)` +
          (resultado.archivadas > 0
            ? ` y ${resultado.archivadas} archivada(s) por tener respuestas de estudiantes.`
            : '.'),
      });
      setExpandida(null);
      await recargar();
      if (!documentoFijo) setFiltroBanco('TODOS');
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto:
          error instanceof ErrorPeticion ? error.message : 'No se pudo eliminar el banco de preguntas.',
      });
    } finally {
      setOcupada(null);
    }
  }

  async function cambiarEstado(pregunta: PreguntaDto, estado: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED') {
    setOcupada(pregunta.id);
    setMensaje(null);
    try {
      await api.patch(`/api/preguntas/${pregunta.id}`, { estado });
      await recargar();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo cambiar el estado.',
      });
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      {editando ? (
        <EditorPregunta
          inicial={editando}
          documentos={documentos}
          documentoFijo={documentoFijo}
          onCancelar={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null);
            setMensaje({ tipo: 'exito', texto: 'Pregunta guardada correctamente.' });
            await recargar();
          }}
        />
      ) : (
        <Tarjeta
          titulo={titulo}
          descripcion={descripcion ?? `${resumen.total} pregunta(s) · ${resumen.aprobadas} aprobada(s) · ${resumen.pendientes} pendiente(s) de revision`}
          acciones={
            <div className="flex flex-wrap gap-2">
              {bancoActivo && (
                <Boton
                  variante="peligro"
                  tamano="sm"
                  disabled={totalBancoActivo === 0 || ocupada === '__banco__'}
                  title={
                    totalBancoActivo === 0
                      ? 'El banco ya esta vacio.'
                      : `Eliminar las ${totalBancoActivo} pregunta(s) de ${nombreBancoActivo}`
                  }
                  onClick={() => void eliminarBanco()}
                >
                  {ocupada === '__banco__' ? 'Eliminando...' : `Eliminar banco (${totalBancoActivo})`}
                </Boton>
              )}
              <Boton variante="secundario" tamano="sm" onClick={() => void recargar()} disabled={recargando}>
                {recargando ? 'Recargando...' : 'Recargar'}
              </Boton>
              <Boton onClick={() => setEditando(valoresVacios(documentoFijo))}>+ Nueva pregunta</Boton>
            </div>
          }
        >
          <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {!documentoFijo && (
              <Campo etiqueta="Banco" htmlFor="banco-filtro">
                <Selector
                  id="banco-filtro"
                  value={filtroBanco}
                  onChange={(evento) => setFiltroBanco(evento.target.value)}
                >
                  <option value="TODOS">Todos los bancos</option>
                  {bancos.map((opcion) => (
                    <option key={opcion.clave} value={opcion.clave}>
                      {opcion.titulo} ({opcion.total})
                    </option>
                  ))}
                </Selector>
              </Campo>
            )}
            <Campo etiqueta="Buscar en el enunciado">
              <Entrada
                type="search"
                value={buscar}
                onChange={(evento) => setBuscar(evento.target.value)}
                placeholder="Texto a buscar"
              />
            </Campo>
            <Campo etiqueta="Tipo">
              <Selector value={filtroTipo} onChange={(evento) => setFiltroTipo(evento.target.value as typeof filtroTipo)}>
                <option value="TODOS">Todos</option>
                {TIPOS_PREGUNTA.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ETIQUETA_TIPO_PREGUNTA[tipo]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Estado">
              <Selector
                value={filtroEstado}
                onChange={(evento) => setFiltroEstado(evento.target.value as typeof filtroEstado)}
              >
                <option value="TODOS">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="PENDING_REVIEW">Pendiente de revision</option>
                <option value="APPROVED">Aprobada</option>
              </Selector>
            </Campo>
            <Campo etiqueta="Dificultad">
              <Selector
                value={filtroDificultad}
                onChange={(evento) => setFiltroDificultad(evento.target.value as typeof filtroDificultad)}
              >
                <option value="TODAS">Todas</option>
                {DIFICULTADES.map((dificultad) => (
                  <option key={dificultad} value={dificultad}>
                    {ETIQUETA_DIFICULTAD[dificultad]}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>

          {filtradas.length === 0 ? (
            <Vacio
              mensaje={
                preguntas.length === 0
                  ? 'Todavia no hay preguntas. Genera preguntas desde un documento o crea una manualmente.'
                  : 'Ninguna pregunta coincide con los filtros seleccionados.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {filtradas.map((pregunta) => {
                const abierta = expandida === pregunta.id;
                return (
                  <li key={pregunta.id} className="rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Insignia tono="azul">{ETIQUETA_TIPO_PREGUNTA[pregunta.tipo as TipoPregunta]}</Insignia>
                          <Insignia tono={tonoEstado(pregunta.estado)}>
                            {ETIQUETA_ESTADO_PREGUNTA[pregunta.estado] ?? pregunta.estado}
                          </Insignia>
                          <Insignia tono="gris">{ETIQUETA_DIFICULTAD[pregunta.dificultad as Dificultad]}</Insignia>
                          <Insignia tono="gris">
                            {ETIQUETA_ORIGEN_PREGUNTA[pregunta.origen as OrigenPregunta] ?? pregunta.origen}
                          </Insignia>
                          {pregunta.pagina && <Insignia tono="gris">pag. {pregunta.pagina}</Insignia>}
                          {pregunta.respuestaPendiente && <Insignia tono="ambar">respuesta por confirmar</Insignia>}
                          {pregunta.usadaEnQuices > 0 && (
                            <Insignia tono="violeta">en {pregunta.usadaEnQuices} quiz(es)</Insignia>
                          )}
                        </div>
                        <p className="text-sm text-slate-800">{pregunta.enunciado}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          onClick={() => setExpandida(abierta ? null : pregunta.id)}
                        >
                          {abierta ? 'Ocultar' : 'Ver opciones'}
                        </Boton>
                        <Boton variante="secundario" tamano="sm" onClick={() => setEditando(preguntaAValores(pregunta))}>
                          Editar
                        </Boton>
                        {pregunta.estado !== 'APPROVED' && (
                          <Boton
                            variante="exito"
                            tamano="sm"
                            disabled={ocupada === pregunta.id}
                            onClick={() => void cambiarEstado(pregunta, 'APPROVED')}
                          >
                            Aprobar
                          </Boton>
                        )}
                        <Boton
                          variante="peligro"
                          tamano="sm"
                          disabled={ocupada === pregunta.id}
                          onClick={() => void eliminar(pregunta)}
                        >
                          Eliminar
                        </Boton>
                      </div>
                    </div>

                    {abierta && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <ul className="flex flex-col gap-1">
                          {pregunta.opciones.map((opcion) => (
                            <li
                              key={opcion.id}
                              className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${
                                opcion.correcta ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700'
                              }`}
                            >
                              <span className="font-semibold">{opcion.etiqueta}.</span>
                              <span>{opcion.texto}</span>
                              {opcion.correcta && <span className="text-xs font-semibold">(correcta)</span>}
                            </li>
                          ))}
                        </ul>
                        {pregunta.explicacion && (
                          <p className="mt-2 text-xs text-slate-600">
                            <span className="font-semibold">Explicacion: </span>
                            {pregunta.explicacion}
                          </p>
                        )}
                        {pregunta.documento && (
                          <p className="mt-1 text-xs text-slate-500">
                            Documento: {pregunta.documento.titulo}
                            {pregunta.tema ? ` · Tema: ${pregunta.tema}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
