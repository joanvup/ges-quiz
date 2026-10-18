'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alerta, Boton, Tarjeta } from '@/components/ui';

export function ImportadorMoodle({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ total: number; importadas: number; errores: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function manejarImportacion(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) {
      setError('Selecciona un archivo XML de Moodle');
      return;
    }

    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append('archivo', archivo);

      const res = await fetch(`/api/documentos/${documentoId}/moodle`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al importar XML de Moodle');
      }

      setResultado(data);
      setArchivo(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Importar preguntas desde Moodle XML"
      descripcion="Sube un archivo XML exportado desde Moodle para poblar automáticamente el banco de preguntas de este documento."
    >
      <form onSubmit={manejarImportacion} className="flex flex-col gap-4">
        {error && <Alerta tipo="error" titulo="Error">{error}</Alerta>}
        {resultado && (
          <Alerta tipo="exito" titulo="Importación completada">
            Se importaron {resultado.importadas} de {resultado.total} preguntas correctamente.
            {resultado.errores.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-xs">
                {resultado.errores.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </Alerta>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Archivo XML de Moodle (.xml)</label>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
        </div>

        <div>
          <Boton type="submit" disabled={cargando || !archivo}>
            {cargando ? 'Importando...' : 'Importar Banco Moodle'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
