import { NextResponse } from 'next/server';
import { ruta } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import { obtenerAjuste } from '@/lib/settings';
import { anioEscolarActual } from '@/lib/dominio/anio';
import {
  construirPlantilla,
  FORMATOS_PLANTILLA,
  type FormatoPlantilla,
} from '@/lib/importacion/plantilla';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/importar/plantilla?formato=csv|excel
 * Descarga la plantilla para importar estudiantes y grupos.
 */
export const GET = ruta(async (req) => {
  await requiereRolApi('ADMIN');

  const url = new URL(req.url);
  const formato: FormatoPlantilla = url.searchParams.get('formato') === 'excel' ? 'excel' : 'csv';
  const config = FORMATOS_PLANTILLA[formato];
  const anio = (await obtenerAjuste('institucion.anio')) || anioEscolarActual();
  const contenido = construirPlantilla(formato, anio);

  return new NextResponse(contenido, {
    headers: {
      'Content-Type': config.mime,
      'Content-Disposition': `attachment; filename="${config.nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
});
