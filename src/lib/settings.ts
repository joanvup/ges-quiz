import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { MENSAJE_ANIO, anioEscolarActual, normalizarAnioEscolar } from '@/lib/dominio/anio';

/**
 * Configuracion global del sistema (tabla `Setting`).
 * Todo se guarda como texto y se valida segun la definicion.
 */

export type DefinicionAjuste = {
  clave: string;
  etiqueta: string;
  descripcion: string;
  tipo: 'texto' | 'entero' | 'decimal' | 'booleano';
  /** Formato especial aplicado a los ajustes de tipo texto. */
  formato?: 'anio';
  porDefecto: string;
  min?: number;
  max?: number;
  grupo: 'institucion' | 'academico' | 'quiz' | 'archivos' | 'seguridad';
};

export const DEFINICIONES_AJUSTES: DefinicionAjuste[] = [
  {
    clave: 'institucion.nombre',
    etiqueta: 'Nombre de la institucion',
    descripcion: 'Aparece en el encabezado y en los reportes exportados.',
    tipo: 'texto',
    porDefecto: 'Colegio San Ejemplo',
    grupo: 'institucion',
  },
  {
    clave: 'institucion.anio',
    etiqueta: 'Ano escolar activo',
    descripcion:
      'Ano lectivo usado por defecto al crear grupos. Admite un ano (2026) o un ciclo (2026-2027).',
    tipo: 'texto',
    formato: 'anio',
    porDefecto: anioEscolarActual(),
    grupo: 'institucion',
  },
  {
    clave: 'academico.notaMinima',
    etiqueta: 'Nota minima de aprobacion',
    descripcion: 'Valor por defecto al crear un quiz.',
    tipo: 'decimal',
    porDefecto: '3',
    min: 0,
    max: 100,
    grupo: 'academico',
  },
  {
    clave: 'academico.notaMaxima',
    etiqueta: 'Nota maxima',
    descripcion: 'Escala maxima de calificacion (por ejemplo 5 o 100).',
    tipo: 'decimal',
    porDefecto: '5',
    min: 1,
    max: 100,
    grupo: 'academico',
  },
  {
    clave: 'quiz.intentosMaximos',
    etiqueta: 'Intentos maximos por defecto',
    descripcion: 'Numero de intentos permitidos al crear un quiz nuevo.',
    tipo: 'entero',
    porDefecto: '1',
    min: 1,
    max: 10,
    grupo: 'quiz',
  },
  {
    clave: 'quiz.modoSeguroPorDefecto',
    etiqueta: 'Modo seguro activado por defecto',
    descripcion: 'Si esta activo, los quices nuevos nacen con modo seguro.',
    tipo: 'booleano',
    porDefecto: 'false',
    grupo: 'seguridad',
  },
  {
    clave: 'quiz.umbralInfracciones',
    etiqueta: 'Umbral de infracciones por defecto',
    descripcion:
      'Numero de infracciones que se pueden acumular; al alcanzar esta cantidad se aplica la sancion.',
    tipo: 'entero',
    porDefecto: '3',
    min: 1,
    max: 50,
    grupo: 'seguridad',
  },
  {
    clave: 'archivos.maxMB',
    etiqueta: 'Tamano maximo por PDF (MB)',
    descripcion: 'Limite de subida por archivo. Requiere reiniciar para valores mayores al de la variable de entorno.',
    tipo: 'entero',
    porDefecto: String(env.maxUploadMb),
    min: 1,
    max: 200,
    grupo: 'archivos',
  },
  {
    clave: 'seguridad.contrasenaPorDefecto',
    etiqueta: 'Contrasena por defecto para importaciones',
    descripcion: 'Se asigna a los estudiantes importados desde un archivo que no traigan contrasena (minimo 8 caracteres).',
    tipo: 'texto',
    porDefecto: 'Estudiante123!',
    grupo: 'seguridad',
  },
];

export const CLAVES_AJUSTES = DEFINICIONES_AJUSTES.map((d) => d.clave);

function validador(def: DefinicionAjuste): z.ZodType<string> {
  if (def.tipo === 'booleano') {
    return z.enum(['true', 'false'], {
      errorMap: () => ({ message: 'Debe ser "true" o "false".' }),
    });
  }
  if (def.tipo === 'texto') {
    const texto = z.string().trim().min(1, 'No puede estar vacio.').max(160);
    if (def.formato === 'anio') {
      return texto
        .transform((valor) => normalizarAnioEscolar(valor))
        .refine((valor): valor is string => valor !== null, MENSAJE_ANIO);
    }
    return texto;
  }
  const num = z
    .string()
    .trim()
    .refine((v) => v !== '' && Number.isFinite(Number(v)), 'Debe ser un numero.');
  return num
    .refine((v) => def.min === undefined || Number(v) >= def.min, `Minimo ${def.min}.`)
    .refine((v) => def.max === undefined || Number(v) <= def.max, `Maximo ${def.max}.`)
    .refine(
      (v) => def.tipo !== 'entero' || Number.isInteger(Number(v)),
      'Debe ser un numero entero.',
    );
}

export const esquemaAjustes = z
  .object(
    Object.fromEntries(DEFINICIONES_AJUSTES.map((d) => [d.clave, validador(d)])) as Record<
      string,
      z.ZodType<string>
    >,
  )
  .partial();

export type Ajustes = Record<string, string>;

/** Ajustes por defecto (sin consultar la base). */
export function ajustesPorDefecto(): Ajustes {
  return Object.fromEntries(DEFINICIONES_AJUSTES.map((d) => [d.clave, d.porDefecto]));
}

/** Lee todos los ajustes, completando con los valores por defecto. */
export async function obtenerAjustes(): Promise<Ajustes> {
  const filas = await prisma.setting.findMany();
  const resultado = ajustesPorDefecto();
  for (const fila of filas) {
    if (fila.key in resultado) resultado[fila.key] = fila.value;
  }
  return resultado;
}

/** Lee un unico ajuste. */
export async function obtenerAjuste(clave: string): Promise<string> {
  const fila = await prisma.setting.findUnique({ where: { key: clave } });
  if (fila) return fila.value;
  return DEFINICIONES_AJUSTES.find((d) => d.clave === clave)?.porDefecto ?? '';
}

export async function obtenerAjusteNumero(clave: string, porDefecto = 0): Promise<number> {
  const valor = await obtenerAjuste(clave);
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

export async function obtenerAjusteBooleano(clave: string, porDefecto = false): Promise<boolean> {
  const valor = await obtenerAjuste(clave);
  if (valor === '') return porDefecto;
  return valor === 'true';
}

/** Guarda (upsert) un conjunto de ajustes ya validados. */
export async function guardarAjustes(parcial: Record<string, string | undefined>): Promise<void> {
  const entradas = Object.entries(parcial).filter(
    (entrada): entrada is [string, string] =>
      entrada[1] !== undefined && CLAVES_AJUSTES.includes(entrada[0]),
  );
  for (const [clave, valor] of entradas) {
    await prisma.setting.upsert({
      where: { key: clave },
      create: { key: clave, value: valor },
      update: { value: valor },
    });
  }
}
