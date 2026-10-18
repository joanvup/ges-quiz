import { construirCsv, construirExcel, type Fila } from '@/lib/reportes/exportar';

/**
 * Plantilla descargable para importar estudiantes y grupos.
 *
 * Se genera en dos formatos:
 *  - Excel (SpreadsheetML 2003, `.xls`): libro con las hojas "Datos" e
 *    "Instrucciones". Excel lo abre y lo guarda conservando el formato.
 *  - CSV (`.csv`, separador `;` y BOM UTF-8): una sola tabla "Datos".
 *
 * En ambos casos el importador acepta tambien el formato del otro, ademas de
 * XML Spreadsheet 2003 (`.xml`).
 */

const ENCABEZADO: Fila = ['tipo', 'nombre', 'correo', 'contrasena', 'grupo', 'grado', 'anio'];

/** Nombre de archivo y tipo MIME por formato. */
export const FORMATOS_PLANTILLA = {
  excel: {
    extension: 'xls',
    mime: 'application/vnd.ms-excel; charset=utf-8',
    nombre: 'plantilla-importacion-estudiantes-grupos.xls',
  },
  csv: {
    extension: 'csv',
    mime: 'text/csv; charset=utf-8',
    nombre: 'plantilla-importacion-estudiantes-grupos.csv',
  },
} as const;

export type FormatoPlantilla = keyof typeof FORMATOS_PLANTILLA;

function ejemplos(anio: string): Fila[] {
  return [
    // Las columnas son: tipo, nombre, correo, contrasena, grupo, grado, anio.
    ['ESTUDIANTE', 'Ana Gomez', 'ana.gomez@colegio.edu', 'Estudiante123!', 'Decimo A', '10', anio],
    ['ESTUDIANTE', 'Luis Perez', 'luis.perez@colegio.edu', '', 'Decimo A', '10', anio],
    ['GRUPO', 'Decimo A', '', '', '', '10', anio],
    ['GRUPO', 'Noveno B', '', '', '', '9', anio],
  ];
}

function instrucciones(): Fila[] {
  return [
    ['Como llenar la plantilla de importacion'],
    [],
    ['Escribe una fila por persona o grupo en la hoja "Datos". No cambies los encabezados.'],
    [],
    ['Columna', 'Descripcion'],
    ['tipo', 'Obligatorio. ESTUDIANTE o GRUPO.'],
    ['nombre', 'Nombre completo del estudiante, o nombre del grupo.'],
    ['correo', 'Correo electronico. Obligatorio para ESTUDIANTE.'],
    ['contrasena', 'Opcional (minimo 8 caracteres). Si se deja vacia se usa la contrasena por defecto.'],
    ['grupo', 'Solo para ESTUDIANTE: grupo al que pertenece. Si no existe, se crea.'],
    ['grado', 'Grado o nivel (para grupos o al crear uno nuevo).'],
    ['anio', 'Ano escolar del grupo: un ano (2026) o un ciclo (2026-2027). Si va vacio se usa el ano activo.'],
    [],
    ['Consejos'],
    ['- Los correos no pueden repetirse ni existir ya en el sistema.'],
    ['- Puedes importar solo estudiantes, solo grupos, o ambos a la vez.'],
    ['- Antes de importar, el sistema valida el archivo y te muestra los errores por fila.'],
  ];
}

/** Contenido de la plantilla Excel (libro con "Datos" e "Instrucciones"). */
export function construirPlantillaExcel(anio: string): string {
  return construirExcel([
    { nombre: 'Datos', filas: [ENCABEZADO, ...ejemplos(anio)] },
    { nombre: 'Instrucciones', filas: instrucciones() },
  ]);
}

/** Contenido de la plantilla CSV (solo la tabla "Datos"). */
export function construirPlantillaCsv(anio: string): string {
  return construirCsv([ENCABEZADO, ...ejemplos(anio)]);
}

/** Construye la plantilla en el formato indicado. */
export function construirPlantilla(formato: FormatoPlantilla, anio: string): string {
  return formato === 'csv' ? construirPlantillaCsv(anio) : construirPlantillaExcel(anio);
}
