'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type { FragmentoDto, ResultadoGeneracionDto } from '@/lib/cliente/tipos';
import {
  Alerta,
  Boton,
  Campo,
  Casilla,
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

type Modo = 'generar' | 'importar';

type Linea = {
  indice: number;
  paginas: string;
  creadas: number;
  omitidas: number;
  pendientes: number;
  mensaje?: string;
};

export function PanelGeneracion({
  documentoId,
  fragmentos,
  tieneTexto,
  proveedor,
}: {
  documentoId: string;
  fragmentos: FragmentoDto[];
  tieneTexto: boolean;
  proveedor: string;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('generar');
  const [cantidad, setCantidad] = useState(3);
  const [tipos, setTipos] = useState<TipoPregunta[]>(['MCQ_SINGLE', 'TRUE_FALSE']);
  const [dificultad, setDificultad] = useState<Dificultad>('MEDIUM');
  const [idioma, setIdioma] = useState('espanol');
  const [instrucciones, setInstrucciones] = useState('');
  const [enProceso, setEnProceso] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState({ creadas: 0, omitidas: 0, pendientes: 0 });
  const cancelar = useRef(false);

  function alternarTipo(tipo: TipoPregunta) {
    setTipos((actual) =>
      actual.includes(tipo) ? actual.filter((t) => t !== tipo) : [...actual, tipo],
    );
  }

  async function ejecutar() {
    if (!tieneTexto) {
      setError('El documento no tiene texto utilizable. Revisa el estado de la extraccion.');
      return;
    }
    if (fragmentos.length === 0) {
      setError('No hay fragmentos que procesar.');
      return;
    }
    if (modo === 'generar' && tipos.length === 0) {
      setError('Selecciona al menos un tipo de pregunta.');
      return;
    }

    cancelar.current = false;
    setEnProceso(true);
    setError(null);
    setLineas([]);
    setResumen({ creadas: 0, omitidas: 0, pendientes: 0 });
    setProgreso({ actual: 0, total: fragmentos.length });

    const acumulado = { creadas: 0, omitidas: 0, pendientes: 0 };
    const nuevasLineas: Linea[] = [];

    try {
      for (let indice = 0; indice < fragmentos.length; indice += 1) {
        if (cancelar.current) break;
        const fragmento = fragmentos[indice]!;
        const etiquetaPaginas = `pag. ${fragmento.paginaInicio}-${fragmento.paginaFin}`;

        const respuesta =
          modo === 'generar'
            ? await api.post<ResultadoGeneracionDto>(`/api/documentos/${documentoId}/generar`, {
                fragmento: indice,
                cantidad,
                tipos,
                dificultad,
                idioma,
                instruccionesExtra: instrucciones,
              })
            : await api.post<ResultadoGeneracionDto & { detectadas?: number }>(
                `/api/documentos/${documentoId}/importar`,
                { fragmento: indice },
              );

        acumulado.creadas += respuesta.creadas;
        acumulado.omitidas += respuesta.omitidas;
        acumulado.pendientes += respuesta.pendientes;

        nuevasLineas.push({
          indice,
          paginas: etiquetaPaginas,
          creadas: respuesta.creadas,
          omitidas: respuesta.omitidas,
          pendientes: respuesta.pendientes,
          mensaje:
            modo === 'importar' && respuesta.creadas === 0
              ? 'No se detectaron preguntas en este fragmento.'
              : undefined,
        });

        setLineas([...nuevasLineas]);
        setResumen({ ...acumulado });
        setProgreso({ actual: indice + 1, total: fragmentos.length });
      }
    } catch (e) {
      setError(
        e instanceof ErrorPeticion
          ? e.message
          : 'Ocurrio un error inesperado durante el procesamiento.',
      );
    } finally {
      setEnProceso(false);
      router.refresh();
    }
  }

  const porcentaje = progreso.total === 0 ? 0 : Math.round((progreso.actual / progreso.total) * 100);

  return (
    <Tarjeta
      titulo="Crear preguntas a partir de este documento"
      descripcion={`Proveedor de IA activo: ${proveedor}. El documento se procesa por fragmentos para mostrar el progreso y evitar preguntas repetidas.`}
    >
      <div className="flex flex-col gap-5">
        {error && <Alerta tipo="error">{error}</Alerta>}

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modo de creacion">
          <Boton
            variante={modo === 'generar' ? 'primario' : 'secundario'}
            onClick={() => setModo('generar')}
            disabled={enProceso}
            role="tab"
            aria-selected={modo === 'generar'}
          >
            Generar desde material
          </Boton>
          <Boton
            variante={modo === 'importar' ? 'primario' : 'secundario'}
            onClick={() => setModo('importar')}
            disabled={enProceso}
            role="tab"
            aria-selected={modo === 'importar'}
          >
            Importar examen / banco existente
          </Boton>
        </div>

        <p className="text-sm text-slate-600">
          {modo === 'generar'
            ? 'La IA redacta preguntas nuevas a partir del contenido del documento.'
            : 'El sistema detecta las preguntas y opciones ya presentes en el PDF. Si no puede determinar la respuesta correcta, la marca como pendiente de revision.'}
        </p>

        {modo === 'generar' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Campo etiqueta="Preguntas por fragmento" requerido ayuda={`${fragmentos.length} fragmentos en total`}>
              <Entrada
                type="number"
                min={1}
                max={20}
                value={cantidad}
                onChange={(evento) => setCantidad(Number(evento.target.value))}
                disabled={enProceso}
              />
            </Campo>
            <Campo etiqueta="Dificultad">
              <Selector
                value={dificultad}
                onChange={(evento) => setDificultad(evento.target.value as Dificultad)}
                disabled={enProceso}
              >
                {DIFICULTADES.map((valor) => (
                  <option key={valor} value={valor}>
                    {ETIQUETA_DIFICULTAD[valor]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Idioma">
              <Entrada
                value={idioma}
                onChange={(evento) => setIdioma(evento.target.value)}
                disabled={enProceso}
                placeholder="espanol"
              />
            </Campo>

            <div className="md:col-span-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Tipos de pregunta</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TIPOS_PREGUNTA.map((tipo) => (
                  <Casilla
                    key={tipo}
                    etiqueta={ETIQUETA_TIPO_PREGUNTA[tipo]}
                    checked={tipos.includes(tipo)}
                    onChange={() => alternarTipo(tipo)}
                    disabled={enProceso}
                  />
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <Campo etiqueta="Instrucciones adicionales" ayuda="Opcional: enfoque, temas a cubrir o evitar.">
                <Entrada
                  value={instrucciones}
                  onChange={(evento) => setInstrucciones(evento.target.value)}
                  disabled={enProceso}
                  placeholder="Ej: enfatizar los planetas interiores y evitar preguntas de fechas"
                />
              </Campo>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => void ejecutar()} disabled={enProceso}>
            {enProceso
              ? 'Procesando...'
              : modo === 'generar'
                ? 'Generar preguntas'
                : 'Importar preguntas'}
          </Boton>
          {enProceso && (
            <Boton variante="secundario" onClick={() => (cancelar.current = true)}>
              Detener
            </Boton>
          )}
        </div>

        {(enProceso || lineas.length > 0) && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>
                Fragmento {progreso.actual} de {progreso.total}
              </span>
              <span>{porcentaje}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        )}

        {lineas.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Resumen</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <Insignia tono="verde">{resumen.creadas} pregunta(s) creada(s)</Insignia>
              <Insignia tono="gris">{resumen.omitidas} duplicada(s) omitida(s)</Insignia>
              <Insignia tono="ambar">{resumen.pendientes} pendiente(s) de revision</Insignia>
            </div>
            <ul className="max-h-56 overflow-y-auto text-xs text-slate-600">
              {lineas.map((linea) => (
                <li key={linea.indice} className="flex flex-wrap items-center gap-2 border-b border-slate-200 py-1">
                  <span className="font-medium text-slate-700">
                    Fragmento {linea.indice + 1} ({linea.paginas})
                  </span>
                  <span>{linea.creadas} creadas</span>
                  <span>{linea.omitidas} omitidas</span>
                  {linea.pendientes > 0 && <span>{linea.pendientes} pendientes</span>}
                  {linea.mensaje && <span className="text-amber-700">{linea.mensaje}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}
