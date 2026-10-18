import { prisma } from '@/lib/db';
import { ruta, respuestaOk, infoCliente, noEncontrado, conflicto } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { borrarArchivo } from '@/lib/almacenamiento';
import { fragmentarPaginas } from '@/lib/pdf/chunking';
import { obtenerDocumentoVisible, paginasDeDocumento } from '@/lib/documentos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/documentos/[id] */
export const GET = ruta<Ctx['params']>(async (_req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const { id } = await ctx.params;
  const documento = await obtenerDocumentoVisible(id, sesion.usuario);

  const fragmentos = fragmentarPaginas(paginasDeDocumento(documento));
  const preguntas = await prisma.question.count({ where: { documentId: id } });

  return respuestaOk({
    documento: {
      id: documento.id,
      titulo: documento.title,
      nombreArchivo: documento.originalName,
      estado: documento.status,
      error: documento.errorMessage,
      paginas: documento.pageCount,
      caracteres: documento.charCount,
      bytes: documento.sizeBytes,
      usoOcr: documento.usedOcr,
      creadoEn: documento.createdAt,
      preguntas,
    },
    fragmentos: fragmentos.map((fragmento, indice) => ({
      indice,
      paginaInicio: fragmento.paginaInicio,
      paginaFin: fragmento.paginaFin,
      caracteres: fragmento.caracteres,
      vistaPrevia: fragmento.texto.replace(/\s+/g, ' ').slice(0, 220),
    })),
  });
});

/** DELETE /api/documentos/[id] */
export const DELETE = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const { id } = await ctx.params;

  const documento = await obtenerDocumentoVisible(id, sesion.usuario);
  const preguntas = await prisma.question.count({ where: { documentId: id } });

  // Las preguntas generadas son valiosas: no se borran en cascada.
  if (preguntas > 0) {
    await prisma.question.updateMany({ where: { documentId: id }, data: { documentId: null } });
  }

  await prisma.document.delete({ where: { id } });
  await borrarArchivo(documento.storagePath);

  await auditar({
    accion: ACCIONES.DOCUMENTO_ELIMINADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Document',
    entidadId: id,
    meta: { nombre: documento.originalName, preguntasConservadas: preguntas },
    ip,
  });

  return respuestaOk({ eliminado: true, preguntasConservadas: preguntas });
});

/** PATCH /api/documentos/[id] - renombrar el documento. */
export const PATCH = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { id } = await ctx.params;
  const documento = await obtenerDocumentoVisible(id, sesion.usuario);

  const cuerpo = (await req.json().catch(() => null)) as { titulo?: unknown } | null;
  const titulo = typeof cuerpo?.titulo === 'string' ? cuerpo.titulo.trim() : '';
  if (titulo.length < 3 || titulo.length > 160) {
    throw conflicto('El titulo debe tener entre 3 y 160 caracteres.');
  }
  if (!documento) throw noEncontrado('Documento');

  await prisma.document.update({ where: { id }, data: { title: titulo } });
  return respuestaOk({ titulo });
});
