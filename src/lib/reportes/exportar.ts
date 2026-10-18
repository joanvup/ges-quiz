import { slug, etiqueta } from '@/lib/dominio/constantes';
import type { ReporteQuiz } from './servicio';

/* ------------------------------------------------------------------ *
 * Exportacion de reportes a CSV y Excel
 * ------------------------------------------------------------------ */

export type Fila = Array<string | number | null>;
export type HojaExcel = { nombre: string; filas: Fila[] };

const ETIQUETA_ESTADO_REPORTE: Record<string, string> = {
  SIN_INTENTAR: 'Sin intentar',
  EN_PROGRESO: 'En progreso',
  ENVIADO: 'Enviado',
  ANULADO: 'Anulado',
};

function aTexto(valor: string | number | null): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  return valor;
}

/**
 * Construye un CSV con separador `;` (el que Excel abre de forma nativa en
 * espanol) y BOM UTF-8 para que las tildes se vean correctamente.
 */
export function construirCsv(filas: Fila[], separador = ';'): string {
  const lineas = filas.map((fila) =>
    fila
      .map((celda) => {
        const texto = aTexto(celda);
        if (texto.includes(separador) || texto.includes('"') || texto.includes('\n') || texto.includes('\r')) {
          return `"${texto.replace(/"/g, '""')}"`;
        }
        return texto;
      })
      .join(separador),
  );
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function celdaXml(valor: string | number | null): string {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<Cell><Data ss:Type="Number">${valor}</Data></Cell>`;
  }
  const texto = aTexto(valor);
  if (texto === '') return '<Cell/>';
  return `<Cell><Data ss:Type="String">${escaparXml(texto)}</Data></Cell>`;
}

function nombreHojaSeguro(nombre: string): string {
  return nombre.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Hoja';
}

/**
 * Genera un libro Excel en formato SpreadsheetML 2003 (`.xls`), que Excel
 * abre sin dependencias externas y admite varias hojas.
 */
export function construirExcel(hojas: HojaExcel[]): string {
  const cuerpo = hojas
    .map((hoja) => {
      const filas = hoja.filas
        .map((fila) => `<Row>${fila.map(celdaXml).join('')}</Row>`)
        .join('');
      return `<Worksheet ss:Name="${escaparXml(nombreHojaSeguro(hoja.nombre))}"><Table>${filas}</Table></Worksheet>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="encabezado"><Font ss:Bold="1"/></Style></Styles>' +
    cuerpo +
    '</Workbook>'
  );
}

/** Filas del resumen general del quiz. */
export function filasResumen(reporte: ReporteQuiz): Fila[] {
  const r = reporte.resumen;
  return [
    ['Reporte del quiz', reporte.titulo],
    ['Estado', reporte.estado],
    ['Autor', reporte.autorNombre],
    ['Grupos', reporte.grupos.map((grupo) => grupo.nombre).join(', ') || 'Sin asignar'],
    ['Preguntas', reporte.totalPreguntas],
    ['Puntos totales', reporte.totalPuntos],
    ['Nota de aprobacion', `${reporte.notaAprobacion} / ${reporte.notaMaxima}`],
    ['Intentos maximos', reporte.intentosMaximos],
    [
      'Modo seguro',
      reporte.modoSeguro
        ? `Activo (umbral ${reporte.umbralInfracciones}, accion ${reporte.accionInfraccion})`
        : 'Desactivado',
    ],
    [],
    ['Estudiantes asignados', r.estudiantesAsignados],
    ['Sin intentar', r.sinIntentar],
    ['Intentos totales', r.intentosTotales],
    ['Enviados', r.enviados],
    ['En progreso', r.enProgreso],
    ['Anulados', r.anulados],
    ['Aprobados', r.aprobados],
    ['Tasa de aprobacion (%)', r.tasaAprobacion],
    ['Promedio de notas', r.promedioNota ?? ''],
    ['Tiempo promedio por intento (s)', r.tiempoPromedioSeg ?? ''],
    ['Infracciones totales', r.infraccionesTotales],
  ];
}

/** Filas del detalle por estudiante (tambien la base del CSV). */
export function filasEstudiantes(reporte: ReporteQuiz): Fila[] {
  const encabezado: Fila = [
    'Estudiante',
    'Correo',
    'Grupos',
    'Intentos',
    'Enviados',
    'Mejor nota',
    'Ultima nota',
    'Aprobada',
    'Tiempo total (s)',
    'Infracciones',
    'Estado',
  ];
  const filas = reporte.estudiantes.map<Fila>((estudiante) => [
    estudiante.nombre,
    estudiante.correo,
    estudiante.grupos.join(', '),
    estudiante.intentos,
    estudiante.enviados,
    estudiante.mejorNota ?? '',
    estudiante.ultimaNota ?? '',
    estudiante.aprobada === null ? '' : estudiante.aprobada ? 'Si' : 'No',
    estudiante.tiempoTotalSeg,
    estudiante.infracciones,
    etiqueta(ETIQUETA_ESTADO_REPORTE, estudiante.estado),
  ]);
  return [encabezado, ...filas];
}

/** Filas del analisis por pregunta. */
export function filasPreguntas(reporte: ReporteQuiz): Fila[] {
  const encabezado: Fila = [
    '#',
    'Enunciado',
    'Tipo',
    'Tema',
    'Puntos',
    'Presentadas',
    'Respondidas',
    'Correctas',
    'Omitidas',
    '% acierto',
    'Distribucion de opciones',
  ];
  const filas = reporte.preguntas.map<Fila>((pregunta) => [
    pregunta.posicion,
    pregunta.enunciado,
    pregunta.tipo,
    pregunta.tema ?? '',
    pregunta.puntos,
    pregunta.presentadas,
    pregunta.respondidas,
    pregunta.correctas,
    pregunta.omitidas,
    pregunta.porcentajeAcierto,
    pregunta.opciones
      .map((opcion) => `${opcion.etiqueta}: ${opcion.elegidas} (${opcion.porcentaje}%)`)
      .join(' | '),
  ]);
  return [encabezado, ...filas];
}

/** Filas con el detalle por opcion elegida (una fila por opcion). */
export function filasOpciones(reporte: ReporteQuiz): Fila[] {
  const encabezado: Fila = [
    '#',
    'Pregunta',
    'Opcion',
    'Texto',
    'Correcta',
    'Elegidas',
    '% sobre respondidas',
  ];
  const filas: Fila[] = [];
  for (const pregunta of reporte.preguntas) {
    for (const opcion of pregunta.opciones) {
      filas.push([
        pregunta.posicion,
        pregunta.enunciado,
        opcion.etiqueta,
        opcion.texto,
        opcion.correcta ? 'Si' : 'No',
        opcion.elegidas,
        opcion.porcentaje,
      ]);
    }
  }
  return [encabezado, ...filas];
}

/** Nombre de archivo estable y seguro para descargas. */
export function nombreArchivo(titulo: string, sufijo: string, extension: string): string {
  return `reporte-${slug(titulo) || 'quiz'}-${sufijo}.${extension}`;
}
