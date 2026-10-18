import { requiereRol } from '@/lib/auth/guard';
import { obtenerAjuste } from '@/lib/settings';
import { anioEscolarActual } from '@/lib/dominio/anio';
import { ImportadorDatos } from './ImportadorDatos';

export const dynamic = 'force-dynamic';

export default async function PaginaImportar() {
  await requiereRol('ADMIN');
  const anioActual = (await obtenerAjuste('institucion.anio')) || anioEscolarActual();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar estudiantes y grupos</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Descarga la plantilla, llenala y subela. El sistema valida el archivo y te muestra los errores
          por fila antes de crear los estudiantes y los grupos.
        </p>
      </div>
      <ImportadorDatos anioActual={anioActual} />
    </div>
  );
}
