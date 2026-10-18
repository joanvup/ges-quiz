'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import { Boton } from '@/components/ui';

/**
 * Boton para eliminar un quiz. Solo esta disponible si el quiz nunca se ha
 * ejecutado (sin intentos de estudiantes): en cuanto hay un intento, la accion
 * queda bloqueada y hay que cerrar el quiz en su lugar.
 */
export function BotonEliminarQuiz({
  quizId,
  titulo,
  intentos,
  alEliminar,
  etiqueta = 'Eliminar',
}: {
  quizId: string;
  titulo: string;
  intentos: number;
  alEliminar?: () => void;
  etiqueta?: string;
}) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);
  const bloqueado = intentos > 0;

  async function eliminar() {
    if (
      !window.confirm(
        `¿Eliminar el quiz "${titulo}"? Esta accion no se puede deshacer.`,
      )
    ) {
      return;
    }
    setEliminando(true);
    try {
      await api.del(`/api/quices/${quizId}`);
      if (alEliminar) alEliminar();
      else router.refresh();
    } catch (fallo) {
      window.alert(
        fallo instanceof ErrorPeticion ? fallo.message : 'No se pudo eliminar el quiz.',
      );
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Boton
      variante="peligro"
      tamano="sm"
      disabled={bloqueado || eliminando}
      title={
        bloqueado
          ? 'Ya tiene intentos registrados: no se puede eliminar. Cierralo en su lugar.'
          : 'Eliminar este quiz'
      }
      onClick={() => void eliminar()}
    >
      {eliminando ? 'Eliminando...' : etiqueta}
    </Boton>
  );
}
