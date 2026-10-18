import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/auth/guard';

export default async function Inicio() {
  const usuario = await usuarioActual();
  redirect(usuario ? '/panel' : '/login');
}
