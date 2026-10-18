'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import { Alerta, Boton, Campo, Entrada } from '@/components/ui';

export function FormularioLogin({ siguiente }: { siguiente: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.post('/api/auth/login', { correo: email, contrasena });
      router.push(siguiente.startsWith('/') ? siguiente : '/panel');
      router.refresh();
    } catch (e) {
      if (e instanceof ErrorPeticion) setError(e.message);
      else setError('No se pudo iniciar sesion. Intentalo nuevamente.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Iniciar sesion</h2>

      {error && <Alerta tipo="error">{error}</Alerta>}

      <Campo etiqueta="Correo electronico" htmlFor="email" requerido>
        <Entrada
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="docente@colegio.edu"
        />
      </Campo>

      <Campo etiqueta="Contrasena" htmlFor="contrasena" requerido>
        <Entrada
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="••••••••"
        />
      </Campo>

      <Boton type="submit" disabled={enviando} tamano="lg">
        {enviando ? 'Verificando...' : 'Entrar'}
      </Boton>
    </form>
  );
}
