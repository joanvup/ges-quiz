import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_SESION = 'qc_session';

/**
 * Middleware de seguridad.
 *  1. Aplica cabeceras de seguridad (CSP, anti-framing, nosniff, etc.).
 *  2. Hace un control rapido de acceso: si no existe cookie de sesion en una
 *     ruta privada, redirige a /login. La autorizacion real (rol y propiedad
 *     del recurso) SIEMPRE se valida en el servidor, nunca aqui.
 */

const RUTAS_PUBLICAS = ['/login'];

function cabecerasSeguridad(respuesta: NextResponse, esDesarrollo: boolean): NextResponse {
  const csp = [
    "default-src 'self'",
    // Next.js inyecta scripts inline en el HTML; sin nonce necesitamos
    // 'unsafe-inline'. Ver README > Limitaciones y mejoras.
    `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    esDesarrollo ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ');

  respuesta.headers.set('Content-Security-Policy', csp);
  respuesta.headers.set('X-Frame-Options', 'DENY');
  respuesta.headers.set('X-Content-Type-Options', 'nosniff');
  respuesta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  respuesta.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)',
  );
  respuesta.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  respuesta.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  respuesta.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  if (!esDesarrollo) {
    respuesta.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return respuesta;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const esDesarrollo = process.env.NODE_ENV !== 'production';
  const tieneSesion = Boolean(req.cookies.get(COOKIE_SESION)?.value);

  // Las rutas de API responden JSON; no se redirigen, cada handler autentica.
  if (pathname.startsWith('/api')) {
    return cabecerasSeguridad(NextResponse.next(), esDesarrollo);
  }

  const esPublica = RUTAS_PUBLICAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));

  if (tieneSesion && pathname === '/login') {
    return cabecerasSeguridad(NextResponse.redirect(new URL('/panel', req.url)), esDesarrollo);
  }

  if (!esPublica && !tieneSesion) {
    const destino = new URL('/login', req.url);
    if (pathname !== '/') destino.searchParams.set('siguiente', `${pathname}${search}`);
    return cabecerasSeguridad(NextResponse.redirect(destino), esDesarrollo);
  }

  return cabecerasSeguridad(NextResponse.next(), esDesarrollo);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto estaticos de Next, imagenes y archivos comunes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|pdf)$).*)',
  ],
};
