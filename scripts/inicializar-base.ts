/**
 * Inicializa la base de datos SIN datos de prueba:
 *
 *   npm run db:inicializar
 *
 * Es la alternativa a `npm run db:reset` + `npm run seed` para una instalacion
 * real: crea las tablas y deja una unica cuenta de administrador, sin
 * estudiantes, grupos, documentos ni quices de ejemplo.
 *
 * El administrador se toma de `ADMIN_EMAIL` y `ADMIN_PASSWORD`; si no estan
 * definidos se usa `admin@colegio.edu` y se genera una contrasena aleatoria que
 * se muestra una sola vez por consola.
 *
 * Es seguro volver a ejecutarlo: no borra datos existentes.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashearContrasena } from '../src/lib/auth/password';
import { resolverAdministradorInicial } from '../src/lib/auth/administrador-inicial';
import { etiquetaMotor } from '../src/lib/basedatos/motores';
import { PREFIJO, asegurarEsquemaDeLaBase, asegurarProveedorYCliente } from './comun-base';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const preparacion = await asegurarProveedorYCliente();
  const motor = preparacion.motor;
  if (preparacion.error || !motor) {
    console.error(
      `${PREFIJO} ${preparacion.error ?? 'No se pudo determinar el motor de la base a partir de DATABASE_URL.'}`,
    );
    process.exit(1);
  }

  const esquema = await asegurarEsquemaDeLaBase();
  if (esquema.error) {
    console.error(`${PREFIJO} ${esquema.error}`);
    process.exit(1);
  }

  const admin = resolverAdministradorInicial();
  if (admin.aviso) console.warn(`${PREFIJO} ${admin.aviso}`);

  const existente = await prisma.user.findUnique({ where: { email: admin.correo } });
  let contrasenaAplicada = false;

  if (existente) {
    await prisma.user.update({
      where: { id: existente.id },
      data: {
        role: 'ADMIN',
        active: true,
        name: existente.name || admin.nombre,
        // La contrasena solo se cambia si se indico una explicitamente.
        ...(admin.generada ? {} : { passwordHash: await hashearContrasena(admin.contrasena) }),
      },
    });
    contrasenaAplicada = !admin.generada;
    console.log(`${PREFIJO} El usuario ${admin.correo} ya existia: se aseguro el rol de administrador.`);
  } else {
    await prisma.user.create({
      data: {
        email: admin.correo,
        name: admin.nombre,
        passwordHash: await hashearContrasena(admin.contrasena),
        role: 'ADMIN',
        active: true,
      },
    });
    contrasenaAplicada = true;
    console.log(`${PREFIJO} Cuenta de administrador creada.`);
  }

  const [usuarios, grupos, documentos, preguntas, quices] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.document.count(),
    prisma.question.count(),
    prisma.quiz.count(),
  ]);

  console.log('');
  console.log('Base de datos lista (sin datos de prueba).');
  console.log(`  Motor: ${etiquetaMotor(motor)}`);
  console.log(
    `  Contenido: ${usuarios} usuario(s), ${grupos} grupo(s), ${documentos} documento(s), ${preguntas} pregunta(s), ${quices} quiz/quices`,
  );
  console.log(`  Administrador: ${admin.correo}`);
  if (contrasenaAplicada && admin.generada) {
    console.log(`  Contrasena generada: ${admin.contrasena}`);
    console.log('  Guardala ahora: no se volvera a mostrar.');
  } else if (contrasenaAplicada) {
    console.log('  Contrasena: la definida en ADMIN_PASSWORD.');
  } else {
    console.log('  La contrasena no se cambio (define ADMIN_PASSWORD para cambiarla).');
  }
  console.log('');
  console.log('Para cargar los datos de ejemplo usa "npm run seed".');
}

main()
  .catch((error) => {
    console.error(`${PREFIJO} Error inesperado:`, error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
