'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import { Alerta, Boton } from '@/components/ui';
import type { EstadoIntentoDto } from '@/lib/cliente/tipos';

/**
 * Boton para iniciar (o reanudar) un intento. Al responder, el servidor crea
 * el intento con el orden y los tiempos congelados y llevamos al estudiante a
 * la pantalla del examen.
 *
 * En modo seguro se activa la pantalla completa ANTES de crear el intento (la
 * llamada debe ocurrir dentro del gesto del usuario) y se rechaza el inicio en
 * navegadores sin soporte de la API Fullscreen.
 */
export function IniciarQuiz({
  quizId,
  modoSeguro = false,
  etiqueta = 'Comenzar quiz',
}: {
  quizId: string;
  modoSeguro?: boolean;
  etiqueta?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);

  function soportaPantallaCompleta(): boolean {
    return (
      typeof document !== 'undefined' &&
      document.fullscreenEnabled === true &&
      typeof document.documentElement.requestFullscreen === 'function'
    );
  }

  async function iniciar() {
    setError(null);

    if (modoSeguro) {
      if (!soportaPantallaCompleta()) {
        setError(
          'Este quiz usa modo seguro y exige un navegador con soporte de pantalla completa (API Fullscreen). En iPhone con Safari no es posible iniciarlo; usa un computador de escritorio.',
        );
        return;
      }
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        setError('No se pudo activar la pantalla completa. Revisa los permisos del navegador.');
        return;
      }
    }

    setIniciando(true);
    try {
      const datos = await api.post<{ estado: EstadoIntentoDto; reanudado: boolean }>(
        '/api/intentos',
        { quizId },
      );
      router.push(`/estudiante/intentos/${datos.estado.id}`);
    } catch (fallo) {
      if (modoSeguro && typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      setError(
        fallo instanceof ErrorPeticion
          ? fallo.message
          : 'No se pudo iniciar el intento. Intenta de nuevo.',
      );
      setIniciando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Alerta tipo="error">{error}</Alerta>}
      <Boton onClick={() => void iniciar()} disabled={iniciando} tamano="lg">
        {iniciando ? 'Preparando...' : etiqueta}
      </Boton>
    </div>
  );
}
