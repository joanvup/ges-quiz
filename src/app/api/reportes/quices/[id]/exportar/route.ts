import { NextResponse } from 'next/server';
import { ruta, noEncontrado, solicitudInvalida, infoCliente } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import { obtenerQuizAutorizado } from '@/lib/quices/servicio';
import { obtenerReporteQuiz } from '@/lib/reportes/servicio';
import {
  construirCsv,
  construirExcel,
  filasOpciones,
  filasPreguntas,
  filasResumen,
  filasEstudiantes,
  nombreArchivo,
  type Fila,
} from '@/lib/reportes/exportar';
import { ACCIONES, auditar } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const TABLAS = {
  estudiantes: { sufijo: 'estudiantes', filas: filasEstudiantes },
  preguntas: { sufijo: 'preguntas', filas: filasPreguntas },
  opciones: { sufijo: 'opciones', filas: filasOpciones },
  resumen: { sufijo: 'resumen', filas: filasResumen },
} as const;

type NombreTabla = keyof typeof TABLAS;

function cabecerasDescarga(nombre: string, tipo: string): Record<string, string> {
  return {
    'Content-Type': tipo,
    'Content-Disposition': `attachment; filename="${nombre}"`,
    'Cache-Control': 'no-store',
  };
}

/**
 * GET /api/reportes/quices/[id]/exportar - descarga el reporte del quiz en CSV
 * (una tabla por archivo) o en Excel (libro con varias hojas). Solo el autor
 * del quiz o un administrador pueden exportar; cada descarga queda auditada.
 */
export const GET = ruta<Ctx['params']>(async (req, ctx) => {
  const sesion = await requiereRolApi('ADMIN', 'TEACHER');
  const { id } = await ctx.params;

  const quiz = await obtenerQuizAutorizado(id, sesion.usuario);
  const reporte = await obtenerReporteQuiz(quiz.id);
  if (!reporte) throw noEncontrado('Quiz');

  const url = new URL(req.url);
  const formato = url.searchParams.get('formato') === 'excel' ? 'excel' : 'csv';
  const { ip } = infoCliente(req);

  await auditar({
    accion: ACCIONES.REPORTE_EXPORTADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'Quiz',
    entidadId: quiz.id,
    meta: { formato, tabla: url.searchParams.get('tabla') ?? 'estudiantes' },
    ip,
  });

  if (formato === 'excel') {
    const contenido = construirExcel([
      { nombre: 'Resumen', filas: filasResumen(reporte) },
      { nombre: 'Estudiantes', filas: filasEstudiantes(reporte) },
      { nombre: 'Preguntas', filas: filasPreguntas(reporte) },
      { nombre: 'Opciones', filas: filasOpciones(reporte) },
    ]);
    return new NextResponse(contenido, {
      headers: cabecerasDescarga(
        nombreArchivo(reporte.titulo, 'reporte', 'xls'),
        'application/vnd.ms-excel; charset=utf-8',
      ),
    });
  }

  const tabla = (url.searchParams.get('tabla') ?? 'estudiantes') as NombreTabla;
  const seleccion = TABLAS[tabla];
  if (!seleccion) {
    throw solicitudInvalida('La tabla solicitada no es valida.');
  }

  const filas = seleccion.filas(reporte) as Fila[];
  const contenido = construirCsv(filas);
  return new NextResponse(contenido, {
    headers: cabecerasDescarga(
      nombreArchivo(reporte.titulo, seleccion.sufijo, 'csv'),
      'text/csv; charset=utf-8',
    ),
  });
});
