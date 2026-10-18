import { normalizar } from './parsear';
import { MENSAJE_ANIO, normalizarAnioEscolar } from '@/lib/dominio/anio';
import type {
  Analisis,
  FilaCruda,
  FilaLista,
  ResultadoFila,
  ResumenImportacion,
} from './tipos';

/* ------------------------------------------------------------------ *
 * Validacion (pura, sin base de datos) de las filas de la plantilla
 * ------------------------------------------------------------------ */

const TIPOS_ESTUDIANTE = ['estudiante', 'alumno', 'student'];
const TIPOS_GRUPO = ['grupo', 'curso', 'group', 'clase'];

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CONTRASENA = 8;
const MAX_CONTRASENA = 72;

/** Clave normalizada para comparar nombres (grupos, correos). */
export function clave(texto: string): string {
  return normalizar(texto);
}

export type ContextoValidacion = {
  anioDefecto: string;
  contrasenaPorDefecto: string;
  correosExistentes: Set<string>;
  gruposExistentes: Set<string>;
};

export type FilaEstudiante = Extract<FilaLista, { tipo: 'ESTUDIANTE' }>;
export type FilaGrupo = Extract<FilaLista, { tipo: 'GRUPO' }>;

function leerAnio(texto: string, porDefecto: string): { anio: string; error: string | null } {
  if (!texto) return { anio: porDefecto, error: null };
  const anio = normalizarAnioEscolar(texto);
  if (!anio) return { anio: porDefecto, error: MENSAJE_ANIO };
  return { anio, error: null };
}

function estadoDe(mensajes: string[], duplicado: boolean): ResultadoFila['estado'] {
  if (mensajes.length === 0) return 'LISTO';
  return duplicado ? 'DUPLICADO' : 'ERROR';
}

export function validarFilas(crudas: FilaCruda[], ctx: ContextoValidacion): Analisis {
  const filas: ResultadoFila[] = [];
  const listas: FilaLista[] = [];
  const correosVistos = new Set<string>();
  const gruposVistos = new Set<string>();

  for (const cruda of crudas) {
    const v = cruda.valores;
    const tipoCrudo = (v.tipo ?? '').trim();
    const nombre = (v.nombre ?? '').trim();
    const correoCrudo = (v.correo ?? '').trim();
    const contrasena = (v.contrasena ?? '').trim();
    const grupo = (v.grupo ?? '').trim();
    const grado = (v.grado ?? '').trim();
    const anioTexto = (v.anio ?? '').trim();

    const mensajes: string[] = [];
    const tipoNormalizado = clave(tipoCrudo);

    let tipo: 'ESTUDIANTE' | 'GRUPO' | null = null;
    if (tipoNormalizado) {
      if (TIPOS_ESTUDIANTE.includes(tipoNormalizado)) tipo = 'ESTUDIANTE';
      else if (TIPOS_GRUPO.includes(tipoNormalizado)) tipo = 'GRUPO';
      else mensajes.push(`Tipo desconocido: "${tipoCrudo}". Usa ESTUDIANTE o GRUPO.`);
    } else if (correoCrudo) {
      tipo = 'ESTUDIANTE';
    } else if (nombre) {
      tipo = 'GRUPO';
    }

    if (!tipo) {
      filas.push({
        fila: cruda.fila,
        tipo: tipoCrudo,
        nombre,
        correo: correoCrudo,
        grupo,
        estado: 'ERROR',
        mensajes: mensajes.length > 0 ? mensajes : ['Falta el tipo (ESTUDIANTE o GRUPO).'],
      });
      continue;
    }

    let duplicado = false;

    if (tipo === 'ESTUDIANTE') {
      const correo = correoCrudo.toLowerCase();
      if (nombre.length < 3) mensajes.push('El nombre debe tener al menos 3 caracteres.');
      if (!correo) mensajes.push('El correo es obligatorio para un estudiante.');
      else if (!CORREO_RE.test(correo)) mensajes.push(`Correo invalido: "${correoCrudo}".`);

      if (contrasena) {
        if (contrasena.length < MIN_CONTRASENA || contrasena.length > MAX_CONTRASENA) {
          mensajes.push(
            `La contrasena debe tener entre ${MIN_CONTRASENA} y ${MAX_CONTRASENA} caracteres.`,
          );
        }
      } else if (ctx.contrasenaPorDefecto.length < MIN_CONTRASENA) {
        mensajes.push('No hay una contrasena por defecto valida; escribe una contrasena.');
      }

      if (correo && ctx.correosExistentes.has(correo)) {
        mensajes.push('Ya existe un usuario con ese correo.');
        duplicado = true;
      } else if (correo && correosVistos.has(correo)) {
        mensajes.push('Correo repetido en el archivo.');
        duplicado = true;
      }

      const { anio, error: errorAnio } = leerAnio(anioTexto, ctx.anioDefecto);
      if (errorAnio) mensajes.push(errorAnio);

      const estado = estadoDe(mensajes, duplicado);
      if (estado === 'LISTO') {
        correosVistos.add(correo);
        listas.push({
          tipo: 'ESTUDIANTE',
          fila: cruda.fila,
          nombre,
          correo,
          contrasena: contrasena || ctx.contrasenaPorDefecto,
          grupo: grupo || null,
          grado,
          anio,
        });
      }

      filas.push({ fila: cruda.fila, tipo: 'ESTUDIANTE', nombre, correo: correoCrudo, grupo, estado, mensajes });
      continue;
    }

    // GRUPO
    if (nombre.length < 2) mensajes.push('El nombre del grupo debe tener al menos 2 caracteres.');
    const { anio, error: errorAnio } = leerAnio(anioTexto, ctx.anioDefecto);
    if (errorAnio) mensajes.push(errorAnio);

    const claveGrupo = clave(nombre);
    if (claveGrupo && ctx.gruposExistentes.has(claveGrupo)) {
      mensajes.push('Ya existe un grupo con ese nombre.');
      duplicado = true;
    } else if (claveGrupo && gruposVistos.has(claveGrupo)) {
      mensajes.push('Grupo repetido en el archivo.');
      duplicado = true;
    }

    const estado = estadoDe(mensajes, duplicado);
    if (estado === 'LISTO') {
      gruposVistos.add(claveGrupo);
      listas.push({ tipo: 'GRUPO', fila: cruda.fila, nombre, grado, anio });
    }

    filas.push({ fila: cruda.fila, tipo: 'GRUPO', nombre, correo: '', grupo: '', estado, mensajes });
  }

  const resumen: ResumenImportacion = {
    total: filas.length,
    listas: filas.filter((fila) => fila.estado === 'LISTO').length,
    errores: filas.filter((fila) => fila.estado === 'ERROR').length,
    duplicadas: filas.filter((fila) => fila.estado === 'DUPLICADO').length,
    estudiantes: listas.filter((fila) => fila.tipo === 'ESTUDIANTE').length,
    grupos: listas.filter((fila) => fila.tipo === 'GRUPO').length,
  };

  return { filas, listas, resumen };
}
