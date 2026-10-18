import { z } from 'zod';
import { esRutaAbsoluta } from '@/lib/basedatos/conexion';

/** Motores que el usuario puede elegir como destino de una migracion. */
export const MOTORES_TUPLE = ['sqlite', 'postgresql', 'mysql'] as const;

const textoOpcional = (maximo: number) =>
  z.string().trim().max(maximo, `Maximo ${maximo} caracteres.`).optional().or(z.literal(''));

/** Numeros que llegan del formulario como texto. */
const numeroOpcional = (minimo: number, maximo: number) =>
  z.preprocess(
    (valor) => (valor === '' || valor === null || valor === undefined ? undefined : valor),
    z.coerce.number().int('Debe ser un numero entero.').min(minimo).max(maximo).optional(),
  );

export const esquemaConexion = z
  .object({
    motor: z.enum(MOTORES_TUPLE, { errorMap: () => ({ message: 'Motor no soportado.' }) }),
    host: textoOpcional(255),
    puerto: numeroOpcional(1, 65535),
    baseDatos: textoOpcional(120),
    usuario: textoOpcional(120),
    contrasena: z.string().max(300).optional(),
    ssl: z.boolean().optional(),
    archivo: textoOpcional(500),
  })
  .superRefine((valor, ctx) => {
    if (valor.motor === 'sqlite') {
      const archivo = valor.archivo?.trim() ?? '';
      if (!archivo) {
        ctx.addIssue({ code: 'custom', path: ['archivo'], message: 'Indica la ruta del archivo.' });
      } else if (!archivo.startsWith('file:') && !esRutaAbsoluta(archivo)) {
        ctx.addIssue({
          code: 'custom',
          path: ['archivo'],
          message: 'Usa una ruta absoluta, por ejemplo C:/datos/quizcolegio.db.',
        });
      }
      return;
    }
    if (!valor.host || !valor.host.trim()) {
      ctx.addIssue({ code: 'custom', path: ['host'], message: 'El servidor es obligatorio.' });
    }
    if (!valor.puerto) {
      ctx.addIssue({ code: 'custom', path: ['puerto'], message: 'El puerto es obligatorio.' });
    }
    if (!valor.baseDatos || !valor.baseDatos.trim()) {
      ctx.addIssue({ code: 'custom', path: ['baseDatos'], message: 'El nombre de la base es obligatorio.' });
    }
    if (!valor.usuario || !valor.usuario.trim()) {
      ctx.addIssue({ code: 'custom', path: ['usuario'], message: 'El usuario es obligatorio.' });
    }
  });

export const esquemaMigracion = z.object({
  conexion: esquemaConexion,
  cambiarConfiguracion: z.boolean().optional(),
});

export const esquemaProbarConexion = z.object({ conexion: esquemaConexion });

const valorRespaldo = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const esquemaRespaldo = z.object({
  version: z.number().int(),
  generadoEn: z.string().min(1),
  motor: z.string().min(1),
  tablas: z
    .array(
      z.object({
        tabla: z.string().min(1),
        columnas: z.array(z.string().min(1)),
        filas: z.array(z.array(valorRespaldo)),
      }),
    )
    .min(1, 'El respaldo no contiene tablas.'),
});

export type DatosConexion = z.infer<typeof esquemaConexion>;
export type DatosMigracion = z.infer<typeof esquemaMigracion>;
