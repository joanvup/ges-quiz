import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requiereRol } from '@/lib/auth/guard';
import { env } from '@/lib/env';
import { fragmentarPaginas, vistaPreviaFragmento } from '@/lib/pdf/chunking';
import { obtenerDocumentoVisible, paginasDeDocumento } from '@/lib/documentos/servicio';
import { aPreguntaDto, INCLUDE_PREGUNTA_DTO } from '@/lib/preguntas/dto';
import type { FragmentoDto, PreguntaDto } from '@/lib/cliente/tipos';
import { formatearBytes } from '@/lib/cliente/formato';
import { ETIQUETA_ESTADO_DOCUMENTO } from '@/lib/dominio/constantes';
import { Alerta, Estadistica, Insignia, Tarjeta } from '@/components/ui';
import { BancoPreguntas } from '@/components/preguntas/BancoPreguntas';
import { ImportadorMoodle } from './ImportadorMoodle';

export const dynamic = 'force-dynamic';

export default async function PaginaDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requiereRol('ADMIN', 'TEACHER');
  const { id } = await params;

  let documento;
  try {
    documento = await obtenerDocumentoVisible(id, usuario);
  } catch {
    notFound();
  }

  const fragmentos = fragmentarPaginas(paginasDeDocumento(documento));
  const preguntasDb = await prisma.question.findMany({
    where: { documentId: id },
    orderBy: { createdAt: 'desc' },
    include: INCLUDE_PREGUNTA_DTO,
  });

  const fragmentosDto: FragmentoDto[] = fragmentos.map((fragmento, indice) => ({
    indice,
    paginaInicio: fragmento.paginaInicio,
    paginaFin: fragmento.paginaFin,
    caracteres: fragmento.caracteres,
    vistaPrevia: vistaPreviaFragmento(fragmento, 240),
  }));

  const preguntas: PreguntaDto[] = preguntasDb.map((pregunta) => aPreguntaDto(pregunta));
  const tieneTexto = documento.extractedText.trim().length >= 40;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta de navegacion" className="text-sm text-slate-500">
        <Link href="/docentes/documentos" className="text-brand-700 hover:underline">
          Documentos
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-700">{documento.title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{documento.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {documento.originalName} · {formatearBytes(documento.sizeBytes)} ·{' '}
            {new Date(documento.createdAt).toLocaleString('es-CO')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tono={documento.status === 'EXTRACTED' ? 'verde' : 'ambar'}>
            {ETIQUETA_ESTADO_DOCUMENTO[documento.status as keyof typeof ETIQUETA_ESTADO_DOCUMENTO] ??
              documento.status}
          </Insignia>
          {documento.usedOcr && <Insignia tono="violeta">OCR</Insignia>}
        </div>
      </div>

      {documento.errorMessage && <Alerta tipo="aviso" titulo="Aviso del procesamiento">{documento.errorMessage}</Alerta>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Estadistica etiqueta="Paginas" valor={documento.pageCount} />
        <Estadistica etiqueta="Fragmentos" valor={fragmentos.length} tono="violeta" />
        <Estadistica etiqueta="Caracteres" valor={documento.charCount.toLocaleString('es-CO')} tono="ambar" />
        <Estadistica etiqueta="Preguntas" valor={preguntas.length} tono="verde" />
      </div>

      {!tieneTexto && (
        <Alerta tipo="error" titulo="No se pudo extraer texto">
          Este PDF no tiene una capa de texto utilizable (probablemente es un documento escaneado). Activa
          el OCR con <code className="font-mono">OCR_ENABLED=true</code> en el archivo{' '}
          <code className="font-mono">.env</code> y vuelve a subirlo, o sube una version digital del
          documento.
        </Alerta>
      )}

      <ImportadorMoodle documentoId={documento.id} />

      {fragmentosDto.length > 0 && (
        <Tarjeta
          titulo="Fragmentos detectados"
          descripcion={`El documento se dividio en ${fragmentosDto.length} fragmento(s) de hasta ${env.pdf.chunkSize} caracteres con solape de ${env.pdf.chunkSolape}.`}
        >
          <ul className="flex flex-col gap-2">
            {fragmentosDto.slice(0, 12).map((fragmento) => (
              <li key={fragmento.indice} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  Fragmento {fragmento.indice + 1} · paginas {fragmento.paginaInicio}-{fragmento.paginaFin} ·{' '}
                  {fragmento.caracteres.toLocaleString('es-CO')} caracteres
                </p>
                <p className="mt-1 text-xs text-slate-600">{fragmento.vistaPrevia}…</p>
              </li>
            ))}
          </ul>
          {fragmentosDto.length > 12 && (
            <p className="mt-2 text-xs text-slate-500">
              Se muestran los primeros 12 fragmentos de {fragmentosDto.length}.
            </p>
          )}
        </Tarjeta>
      )}

      <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Ver texto extraido (primeras 2000 letras)
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          {documento.extractedText.slice(0, 2000) || '(sin texto)'}
        </pre>
      </details>

      <BancoPreguntas
        iniciales={preguntas}
        documentos={[]}
        documentoFijo={documento.id}
        titulo="Banco de preguntas de este documento"
        descripcion="Este documento tiene su propio banco de preguntas. Revisa, corrige y aprueba antes de usarlas en un quiz."
      />
    </div>
  );
}
