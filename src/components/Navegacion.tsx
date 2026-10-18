'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/cliente/api';
import { cx } from '@/components/ui';
import { Icono, type NombreIcono } from '@/components/iconos';

export type ItemNavegacion = { href: string; etiqueta: string; icono?: NombreIcono };

export function Navegacion({
  items,
  onNavegar,
}: {
  items: ItemNavegacion[];
  onNavegar?: () => void;
}) {
  const ruta = usePathname();
  return (
    <nav aria-label="Navegacion principal" className="flex flex-col gap-1">
      {items.map((item) => {
        const activo = ruta === item.href || ruta.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavegar}
            aria-current={activo ? 'page' : undefined}
            className={cx(
              'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              activo ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            {item.icono && <Icono nombre={item.icono} className="h-5 w-5 shrink-0" />}
            {item.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

export function BotonSalir({
  compacto = false,
  className,
}: {
  /** En pantallas pequenas muestra solo el icono (el texto aparece desde `sm`). */
  compacto?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      await api.post('/api/auth/logout');
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      aria-label="Cerrar sesion"
      className={cx(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60',
        className,
      )}
    >
      <Icono nombre="salir" className="h-5 w-5 shrink-0" />
      {compacto ? (
        <span className="hidden sm:inline">{saliendo ? 'Saliendo...' : 'Cerrar sesion'}</span>
      ) : (
        <span>{saliendo ? 'Saliendo...' : 'Cerrar sesion'}</span>
      )}
    </button>
  );
}
