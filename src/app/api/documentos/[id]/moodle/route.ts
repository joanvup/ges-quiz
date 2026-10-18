import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requiereRolApi } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { ruta, infoCliente } from '@/lib/http';
import { importarMoodleXml } from '@/lib/moodle/importar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = ruta(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const { id } = await params;
  const documento = await prisma.document.findUnique({ where: { id } });
  if (!documento) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const formData = await req.formData();
  const archivo = formData.get('archivo');
  if (!archivo || typeof archivo === 'string') {
    return NextResponse.json({ error: 'Archivo XML no proporcionado' }, { status: 400 });
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const contenidoXml = buffer.toString('utf-8');

  const resultado = await importarMoodleXml(contenidoXml, sesion.usuario.id, documento.id);
  const { ip } = infoCliente(req);

  await auditar({
    actorId: sesion.usuario.id,
    accion: ACCIONES.PREGUNTAS_IMPORTADAS,
    tipoEntidad: 'Document',
    entidadId: documento.id,
    meta: { importadas: resultado.importadas, total: resultado.total },
    ip,
  });

  return NextResponse.json(resultado);
});
