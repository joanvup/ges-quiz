import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import {
  ruta,
  respuestaOk,
  infoCliente,
  solicitudInvalida,
  ErrorApi,
} from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { guardarArchivo } from '@/lib/almacenamiento';
import { extraerTextoPdf, ErrorPdf } from '@/lib/pdf/extraer';
import { fragmentarPaginas } from '@/lib/pdf/chunking';
import { obtenerAjusteNumero } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET /api/documentos - lista los documentos visibles para el usuario. */
export const GET = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const url = new URL(req.url);
  const buscar = url.searchParams.get('buscar')?.trim();

  const documentos = await prisma.document.findMany({
    where: {
      ...(sesion.usuario.role === 'ADMIN' ? {} : { uploadedById: sesion.usuario.id }),
      ...(buscar
        ? { OR: [{ title: { contains: buscar } }, { originalName: { contains: buscar } }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      originalName: true,
      sizeBytes: true,
      pageCount: true,
      charCount: true,
      chunkCount: true,
      status: true,
      errorMessage: true,
      usedOcr: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });

  return respuestaOk({
    documentos: documentos.map((documento) => ({
      id: documento.id,
      titulo: documento.title,
      nombreArchivo: documento.originalName,
      bytes: documento.sizeBytes,
      paginas: documento.pageCount,
      caracteres: documento.charCount,
      fragmentos: documento.chunkCount,
      estado: documento.status,
      error: documento.errorMessage,
      usoOcr: documento.usedOcr,
      subidoPor: documento.uploadedBy.name,
      preguntas: documento._count.questions,
      creadoEn: documento.createdAt,
    })),
  });
});

/**
 * POST /api/documentos - sube uno o varios PDFs (multipart/form-data).
 * Campos: `archivos` (uno o varios) y opcionalmente `titulo`.
 */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);

  const maxMb = await obtenerAjusteNumero('archivos.maxMB', env.maxUploadMb);
  const maxBytes = maxMb * 1024 * 1024;

  const longitud = req.headers.get('content-length');
  if (longitud && Number(longitud) > maxBytes + 256 * 1024) {
    throw new ErrorApi(
      413,
      'ARCHIVO_MUY_GRANDE',
      `El archivo supera el limite configurado de ${maxMb} MB.`,
    );
  }

  let formulario: FormData;
  try {
    formulario = await req.formData();
  } catch {
    throw solicitudInvalida('No se pudo leer el formulario de subida (revisa el tamano del archivo).');
  }

  const archivos = formulario
    .getAll('archivos')
    .filter((valor): valor is File => typeof valor === 'object' && valor !== null && 'arrayBuffer' in valor);

  if (archivos.length === 0) {
    throw solicitudInvalida('No se recibio ningun archivo. Adjunta al menos un PDF.');
  }
  if (archivos.length > 10) {
    throw solicitudInvalida('Sube como maximo 10 archivos a la vez.');
  }

  const creados: { id: string; titulo: string; estado: string }[] = [];
  const errores: { archivo: string; mensaje: string }[] = [];

  for (const archivo of archivos) {
    const nombre = archivo.name || 'documento.pdf';
    if (archivo.size > maxBytes) {
      errores.push({ archivo: nombre, mensaje: `Supera el limite de ${maxMb} MB.` });
      continue;
    }
    if (archivo.size === 0) {
      errores.push({ archivo: nombre, mensaje: 'El archivo esta vacio (0 bytes).' });
      continue;
    }
    const tipo = archivo.type || '';
    const parecePdf = tipo === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf');
    if (!parecePdf) {
      errores.push({ archivo: nombre, mensaje: 'Solo se admiten archivos PDF.' });
      continue;
    }

    let rutaGuardada = '';
    try {
      const datos = Buffer.from(await archivo.arrayBuffer());
      rutaGuardada = await guardarArchivo(nombre, datos);

      const extraccion = await extraerTextoPdf(datos);
      const fragmentos = fragmentarPaginas(extraccion.paginas);
      const estado = extraccion.usadoOcr
        ? 'OCR_USED'
        : extraccion.texto.length >= 40
          ? 'EXTRACTED'
          : 'EMPTY';

      const documento = await prisma.document.create({
        data: {
          title: nombre.replace(/\.pdf$/i, ''),
          originalName: nombre,
          storagePath: rutaGuardada,
          mimeType: 'application/pdf',
          sizeBytes: datos.length,
          pageCount: extraccion.pageCount,
          charCount: extraccion.caracteres,
          chunkCount: fragmentos.length,
          extractedText: extraccion.texto.slice(0, 2_000_000),
          pagesJson: JSON.stringify(extraccion.paginas.map((p) => p.slice(0, 200_000))),
          status: estado,
          usedOcr: extraccion.usadoOcr,
          errorMessage: extraccion.aviso ?? null,
          uploadedById: sesion.usuario.id,
        },
        select: { id: true, title: true, status: true },
      });

      creados.push({ id: documento.id, titulo: documento.title, estado: documento.status });
      await auditar({
        accion: ACCIONES.DOCUMENTO_SUBIDO,
        actorId: sesion.usuario.id,
        tipoEntidad: 'Document',
        entidadId: documento.id,
        meta: { nombre, bytes: datos.length, paginas: extraccion.pageCount, fragmentos: fragmentos.length },
        ip,
      });
    } catch (error) {
      const mensaje =
        error instanceof ErrorPdf
          ? error.message
          : `No se pudo procesar el PDF: ${(error as Error).message}`;

      // Se conserva el registro para que el docente vea el error en la interfaz.
      const documento = await prisma.document
        .create({
          data: {
            title: nombre.replace(/\.pdf$/i, ''),
            originalName: nombre,
            storagePath: rutaGuardada,
            mimeType: 'application/pdf',
            sizeBytes: 0,
            status: 'FAILED',
            errorMessage: mensaje,
            uploadedById: sesion.usuario.id,
          },
          select: { id: true, title: true, status: true },
        })
        .catch(() => null);

      errores.push({ archivo: nombre, mensaje });
      if (documento) creados.push({ id: documento.id, titulo: documento.title, estado: 'FAILED' });
    }
  }

  if (creados.length === 0 && errores.length > 0) {
    throw new ErrorApi(400, 'SUBIDA_FALLIDA', errores[0]!.mensaje, { errores });
  }

  return respuestaOk({ creados, errores }, creados.length > 0 ? 201 : 200);
});
