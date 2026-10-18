import { z } from 'zod';

export const esquemaIniciarIntento = z.object({
  quizId: z.string().min(1, 'Quiz invalido.'),
});

export const esquemaGuardarRespuesta = z.object({
  preguntaId: z.string().min(1, 'Pregunta invalida.'),
  opciones: z
    .array(z.string().min(1, 'Opcion invalida.'))
    .max(10, 'Demasiadas opciones seleccionadas.')
    .default([]),
  texto: z.string().trim().max(1000, 'La respuesta es demasiado larga.').optional().nullable(),
});

export const esquemaEntregarIntento = z.object({
  confirmado: z.literal(true, {
    errorMap: () => ({ message: 'Debes confirmar el envio del intento.' }),
  }),
});

export type DatosGuardarRespuesta = z.infer<typeof esquemaGuardarRespuesta>;
