import { prisma } from '@/lib/db';
import { hashearContrasena } from '@/lib/auth/password';
import { obtenerAjuste } from '@/lib/settings';
import { anioEscolarActual } from '@/lib/dominio/anio';
import { parsearHoja } from './parsear';
import { clave, validarFilas, type FilaEstudiante, type FilaGrupo } from './validar';
import type { Analisis } from './tipos';

/* ------------------------------------------------------------------ *
 * Analisis e importacion de estudiantes y grupos (con base de datos)
 * ------------------------------------------------------------------ */

/** Lee el archivo y valida sus filas contra el estado actual de la base. */
export async function analizarArchivo(nombreArchivo: string, contenido: Buffer): Promise<Analisis> {
  const crudas = parsearHoja(nombreArchivo, contenido);

  const [anioDefecto, contrasenaPorDefecto, usuarios, grupos] = await Promise.all([
    obtenerAjuste('institucion.anio'),
    obtenerAjuste('seguridad.contrasenaPorDefecto'),
    prisma.user.findMany({ select: { email: true } }),
    prisma.group.findMany({ select: { name: true } }),
  ]);

  return validarFilas(crudas, {
    anioDefecto: anioDefecto || anioEscolarActual(),
    contrasenaPorDefecto,
    correosExistentes: new Set(usuarios.map((usuario) => usuario.email.toLowerCase())),
    gruposExistentes: new Set(grupos.map((grupo) => clave(grupo.name))),
  });
}

export type ResultadoImportacion = {
  gruposCreados: number;
  usuariosCreados: number;
  membresiasCreadas: number;
  errores: { fila: number; mensaje: string }[];
};

/**
 * Importa las filas validas. Los grupos se crean primero (para que los
 * estudiantes puedan referenciarlos) y luego los estudiantes con su membresia.
 * Todo ocurre en una sola transaccion.
 */
export async function importarAnalisis(
  analisis: Analisis,
  actorId: string,
): Promise<ResultadoImportacion> {
  const estudiantes = analisis.listas.filter(
    (fila): fila is FilaEstudiante => fila.tipo === 'ESTUDIANTE',
  );
  const grupos = analisis.listas.filter((fila): fila is FilaGrupo => fila.tipo === 'GRUPO');

  // El hash de contrasena es costoso: se calcula fuera de la transaccion.
  const hashes = new Map<number, string>();
  for (const estudiante of estudiantes) {
    hashes.set(estudiante.fila, await hashearContrasena(estudiante.contrasena));
  }

  return prisma.$transaction(async (tx) => {
    const gruposDb = await tx.group.findMany({ select: { id: true, name: true } });
    const correosDb = new Set(
      (await tx.user.findMany({ select: { email: true } })).map((usuario) =>
        usuario.email.toLowerCase(),
      ),
    );

    const idPorNombre = new Map<string, string>();
    for (const grupo of gruposDb) idPorNombre.set(clave(grupo.name), grupo.id);

    let gruposCreados = 0;
    let usuariosCreados = 0;
    let membresiasCreadas = 0;
    const errores: { fila: number; mensaje: string }[] = [];

    const crearGrupo = async (nombre: string, grado: string, anio: string): Promise<string> => {
      const creado = await tx.group.create({
        data: { name: nombre, grade: grado || null, year: anio, createdById: actorId },
      });
      idPorNombre.set(clave(nombre), creado.id);
      gruposCreados += 1;
      return creado.id;
    };

    for (const grupo of grupos) {
      if (idPorNombre.has(clave(grupo.nombre))) continue;
      await crearGrupo(grupo.nombre, grupo.grado, grupo.anio);
    }

    for (const estudiante of estudiantes) {
      if (correosDb.has(estudiante.correo)) {
        errores.push({ fila: estudiante.fila, mensaje: `El correo ${estudiante.correo} ya existe.` });
        continue;
      }

      let grupoId: string | null = null;
      if (estudiante.grupo) {
        const llave = clave(estudiante.grupo);
        grupoId =
          idPorNombre.get(llave) ?? (await crearGrupo(estudiante.grupo, estudiante.grado, estudiante.anio));
      }

      const usuario = await tx.user.create({
        data: {
          name: estudiante.nombre,
          email: estudiante.correo,
          passwordHash: hashes.get(estudiante.fila) ?? '',
          role: 'STUDENT',
          active: true,
        },
      });
      correosDb.add(estudiante.correo);
      usuariosCreados += 1;

      if (grupoId) {
        await tx.groupMembership.create({ data: { userId: usuario.id, groupId: grupoId } });
        membresiasCreadas += 1;
      }
    }

    return { gruposCreados, usuariosCreados, membresiasCreadas, errores };
  });
}
