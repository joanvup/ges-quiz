import { NextResponse, type NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

/** Error de API con codigo HTTP y codigo de negocio. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly detalles?: unknown;

  constructor(estado: number, codigo: string, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const noAutenticado = () =>
  new ErrorApi(401, 'NO_AUTENTICADO', 'Debes iniciar sesion para continuar.');
export const sinPermiso = () =>
  new ErrorApi(403, 'SIN_PERMISO', 'No tienes permisos para realizar esta accion.');
export const noEncontrado = (que = 'Recurso') =>
  new ErrorApi(404, 'NO_ENCONTRADO', `${que} no encontrado.`);
export const solicitudInvalida = (mensaje: string, detalles?: unknown) =>
  new ErrorApi(400, 'SOLICITUD_INVALIDA', mensaje, detalles);
export const conflicto = (mensaje: string) => new ErrorApi(409, 'CONFLICTO', mensaje);
export const demasiadasPeticiones = (mensaje: string, reintentarEn: number) =>
  new ErrorApi(429, 'DEMASIADAS_PETICIONES', mensaje, { reintentarEn });

export function respuestaOk<T>(datos: T, estado = 200): NextResponse {
  return NextResponse.json({ datos }, { status: estado });
}

function cuerpoError(estado: number, codigo: string, mensaje: string, campos?: unknown) {
  return NextResponse.json({ error: { codigo, mensaje, campos } }, { status: estado });
}

/** Convierte cualquier excepcion en una respuesta JSON homogenea. */
export function respuestaError(error: unknown): NextResponse {
  if (error instanceof ErrorApi) {
    return cuerpoError(error.estado, error.codigo, error.message, error.detalles);
  }
  if (error instanceof ZodError) {
    const campos: Record<string, string> = {};
    for (const problema of error.errors) {
      campos[problema.path.join('.') || '_'] = problema.message;
    }
    return cuerpoError(400, 'DATOS_INVALIDOS', 'Los datos enviados no son validos.', campos);
  }
  const mensaje = error instanceof Error ? error.message : 'Error desconocido';
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API]', error);
  }
  return cuerpoError(500, 'ERROR_INTERNO', `Error interno del servidor: ${mensaje}`);
}

type ContextoRuta<P> = { params: Promise<P> };

/**
 * Envuelve un handler de route de Next para capturar errores y
 * validar automaticamente.
 */
export function ruta<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: ContextoRuta<P>) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest, ctx: ContextoRuta<P>): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      return respuestaError(error);
    }
  };
}

/** Lee y valida el cuerpo JSON de una peticion. */
export async function leerCuerpo<E extends z.ZodTypeAny>(
  req: NextRequest,
  esquema: E,
): Promise<z.output<E>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw solicitudInvalida('El cuerpo de la peticion no es JSON valido.');
  }
  return validar(esquema, json);
}

/** Valida datos que pueden venir de query string, JSON o formulario. */
export function validar<E extends z.ZodTypeAny>(esquema: E, datos: unknown): z.output<E> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) throw resultado.error;
  return resultado.data;
}

/** Extrae datos de autenticacion del cliente (IP y user-agent). */
export function infoCliente(req: NextRequest): { ip: string | null; userAgent: string | null } {
  const reenviada = req.headers.get('x-forwarded-for');
  const ip = reenviada?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  return { ip, userAgent: req.headers.get('user-agent') };
}
