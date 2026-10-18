import { prisma } from '@/lib/db';
import { ruta, leerCuerpo, respuestaOk, infoCliente, solicitudInvalida } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { huellaTexto } from '@/lib/auth/password';
import { esquemaCrearPregunta } from '@/lib/esquemas/preguntas';
import { aPreguntaDto, INCLUDE_PREGUNTA_DTO } from '@/lib/preguntas/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/preguntas?documentoId=&tipo=&estado=&buscar=&limite= */
export const GET = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const url = new URL(req.url);
  const documentoId = url.searchParams.get('documentoId');
  const tipo = url.searchParams.get('tipo');
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('buscar')?.trim();
  const limite = Math.min(Number(url.searchParams.get('limite') ?? 200) || 200, 500);

  const preguntas = await prisma.question.findMany({
    where: {
      ...(sesion.usuario.role === 'ADMIN' ? {} : { authorId: sesion.usuario.id }),
      ...(documentoId ? { documentId: documentoId } : {}),
      ...(tipo ? { type: tipo } : {}),
      ...(estado ? { status: estado } : {}),
      ...(buscar ? { statement: { contains: buscar } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: limite,
    include: INCLUDE_PREGUNTA_DTO,
  });

  return respuestaOk({ preguntas: preguntas.map((pregunta) => aPreguntaDto(pregunta)) });
});

/** POST /api/preguntas - crea una pregunta manual. */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const datos = await leerCuerpo(req, esquemaCrearPregunta);

  if (datos.documentoId) {
    const documento = await prisma.document.findUnique({
      where: { id: datos.documentoId },
      select: { uploadedById: true },
    });
    if (!documento) throw solicitudInvalida('El documento indicado no existe.');
    if (sesion.usuario.role !== 'ADMIN' && documento.uploadedById !== sesion.usuario.id) {
      throw solicitudInvalida('No puedes asociar preguntas a un documento de otro docente.');
    }
  }

  const creada = await prisma.question.create({
    data: {
      type: datos.tipo,
      statement: datos.enunciado,
      explanation: datos.explicacion || null,
      topic: datos.tema || null,
      sourcePage: datos.pagina ?? null,
      difficulty: datos.dificultad,
      status: datos.estado ?? 'DRAFT',
      points: 1,
      fingerprint: huellaTexto(datos.enunciado),
      origin: 'MANUAL',
      answerPending: false,
      authorId: sesion.usuario.id,
      documentId: datos.documentoId ?? null,
      options: {
        create: datos.opciones.map((opcion, indice) => ({
          label: String.fromCharCode(65 + indice),
          text: opcion.texto,
          isCorrect: opcion.correcta,
          position: indice,
        })),
      },
    },
    select: { id: true },
  });

  return respuestaOk({ id: creada.id }, 201);
});
