import path from 'node:path';
import { requiereRol } from '@/lib/auth/guard';
import { DEFINICION_MOTOR, MOTORES_DESTINO } from '@/lib/basedatos/motores';
import { estadoBaseDatos } from '@/lib/basedatos/servicio';
import { GestorBaseDatos, type MotorDestino } from './GestorBaseDatos';

export const dynamic = 'force-dynamic';

export default async function PaginaBaseDatos() {
  await requiereRol('ADMIN');
  const estado = await estadoBaseDatos();

  const motores: MotorDestino[] = MOTORES_DESTINO.map((id) => {
    const definicion = DEFINICION_MOTOR[id];
    return {
      id,
      etiqueta: definicion.etiqueta,
      puertoPorDefecto: definicion.puertoPorDefecto,
      descripcion: definicion.descripcion,
      urlEjemplo: definicion.urlEjemplo,
    };
  });

  // Las rutas de SQLite deben ser absolutas (ver `esquemaConexion`).
  const rutaSugerida = path
    .join(process.cwd(), 'storage', 'backups', 'quizcolegio.db')
    .split(path.sep)
    .join('/');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Base de datos</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Consulta el motor activo, descarga un respaldo completo de todos los datos o migra la
          informacion a PostgreSQL o MySQL. El respaldo funciona con cualquier motor.
        </p>
      </div>
      <GestorBaseDatos
        estadoInicial={estado}
        motores={motores}
        rutaSugerida={rutaSugerida}
      />
    </div>
  );
}
