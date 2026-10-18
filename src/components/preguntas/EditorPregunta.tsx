'use client';

import { useState } from 'react';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import {
  Alerta,
  Boton,
  Campo,
  Entrada,
  Insignia,
  Selector,
  Tarjeta,
} from '@/components/ui';
import {
  DIFICULTADES,
  ETIQUETA_DIFICULTAD,
  ETIQUETA_TIPO_PREGUNTA,
  TIPOS_PREGUNTA,
  type Dificultad,
  type TipoPregunta,
} from '@/lib/dominio/constantes';

export type ValoresPregunta = {
  id: string | null;
  enunciado: string;
  tipo: TipoPregunta;
  dificultad: Dificultad;
  tema: string;
  pagina: string;
  explicacion: string;
  estado: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED';
  documentoId: string | null;
  opciones: { texto: string; correcta: boolean }[];
};

export function valoresVacios(documentoId: string | null = null): ValoresPregunta {
  return {
    id: null,
    enunciado: '',
    tipo: 'MCQ_SINGLE',
    dificultad: 'MEDIUM',
    tema: '',
    pagina: '',
    explicacion: '',
    estado: 'DRAFT',
    documentoId,
    opciones: [
      { texto: '', correcta: true },
      { texto: '', correcta: false },
      { texto: '', correcta: false },
      { texto: '', correcta: false },
    ],
  };
}

export function ajustarOpciones(valores: ValoresPregunta, tipo: TipoPregunta): ValoresPregunta {
  if (tipo === 'TRUE_FALSE') {
    return {
      ...valores,
      tipo,
      opciones: [
        { texto: 'Verdadero', correcta: true },
        { texto: 'Falso', correcta: false },
      ],
    };
  }
  if (tipo === 'SHORT_ANSWER') {
    return {
      ...valores,
      tipo,
      opciones: [valores.opciones[0] ?? { texto: '', correcta: true }].map((opcion) => ({
        texto: opcion.texto,
        correcta: true,
      })),
    };
  }

  const marcadas = valores.opciones.filter((opcion) => opcion.correcta);
  if (tipo === 'MCQ_SINGLE' && marcadas.length > 1) {
    return {
      ...valores,
      tipo,
      opciones: valores.opciones.map((opcion, indice) => ({
        texto: opcion.texto,
        correcta: indice === valores.opciones.findIndex((o) => o.correcta),
      })),
    };
  }

  if (valores.opciones.length >= 2) return { ...valores, tipo };

  return {
    ...valores,
    tipo,
    opciones: [
      ...valores.opciones,
      { texto: '', correcta: false },
      { texto: '', correcta: false },
    ].slice(0, 4),
  };
}

