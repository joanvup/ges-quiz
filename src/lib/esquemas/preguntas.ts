import { z } from 'zod';
import { dificultadSchema, tipoPreguntaSchema } from '@/lib/dominio/constantes';

export const opcionEntradaSchema = z.object({
  texto: z.string().trim().min(1, 'La opcion no puede estar vacia.').max(600),
  correcta: z.boolean(),
});

const basePregunta = z.object({
  enunciado: z
    .string()
    .trim()
    .min(8, 'El enunciado debe tener al menos 8 caracteres.')
    .max(2000, 'El enunciado es demasiado largo.'),
  tipo: tipoPreguntaSchema,
  opciones: z.array(opcionEntradaSchema).max(10).default([]),
  explicacion: z.string().trim().max(1200).optional().or(z.literal('')),
  tema: z.string().trim().max(160).optional().or(z.literal('')),
  pagina: z.coerce.number().int().positive().max(100000).optional(),
  dificultad: dificultadSchema.default('MEDIUM'),
  estado: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED']).optional(),
  documentoId: z.string().min(1).nullable().optional(),
});

/** Reglas de coherencia entre tipo de pregunta y opciones. */
function coherente(datos: {
  tipo: string;
  opciones: { texto: string; correcta: boolean }[];
}): string | null {
  const correctas = datos.opciones.filter((o) => o.correcta).length;
  if (datos.tipo === 'SHORT_ANSWER') {
    if (datos.opciones.length > 1) return 'Una respuesta corta admite como maximo una opcion.';
    return null;
  }
  if (datos.tipo === 'TRUE_FALSE') {
    if (datos.opciones.length !== 2) return 'Verdadero/Falso requiere exactamente dos opciones.';
    if (correctas !== 1) return 'Marca exactamente una opcion correcta.';
    return null;
  }
  if (datos.tipo === 'MCQ_SINGLE') {
    if (datos.opciones.length < 2) return 'Necesitas al menos dos opciones.';
    if (correctas !== 1) return 'Marca exactamente una opcion correcta.';
    return null;
  }
  if (datos.tipo === 'MCQ_MULTI') {
    if (datos.opciones.length < 2) return 'Necesitas al menos dos opciones.';
    if (correctas < 1) return 'Marca al menos una opcion correcta.';
    return null;
  }
  return null;
}

export const esquemaCrearPregunta = basePregunta.superRefine((datos, ctx) => {
  const problema = coherente(datos);
  if (problema) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['opciones'], message: problema });
});

export const esquemaActualizarPregunta = basePregunta
  .partial()
  .superRefine((datos, ctx) => {
    if (datos.tipo && datos.opciones) {
      const problema = coherente({ tipo: datos.tipo, opciones: datos.opciones });
      if (problema) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['opciones'], message: problema });
    }
  });

/** Borra un banco completo: el de un documento (PDF) o el general (documentoId null). */
export const esquemaEliminarBanco = z.object({
  documentoId: z.string().trim().min(1).nullable().default(null),
});

export type DatosCrearPregunta = z.infer<typeof esquemaCrearPregunta>;
export type DatosActualizarPregunta = z.infer<typeof esquemaActualizarPregunta>;
export type DatosEliminarBanco = z.infer<typeof esquemaEliminarBanco>;
