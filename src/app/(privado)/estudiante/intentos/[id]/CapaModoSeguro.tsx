'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Boton } from '@/components/ui';
import type { TipoEventoProctor } from '@/lib/dominio/constantes';

/** Atajos de teclado restringidos durante el modo seguro. */
const ATAJOS_BLOQUEADOS = ['c', 'x', 'v', 'p', 's', 'a', 'u', 'f'];

/**
 * Capa de modo seguro alrededor del motor del intento.
 *
 * Lo que SI hace (y se registra en el servidor):
 *  - exige pantalla completa antes y durante el intento;
 *  - detecta y reporta salidas de pantalla completa, cambios de pestana,
 *    perdida de foco, menu contextual, copiar/cortar/pegar, impresion,
 *    seleccion de texto y atajos restringidos;
 *  - pausa la interfaz (superponiendo un aviso) cuando se sale de pantalla
 *    completa o se oculta la pestana, y exige volver a entrar;
 *  - bloquea el intento en navegadores sin API de pantalla completa cuando el
 *    quiz asi lo exige.
 *
 * Lo que NO puede hacer (limitacion honesta del navegador, documentada en el
 * README): no puede impedir que el estudiante cambie de pestana, abra otra
 * aplicacion o haga capturas de pantalla. Solo puede detectarlo y registrarlo.
 */
