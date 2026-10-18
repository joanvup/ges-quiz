import { NextResponse, type NextRequest } from 'next/server';
import { requiereRolApi } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { infoCliente } from '@/lib/http';
import { importarMoodleXml } from '@/lib/moodle/importar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');

  const formData = await req.formData();
  const archivo = formData.get('archivo');
  if (!archivo || typeof archivo === 'string') {
    return NextResponse.json({ error: 'Archivo XML de Moodle no proporcionado' }, { status: 400 });
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const contenidoXml = buffer.toString('utf-8');

  const resultado = await importarMoodleXml(contenidoXml, sesion.usuario.id);
  const { ip } = infoCliente(req);

  await auditar({
    actorId: sesion.usuario.id,
    accion: ACCIONES.PREGUNTAS_IMPORTADAS,
    tipoEntidad: 'Question',
    entidadId: 'moodle-xml',
    meta: { importadas: resultado.importadas, total: resultado.total },
    ip,
  });

  return NextResponse.json(resultado);
}
