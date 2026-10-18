import { z } from 'zod';
import { MENSAJE_ANIO, normalizarAnioEscolar } from '@/lib/dominio/anio';

/**
 * El ano escolar se guarda como texto para permitir tanto un ano suelto
 * ("2026") como un ciclo lectivo ("2026-2027").
 */
export const esquemaAnioEscolar = z
  .string({ required_error: 'El ano escolar es obligatorio.' })
  .trim()
  .min(1, 'El ano escolar es obligatorio.')
  .transform((valor) => normalizarAnioEscolar(valor))
  .refine((valor): valor is string => valor !== null, MENSAJE_ANIO);

export const esquemaCrearGrupo = z.object({
  nombre: z.string().trim().min(2, 'Minimo 2 caracteres.').max(80),
  grado: z.string().trim().max(40).optional().or(z.literal('')),
  anio: esquemaAnioEscolar,
  descripcion: z.string().trim().max(300).optional().or(z.literal('')),
});

export const esquemaActualizarGrupo = esquemaCrearGrupo.partial().extend({
  activo: z.boolean().optional(),
});

export const esquemaMiembros = z.object({
  usuarioIds: z.array(z.string().min(1)).min(1, 'Selecciona al menos un estudiante.').max(200),
});

export const esquemaQuitarMiembro = z.object({
  usuarioId: z.string().min(1),
});

export type DatosCrearGrupo = z.infer<typeof esquemaCrearGrupo>;
export type DatosActualizarGrupo = z.infer<typeof esquemaActualizarGrupo>;
