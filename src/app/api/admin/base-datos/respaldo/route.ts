import { NextResponse } from 'next/server';
import { ruta, infoCliente } from '@/lib/http';
import { requiereRolApi } from '@/lib/auth/guard';
import { auditar, ACCIONES } from '@/lib/audit';
import { convertirError, crearRespaldo, type FormatoRespaldo, type Respaldo } from '@/lib/basedatos/servicio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/admin/base-datos/respaldo?formato=sql|json
 * Descarga un respaldo completo de la base de datos activa
 * (funciona con SQLite, PostgreSQL y MySQL).
 */
export const GET = ruta(async (req) => {
  const sesion = await requiereRolApi('ADMIN');
  const { ip } = infoCliente(req);
  const parametro = new URL(req.url).searchParams.get('formato');
  const formato: FormatoRespaldo = parametro === 'json' ? 'json' : 'sql';

  let respaldo: Respaldo;
  try {
    respaldo = await crearRespaldo(formato);
  } catch (error) {
    throw convertirError(error);
  }

  await auditar({
    accion: ACCIONES.RESPALDO_GENERADO,
    actorId: sesion.usuario.id,
    tipoEntidad: 'BaseDatos',
    meta: { formato, archivo: respaldo.nombre },
    ip,
  });

  return new NextResponse(respaldo.contenido, {
    headers: {
      'Content-Type': respaldo.mime,
      'Content-Disposition': `attachment; filename="${respaldo.nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
});
