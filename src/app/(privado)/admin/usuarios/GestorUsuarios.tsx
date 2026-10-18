'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type { GrupoDto, UsuarioDto } from '@/lib/cliente/tipos';
import {
  Alerta,
  Boton,
  Campo,
  Casilla,
  Entrada,
  Insignia,
  Selector,
  Tabla,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { ETIQUETA_ROL, ROLES, type Rol } from '@/lib/dominio/constantes';

type Formulario = {
  id: string | null;
  nombre: string;
  correo: string;
  contrasena: string;
  rol: Rol;
  activo: boolean;
  grupos: string[];
};

const FORMULARIO_VACIO: Formulario = {
  id: null,
  nombre: '',
  correo: '',
  contrasena: '',
  rol: 'STUDENT',
  activo: true,
  grupos: [],
};

export function GestorUsuarios({
  usuariosIniciales,
  grupos,
}: {
  usuariosIniciales: UsuarioDto[];
  grupos: GrupoDto[];
}) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [form, setForm] = useState<Formulario | null>(null);
  const [buscar, setBuscar] = useState('');
  const [filtroRol, setFiltroRol] = useState<'TODOS' | Rol>('TODOS');
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const filtrados = useMemo(() => {
    const termino = buscar.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const coincideRol = filtroRol === 'TODOS' || usuario.rol === filtroRol;
      const coincideTexto =
        termino === '' ||
        usuario.nombre.toLowerCase().includes(termino) ||
        usuario.correo.toLowerCase().includes(termino);
      return coincideRol && coincideTexto;
    });
  }, [usuarios, buscar, filtroRol]);

  function abrirCrear() {
    setErrores({});
    setForm({ ...FORMULARIO_VACIO });
  }

  function abrirEditar(usuario: UsuarioDto) {
    setErrores({});
    setForm({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      contrasena: '',
      rol: usuario.rol as Rol,
      activo: usuario.activo,
      grupos: usuario.grupos.map((g) => g.id),
    });
  }

  async function recargar() {
    const datos = await api.get<{ usuarios: UsuarioDto[] }>('/api/admin/usuarios');
    setUsuarios(datos.usuarios);
    router.refresh();
  }

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    setErrores({});
    setMensaje(null);
    try {
      if (form.id) {
        await api.patch(`/api/admin/usuarios/${form.id}`, {
          nombre: form.nombre,
          correo: form.correo,
          rol: form.rol,
          activo: form.activo,
          grupos: form.rol === 'STUDENT' ? form.grupos : [],
          ...(form.contrasena ? { contrasena: form.contrasena } : {}),
        });
        setMensaje({ tipo: 'exito', texto: 'Usuario actualizado correctamente.' });
      } else {
        await api.post('/api/admin/usuarios', {
          nombre: form.nombre,
          correo: form.correo,
          contrasena: form.contrasena,
          rol: form.rol,
          activo: form.activo,
          grupos: form.rol === 'STUDENT' ? form.grupos : [],
        });
        setMensaje({ tipo: 'exito', texto: 'Usuario creado correctamente.' });
      }
      setForm(null);
      await recargar();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setMensaje({ tipo: 'error', texto: e.message });
        setErrores(e.campos ?? {});
      } else {
        setMensaje({ tipo: 'error', texto: 'No se pudo guardar el usuario.' });
      }
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(usuario: UsuarioDto) {
    const confirmado = window.confirm(
      `¿Eliminar definitivamente a ${usuario.nombre}? Esta accion no se puede deshacer.`,
    );
    if (!confirmado) return;
    setMensaje(null);
    try {
      await api.del(`/api/admin/usuarios/${usuario.id}`);
      setMensaje({ tipo: 'exito', texto: `Usuario ${usuario.nombre} eliminado.` });
      await recargar();
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof ErrorPeticion ? e.message : 'No se pudo eliminar el usuario.',
      });
    }
  }

  function alternarGrupo(id: string) {
    setForm((actual) => {
      if (!actual) return actual;
      const yaEsta = actual.grupos.includes(id);
      return {
        ...actual,
        grupos: yaEsta ? actual.grupos.filter((g) => g !== id) : [...actual.grupos, id],
      };
    });
  }

  const estudiantesFiltrables = form?.rol === 'STUDENT';

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      <Tarjeta
        titulo="Usuarios del colegio"
        descripcion={`${usuarios.length} usuario(s) registrados`}
        acciones={
          <Boton type="button" onClick={abrirCrear}>
            + Nuevo usuario
          </Boton>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <Campo etiqueta="Buscar">
              <Entrada
                type="search"
                placeholder="Nombre o correo"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </Campo>
          </div>
          <div className="w-48">
            <Campo etiqueta="Rol">
              <Selector
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value as 'TODOS' | Rol)}
              >
                <option value="TODOS">Todos</option>
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {ETIQUETA_ROL[rol]}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <Vacio mensaje="No hay usuarios que coincidan con el filtro." />
        ) : (
          <Tabla cabeceras={['Nombre', 'Correo', 'Rol', 'Grupos', 'Estado', 'Acciones']}>
            {filtrados.map((usuario) => (
              <tr key={usuario.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{usuario.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{usuario.correo}</td>
                <td className="px-3 py-2">
                  <Insignia
                    tono={
                      usuario.rol === 'ADMIN' ? 'violeta' : usuario.rol === 'TEACHER' ? 'azul' : 'verde'
                    }
                  >
                    {ETIQUETA_ROL[usuario.rol as Rol] ?? usuario.rol}
                  </Insignia>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {usuario.grupos.length === 0 ? '-' : usuario.grupos.map((g) => g.nombre).join(', ')}
                </td>
                <td className="px-3 py-2">
                  {usuario.activo ? (
                    <Insignia tono="verde">Activo</Insignia>
                  ) : (
                    <Insignia tono="rojo">Inactivo</Insignia>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Boton tamano="sm" variante="secundario" onClick={() => abrirEditar(usuario)}>
                      Editar
                    </Boton>
                    <Boton tamano="sm" variante="peligro" onClick={() => eliminar(usuario)}>
                      Eliminar
                    </Boton>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>

      {form && (
        <Tarjeta
          titulo={form.id ? 'Editar usuario' : 'Nuevo usuario'}
          descripcion={
            form.id
              ? 'Deja la contrasena vacia para conservarla. Si la cambias, se cerraran sus sesiones.'
              : 'La contrasena debe tener al menos 8 caracteres.'
          }
          acciones={
            <Boton variante="secundario" tamano="sm" onClick={() => setForm(null)}>
              Cancelar
            </Boton>
          }
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Campo etiqueta="Nombre completo" requerido error={errores.nombre}>
                <Entrada
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  minLength={3}
                />
              </Campo>
              <Campo etiqueta="Correo electronico" requerido error={errores.correo}>
                <Entrada
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  required
                />
              </Campo>
              <Campo
                etiqueta="Contrasena"
                requerido={!form.id}
                error={errores.contrasena}
                ayuda={form.id ? 'Opcional al editar' : undefined}
              >
                <Entrada
                  type="password"
                  value={form.contrasena}
                  onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
                  required={!form.id}
                  minLength={8}
                  autoComplete="new-password"
                />
              </Campo>
              <Campo etiqueta="Rol" requerido error={errores.rol}>
                <Selector
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                >
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {ETIQUETA_ROL[rol]}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>

            <Casilla
              etiqueta="Cuenta activa"
              descripcion="Si la desactivas, el usuario no podra iniciar sesion."
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />

            {estudiantesFiltrables && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Grupos del estudiante</p>
                {grupos.length === 0 ? (
                  <Alerta tipo="aviso">
                    Todavia no hay grupos creados. Crea uno en la seccion Grupos.
                  </Alerta>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {grupos.map((grupo) => (
                      <label
                        key={grupo.id}
                        className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600"
                          checked={form.grupos.includes(grupo.id)}
                          onChange={() => alternarGrupo(grupo.id)}
                        />
                        <span>
                          {grupo.nombre}
                          <span className="ml-1 text-xs text-slate-500">({grupo.anio})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Boton type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear usuario'}
              </Boton>
              <Boton type="button" variante="secundario" onClick={() => setForm(null)}>
                Cancelar
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
    </div>
  );
}
