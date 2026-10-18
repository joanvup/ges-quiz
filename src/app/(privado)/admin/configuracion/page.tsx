import { requiereRol } from '@/lib/auth/guard';
import { DEFINICIONES_AJUSTES, obtenerAjustes } from '@/lib/settings';
import { FormularioAjustes } from './FormularioAjustes';

export const dynamic = 'force-dynamic';

export default async function PaginaConfiguracion() {
  await requiereRol('ADMIN');
  const valores = await obtenerAjustes();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracion global</h1>
        <p className="mt-1 text-sm text-slate-600">
          Valores por defecto y parametros generales del sistema.
        </p>
      </div>
      <FormularioAjustes
        definiciones={DEFINICIONES_AJUSTES.map((d) => ({
          clave: d.clave,
          etiqueta: d.etiqueta,
          descripcion: d.descripcion,
          tipo: d.tipo,
          grupo: d.grupo,
        }))}
        valoresIniciales={valores}
      />
    </div>
  );
}