export function CapaModoSeguro({
  activo,
  bloquearSinSoporte,
  onEvento,
  children,
}: {
  activo: boolean;
  bloquearSinSoporte: boolean;
  onEvento: (tipo: TipoEventoProctor, detalle?: string) => void;
  children: React.ReactNode;
}) {
  const [soportado, setSoportado] = useState(true);
  const [iniciado, setIniciado] = useState(!activo);
  const [pausado, setPausado] = useState(false);
  const [mensajePausa, setMensajePausa] = useState<string | null>(null);
  const ultimoEventoRef = useRef<{ tipo: string; ts: number } | null>(null);

  const emitir = useCallback(
    (tipo: TipoEventoProctor, detalle?: string) => {
      const ahora = Date.now();
      const ultimo = ultimoEventoRef.current;
      if (ultimo && ultimo.tipo === tipo && ahora - ultimo.ts < 800) return;
      ultimoEventoRef.current = { tipo, ts: ahora };
      onEvento(tipo, detalle);
    },
    [onEvento],
  );

  // Deteccion de soporte de la API de pantalla completa.
  useEffect(() => {
    if (!activo) return;
    const soporte =
      typeof document !== 'undefined' &&
      document.fullscreenEnabled === true &&
      typeof document.documentElement.requestFullscreen === 'function';
    setSoportado(soporte);
    if (!soporte) {
      emitir('NO_FULLSCREEN_SUPPORT', 'El navegador no admite la API de pantalla completa.');
    }
  }, [activo, emitir]);

  // Si ya estamos en pantalla completa (por ejemplo al venir del boton Comenzar).
  useEffect(() => {
    if (activo && typeof document !== 'undefined' && document.fullscreenElement) {
      setIniciado(true);
    }
  }, [activo]);

  const entrarPantallaCompleta = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIniciado(true);
      setPausado(false);
      setMensajePausa(null);
      emitir('FULLSCREEN_ENTER');
    } catch {
      setMensajePausa('No se pudo activar la pantalla completa. Vuelve a intentarlo.');
    }
  }, [emitir]);

  const reanudar = useCallback(async () => {
    await entrarPantallaCompleta();
    emitir('RESUMED');
  }, [entrarPantallaCompleta, emitir]);

  // Escuchas de eventos durante el intento en modo seguro.
  useEffect(() => {
    if (!activo || !iniciado) return;

    const alCambiarPantalla = () => {
      if (document.fullscreenElement) {
        setPausado(false);
        setMensajePausa(null);
        emitir('FULLSCREEN_ENTER');
      } else {
        emitir('FULLSCREEN_EXIT');
        setPausado(true);
        setMensajePausa('Saliste de pantalla completa. El intento quedo en pausa.');
      }
    };
    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        emitir('TAB_HIDDEN');
        setPausado(true);
        setMensajePausa('La pestana dejo de estar visible. El intento quedo en pausa.');
      }
    };
    const alPerderFoco = () => emitir('WINDOW_BLUR');
    const alMenu = (evento: MouseEvent) => {
      evento.preventDefault();
      emitir('CONTEXT_MENU');
    };
    const alPortapapeles = (evento: ClipboardEvent) => {
      evento.preventDefault();
      const tipo: TipoEventoProctor =
        evento.type === 'copy' ? 'COPY' : evento.type === 'cut' ? 'CUT' : 'PASTE';
      emitir(tipo);
    };
    const alSeleccionar = (evento: Event) => {
      evento.preventDefault();
      emitir('SELECTION');
    };
    const alImprimir = () => emitir('PRINT');
    const alTecla = (evento: KeyboardEvent) => {
      const conCtrl = evento.ctrlKey || evento.metaKey;
      const tecla = evento.key.toLowerCase();
      const restringida =
        (conCtrl && ATAJOS_BLOQUEADOS.includes(tecla)) ||
        evento.key === 'PrintScreen' ||
        evento.key === 'F12';
      if (restringida) {
        evento.preventDefault();
        emitir('SHORTCUT', `${conCtrl ? 'Ctrl+' : ''}${evento.key}`);
      }
    };

    document.addEventListener('fullscreenchange', alCambiarPantalla);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('blur', alPerderFoco);
    document.addEventListener('contextmenu', alMenu);
    document.addEventListener('copy', alPortapapeles);
    document.addEventListener('cut', alPortapapeles);
    document.addEventListener('paste', alPortapapeles);
    document.addEventListener('selectstart', alSeleccionar);
    document.addEventListener('keydown', alTecla);
    window.addEventListener('beforeprint', alImprimir);

    return () => {
      document.removeEventListener('fullscreenchange', alCambiarPantalla);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('blur', alPerderFoco);
      document.removeEventListener('contextmenu', alMenu);
      document.removeEventListener('copy', alPortapapeles);
      document.removeEventListener('cut', alPortapapeles);
      document.removeEventListener('paste', alPortapapeles);
      document.removeEventListener('selectstart', alSeleccionar);
      document.removeEventListener('keydown', alTecla);
      window.removeEventListener('beforeprint', alImprimir);
    };
  }, [activo, iniciado, emitir]);

  if (activo && !soportado && bloquearSinSoporte) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <h2 className="text-base font-semibold">Modo seguro no disponible en este navegador</h2>
        <p className="mt-2">
          Este quiz se configuro en modo seguro y exige un navegador con soporte de pantalla completa
          (API Fullscreen). En dispositivos como iPhone con Safari no es posible iniciarlo.
        </p>
        <p className="mt-2">
          Usa un computador de escritorio con Chrome, Edge o Firefox actualizados y vuelve a
          intentarlo.
        </p>
      </div>
    );
  }

  return (
    <div className={activo ? 'select-none' : undefined}>
      {children}

      {activo && soportado && (!iniciado || pausado) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {pausado ? 'Intento en pausa' : 'Modo seguro activado'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {pausado
                ? mensajePausa ?? 'Saliste de pantalla completa o cambiaste de pestana.'
                : 'Antes de comenzar debes entrar en pantalla completa. Mientras el modo seguro este activo se registraran las salidas de pantalla completa, los cambios de pestana y los intentos de copiar.'}
            </p>
            <div className="mt-4">
              <Boton onClick={() => void (pausado ? reanudar() : entrarPantallaCompleta())}>
                {pausado ? 'Volver a pantalla completa' : 'Activar pantalla completa y continuar'}
              </Boton>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              El temporizador del intento sigue corriendo. Cada salida de pantalla completa suma una
              infraccion y, al superar el umbral, el intento puede anularse o enviarse solo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
