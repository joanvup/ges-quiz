import { z } from 'zod';
import { rolSchema } from '@/lib/dominio/constantes';

export const esquemaCrearUsuario = z.object({
  nombre: z.string().trim().min(3, 'Minimo 3 caracteres.').max(80),
  correo: z.string().trim().toLowerCase().email('Correo invalido.').max(160),
  contrasena: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .max(72, 'La contrasena no puede superar 72 caracteres.'),
  rol: rolSchema,
  activo: z.boolean().default(true),
  grupos: z.array(z.string().min(1)).max(50).default([]),
});

export const esquemaActualizarUsuario = z.object({
  nombre: z.string().trim().min(3, 'Minimo 3 caracteres.').max(80).optional(),
  correo: z.string().trim().toLowerCase().email('Correo invalido.').max(160).optional(),
  contrasena: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .max(72, 'La contrasena no puede superar 72 caracteres.')
    .optional(),
  rol: rolSchema.optional(),
  activo: z.boolean().optional(),
  grupos: z.array(z.string().min(1)).max(50).optional(),
});

export type DatosCrearUsuario = z.infer<typeof esquemaCrearUsuario>;
export type DatosActualizarUsuario = z.infer<typeof esquemaActualizarUsuario>;
