import { z } from 'zod';
import {
  accionInfraccionSchema,
  modoNavegacionSchema,
  modoResultadoSchema,
} from '@/lib/dominio/constantes';

/**
 * Esquemas de validacion de quices.
 *
 * Las fechas se aceptan como ISO 8601 (lo que envia la interfaz) o como el
 * formato local de `<input type="datetime-local">`; el servicio las convierte
 * a Date antes de guardarlas.
 */
const fechaTexto = z
  .union([
    z.literal(''),
    z.string().datetime({ offset: true, message: 'La fecha no es valida.' }),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'La fecha no es valida.'),
  ])
  .nullable()
  .optional();

const titulo = z
  .string()
  .trim()
  .min(5, 'El titulo debe tener al menos 5 caracteres.')
  .max(160, 'El titulo es demasiado largo.');

const descripcion = z.string().trim().max(3000, 'La descripcion es demasiado larga.');

export const esquemaCrearQuiz = z.object({
  titulo,
  descripcion: descripcion.optional().or(z.literal('')),
});

export const esquemaActualizarQuiz = z.object({
  titulo: titulo.optional(),
  descripcion: descripcion.nullable().optional(),
  grupoIds: z
    .array(z.string().min(1, 'Grupo invalido.'))
    .max(50, 'Demasiados grupos asignados.')
    .optional(),
  fechaDisponibleDesde: fechaTexto,
  fechaDisponibleHasta: fechaTexto,
  navegacion: modoNavegacionSchema.optional(),
  tiempoTotalSeg: z.coerce
    .number()
    .int('El tiempo total debe ser un numero entero de segundos.')
    .min(30, 'El tiempo total debe ser de al menos 30 segundos.')
    .max(86_400, 'El tiempo total no puede superar 24 horas.')
    .nullable()
    .optional(),
  tiempoPorPreguntaSeg: z.coerce
    .number()
    .int('El tiempo por pregunta debe ser un numero entero de segundos.')
    .min(5, 'El tiempo por pregunta debe ser de al menos 5 segundos.')
    .max(3_600, 'El tiempo por pregunta no puede superar una hora.')
    .nullable()
    .optional(),
  mezclarPreguntas: z.boolean().optional(),
  mezclarOpciones: z.boolean().optional(),
  intentosMaximos: z.coerce
    .number()
    .int('Los intentos deben ser un numero entero.')
    .min(1, 'Debe permitirse al menos un intento.')
    .max(10, 'El maximo es 10 intentos.')
    .optional(),
  cantidadPreguntas: z.coerce
    .number()
    .int('La cantidad de preguntas debe ser un numero entero.')
    .min(1, 'La cantidad de preguntas debe ser al menos 1.')
    .max(300, 'La cantidad de preguntas es demasiado alta.')
    .nullable()
    .optional(),
  puntosPorDefecto: z.coerce
    .number()
    .min(0.1, 'Los puntos deben ser mayores que cero.')
    .max(100, 'El maximo de puntos por pregunta es 100.')
    .optional(),
  notaAprobacion: z.coerce
    .number()
    .min(0, 'La nota minima no puede ser negativa.')
    .max(100, 'La nota maxima es 100.')
    .optional(),
  notaMaxima: z.coerce
    .number()
    .min(1, 'La nota maxima debe ser al menos 1.')
    .max(100, 'La nota maxima es 100.')
    .optional(),
  mostrarResultados: modoResultadoSchema.optional(),
  permitirRevision: z.boolean().optional(),
  modoSeguro: z.boolean().optional(),
  umbralInfracciones: z.coerce
    .number()
    .int('El umbral debe ser un numero entero.')
    .min(1, 'El umbral debe ser al menos 1.')
    .max(50, 'El umbral maximo es 50.')
    .optional(),
  accionInfraccion: accionInfraccionSchema.optional(),
  bloquearSinPantallaCompleta: z.boolean().optional(),
});

export const esquemaPreguntasQuiz = z
  .object({
    preguntas: z
      .array(
        z.object({
          id: z.string().min(1, 'Pregunta invalida.'),
          puntos: z.coerce
            .number()
            .min(0.1, 'Los puntos deben ser mayores que cero.')
            .max(100, 'El maximo de puntos por pregunta es 100.')
            .optional(),
        }),
      )
      .max(300, 'Un quiz no puede tener mas de 300 preguntas.'),
  })
  .superRefine((datos, ctx) => {
    const ids = new Set<string>();
    datos.preguntas.forEach((pregunta, indice) => {
      if (ids.has(pregunta.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['preguntas', indice, 'id'],
          message: 'La misma pregunta aparece dos veces.',
        });
      }
      ids.add(pregunta.id);
    });
  });

export const esquemaPublicarQuiz = z.object({
  confirmoRevision: z.literal(true, {
    errorMap: () => ({
      message: 'Debes confirmar que revisaste las preguntas antes de publicar.',
    }),
  }),
});

export type DatosCrearQuiz = z.infer<typeof esquemaCrearQuiz>;
export type DatosActualizarQuiz = z.infer<typeof esquemaActualizarQuiz>;
export type DatosPreguntasQuiz = z.infer<typeof esquemaPreguntasQuiz>;

/** Convierte un texto de fecha del esquema a Date (o null). */
export function fechaDesdeTexto(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
