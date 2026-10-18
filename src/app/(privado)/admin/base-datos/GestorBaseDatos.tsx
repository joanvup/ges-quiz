'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorPeticion, peticion } from '@/lib/cliente/api';
import {
  Alerta,
  Boton,
  Campo,
  Casilla,
  Cargando,
  Entrada,
  Estadistica,
  Insignia,
  Selector,
  Tabla,
  Tarjeta,
  Vacio,
} from '@/components/ui';

type MotorId = 'sqlite' | 'postgresql' | 'mysql';

export type MotorDestino = {
  id: MotorId;
  etiqueta: string;
  puertoPorDefecto: number | null;
  descripcion: string;
  urlEjemplo: string;
};

type FilaConteo = { tabla: string; etiqueta: string; filas: number };

export type EstadoBaseDatos = {
  motor: MotorId | null;
  motorEtiqueta: string;
  conexion: string;
  archivo: string | null;
  tablas: FilaConteo[];
  totalFilas: number;
  proveedorEsquema: string | null;
  sincronizado: boolean;
  respaldosEnDisco: string[];
};

type InformeMigracion = {
  motorOrigen: MotorId;
  motorDestino: MotorId;
  destino: string;
  tablas: FilaConteo[];
  totalFilas: number;
  esquemaVerificado: boolean;
  configuracionActualizada: boolean;
  pasos: string[];
};

type InformeRestauracion = {
  motor: MotorId;
  tablas: FilaConteo[];
  totalFilas: number;
  respaldoPrevio: string;
};

type InformeInicializacion = {
  motor: MotorId;
  tablas: FilaConteo[];
  totalFilas: number;
  respaldoPrevio: string;
  conservado: { usuarios: number; configuracion: number; auditoria: number };
};

type Mensaje = { tipo: 'exito' | 'error' | 'aviso' | 'info'; texto: string };

type CamposConexion = {
  motor: MotorId;
  host: string;
  puerto: string;
  baseDatos: string;
  usuario: string;
  contrasena: string;
  ssl: boolean;
  archivo: string;
};

const ESTILO_ENLACE_DESCARGA =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors';

function conexionInicial(motores: MotorDestino[], rutaSugerida: string): CamposConexion {
  const destino = motores.find((motor) => motor.id !== 'sqlite') ?? motores[0];
  return {
    motor: destino?.id ?? 'postgresql',
    host: 'localhost',
    puerto: destino?.puertoPorDefecto ? String(destino.puertoPorDefecto) : '',
    baseDatos: 'quizcolegio',
    usuario: '',
    contrasena: '',
    ssl: false,
    archivo: rutaSugerida,
  };
}

