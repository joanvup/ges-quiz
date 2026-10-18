import Link from 'next/link';
import { requiereUsuario } from '@/lib/auth/guard';
import { menuParaRol } from '@/lib/navegacion';
import { ETIQUETA_ROL, type Rol } from '@/lib/dominio/constantes';
import { obtenerAjuste } from '@/lib/settings';
import { BotonSalir, Navegacion } from '@/components/Navegacion';
import { MenuMovil } from '@/components/MenuMovil';
import { Insignia } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const { usuario } = await requiereUsuario();
  const items = menuParaRol(usuario.role);
  const nombreInstitucion = await obtenerAjuste('institucion.nombre');
  const iniciales = usuario.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="no-imprimir sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>

      <header className="no-imprimir sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <MenuMovil items={items} nombreInstitucion={nombreInstitucion} />
            <Link href="/panel" className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                QC
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-slate-900">QuizColegio</span>
                <span className="block max-w-[16rem] truncate text-xs text-slate-500">
                  {nombreInstitucion}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <span className="block text-sm font-medium text-slate-800">{usuario.name}</span>
              <Insignia tono={usuario.role === 'ADMIN' ? 'violeta' : usuario.role === 'TEACHER' ? 'azul' : 'verde'}>
                {ETIQUETA_ROL[usuario.role as Rol] ?? usuario.role}
              </Insignia>
            </div>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
            >
              {iniciales || '?'}
            </span>
            <BotonSalir compacto />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className="no-imprimir hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20">
            <Navegacion items={items} />
          </div>
        </aside>

        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
      </div>

      <footer className="no-imprimir border-t border-slate-200 bg-white px-4 py-4">
        <p className="mx-auto max-w-7xl text-xs text-slate-500">
          QuizColegio · {nombreInstitucion} · Las acciones relevantes se registran en la auditoria.
        </p>
      </footer>
    </div>
  );
}
