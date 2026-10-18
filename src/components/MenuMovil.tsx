'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BotonSalir, Navegacion, type ItemNavegacion } from '@/components/Navegacion';
import { Icono } from '@/components/iconos';

const SELECTOR_ENFOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Menu de navegacion para pantallas pequenas.
 *
 * Antes la navegacion se apilaba encima del contenido (hasta 10 enlaces
 * seguidos) y habia que desplazarse para ver la pagina. Ahora se abre en
 * un panel lateral con estas garantias:
 *   - Se cierra con Escape, con el boton de cerrar, tocando fuera o al
 *     navegar a otra seccion.
 *   - El foco no puede salir del panel mientras esta abierto.
 *   - Se bloquea el desplazamiento del fondo y se devuelve el foco al
 *     boton que lo abrio.
 */
export function MenuMovil({
  items,
  nombreInstitucion,
}: {
  items: ItemNavegacion[];
  nombreInstitucion?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const ruta = usePathname();

  // Al cambiar de seccion el panel deja de tener sentido.
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  useEffect(() => {
    if (!abierto) return;

    const focoPrevio = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const enfocables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES) ?? []);

    enfocables()[0]?.focus();

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setAbierto(false);
        return;
      }
      if (evento.key !== 'Tab') return;

      const lista = enfocables();
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!primero || !ultimo) return;

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      document.body.style.overflow = overflowPrevio;
      focoPrevio?.focus?.();
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menu de navegacion"
        aria-expanded={abierto}
        aria-controls="menu-movil"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
      >
        <Icono nombre="menu" />
      </button>

      {abierto && (
        <div
          id="menu-movil"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegacion"
          className="no-imprimir fixed inset-0 z-50 lg:hidden"
        >
          <div
            aria-hidden="true"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 animate-fade-in bg-slate-900/50"
          />
          <div
            ref={panelRef}
            className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs animate-deslizar-entrada flex-col bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">QuizColegio</p>
                {nombreInstitucion && (
                  <p className="truncate text-xs text-slate-500">{nombreInstitucion}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menu"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
              >
                <Icono nombre="cerrar" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <Navegacion items={items} onNavegar={() => setAbierto(false)} />
            </div>

            <div className="border-t border-slate-200 p-3">
              <BotonSalir className="w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