export function GestorBaseDatos({
  estadoInicial,
  motores,
  rutaSugerida,
}: {
  estadoInicial: EstadoBaseDatos;
  motores: MotorDestino[];
  rutaSugerida: string;
}) {
  const router = useRouter();
  const inputRespaldo = useRef<HTMLInputElement>(null);

  const [estado, setEstado] = useState<EstadoBaseDatos>(estadoInicial);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // Migracion
  const [conexion, setConexion] = useState<CamposConexion>(() =>
    conexionInicial(motores, rutaSugerida),
  );
  const [cambiarConfiguracion, setCambiarConfiguracion] = useState(true);
  const [probando, setProbando] = useState(false);
  const [probado, setProbado] = useState<string | null>(null);
  const [migrando, setMigrando] = useState(false);
  const [informe, setInforme] = useState<InformeMigracion | null>(null);

  // Restauracion
  const [archivoRespaldo, setArchivoRespaldo] = useState<File | null>(null);
  const [confirmoRestaurar, setConfirmoRestaurar] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [informeRestauracion, setInformeRestauracion] = useState<InformeRestauracion | null>(null);

  // Inicializacion sin datos de prueba
  const [confirmoInicializar, setConfirmoInicializar] = useState(false);
  const [inicializando, setInicializando] = useState(false);
  const [informeInicializacion, setInformeInicializacion] =
    useState<InformeInicializacion | null>(null);

  const motorSeleccionado = motores.find((motor) => motor.id === conexion.motor);

  function actualizarCampo(campo: keyof CamposConexion, valor: string | boolean) {
    setConexion((actual) => ({ ...actual, [campo]: valor }));
    setProbado(null);
    setInforme(null);
  }

  function elegirMotor(motor: MotorId) {
    const definicion = motores.find((item) => item.id === motor);
    setConexion((actual) => ({
      ...actual,
      motor,
      puerto: definicion?.puertoPorDefecto ? String(definicion.puertoPorDefecto) : actual.puerto,
    }));
    setProbado(null);
    setInforme(null);
  }

  async function refrescarEstado() {
    try {
      const datos = await peticion<{ estado: EstadoBaseDatos }>('/api/admin/base-datos');
      setEstado(datos.estado);
    } catch {
      /* el refresco es informativo */
    }
  }

  function cuerpoConexion() {
    return {
      motor: conexion.motor,
      host: conexion.host,
      puerto: conexion.puerto,
      baseDatos: conexion.baseDatos,
      usuario: conexion.usuario,
      contrasena: conexion.contrasena,
      ssl: conexion.ssl,
      archivo: conexion.archivo,
    };
  }

  async function probar() {
    setProbando(true);
    setMensaje(null);
    setInforme(null);
    try {
      const datos = await peticion<{ resultado: { motor: MotorId; destino: string } }>(
        '/api/admin/base-datos/probar',
        { method: 'POST', cuerpo: { conexion: cuerpoConexion() } },
      );
      setProbado(datos.resultado.destino);
      setMensaje({ tipo: 'exito', texto: `Conexion correcta con ${datos.resultado.destino}.` });
    } catch (error) {
      setProbado(null);
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo conectar con la base de datos.',
      });
    } finally {
      setProbando(false);
    }
  }

  async function migrar() {
    if (!probado) {
      setMensaje({ tipo: 'aviso', texto: 'Prueba la conexion antes de migrar.' });
      return;
    }
    setMigrando(true);
    setMensaje(null);
    setInforme(null);
    try {
      const datos = await peticion<{ informe: InformeMigracion }>('/api/admin/base-datos/migrar', {
        method: 'POST',
        cuerpo: { conexion: cuerpoConexion(), cambiarConfiguracion },
      });
      setInforme(datos.informe);
      setMensaje({
        tipo: 'exito',
        texto: `Migracion terminada: ${datos.informe.totalFilas} fila(s) copiadas a ${datos.informe.destino}.`,
      });
      router.refresh();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo completar la migracion.',
      });
    } finally {
      setMigrando(false);
    }
  }

  async function restaurar() {
    if (!archivoRespaldo) {
      setMensaje({ tipo: 'aviso', texto: 'Selecciona primero el archivo de respaldo (.json).' });
      return;
    }
    if (!confirmoRestaurar) {
      setMensaje({ tipo: 'aviso', texto: 'Marca la casilla de confirmacion para continuar.' });
      return;
    }
    if (!window.confirm('Se reemplazaran TODOS los datos actuales. ¿Continuar?')) return;

    setRestaurando(true);
    setMensaje(null);
    setInformeRestauracion(null);
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivoRespaldo);
      const datos = await peticion<{ informe: InformeRestauracion }>(
        '/api/admin/base-datos/restaurar',
        { method: 'POST', cuerpoCrudo: formulario },
      );
      setInformeRestauracion(datos.informe);
      setMensaje({
        tipo: 'exito',
        texto: `Respaldo restaurado: ${datos.informe.totalFilas} fila(s).`,
      });
      setArchivoRespaldo(null);
      setConfirmoRestaurar(false);
      if (inputRespaldo.current) inputRespaldo.current.value = '';
      await refrescarEstado();
      router.refresh();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error instanceof ErrorPeticion ? error.message : 'No se pudo restaurar el respaldo.',
      });
    } finally {
      setRestaurando(false);
    }
  }

  async function inicializar() {
    if (!confirmoInicializar) {
      setMensaje({ tipo: 'aviso', texto: 'Marca la casilla de confirmacion para continuar.' });
      return;
    }
    if (
      !window.confirm(
        'Se borraran TODOS los datos de trabajo (usuarios, grupos, documentos, preguntas, quices e intentos). ¿Continuar?',
      )
    ) {
      return;
    }

    setInicializando(true);
    setMensaje(null);
    setInformeInicializacion(null);
    try {
      const datos = await peticion<{ informe: InformeInicializacion }>(
        '/api/admin/base-datos/inicializar',
        { method: 'POST' },
      );
      setInformeInicializacion(datos.informe);
      setMensaje({
        tipo: 'exito',
        texto: `Base de datos inicializada: ${datos.informe.totalFilas} fila(s) borradas.`,
      });
      setConfirmoInicializar(false);
      await refrescarEstado();
      router.refresh();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto:
          error instanceof ErrorPeticion
            ? error.message
            : 'No se pudo inicializar la base de datos.',
      });
    } finally {
      setInicializando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      <Tarjeta
        titulo="Motor de base de datos activo"
        descripcion="Se determina a partir de DATABASE_URL."
        acciones={<Insignia tono="violeta">{estado.motorEtiqueta}</Insignia>}
      >
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap gap-2">
              <dt className="font-medium text-slate-600">Conexion:</dt>
              <dd id="motor-conexion" className="break-all font-mono text-slate-800">
                {estado.conexion}
              </dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="font-medium text-slate-600">Filas totales:</dt>
              <dd className="font-semibold text-slate-800">{estado.totalFilas}</dd>
            </div>
          </dl>

          {estado.archivo && (
            <p className="text-xs text-slate-500">
              El archivo de SQLite se puede copiar con el servidor detenido para un respaldo fisico.
            </p>
          )}

          {!estado.sincronizado && (
            <Alerta tipo="aviso" titulo="El esquema no coincide con la conexion">
              <p>
                El motor de <code>DATABASE_URL</code> es <strong>{estado.motorEtiqueta}</strong> pero
                el esquema de Prisma declara <strong>{estado.proveedorEsquema ?? 'desconocido'}</strong>.
                Deten el servidor y ejecuta <code>npm run db:preparar</code> antes de continuar.
              </p>
            </Alerta>
          )}

          <div className="max-h-72 overflow-auto">
            <Tabla cabeceras={['Tabla', 'Registros']}>
              {estado.tablas.map((fila) => (
                <tr key={fila.tabla}>
                  <td className="px-3 py-2 text-slate-700">{fila.etiqueta}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{fila.filas}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Respaldo de la base de datos"
        descripcion="Descarga todos los datos en un solo archivo. Funciona con SQLite, PostgreSQL y MySQL."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a
              id="respaldo-sql"
              href="/api/admin/base-datos/respaldo?formato=sql"
              download
              className={`${ESTILO_ENLACE_DESCARGA} bg-brand-600 text-white hover:bg-brand-700`}
            >
              Descargar respaldo SQL (.sql)
            </a>
            <a
              id="respaldo-json"
              href="/api/admin/base-datos/respaldo?formato=json"
              download
              className={`${ESTILO_ENLACE_DESCARGA} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
            >
              Descargar respaldo JSON (.json)
            </a>
          </div>
          <p className="text-xs text-slate-500">
            El archivo SQL incluye la estructura (CREATE TABLE) y los datos, para restaurarlo con
            <code className="mx-1">psql</code>,<code className="mx-1">mysql</code> o
            <code className="mx-1">sqlite3</code>. El archivo JSON se puede volver a cargar desde aqui.
          </p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Restaurar un respaldo JSON</p>
            <p className="mt-1 text-xs text-amber-900">
              Reemplaza TODOS los datos actuales. Antes de sobrescribir se guarda una copia automatica
              en el servidor (carpeta <code>storage/backups</code>).
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <input
                ref={inputRespaldo}
                id="restaurar-archivo"
                type="file"
                accept=".json,application/json"
                onChange={(evento) => setArchivoRespaldo(evento.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <Casilla
                id="restaurar-confirmo"
                etiqueta="Confirmo que quiero reemplazar todos los datos actuales"
                checked={confirmoRestaurar}
                onChange={(evento) => setConfirmoRestaurar(evento.target.checked)}
              />
              <div>
                <Boton
                  id="restaurar-boton"
                  variante="peligro"
                  onClick={() => void restaurar()}
                  disabled={!archivoRespaldo || !confirmoRestaurar || restaurando}
                >
                  {restaurando ? 'Restaurando...' : 'Restaurar respaldo'}
                </Boton>
              </div>
            </div>
          </div>

          {informeRestauracion && (
            <Alerta tipo="exito" titulo="Respaldo restaurado">
              <ul className="mt-1 list-inside list-disc">
                {informeRestauracion.tablas
                  .filter((tabla) => tabla.filas > 0)
                  .map((tabla) => (
                    <li key={tabla.tabla}>
                      {tabla.etiqueta}: {tabla.filas} registro(s)
                    </li>
                  ))}
              </ul>
              <p className="mt-1">
                Copia previa guardada en el servidor: <code>{informeRestauracion.respaldoPrevio}</code>
              </p>
            </Alerta>
          )}

          {estado.respaldosEnDisco.length > 0 && (
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-medium">
                Copias guardadas en el servidor ({estado.respaldosEnDisco.length})
              </summary>
              <ul className="mt-1 list-inside list-disc font-mono">
                {estado.respaldosEnDisco.map((nombre) => (
                  <li key={nombre}>{nombre}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Inicializar sin datos de prueba"
        descripcion="Deja la base de datos como recien instalada, conservando el esquema y el acceso."
      >
        <div className="flex flex-col gap-3">
          <Alerta tipo="aviso">
            <p>
              Se borran los datos de trabajo: estudiantes, docentes, grupos, documentos, preguntas,
              quices, intentos, respuestas y eventos de modo seguro.
            </p>
            <p className="mt-1">
              Se conservan el esquema de las tablas, la configuracion del sistema, el registro de
              auditoria y <strong>tu cuenta de administrador</strong> (no se cierra la sesion).
            </p>
          </Alerta>

          <p className="text-xs text-slate-500">
            Antes de borrar se guarda una copia completa en <code>storage/backups</code>, por si
            necesitas volver atras.
          </p>

          <Casilla
            id="inicializar-confirmo"
            etiqueta="Confirmo que quiero borrar todos los datos de trabajo"
            checked={confirmoInicializar}
            onChange={(evento) => setConfirmoInicializar(evento.target.checked)}
          />

          <div>
            <Boton
              id="inicializar-boton"
              variante="peligro"
              onClick={() => void inicializar()}
              disabled={!confirmoInicializar || inicializando}
            >
              {inicializando ? 'Borrando...' : 'Borrar los datos de prueba'}
            </Boton>
          </div>

          {informeInicializacion && (
            <Alerta tipo="exito" titulo="Base de datos inicializada sin datos de prueba">
              <ul className="list-inside list-disc">
                {informeInicializacion.tablas
                  .filter((fila) => fila.filas > 0)
                  .map((fila) => (
                    <li key={fila.tabla}>
                      {fila.etiqueta}: {fila.filas} registro(s) borrado(s)
                    </li>
                  ))}
              </ul>
              <p className="mt-1">
                Se conservan {informeInicializacion.conservado.usuarios} cuenta(s) de administrador,{' '}
                {informeInicializacion.conservado.configuracion} valor(es) de configuracion y{' '}
                {informeInicializacion.conservado.auditoria} registro(s) de auditoria.
              </p>
              <p className="mt-1">
                Copia previa guardada en el servidor: <code>{informeInicializacion.respaldoPrevio}</code>
              </p>
            </Alerta>
          )}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Migrar a otra base de datos"
        descripcion="Crea la estructura en el destino y copia todos los datos de la base activa."
      >
        <div className="flex flex-col gap-3">
          <Alerta tipo="aviso">
            La base de datos destino debe existir y estar <strong>vacia</strong>: si ya tuviera tablas
            con informacion, la migracion se detiene sin borrar nada.
          </Alerta>

          <div className="flex flex-col gap-3">
            <Campo etiqueta="Motor destino" htmlFor="migrar-motor" requerido>
              <Selector
                id="migrar-motor"
                value={conexion.motor}
                onChange={(evento) => elegirMotor(evento.target.value as MotorId)}
              >
                {motores.map((motor) => (
                  <option key={motor.id} value={motor.id}>
                    {motor.etiqueta}
                  </option>
                ))}
              </Selector>
            </Campo>
            {motorSeleccionado && <p className="text-xs text-slate-500">{motorSeleccionado.descripcion}</p>}

            {conexion.motor === 'sqlite' ? (
              <Campo
                etiqueta="Ruta del archivo"
                ayuda="Ruta absoluta del archivo SQLite a crear. Elige una carpeta fuera del proyecto si quieres conservarlo aparte."
                htmlFor="migrar-archivo"
                requerido
              >
                <Entrada
                  id="migrar-archivo"
                  value={conexion.archivo}
                  onChange={(evento) => actualizarCampo('archivo', evento.target.value)}
                  placeholder={rutaSugerida}
                />
              </Campo>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Servidor" htmlFor="migrar-host" requerido>
                  <Entrada
                    id="migrar-host"
                    value={conexion.host}
                    onChange={(evento) => actualizarCampo('host', evento.target.value)}
                    placeholder="localhost"
                  />
                </Campo>
                <Campo etiqueta="Puerto" htmlFor="migrar-puerto" requerido>
                  <Entrada
                    id="migrar-puerto"
                    inputMode="numeric"
                    value={conexion.puerto}
                    onChange={(evento) => actualizarCampo('puerto', evento.target.value)}
                  />
                </Campo>
                <Campo etiqueta="Base de datos" htmlFor="migrar-basedatos" requerido>
                  <Entrada
                    id="migrar-basedatos"
                    value={conexion.baseDatos}
                    onChange={(evento) => actualizarCampo('baseDatos', evento.target.value)}
                    placeholder="quizcolegio"
                  />
                </Campo>
                <Campo etiqueta="Usuario" htmlFor="migrar-usuario" requerido>
                  <Entrada
                    id="migrar-usuario"
                    value={conexion.usuario}
                    onChange={(evento) => actualizarCampo('usuario', evento.target.value)}
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Contrasena" htmlFor="migrar-contrasena">
                  <Entrada
                    id="migrar-contrasena"
                    type="password"
                    value={conexion.contrasena}
                    onChange={(evento) => actualizarCampo('contrasena', evento.target.value)}
                    autoComplete="new-password"
                  />
                </Campo>
                <div className="flex items-end">
                  <Casilla
                    id="migrar-ssl"
                    etiqueta="Usar conexion segura (SSL)"
                    checked={conexion.ssl}
                    onChange={(evento) => actualizarCampo('ssl', evento.target.checked)}
                  />
                </div>
              </div>
            )}

            {motorSeleccionado && (
              <p className="font-mono text-xs text-slate-400">
                Ejemplo: {motorSeleccionado.urlEjemplo}
              </p>
            )}

            <Casilla
              id="migrar-cambiar"
              etiqueta="Al terminar, dejar el sistema apuntando a la nueva base de datos"
              descripcion="Actualiza DATABASE_URL en .env y el provider de prisma/schema.prisma. El cambio se aplica al reiniciar el servidor."
              checked={cambiarConfiguracion}
              onChange={(evento) => setCambiarConfiguracion(evento.target.checked)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Boton
                id="migrar-probar"
                variante="secundario"
                onClick={() => void probar()}
                disabled={probando || migrando}
              >
                {probando ? 'Probando...' : 'Probar conexion'}
              </Boton>
              <Boton
                id="migrar-ejecutar"
                onClick={() => void migrar()}
                disabled={!probado || migrando || probando}
              >
                {migrando ? 'Migrando...' : 'Migrar datos'}
              </Boton>
              {probado && <Insignia tono="verde">Conexion verificada</Insignia>}
            </div>

            {migrando && <Cargando texto="Copiando los datos. Esto puede tardar unos segundos..." />}
          </div>

          {informe && (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                Migracion completada hacia {informe.destino}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Estadistica etiqueta="Filas copiadas" valor={informe.totalFilas} tono="verde" />
                <Estadistica
                  etiqueta="Motor destino"
                  valor={informe.motorDestino}
                  tono="violeta"
                />
                <Estadistica
                  etiqueta="Esquema verificado"
                  valor={informe.esquemaVerificado ? 'Si' : 'No'}
                  tono={informe.esquemaVerificado ? 'verde' : 'ambar'}
                />
              </div>
              <div className="max-h-64 overflow-auto">
                <Tabla cabeceras={['Tabla', 'Filas copiadas']}>
                  {informe.tablas.map((tabla) => (
                    <tr key={tabla.tabla}>
                      <td className="px-3 py-2 text-slate-700">{tabla.etiqueta}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{tabla.filas}</td>
                    </tr>
                  ))}
                </Tabla>
              </div>
              <div className="rounded-lg border border-emerald-300 bg-white p-3">
                <p className="text-sm font-semibold text-slate-800">Pasos siguientes</p>
                <ol className="mt-1 list-inside list-decimal text-sm text-slate-700">
                  {informe.pasos.map((paso, indice) => (
                    <li key={indice}>{paso}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Notas sobre la migracion" descripcion="Limitaciones que conviene conocer.">
        <ul className="list-inside list-disc text-sm text-slate-600">
          <li>
            La migracion crea la estructura y copia los datos; no requiere detener el servidor, pero
            el cambio de motor si se aplica al reiniciarlo.
          </li>
          <li>
            Los archivos subidos (PDF originales) viven en la carpeta <code>storage/</code> y no forman
            parte de la base de datos: copia esa carpeta aparte si cambias de servidor.
          </li>
          <li>
            Si algo sale mal, la base de datos original no se modifica: puedes seguir usando el sistema
            como antes.
          </li>
        </ul>
      </Tarjeta>
    </div>
  );
}
