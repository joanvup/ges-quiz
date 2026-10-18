/** Utilidades de formato compartidas entre el servidor y los componentes de cliente. */

/** Formatea una fecha ISO como fecha y hora local en espanol. */
export function formatearFechaHora(iso: string | null): string {
  if (!iso) return '-';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '-';
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatea una duracion en segundos como texto legible ("1 h 5 min"). */
export function formatearDuracion(segundos: number | null): string {
  if (segundos === null || segundos === undefined) return 'Sin limite';
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/** Formatea una cuenta regresiva como MM:SS o HH:MM:SS. */
export function formatearReloj(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return horas > 0 ? `${horas}:${dos(minutos)}:${dos(seg)}` : `${dos(minutos)}:${dos(seg)}`;
}
