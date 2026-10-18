'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorPeticion, peticion } from '@/lib/cliente/api';
import { Alerta, Boton, Estadistica, Insignia, Tabla, Tarjeta, Vacio } from '@/components/ui';

type EstadoFila = 'LISTO' | 'ERROR' | 'DUPLICADO';

type FilaResultado = {
  fila: number;
  tipo: string;
  nombre: string;
  correo: string;
  grupo: string;
  estado: EstadoFila;
  mensajes: string[];
};

type Resumen = {
  total: number;
  listas: number;
  errores: number;
  duplicadas: number;
  estudiantes: number;
  grupos: number;
};

type Analisis = { filas: FilaResultado[]; resumen: Resumen };

type ResultadoImportacion = {
  gruposCreados: number;
  usuariosCreados: number;
  membresiasCreadas: number;
  errores: { fila: number; mensaje: string }[];
};

const ESTILO_ENLACE_DESCARGA =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors';

function tonoEstado(estado: EstadoFila): 'verde' | 'ambar' | 'rojo' {
  if (estado === 'LISTO') return 'verde';
  if (estado === 'DUPLICADO') return 'ambar';
  return 'rojo';
}

const ETIQUETA_ESTADO: Record<EstadoFila, string> = {
  LISTO: 'Listo',
  DUPLICADO: 'Duplicado',
  ERROR: 'Error',
};

export function ImportadorDatos({ anioActual }: { anioActual: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [validando, setValidando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'aviso'; texto: string } | null>(
    null,
  );

  function elegirArchivo(file: File | null) {
    setArchivo(file);
    setAnalisis(null);
    setResultado(null);
    setMensaje(null);
  }

  async function subir<T>(url: string): Promise<T> {
    if (!archivo) throw new ErrorPeticion(400, 'SIN_ARCHIVO', 'Selecciona un archivo primero.');
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    return peticion<T>(url, { method: 'POST', cuerpoCrudo: formulario });
  }

  async function validar() {
    setValidando(true);
    setMensaje(null);
    setResultado(null);
    try {
      const datos = await subir<Analisis>('/api/admin/importar/validar');
      setAnalisis({ filas: datos.filas, resumen: datos.resumen });
      if (datos.resumen.listas === 0) {
        setMensaje({ tipo: 'aviso', texto: 'No hay filas validas. Corrige los errores marcados abajo.' });
      } else {
        setMensaje({
          tipo: 'exito',
          texto: `Archivo validado: ${datos.resumen.listas} fila(s) listas para importar.`,
        });
      }
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo validar el archivo.',
      });
    } finally {
      setValidando(false);
    }
  }

  async function importar() {
    setImportando(true);
    setMensaje(null);
    try {
      const datos = await subir<Analisis & { resultado: ResultadoImportacion }>('/api/admin/importar');
      setAnalisis({ filas: datos.filas, resumen: datos.resumen });
      setResultado(datos.resultado);
      setMensaje({
        tipo: 'exito',
        texto: `Importacion completada: ${datos.resultado.usuariosCreados} estudiante(s) y ${datos.resultado.gruposCreados} grupo(s) creados.`,
      });
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo importar el archivo.',
      });
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      <Tarjeta
        titulo="1. Descarga la plantilla"
        descripcion="Llenala con tus estudiantes y grupos. Elige el formato que prefieras."
      >
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/importar/plantilla?formato=excel"
            download
            className={`${ESTILO_ENLACE_DESCARGA} bg-brand-600 text-white hover:bg-brand-700`}
          >
            Descargar plantilla Excel (.xls)
          </a>
          <a
            href="/api/admin/importar/plantilla?formato=csv"
            download
            className={`${ESTILO_ENLACE_DESCARGA} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
          >
            Descargar plantilla CSV
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          La plantilla trae las columnas <strong>tipo, nombre, correo, contrasena, grupo, grado</strong> y{' '}
          <strong>anio</strong>, con filas de ejemplo. El ano escolar activo es {anioActual}. Tambien puedes
          subir un archivo propio con esos encabezados.
        </p>
      </Tarjeta>

      <Tarjeta
        titulo="2. Sube y valida el archivo"
        descripcion="Formatos admitidos: Excel XML 2003 (.xls), XML (.xml) o CSV. Maximo 2 MB."
      >
        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            id="archivo-importacion"
            type="file"
            accept=".xls,.xml,.csv,text/csv,application/vnd.ms-excel"
            onChange={(evento) => elegirArchivo(evento.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => void validar()} disabled={!archivo || validando || importando}>
              {validando ? 'Validando...' : 'Validar archivo'}
            </Boton>
            <Boton
              onClick={() => void importar()}
              disabled={!archivo || importando || validando || !analisis || analisis.resumen.listas === 0}
            >
              {importando
                ? 'Importando...'
                : analisis
                  ? `Importar ${analisis.resumen.listas} fila(s) validas`
                  : 'Importar'}
            </Boton>
          </div>
          {!archivo && <p className="text-xs text-slate-500">Selecciona primero un archivo.</p>}
        </div>
      </Tarjeta>

      {resultado && (
        <Tarjeta titulo="Resultado de la importacion">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Estadistica etiqueta="Estudiantes creados" valor={resultado.usuariosCreados} tono="verde" />
              <Estadistica etiqueta="Grupos creados" valor={resultado.gruposCreados} tono="violeta" />
              <Estadistica etiqueta="Membresias" valor={resultado.membresiasCreadas} tono="azul" />
            </div>
            {resultado.errores.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-amber-800">
                  Filas omitidas durante la importacion:
                </p>
                <ul className="list-inside list-disc text-sm text-slate-700">
                  {resultado.errores.map((error, indice) => (
                    <li key={indice}>
                      Fila {error.fila}: {error.mensaje}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Tarjeta>
      )}

      {analisis && (
        <Tarjeta
          titulo="Vista previa de la validacion"
          descripcion={`${analisis.resumen.total} fila(s) leidas`}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Estadistica etiqueta="Listas" valor={analisis.resumen.listas} tono="verde" />
            <Estadistica etiqueta="Errores" valor={analisis.resumen.errores} tono="ambar" />
            <Estadistica etiqueta="Duplicadas" valor={analisis.resumen.duplicadas} tono="violeta" />
            <Estadistica
              etiqueta="Estudiantes / grupos"
              valor={`${analisis.resumen.estudiantes} / ${analisis.resumen.grupos}`}
            />
          </div>

          {analisis.filas.length === 0 ? (
            <Vacio mensaje="El archivo no tiene filas de datos." />
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <Tabla cabeceras={['Fila', 'Tipo', 'Nombre', 'Correo', 'Grupo', 'Estado', 'Detalle']} principal={2}>
                {analisis.filas.map((fila) => (
                  <tr key={fila.fila} className="align-top">
                    <td className="px-3 py-2 text-slate-500">{fila.fila}</td>
                    <td className="px-3 py-2 text-slate-700">{fila.tipo || '-'}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{fila.nombre || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{fila.correo || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{fila.grupo || '-'}</td>
                    <td className="px-3 py-2">
                      <Insignia tono={tonoEstado(fila.estado)}>{ETIQUETA_ESTADO[fila.estado]}</Insignia>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {fila.mensajes.length === 0 ? (
                        <span className="text-emerald-700">Sin problemas</span>
                      ) : (
                        <ul className="list-inside list-disc">
                          {fila.mensajes.map((m, indice) => (
                            <li key={indice}>{m}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </Tabla>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
