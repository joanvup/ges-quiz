'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/cliente/api';
import type { AjusteDto } from '@/lib/cliente/tipos';
import { Alerta, Boton, Campo, Casilla, Entrada, Tarjeta } from '@/components/ui';

const TITULOS_GRUPO: Record<AjusteDto['grupo'], string> = {
  institucion: 'Institucion',
  academico: 'Academico',
  quiz: 'Quices',
  archivos: 'Archivos',
  seguridad: 'Seguridad y modo seguro',
};

export function FormularioAjustes({
  definiciones,
  valoresIniciales,
}: {
  definiciones: AjusteDto[];
  valoresIniciales: Record<string, string>;
}) {
  const router = useRouter();
  const [valores, setValores] = useState(valoresIniciales);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const grupos = Array.from(new Set(definiciones.map((d) => d.grupo)));

  function actualizar(clave: string, valor: string) {
    setValores((actual) => ({ ...actual, [clave]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    setErrores({});
    try {
      const datos = await api.put<{ valores: Record<string, string> }>('/api/admin/ajustes', valores);
      setValores(datos.valores);
      setMensaje({ tipo: 'exito', texto: 'Configuracion guardada correctamente.' });
      router.refresh();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setMensaje({ tipo: 'error', texto: e.message });
        setErrores(e.campos ?? {});
      } else {
        setMensaje({ tipo: 'error', texto: 'No se pudo guardar la configuracion.' });
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      {mensaje && <Alerta tipo={mensaje.tipo}>{mensaje.texto}</Alerta>}

      {grupos.map((grupo) => (
        <Tarjeta key={grupo} titulo={TITULOS_GRUPO[grupo]}>
          <div className="grid gap-4 md:grid-cols-2">
            {definiciones
              .filter((definicion) => definicion.grupo === grupo)
              .map((definicion) => (
                <div key={definicion.clave}>
                  {definicion.tipo === 'booleano' ? (
                    <Casilla
                      etiqueta={definicion.etiqueta}
                      descripcion={definicion.descripcion}
                      checked={valores[definicion.clave] === 'true'}
                      onChange={(e) => actualizar(definicion.clave, e.target.checked ? 'true' : 'false')}
                    />
                  ) : (
                    <Campo
                      etiqueta={definicion.etiqueta}
                      ayuda={definicion.descripcion}
                      error={errores[definicion.clave]}
                      htmlFor={definicion.clave}
                    >
                      <Entrada
                        id={definicion.clave}
                        value={valores[definicion.clave] ?? ''}
                        onChange={(e) => actualizar(definicion.clave, e.target.value)}
                      />
                    </Campo>
                  )}
                </div>
              ))}
          </div>
        </Tarjeta>
      ))}

      <div className="flex gap-2">
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar configuracion'}
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => setValores(valoresIniciales)}>
          Descartar cambios
        </Boton>
      </div>
    </form>
  );
}
