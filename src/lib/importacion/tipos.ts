/**
 * Tipos y error de la importacion de estudiantes y grupos desde un archivo
 * (plantilla de Excel / CSV).
 */

export class ErrorImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorImportacion';
  }
}

export const COLUMNAS_IMPORTACION = [
  'tipo',
  'nombre',
  'correo',
  'contrasena',
  'grupo',
  'grado',
  'anio',
] as const;

export type ColumnaImportacion = (typeof COLUMNAS_IMPORTACION)[number];

/** Una fila leida del archivo, ya mapeada a columnas conocidas. */
export type FilaCruda = {
  /** Numero de fila dentro de la hoja (1 = encabezado). */
  fila: number;
  valores: Partial<Record<ColumnaImportacion, string>>;
};

export type EstadoFila = 'LISTO' | 'ERROR' | 'DUPLICADO';

/** Resultado de validar una fila, tal como se le muestra al administrador. */
export type ResultadoFila = {
  fila: number;
  tipo: string;
  nombre: string;
  correo: string;
  grupo: string;
  estado: EstadoFila;
  mensajes: string[];
};

/** Fila validada lista para importarse. */
export type FilaLista =
  | {
      tipo: 'ESTUDIANTE';
      fila: number;
      nombre: string;
      correo: string;
      contrasena: string;
      grupo: string | null;
      grado: string;
      anio: string;
    }
  | {
      tipo: 'GRUPO';
      fila: number;
      nombre: string;
      grado: string;
      anio: string;
    };

export type ResumenImportacion = {
  total: number;
  listas: number;
  errores: number;
  duplicadas: number;
  estudiantes: number;
  grupos: number;
};

export type Analisis = {
  filas: ResultadoFila[];
  listas: FilaLista[];
  resumen: ResumenImportacion;
};
