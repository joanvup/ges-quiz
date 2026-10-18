'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type { GrupoDto, UsuarioDto } from '@/lib/cliente/tipos';
import {
  Alerta,
  Boton,
  Campo,
  Entrada,
  Insignia,
  Selector,
  Tabla,
  Tarjeta,
  Vacio,
} from '@/components/ui';

type FormularioGrupo = {
  id: string | null;
  nombre: string;
  grado: string;
  anio: string;
  descripcion: string;
  activo: boolean;
};

export function GestorGrupos({
  gruposIniciales,
  estudiantes,
  anioActual,
}: {
  gruposIniciales: GrupoDto[];
  estudiantes: UsuarioDto[];
  anioActual: string;
}) {
  const router = useRouter();
  const [grupos, setGrupos] = useState(gruposIniciales);
  // Copia local de estudiantes para reflejar cambios sin recargar la pagina.
  const [estudiantesLocales, setEstudiantes] = useState(estudiantes);
  const [form, setForm] = useState<FormularioGrupo | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'aviso'; texto: string } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [grupoMiembros, setGrupoMiembros] = useState<GrupoDto | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [filtroEstudiante, setFiltroEstudiante] = useState('');

  const estudiantesFiltrados = useMemo(() => {
    const termino = filtroEstudiante.trim().toLowerCase();
    const yaEnGrupo = new Set(
      estudiantes.filter((e) => e.grupos.some((g) => g.id === grupoMiembros?.id)).map((e) => e.id),
    );
    return estudiantes
      .filter((e) => !termino || e.nombre.toLowerCase().includes(termino) || e.correo.toLowerCase().includes(termino))
      .sort((a, b) => Number(yaEnGrupo.has(a.id)) - Number(yaEnGrupo.has(b.id)) || a.nombre.localeCompare(b.nombre))
      .map((e) => ({ ...e, yaEsta: yaEnGrupo.has(e.id) }));
  }, [estudiantes, filtroEstudiante, grupoMiembros]);

  async function recargar() {
    const datos = await api.get<{ grupos: GrupoDto[] }>('/api/admin/grupos');
    setGrupos(datos.grupos);
    router.refresh();
  }

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    setErrores({});
    setMensaje(null);
    try {
      const cuerpo = {
        nombre: form.nombre,
        grado: form.grado,
        anio: form.anio,
        descripcion: form.descripcion,
      };
      if (form.id) {
        await api.patch(`/api/admin/grupos/${form.id}`, { ...cuerpo, activo: form.activo });
        setMensaje({ tipo: 'exito', texto: 'Grupo actualizado.' });
      } else {
        await api.post('/api/admin/grupos', cuerpo);
        setMensaje({ tipo: 'exito', texto: 'Grupo creado.' });
      }
      setForm(null);
      await recargar();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setMensaje({ tipo: 'error', texto: e.message });
        setErrores(e.campos ?? {});
      } else {
        setMensaje({ tipo: 'error', texto: 'No se pudo guardar el grupo.' });
      }
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(grupo: GrupoDto) {
    if (!window.confirm(`¿Eliminar el grupo ${grupo.nombre}? Los estudiantes no seran eliminados.`)) return;
    setMensaje(null);
    try {
      await api.del(`/api/admin/grupos/${grupo.id}`);
      setMensaje({ tipo: 'exito', texto: 'Grupo eliminado.' });
      if (grupoMiembros?.id === grupo.id) setGrupoMiembros(null);
      await recargar();
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof ErrorPeticion ? e.message : 'No se pudo eliminar el grupo.',
      });
    }
  }

  async function agregarMiembros() {
    if (!grupoMiembros || seleccionados.length === 0) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const resultado = await api.post<{ agregados: number; yaEstaban: number }>(
        `/api/admin/grupos/${grupoMiembros.id}/miembros`,
        { usuarioIds: seleccionados },
      );
      setMensaje({
        tipo: 'exito',
        texto: `Se agregaron ${resultado.agregados} estudiante(s).${
          resultado.yaEstaban ? ` ${resultado.yaEstaban} ya estaban en el grupo.` : ''
        }`,
      });
      setSeleccionados([]);
      // Actualizacion optimista de la lista local.
      setEstudiantes((previos) =>
        previos.map((estudiante) =>
          seleccionados.includes(estudiante.id) &&
          !estudiante.grupos.some((g) => g.id === grupoMiembros.id)
            ? {
                ...estudiante,
                grupos: [...estudiante.grupos, { id: grupoMiembros.id, nombre: grupoMiembros.nombre }],
              }
            : estudiante,
        ),
      );
      await recargar();
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof ErrorPeticion ? e.message : 'No se pudieron agregar los estudiantes.',
      });
    } finally {
      setGuardando(false);
    }
  }

  async function quitarMiembro(usuarioId: string) {
    if (!grupoMiembros) return;
    setMensaje(null);
    try {
      await api.del(`/api/admin/grupos/${grupoMiembros.id}/miembros`, { usuarioId });
      await recargar();
      setEstudiantes((previos) =>
        previos.map((e) =>
          e.id === usuarioId
            ? { ...e, grupos: e.grupos.filter((g) => g.id !== grupoMiembros.id) }
            : e,
        ),
      );
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof ErrorPeticion ? e.message : 'No se pudo quitar el estudiante.',
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      <Tarjeta
        titulo="Cursos y grupos"
        descripcion={`${grupos.length} grupo(s)`}
        acciones={
          <Boton
            onClick={() =>
              setForm({
                id: null,
                nombre: '',
                grado: '',
                anio: anioActual,
                descripcion: '',
                activo: true,
              })
            }
          >
            + Nuevo grupo
          </Boton>
        }
      >
        {grupos.length === 0 ? (
          <Vacio mensaje="Todavia no hay grupos creados." />
        ) : (
          <Tabla cabeceras={['Grupo', 'Grado', 'Ano', 'Estudiantes', 'Quices asignados', 'Estado', 'Acciones']}>
            {grupos.map((grupo) => (
              <tr key={grupo.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{grupo.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.grado ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.anio}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.miembros}</td>
                <td className="px-3 py-2 text-slate-600">{grupo.asignaciones}</td>
                <td className="px-3 py-2">
                  {grupo.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia tono="rojo">Inactivo</Insignia>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Boton tamano="sm" variante="secundario" onClick={() => setGrupoMiembros(grupo)}>
                      Estudiantes
                    </Boton>
                    <Boton
                      tamano="sm"
                      variante="secundario"
                      onClick={() =>
                        setForm({
                          id: grupo.id,
                          nombre: grupo.nombre,
                          grado: grupo.grado ?? '',
                          anio: grupo.anio,
                          descripcion: grupo.descripcion ?? '',
                          activo: grupo.activo,
                        })
                      }
                    >
                      Editar
                    </Boton>
                    <Boton tamano="sm" variante="peligro" onClick={() => eliminar(grupo)}>
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
          titulo={form.id ? 'Editar grupo' : 'Nuevo grupo'}
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
            <div className="grid gap-4 md:grid-cols-3">
              <Campo etiqueta="Nombre del grupo" requerido error={errores.nombre}>
                <Entrada
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  placeholder="Ej: Decimo A"
                />
              </Campo>
              <Campo etiqueta="Grado / nivel" error={errores.grado}>
                <Entrada
                  value={form.grado}
                  onChange={(e) => setForm({ ...form, grado: e.target.value })}
                  placeholder="Ej: 10"
                />
              </Campo>
              <Campo etiqueta="Ano escolar" requerido error={errores.anio}>
                <Entrada
                  value={form.anio}
                  onChange={(e) => setForm({ ...form, anio: e.target.value })}
                  placeholder="2026 o 2026-2027"
                  required
                />
              </Campo>
            </div>
            <Campo etiqueta="Descripcion" error={errores.descripcion}>
              <Entrada
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Opcional"
              />
            </Campo>
            {form.id && (
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                Grupo activo
              </label>
            )}
            <div className="flex gap-2">
              <Boton type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear grupo'}
              </Boton>
              <Boton type="button" variante="secundario" onClick={() => setForm(null)}>
                Cancelar
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {grupoMiembros && (
        <Tarjeta
          titulo={`Estudiantes de ${grupoMiembros.nombre}`}
          descripcion="Selecciona estudiantes para agregarlos. Los que ya pertenecen aparecen marcados."
          acciones={
            <Boton variante="secundario" tamano="sm" onClick={() => setGrupoMiembros(null)}>
              Cerrar
            </Boton>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="max-w-sm">
              <Campo etiqueta="Filtrar estudiantes">
                <Entrada
                  type="search"
                  placeholder="Nombre o correo"
                  value={filtroEstudiante}
                  onChange={(e) => setFiltroEstudiante(e.target.value)}
                />
              </Campo>
            </div>

            {estudiantesLocales.length === 0 ? (
              <Alerta tipo="aviso">
                No hay estudiantes registrados. Crea estudiantes en la seccion Usuarios.
              </Alerta>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {estudiantesFiltrados.map((estudiante) => (
                  <label
                    key={estudiante.id}
                    className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600"
                      checked={seleccionados.includes(estudiante.id)}
                      onChange={() =>
                        setSeleccionados((actual) =>
                          actual.includes(estudiante.id)
                            ? actual.filter((id) => id !== estudiante.id)
                            : [...actual, estudiante.id],
                        )
                      }
                    />
                    <span>
                      {estudiante.nombre}
                      <span className="ml-1 text-xs text-slate-500">{estudiante.correo}</span>
                      {estudiante.yaEsta && (
                        <span className="ml-1 text-xs font-medium text-emerald-700">· ya en el grupo</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton onClick={agregarMiembros} disabled={guardando || seleccionados.length === 0}>
                {guardando ? 'Agregando...' : `Agregar ${seleccionados.length || ''} estudiante(s)`}
              </Boton>
              <Boton
                variante="secundario"
                onClick={() => setSeleccionados(estudiantesLocales.map((e) => e.id))}
              >
                Seleccionar todos
              </Boton>
              <Boton variante="secundario" onClick={() => setSeleccionados([])}>
                Limpiar seleccion
              </Boton>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                Miembros actuales ({estudiantesLocales.filter((e) => e.grupos.some((g) => g.id === grupoMiembros.id)).length})
              </p>
              <div className="flex flex-wrap gap-2">
                {estudiantesLocales
                  .filter((e) => e.grupos.some((g) => g.id === grupoMiembros.id))
                  .map((estudiante) => (
                    <span
                      key={estudiante.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                    >
                      {estudiante.nombre}
                      <button
                        type="button"
                        onClick={() => quitarMiembro(estudiante.id)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                        aria-label={`Quitar a ${estudiante.nombre} del grupo`}
                      >
                        Quitar
                      </button>
                    </span>
                  ))}
                {estudiantesLocales.filter((e) => e.grupos.some((g) => g.id === grupoMiembros.id)).length === 0 && (
                  <p className="text-sm text-slate-500">Este grupo aun no tiene estudiantes.</p>
                )}
              </div>
            </div>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
