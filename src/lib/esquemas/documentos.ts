import { z } from 'zod';
import { dificultadSchema, tipoPreguntaSchema } from '@/lib/dominio/constantes';

export const esquemaGenerar = z.object({
  fragmento: z.coerce.number().int().min(0, 'Fragmento invalido.').max(5000),
  cantidad: z.coerce
    .number()
    .int('La cantidad debe ser un numero entero.')
    .min(1, 'Genera al menos una pregunta.')
    .max(20, 'Maximo 20 preguntas por fragmento.'),
  tipos: z.array(tipoPreguntaSchema).min(1, 'Selecciona al menos un tipo de pregunta.').max(4),
  dificultad: dificultadSchema,
  idioma: z.string().trim().min(2, 'Indica el idioma.').max(40).default('espanol'),
  instruccionesExtra: z.string().trim().max(600).optional().or(z.literal('')),
});

export const esquemaImportar = z.object({
  fragmento: z.coerce.number().int().min(0).max(5000),
});

export const esquemaListarDocumentos = z.object({
  buscar: z.string().trim().max(120).optional(),
});

export type DatosGenerar = z.infer<typeof esquemaGenerar>;
export type DatosImportar = z.infer<typeof esquemaImportar>;
