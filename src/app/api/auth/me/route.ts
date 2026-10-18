import { ruta, respuestaOk } from '@/lib/http';
import { usuarioActual } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/auth/me */
export const GET = ruta(async () => {
  const usuario = await usuarioActual();
  return respuestaOk({ usuario });
});
