import { z } from 'zod';
import { tipoEventoProctorSchema } from '@/lib/dominio/constantes';

/**
 * Evento de proctoring que envia el navegador durante un intento en modo
 * seguro. El servidor decide su gravedad y si cuenta como infraccion: nunca se
 * confia en el cliente para eso.
 */
export const esquemaEventoProctor = z.object({
  tipo: tipoEventoProctorSchema,
  detalle: z.string().trim().max(300, 'El detalle es demasiado largo.').optional().nullable(),
  clientTs: z
    .string()
    .datetime({ offset: true, message: 'La marca de tiempo no es valida.' })
    .optional()
    .nullable(),
});

export type DatosEventoProctor = z.infer<typeof esquemaEventoProctor>;
