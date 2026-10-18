import type { NombreIcono } from '@/components/iconos';
import type { Rol } from '@/lib/dominio/constantes';

export type ItemMenu = { href: string; etiqueta: string; icono: NombreIcono };

/**
 * Menu lateral segun el rol. Se amplia en cada fase del proyecto.
 */
export function menuParaRol(rol: Rol | string): ItemMenu[] {
  const comunes: ItemMenu[] = [{ href: '/panel', etiqueta: 'Panel', icono: 'panel' }];

  if (rol === 'ADMIN') {
    return [
      ...comunes,
      { href: '/docentes/preguntas', etiqueta: 'Banco de preguntas', icono: 'preguntas' },
      { href: '/docentes/quices', etiqueta: 'Quices', icono: 'quices' },
      { href: '/reportes', etiqueta: 'Reportes', icono: 'reportes' },
      { href: '/admin/usuarios', etiqueta: 'Usuarios', icono: 'usuarios' },
      { href: '/admin/grupos', etiqueta: 'Grupos', icono: 'grupos' },
      { href: '/admin/importar', etiqueta: 'Importar datos', icono: 'importar' },
      { href: '/admin/base-datos', etiqueta: 'Base de datos', icono: 'baseDatos' },
      { href: '/admin/configuracion', etiqueta: 'Configuracion', icono: 'configuracion' },
      { href: '/admin/auditoria', etiqueta: 'Auditoria', icono: 'auditoria' },
    ];
  }

  if (rol === 'TEACHER') {
    return [
      ...comunes,
      { href: '/docentes/preguntas', etiqueta: 'Banco de preguntas', icono: 'preguntas' },
      { href: '/docentes/quices', etiqueta: 'Quices', icono: 'quices' },
      { href: '/reportes', etiqueta: 'Reportes', icono: 'reportes' },
    ];
  }

  return [...comunes, { href: '/estudiante/quices', etiqueta: 'Mis quices', icono: 'quices' }];
}
