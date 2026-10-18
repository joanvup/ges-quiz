import type { PreguntaDto } from '@/lib/cliente/tipos';

type EntradaPregunta = {
  id: string;
  type: string;
  statement: string;
  explanation: string | null;
  topic: string | null;
  sourcePage: number | null;
  difficulty: string;
  status: string;
  origin: string;
  points: number;
  answerPending: boolean;
  createdAt: Date;
  document?: { id: string; title: string } | null;
  options: { id: string; label: string; text: string; isCorrect: boolean }[];
  _count?: { quizzes: number };
};

/** Convierte una pregunta de Prisma al DTO que consume la interfaz. */
export function aPreguntaDto(pregunta: EntradaPregunta): PreguntaDto {
  return {
    id: pregunta.id,
    tipo: pregunta.type,
    enunciado: pregunta.statement,
    explicacion: pregunta.explanation,
    tema: pregunta.topic,
    pagina: pregunta.sourcePage,
    dificultad: pregunta.difficulty,
    estado: pregunta.status,
    origen: pregunta.origin,
    puntos: pregunta.points,
    respuestaPendiente: pregunta.answerPending,
    creadaEn: pregunta.createdAt.toISOString(),
    documento: pregunta.document
      ? { id: pregunta.document.id, titulo: pregunta.document.title }
      : null,
    usadaEnQuices: pregunta._count?.quizzes ?? 0,
    opciones: pregunta.options
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((opcion) => ({
        id: opcion.id,
        etiqueta: opcion.label,
        texto: opcion.text,
        correcta: opcion.isCorrect,
      })),
  };
}

/** Consulta reutilizable con las relaciones necesarias para el DTO. */
export const INCLUDE_PREGUNTA_DTO = {
  options: { orderBy: { position: 'asc' } },
  document: { select: { id: true, title: true } },
  _count: { select: { quizzes: true } },
} as const;
