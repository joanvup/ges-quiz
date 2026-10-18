/**
 * Cliente HTTP para el navegador: adjunta automaticamente el token CSRF
 * leido de la cookie `qc_csrf` y normaliza los errores en espanol.
 */

export class ErrorPeticion extends Error {
  readonly codigo: string;
  readonly estado: number;
  readonly campos?: Record<string, string>;

  constructor(estado: number, codigo: string, mensaje: string, campos?: Record<string, string>) {
    super(mensaje);
    this.name = 'ErrorPeticion';
    this.estado = estado;
    this.codigo = codigo;
    this.campos = campos;
  }
}

/** Token CSRF de la cookie, necesario para subidas con XMLHttpRequest. */
export function leerTokenCsrf(): string | null {
  return leerCookie('qc_csrf');
}

function leerCookie(nombre: string): string | null {
  if (typeof document === 'undefined') return null;
  const partes = document.cookie.split(';').map((p) => p.trim());
  for (const parte of partes) {
    const [clave, ...resto] = parte.split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}

type Opciones = Omit<RequestInit, 'body'> & { cuerpo?: unknown; cuerpoCrudo?: BodyInit };

export async function peticion<T>(url: string, opciones: Opciones = {}): Promise<T> {
  const { cuerpo, cuerpoCrudo, headers, ...resto } = opciones;
  const metodo = (opciones.method ?? 'GET').toUpperCase();
  const cabeceras = new Headers(headers);

  if (cuerpo !== undefined && !cabeceras.has('content-type')) {
    cabeceras.set('content-type', 'application/json');
  }
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    const csrf = leerCookie('qc_csrf');
    if (csrf) cabeceras.set('x-csrf-token', csrf);
  }

  const respuesta = await fetch(url, {
    ...resto,
    method: metodo,
    headers: cabeceras,
    credentials: 'same-origin',
    body: cuerpoCrudo ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
  });

  const tipo = respuesta.headers.get('content-type') ?? '';
  const esJson = tipo.includes('application/json');
  const payload = esJson ? await respuesta.json() : await respuesta.text();

  if (!respuesta.ok) {
    if (esJson && payload && typeof payload === 'object' && 'error' in payload) {
      const error = (payload as { error: { codigo: string; mensaje: string; campos?: Record<string, string> } }).error;
      throw new ErrorPeticion(respuesta.status, error.codigo, error.mensaje, error.campos);
    }
    throw new ErrorPeticion(respuesta.status, 'ERROR_DESCONOCIDO', 'Ocurrio un error inesperado.');
  }

  if (esJson && payload && typeof payload === 'object' && 'datos' in payload) {
    return (payload as { datos: T }).datos;
  }
  return payload as T;
}

export const api = {
  get: <T>(url: string) => peticion<T>(url, { method: 'GET' }),
  post: <T>(url: string, cuerpo?: unknown) => peticion<T>(url, { method: 'POST', cuerpo }),
  patch: <T>(url: string, cuerpo?: unknown) => peticion<T>(url, { method: 'PATCH', cuerpo }),
  put: <T>(url: string, cuerpo?: unknown) => peticion<T>(url, { method: 'PUT', cuerpo }),
  del: <T>(url: string, cuerpo?: unknown) => peticion<T>(url, { method: 'DELETE', cuerpo }),
};