export function EditorPregunta({
  inicial,
  documentos,
  documentoFijo,
  onGuardado,
  onCancelar,
}: {
  inicial: ValoresPregunta;
  documentos: { id: string; titulo: string }[];
  documentoFijo?: string | null;
  onGuardado: () => void | Promise<void>;
  onCancelar: () => void;
}) {
  const [valores, setValores] = useState<ValoresPregunta>(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cambioTipo(tipo: TipoPregunta) {
    setValores((actual) => ajustarOpciones(actual, tipo));
  }

  function cambiarOpcion(indice: number, cambios: Partial<{ texto: string; correcta: boolean }>) {
    setValores((actual) => ({
      ...actual,
      opciones: actual.opciones.map((opcion, i) => {
        if (i !== indice) {
          // En opcion multiple de una sola respuesta, solo una puede estar marcada.
          if (cambios.correcta && actual.tipo === 'MCQ_SINGLE') return { ...opcion, correcta: false };
          if (cambios.correcta && actual.tipo === 'TRUE_FALSE') return { ...opcion, correcta: false };
          return opcion;
        }
        return { ...opcion, ...cambios };
      }),
    }));
  }

  function agregarOpcion() {
    setValores((actual) => ({ ...actual, opciones: [...actual.opciones, { texto: '', correcta: false }] }));
  }

  function quitarOpcion(indice: number) {
    setValores((actual) => ({
      ...actual,
      opciones: actual.opciones.filter((_, i) => i !== indice),
    }));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setErrores({});
    try {
      const cuerpo = {
        enunciado: valores.enunciado,
        tipo: valores.tipo,
        dificultad: valores.dificultad,
        tema: valores.tema,
        explicacion: valores.explicacion,
        ...(valores.pagina ? { pagina: Number(valores.pagina) } : {}),
        estado: valores.estado,
        documentoId: documentoFijo ?? valores.documentoId,
        opciones: valores.opciones
          .filter((opcion) => opcion.texto.trim() !== '')
          .map((opcion) => ({ texto: opcion.texto, correcta: opcion.correcta })),
      };

      if (valores.id) await api.patch(`/api/preguntas/${valores.id}`, cuerpo);
      else await api.post('/api/preguntas', cuerpo);

      await onGuardado();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setError(e.message);
        setErrores(e.campos ?? {});
      } else {
        setError('No se pudo guardar la pregunta.');
      }
    } finally {
      setGuardando(false);
    }
  }

  const esVerdaderoFalso = valores.tipo === 'TRUE_FALSE';

  return (
    <Tarjeta
      titulo={valores.id ? 'Editar pregunta' : 'Nueva pregunta'}
      descripcion={
        valores.tipo === 'SHORT_ANSWER'
          ? 'En respuestas cortas, la opcion es la respuesta esperada.'
          : 'Marca con la casilla las opciones correctas.'
      }
      acciones={
        <Boton variante="secundario" tamano="sm" onClick={onCancelar}>
          Cancelar
        </Boton>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
      >
        {error && <Alerta tipo="error">{error}</Alerta>}

        <Campo etiqueta="Enunciado" requerido error={errores.enunciado}>
          <textarea
            className="min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={valores.enunciado}
            onChange={(evento) => setValores({ ...valores, enunciado: evento.target.value })}
            required
            minLength={8}
          />
        </Campo>

        <div className="grid gap-4 md:grid-cols-4">
          <Campo etiqueta="Tipo" requerido error={errores.tipo}>
            <Selector
              value={valores.tipo}
              onChange={(evento) => cambioTipo(evento.target.value as TipoPregunta)}
            >
              {TIPOS_PREGUNTA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_TIPO_PREGUNTA[tipo]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Dificultad">
            <Selector
              value={valores.dificultad}
              onChange={(evento) => setValores({ ...valores, dificultad: evento.target.value as Dificultad })}
            >
              {DIFICULTADES.map((dificultad) => (
                <option key={dificultad} value={dificultad}>
                  {ETIQUETA_DIFICULTAD[dificultad]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Tema" ayuda="Opcional">
            <Entrada value={valores.tema} onChange={(evento) => setValores({ ...valores, tema: evento.target.value })} />
          </Campo>
          <Campo etiqueta="Pagina de origen" ayuda="Opcional">
            <Entrada
              type="number"
              min={1}
              value={valores.pagina}
              onChange={(evento) => setValores({ ...valores, pagina: evento.target.value })}
            />
          </Campo>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Opciones {esVerdaderoFalso && <Insignia tono="gris">Verdadero / Falso</Insignia>}
          </p>
          <div className="flex flex-col gap-2">
            {valores.opciones.map((opcion, indice) => (
              <div key={indice} className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type={valores.tipo === 'MCQ_MULTI' ? 'checkbox' : 'radio'}
                    name="opcion-correcta"
                    className="h-5 w-5 shrink-0 border-slate-300 text-brand-600"
                    checked={opcion.correcta}
                    onChange={(evento) => cambiarOpcion(indice, { correcta: evento.target.checked })}
                    aria-label={`Marcar la opcion ${indice + 1} como correcta`}
                  />
                  <span className="w-5 text-sm font-semibold text-slate-500">
                    {String.fromCharCode(65 + indice)}
                  </span>
                </label>
                <Entrada
                  value={opcion.texto}
                  readOnly={esVerdaderoFalso}
                  onChange={(evento) => cambiarOpcion(indice, { texto: evento.target.value })}
                  placeholder={esVerdaderoFalso ? '' : 'Texto de la opcion'}
                />
                {!esVerdaderoFalso && valores.tipo !== 'SHORT_ANSWER' && valores.opciones.length > 2 && (
                  <Boton variante="secundario" tamano="sm" type="button" onClick={() => quitarOpcion(indice)}>
                    Quitar
                  </Boton>
                )}
              </div>
            ))}
          </div>
          {errores.opciones && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
              {errores.opciones}
            </p>
          )}
          {!esVerdaderoFalso && valores.tipo !== 'SHORT_ANSWER' && valores.opciones.length < 8 && (
            <div className="mt-2">
              <Boton variante="secundario" tamano="sm" type="button" onClick={agregarOpcion}>
                + Agregar opcion
              </Boton>
            </div>
          )}
        </div>

        <Campo etiqueta="Explicacion de la respuesta" ayuda="Se muestra al estudiante si el quiz lo permite.">
          <textarea
            className="min-h-[70px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={valores.explicacion}
            onChange={(evento) => setValores({ ...valores, explicacion: evento.target.value })}
          />
        </Campo>

        {!documentoFijo && (
          <Campo etiqueta="Documento de origen" ayuda="Opcional">
            <Selector
              value={valores.documentoId ?? ''}
              onChange={(evento) => setValores({ ...valores, documentoId: evento.target.value || null })}
            >
              <option value="">Sin documento asociado</option>
              {documentos.map((documento) => (
                <option key={documento.id} value={documento.id}>
                  {documento.titulo}
                </option>
              ))}
            </Selector>
          </Campo>
        )}

        <Campo etiqueta="Estado" ayuda="Solo las preguntas aprobadas se podran publicar en un quiz.">
          <Selector
            value={valores.estado}
            onChange={(evento) =>
              setValores({ ...valores, estado: evento.target.value as ValoresPregunta['estado'] })
            }
          >
            <option value="DRAFT">Borrador</option>
            <option value="PENDING_REVIEW">Pendiente de revision</option>
            <option value="APPROVED">Aprobada</option>
          </Selector>
        </Campo>

        <div className="flex gap-2">
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : valores.id ? 'Guardar cambios' : 'Crear pregunta'}
          </Boton>
          <Boton type="button" variante="secundario" onClick={onCancelar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

export function preguntaAValores(pregunta: {
  id: string;
  enunciado: string;
  tipo: string;
  dificultad: string;
  tema: string | null;
  pagina: number | null;
  explicacion: string | null;
  estado: string;
  documento: { id: string } | null;
  opciones: { texto: string; correcta: boolean }[];
}): ValoresPregunta {
  return {
    id: pregunta.id,
    enunciado: pregunta.enunciado,
    tipo: pregunta.tipo as TipoPregunta,
    dificultad: pregunta.dificultad as Dificultad,
    tema: pregunta.tema ?? '',
    pagina: pregunta.pagina ? String(pregunta.pagina) : '',
    explicacion: pregunta.explicacion ?? '',
    estado: pregunta.estado as ValoresPregunta['estado'],
    documentoId: pregunta.documento?.id ?? null,
    opciones: pregunta.opciones.map((opcion) => ({ texto: opcion.texto, correcta: opcion.correcta })),
  };
}
