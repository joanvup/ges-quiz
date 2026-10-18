import { prisma } from '@/lib/db';
import { huellaTexto } from '@/lib/auth/password';
import { estaDuplicada, type PreguntaExistente } from '@/lib/preguntas/deduplicar';

export type PreguntaNormalizada = {
  tipo: string;
  enunciado: string;
  explicacion?: string | null;
  tema?: string | null;
  pagina?: number | null;
  dificultad: string;
  respuestaPendiente?: boolean;
  opciones: {
    etiqueta?: string;
    texto: string;
    correcta: boolean;
  }[];
};

export type ResultadoGuardado = {
  creadas: number;
  omitidas: number;
  pendientes: number;
  ids: string[];
};

export async function guardarPreguntas(datos: {
  autorId: string;
  documentoId?: string | null;
  preguntas: PreguntaNormalizada[];
  origen: 'GENERATED' | 'IMPORTED' | 'MANUAL';
  llmModel?: string | null;
  umbralSimilitud?: number;
}): Promise<ResultadoGuardado> {
  const { autorId, documentoId, preguntas, origen, llmModel } = datos;

  const existentesDb = await prisma.question.findMany({
    where: documentoId
      ? { OR: [{ documentId: documentoId }, { authorId: autorId }] }
      : { authorId: autorId },
    select: { statement: true, fingerprint: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const existentes: PreguntaExistente[] = existentesDb.map((fila) => ({
    enunciado: fila.statement,
    huella: fila.fingerprint,
  }));

  let creadas = 0;
  let omitidas = 0;
  let pendientes = 0;
  const ids: string[] = [];

  for (const pregunta of preguntas) {
    const huella = huellaTexto(pregunta.enunciado);
    if (estaDuplicada(pregunta.enunciado, huella, existentes, datos.umbralSimilitud)) {
      omitidas += 1;
      continue;
    }

    const creada = await prisma.question.create({
      data: {
        type: pregunta.tipo,
        statement: pregunta.enunciado,
        explanation: pregunta.explicacion || null,
        topic: pregunta.tema || null,
        sourcePage: pregunta.pagina ?? null,
        difficulty: pregunta.dificultad,
        status: pregunta.respuestaPendiente ? 'PENDING_REVIEW' : 'DRAFT',
        points: 1,
        fingerprint: huella,
        origin: origen,
        llmModel: llmModel ?? null,
        answerPending: pregunta.respuestaPendiente,
        authorId: autorId,
        documentId: documentoId ?? null,
        options: {
          create: pregunta.opciones.map((opcion: { etiqueta?: string; texto: string; correcta: boolean }, indice: number) => ({
            label: opcion.etiqueta || String.fromCharCode(65 + indice),
            text: opcion.texto,
            isCorrect: opcion.correcta,
            position: indice,
          })),
        },
      },
      select: { id: true },
    });

    ids.push(creada.id);
    creadas += 1;
    if (pregunta.respuestaPendiente) pendientes += 1;
    existentes.push({ enunciado: pregunta.enunciado, huella });
  }

  return { creadas, omitidas, pendientes, ids };
}
