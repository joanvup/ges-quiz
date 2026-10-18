import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { usuarioActual } from '@/lib/auth/guard';
import { obtenerAjuste } from '@/lib/settings';
import { FormularioLogin } from './FormularioLogin';

export const metadata: Metadata = { title: 'Iniciar sesion' };
export const dynamic = 'force-dynamic';

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const usuario = await usuarioActual();
  if (usuario) redirect('/panel');

  const { siguiente } = await searchParams;
  const nombreInstitucion = await obtenerAjuste('institucion.nombre');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            QuizColegio
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{nombreInstitucion}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sistema de gestion y aplicacion de quices
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<p className="text-sm text-slate-500">Cargando formulario...</p>}>
            <FormularioLogin siguiente={siguiente ?? '/panel'} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Acceso restringido. Todas las acciones quedan registradas en la auditoria del sistema.
        </p>
      </div>
    </main>
  );
}
