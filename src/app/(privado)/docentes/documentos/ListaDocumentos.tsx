'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type { DocumentoDto } from '@/lib/cliente/tipos';
import { formatearBytes } from '@/lib/cliente/formato';
import {
  Alerta,
  Boton,
  EnlaceBoton,
  Insignia,
  Tabla,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { ETIQUETA_ESTADO_DOCUMENTO } from '@/lib/dominio/constantes';

function tonoEstado(estado: string): 'verde' | 'ambar' | 'rojo' | 'violeta' | 'gris' {
  if (estado === 'EXTRACTED') return 'verde';
  if (estado === 'OCR_USED') return 'violeta';
  if (estado === 'EMPTY' || estado === 'PENDING') return 'ambar';
  if (estado === 'FAILED') return 'rojo';
  return 'gris';
}

export function ListaDocumentos({ documentos }: { documentos: DocumentoDto[] }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function eliminar(documento: DocumentoDto) {
    const confirmado = window.confirm(
      `¿Eliminar el documento "${documento.titulo}"? Las preguntas ya generadas se conservan en el banco.`,
    );
    if (!confirmado) return;
    setOcupado(documento.id);
    setMensaje(null);
    try {
      const resultado = await api.del<{ preguntasConservadas: number }>(`/api/documentos/${documento.id}`);
      setMensaje({
        tipo: 'exito',
        texto: `Documento eliminado. Se conservaron ${resultado.preguntasConservadas} pregunta(s) en el banco.`,
      });
      router.refresh();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo eliminar el documento.',
      });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Tarjeta titulo="Documentos subidos" descripcion={`${documentos.length} archivo(s)`}>
      <div className="flex flex-col gap-4">
        {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

        {documentos.length === 0 ? (
          <Vacio mensaje="Todavia no has subido documentos. Empieza subiendo un PDF de material de estudio." />
        ) : (
          <Tabla cabeceras={['Documento', 'Estado', 'Paginas', 'Fragmentos', 'Preguntas', 'Subido', 'Acciones']}>
            {documentos.map((documento) => (
              <tr key={documento.id}>
                <td className="px-3 py-2">
                  <Link
                    href={`/docentes/documentos/${documento.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {documento.titulo}
                  </Link>
                  <span className="block text-xs text-slate-500">{documento.nombreArchivo}</span>
                  {documento.error && (
                    <span className="block max-w-md text-xs text-amber-700">{documento.error}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Insignia tono={tonoEstado(documento.estado)}>
                    {ETIQUETA_ESTADO_DOCUMENTO[documento.estado as keyof typeof ETIQUETA_ESTADO_DOCUMENTO] ??
                      documento.estado}
                  </Insignia>
                </td>
                <td className="px-3 py-2 text-slate-600">{documento.paginas}</td>
                <td className="px-3 py-2 text-slate-600">{documento.fragmentos}</td>
                <td className="px-3 py-2 text-slate-600">{documento.preguntas ?? 0}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatearBytes(documento.bytes)}
                  <span className="block">{new Date(documento.creadoEn).toLocaleDateString('es-CO')}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <EnlaceBoton href={`/docentes/documentos/${documento.id}`} tamano="sm" variante="secundario">
                      Abrir
                    </EnlaceBoton>
                    <Boton
                      tamano="sm"
                      variante="peligro"
                      disabled={ocupado === documento.id}
                      onClick={() => eliminar(documento)}
                    >
                      {ocupado === documento.id ? 'Eliminando...' : 'Eliminar'}
                    </Boton>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </div>
    </Tarjeta>
  );
}
