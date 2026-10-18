'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import { Alerta, AreaTexto, Boton, Campo, Entrada, Tarjeta } from '@/components/ui';
import type { QuizResumenDto } from '@/lib/cliente/tipos';

/** Formulario para crear un borrador de quiz y pasar directo al editor. */
export function NuevoQuiz() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    setError(null);
    if (titulo.trim().length < 5) {
      setError('El titulo debe tener al menos 5 caracteres.');
      return;
    }
    setGuardando(true);
    try {
      const datos = await api.post<{ quiz: QuizResumenDto }>('/api/quices', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
      });
      router.push(`/docentes/quices/${datos.quiz.id}`);
    } catch (fallo) {
      setError(fallo instanceof ErrorPeticion ? fallo.message : 'No se pudo crear el quiz.');
      setGuardando(false);
    }
  }

  if (!abierto) {
    return <Boton onClick={() => setAbierto(true)}>+ Nuevo quiz</Boton>;
  }

  return (
    <Tarjeta
      titulo="Nuevo quiz"
      descripcion="Crea el borrador con un titulo. Despues eliges preguntas, grupos y reglas."
      className="w-full"
    >
      <div className="flex flex-col gap-4">
        {error && <Alerta tipo="error">{error}</Alerta>}
        <Campo etiqueta="Titulo del quiz" requerido htmlFor="nuevo-quiz-titulo">
          <Entrada
            id="nuevo-quiz-titulo"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Ejemplo: Evaluacion de fracciones - periodo 3"
            maxLength={160}
            autoFocus
          />
        </Campo>
        <Campo etiqueta="Descripcion (opcional)" htmlFor="nuevo-quiz-descripcion">
          <AreaTexto
            id="nuevo-quiz-descripcion"
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Indicaciones generales para los estudiantes"
            maxLength={3000}
          />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setAbierto(false)} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={() => void crear()} disabled={guardando}>
            {guardando ? 'Creando...' : 'Crear borrador'}
          </Boton>
        </div>
      </div>
    </Tarjeta>
  );
}
