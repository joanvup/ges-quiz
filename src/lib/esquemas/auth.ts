import { z } from 'zod';

export const esquemaLogin = z.object({
  correo: z
    .string({ required_error: 'El correo es obligatorio.' })
    .trim()
    .toLowerCase()
    .email('Escribe un correo electronico valido.')
    .max(160),
  contrasena: z
    .string({ required_error: 'La contrasena es obligatoria.' })
    .min(1, 'La contrasena es obligatoria.')
    .max(200),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
