import { Tarjeta, Insignia } from '@/components/ui';

/**
 * Pagina provisional para modulos que se implementan en fases posteriores.
 */
export function PaginaEnConstruccion({
  titulo,
  fase,
  descripcion,
  detalles,
}: {
  titulo: string;
  fase: string;
  descripcion: string;
  detalles: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <Insignia tono="ambar">{fase}</Insignia>
      </div>
      <Tarjeta titulo="En construccion" descripcion={descripcion}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {detalles.map((detalle) => (
            <li key={detalle}>{detalle}</li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}
