import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Iconos SVG propios (sin dependencias).
 *
 * Se usan en lugar de emojis porque las fuentes de emoji cambian de
 * forma y color en cada sistema operativo, mientras que estos heredan
 * el color del texto y se ven igual en Windows, Android, iOS y Linux.
 * ------------------------------------------------------------------ */

export type NombreIcono =
  | 'panel'
  | 'documento'
  | 'preguntas'
  | 'quices'
  | 'reportes'
  | 'usuarios'
  | 'grupos'
  | 'importar'
  | 'baseDatos'
  | 'configuracion'
  | 'auditoria'
  | 'salir'
  | 'menu'
  | 'cerrar'
  | 'flecha';

const TRAZOS: Record<NombreIcono, ReactNode> = {
  panel: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  documento: (
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  preguntas: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9.4a2.4 2.4 0 1 1 3.2 2.3c-.6.2-1 .8-1 1.4v.3" />
      <path d="M12 16.8h.01" />
    </>
  ),
  quices: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5.5H7a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-2" />
      <path d="m9.5 13 2 2 3.5-3.5" />
    </>
  ),
  reportes: (
    <>
      <path d="M3 20h18" />
      <path d="M6.5 20v-8M12 20V4M17.5 20v-5" />
    </>
  ),
  usuarios: (
    <>
      <path d="M15 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M17 4.6a3.5 3.5 0 0 1 0 6.7" />
      <path d="M21 20v-1.5a4 4 0 0 0-3-3.8" />
    </>
  ),
  grupos: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  importar: (
    <>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  baseDatos: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="3" />
      <path d="M5 5.5v13c0 1.7 3.1 3 7 3s7-1.3 7-3v-13" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  configuracion: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </>
  ),
  auditoria: (
    <>
      <path d="M12 3l7 3v6c0 4.4-2.9 7.6-7 9-4.1-1.4-7-4.6-7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="m10 8-4 4 4 4" />
      <path d="M6 12h9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  flecha: <path d="m9 6 6 6-6 6" />,
};

export function Icono({
  nombre,
  className = 'h-5 w-5',
}: {
  nombre: NombreIcono;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
