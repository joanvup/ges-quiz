import { prisma } from '@/lib/db';
import { ruta, leerCuerpo, respuestaOk, infoCliente } from '@/lib/http';
import { requiereRolApi, verificarCsrf } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { esquemaCrearQuiz } from '@/lib/esquemas/quices';
import { INCLUDE_QUIZ, aQuizResumenDto } from '@/lib/quices/servicio';
import { obtenerAjusteBooleano, obtenerAjusteNumero } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/quices?estado=&buscar= */
export const GET = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('buscar')?.trim();

  const quices = await prisma.quiz.findMany({
    where: {
      ...(sesion.usuario.role === 'ADMIN' ? {} : { authorId: sesion.usuario.id }),
      ...(estado ? { status: estado } : {}),
      ...(buscar ? { title: { contains: buscar } } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }],
    include: INCLUDE_QUIZ,
  });

  return respuestaOk({ quices: quices.map(aQuizResumenDto) });
});

/** POST /api/quices - crea un borrador de quiz con la configuracion global. */
export const POST = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  verificarCsrf(req, sesion);
  const { ip } = infoCliente(req);
  const datos = await leerCuerpo(req, esquemaCrearQuiz);

  const [notaMinima, notaMaxima, intentos, umbral, modoSeguro] = await Promise.all([
    obtenerAjusteNumero('academico.notaMinima', 3),
    obtenerAjusteNumero('academico.notaMaxima', 5),
    obtenerAjusteNumero('quiz.intentosMaximos', 1),
    obtenerAjusteNumero('quiz.umbralInfracciones', 3),
    obtenerAjusteBooleano('quiz.modoSeguroPorDefecto', false),
  ]);

  const quiz = await prisma.quiz.create({
    data: {
      title: datos.titulo,
      description: datos.descripcion?.trim() || null,
      authorId: sesion.usuario.id,
      status: 'DRAFT',
      navigationMode: 'FREE',
      maxAttempts: Math.max(1, Math.min(10, Math.round(intentos))),
      defaultPoints: 1,
      passingScore: notaMinima,
      maxGrade: Math.max(1, notaMaxima),
      showResults: 'SCORE',
      allowReview: true,
      secureMode: modoSeguro,
      infractionThreshold: Math.max(1, Math.round(umbral)),
      infractionAction: 'AUTO_SUBMIT',
      blockWithoutFullscreen: true,
    },
    include: INCLUDE_QUIZ,
  });

  await auditar({
    accion: ACCIONES.QUIZ_CREADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: quiz.id,
    meta: { titulo: quiz.title },
    ip,
  });

  return respuestaOk({ quiz: aQuizResumenDto(quiz) }, 201);
});
