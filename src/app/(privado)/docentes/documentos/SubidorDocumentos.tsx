'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { leerTokenCsrf } from '@/lib/cliente/api';
import { Alerta, Boton, Tarjeta } from '@/components/ui';

type ResultadoSubida = {
  creados: { id: string; titulo: string; estado: string }[];
  errores: { archivo: string; mensaje: string }[];
};

export function SubidorDocumentos({ maxMb }: { maxMb: number }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoSubida | null>(null);

  const bytesMax = maxMb * 1024 * 1024;

  const avisos = useMemo(() => {
    const lista: { archivo: string; mensaje: string }[] = [];
    for (const archivo of archivos) {
      if (archivo.size > bytesMax) lista.push({ archivo: archivo.name, mensaje: `Supera ${maxMb} MB.` });
      else if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        lista.push({ archivo: archivo.name, mensaje: 'No es un PDF.' });
      }
    }
    return lista;
  }, [archivos, bytesMax, maxMb]);

  function agregar(lista: FileList | null) {
    if (!lista) return;
    const nuevos = Array.from(lista).filter((archivo) => archivo.size > 0);
    setArchivos((actuales) => {
      const nombres = new Set(actuales.map((a) => `${a.name}-${a.size}`));
      const filtrados = nuevos.filter((a) => !nombres.has(`${a.name}-${a.size}`));
      return [...actuales, ...filtrados].slice(0, 10);
    });
    setResultado(null);
    setError(null);
  }

  function quitar(indice: number) {
    setArchivos((actuales) => actuales.filter((_, i) => i !== indice));
  }

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    agregar(evento.dataTransfer?.files ?? null);
  }

  function subir() {
    if (archivos.length === 0) return;
    setSubiendo(true);
    setError(null);
    setResultado(null);
    setProgreso(0);

    const formulario = new FormData();
    for (const archivo of archivos) formulario.append('archivos', archivo);

    const peticion = new XMLHttpRequest();
    peticion.open('POST', '/api/documentos');
    const csrf = leerTokenCsrf();
    if (csrf) peticion.setRequestHeader('x-csrf-token', csrf);

    peticion.upload.onprogress = (evento) => {
      if (evento.total > 0) setProgreso(Math.round((evento.loaded / evento.total) * 100));
    };

    peticion.onload = () => {
      setSubiendo(false);
      setProgreso(100);
      try {
        const cuerpo = JSON.parse(peticion.responseText) as
          | { datos: ResultadoSubida }
          | { error: { mensaje: string } };
        if (peticion.status >= 200 && peticion.status < 300 && 'datos' in cuerpo) {
          setResultado(cuerpo.datos);
          setArchivos([]);
          router.refresh();
        } else {
          setError('error' in cuerpo ? cuerpo.error.mensaje : 'No se pudo subir los archivos.');
        }
      } catch {
        setError('Respuesta inesperada del servidor al subir los archivos.');
      }
    };

    peticion.onerror = () => {
      setSubiendo(false);
      setError('Fallo de red durante la subida. Revisa tu conexion e intentalo de nuevo.');
    };

    peticion.send(formulario);
  }

  return (
    <Tarjeta
      titulo="Subir material de estudio"
      descripcion={`Formatos admitidos: PDF (maximo ${maxMb} MB por archivo, hasta 10 archivos).`}
    >
      <div className="flex flex-col gap-4">
        {error && <Alerta tipo="error">{error}</Alerta>}

        <div
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={alSoltar}
          className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            arrastrando ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <p className="text-sm font-medium text-slate-700">
            Arrastra tus PDFs aqui o selecciona los archivos
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Puedes subir material de estudio, un examen existente o un banco de preguntas.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Seleccionar archivos
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              onChange={(evento) => {
                agregar(evento.target.files);
                evento.target.value = '';
              }}
            />
          </label>
        </div>

        {archivos.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {archivos.map((archivo, indice) => (
              <li key={`${archivo.name}-${indice}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{archivo.name}</span>
                  <span className="block text-xs text-slate-500">
                    {(archivo.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </span>
                <Boton variante="secundario" tamano="sm" onClick={() => quitar(indice)} disabled={subiendo}>
                  Quitar
                </Boton>
              </li>
            ))}
          </ul>
        )}

        {avisos.length > 0 && (
          <Alerta tipo="aviso" titulo="Revisa estos archivos antes de subir">
            <ul className="list-disc pl-5">
              {avisos.map((aviso) => (
                <li key={aviso.archivo}>
                  {aviso.archivo}: {aviso.mensaje}
                </li>
              ))}
            </ul>
          </Alerta>
        )}

        {subiendo && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>Subiendo y extrayendo texto...</span>
              <span>{progreso}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={progreso}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${progreso}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Boton onClick={subir} disabled={subiendo || archivos.length === 0 || avisos.length > 0}>
            {subiendo ? 'Procesando...' : `Subir ${archivos.length || ''} archivo(s)`}
          </Boton>
          {archivos.length > 0 && !subiendo && (
            <Boton variante="secundario" onClick={() => setArchivos([])}>
              Limpiar lista
            </Boton>
          )}
        </div>

        {resultado && (
          <Alerta tipo={resultado.errores.length > 0 ? 'aviso' : 'exito'} titulo="Resultado de la subida">
            <ul className="list-disc space-y-1 pl-5">
              {resultado.creados.map((creado) => (
                <li key={creado.id}>
                  {creado.titulo}: {creado.estado === 'FAILED' ? 'error al procesar' : 'procesado correctamente'}
                </li>
              ))}
              {resultado.errores.map((errorItem) => (
                <li key={errorItem.archivo}>
                  {errorItem.archivo}: {errorItem.mensaje}
                </li>
              ))}
            </ul>
          </Alerta>
        )}
      </div>
    </Tarjeta>
  );
}
