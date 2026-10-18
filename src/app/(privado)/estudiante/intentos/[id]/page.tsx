import { redirect } from 'next/navigation';
import { requiereRol } from '@/lib/auth/guard';
import {
  estadoIntentoDto,
  obtenerIntentoAutorizado,
  resolverTiempos,
} from '@/lib/intentos/servicio';
import { Alerta, EnlaceBoton, Tarjeta } from '@/components/ui';
import { MotorIntento } from './MotorIntento';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function PaginaIntento({ params }: Props) {
  const { usuario } = await requiereRol('STUDENT');
  const { id } = await params;

  const intento = await obtenerIntentoAutorizado(id, usuario.id);
  const procesado = await resolverTiempos(intento);

  if (procesado.status === 'SUBMITTED') {
    redirect(`/estudiante/intentos/${id}/resultado`);
  }

  if (procesado.status === 'VOIDED') {
    return (
      <Tarjeta titulo="Intento anulado">
        <Alerta tipo="error" titulo="Este intento fue anulado">
          El docente o el sistema anularon este intento
          {procesado.voidedReason ? `: ${procesado.voidedReason}` : '.'} No es posible reabrirlo.
        </Alerta>
        <div className="mt-4">
          <EnlaceBoton href="/estudiante/quices" variante="secundario">
            Volver a mis quices
          </EnlaceBoton>
        </div>
      </Tarjeta>
    );
  }

  return <MotorIntento estadoInicial={estadoIntentoDto(procesado)} />;
}
