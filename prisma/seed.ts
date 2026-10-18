import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { crearPdfSimple } from '../src/lib/pdf/generar-pdf-simple';
import { fragmentarPaginas } from '../src/lib/pdf/chunking';
import { anioEscolarActual } from '../src/lib/dominio/anio';

const prisma = new PrismaClient();
const RONDAS = Number(process.env.BCRYPT_ROUNDS ?? 10);

/** Utilidades de fecha para la ventana de disponibilidad del quiz demo. */
function dias(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function limpiar(): Promise<void> {
  // Orden seguro respecto a las claves foraneas.
  await prisma.proctorEvent.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.quizAssignment.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.document.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  console.log('Sembrando datos de ejemplo de QuizColegio...');
  await limpiar();

  const [admin, docente, estudiante1, estudiante2, estudiante3] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Ana Administradora',
        email: 'admin@colegio.edu',
        passwordHash: await bcrypt.hash('Admin123!', RONDAS),
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'David Docente',
        email: 'docente@colegio.edu',
        passwordHash: await bcrypt.hash('Docente123!', RONDAS),
        role: 'TEACHER',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Elena Estudiante',
        email: 'estudiante1@colegio.edu',
        passwordHash: await bcrypt.hash('Estudiante123!', RONDAS),
        role: 'STUDENT',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Esteban Estudiante',
        email: 'estudiante2@colegio.edu',
        passwordHash: await bcrypt.hash('Estudiante123!', RONDAS),
        role: 'STUDENT',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sofia Estudiante',
        email: 'estudiante3@colegio.edu',
        passwordHash: await bcrypt.hash('Estudiante123!', RONDAS),
        role: 'STUDENT',
      },
    }),
  ]);

  const anio = anioEscolarActual();

  const grupoDecimo = await prisma.group.create({
    data: {
      name: 'Decimo A',
      grade: '10',
      year: anio,
      description: 'Grupo de decimo grado, jornada de la manana.',
      createdById: admin.id,
    },
  });

  const grupoNoveno = await prisma.group.create({
    data: {
      name: 'Noveno B',
      grade: '9',
      year: anio,
      description: 'Grupo de noveno grado.',
      createdById: admin.id,
    },
  });

  await prisma.groupMembership.createMany({
    data: [
      { userId: estudiante1.id, groupId: grupoDecimo.id },
      { userId: estudiante2.id, groupId: grupoDecimo.id },
      { userId: estudiante3.id, groupId: grupoNoveno.id },
    ],
  });

  // --- Documento de ejemplo con PDF real en disco ---------------------------
  const paginasDemo: string[][] = [
    [
      'El sistema solar esta formado por el Sol y todos los cuerpos que orbitan a su alrededor. ' +
        'Los planetas interiores son Mercurio, Venus, la Tierra y Marte; son pequenos y rocosos.',
    ],
    [
      'Los planetas exteriores son Jupiter, Saturno, Urano y Neptuno; son gigantes gaseosos o helados. ' +
        'Jupiter es el planeta mas grande del sistema solar y Saturno es famoso por sus anillos.',
    ],
    [
      'La Tierra completa una orbita alrededor del Sol en aproximadamente 365 dias. ' +
        'La Luna es el unico satelite natural de la Tierra.',
    ],
  ];
  const textosPagina = paginasDemo.map((pagina) => pagina.join(' '));
  const pdfDemo = crearPdfSimple(paginasDemo, 'El sistema solar');
  const carpetaSubidas = path.join(process.cwd(), 'storage', 'uploads');
  fs.mkdirSync(carpetaSubidas, { recursive: true });
  fs.writeFileSync(path.join(carpetaSubidas, 'demo-sistema-solar.pdf'), pdfDemo);
  const fragmentosDemo = fragmentarPaginas(textosPagina);

  const documentoDemo = await prisma.document.create({
    data: {
      title: 'Material de estudio: el sistema solar',
      originalName: 'sistema-solar.pdf',
      storagePath: './storage/uploads/demo-sistema-solar.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfDemo.length,
      pageCount: paginasDemo.length,
      charCount: textosPagina.join(' ').length,
      chunkCount: fragmentosDemo.length,
      pagesJson: JSON.stringify(textosPagina),
      status: 'EXTRACTED',
      extractedText: textosPagina.join('\n\n'),
      uploadedById: docente.id,
    },
  });

  // --- Banco de preguntas ---------------------------------------------------
  type Definicion = {
    tipo: string;
    enunciado: string;
    explicacion: string;
    tema: string;
    dificultad: string;
    pagina: number;
    opciones: { texto: string; correcta: boolean }[];
  };

  const definiciones: Definicion[] = [
    {
      tipo: 'MCQ_SINGLE',
      enunciado: '¿Cual es el planeta mas grande del sistema solar?',
      explicacion: 'Jupiter es el planeta de mayor tamano y masa del sistema solar.',
      tema: 'Sistema solar',
      dificultad: 'EASY',
      pagina: 1,
      opciones: [
        { texto: 'Jupiter', correcta: true },
        { texto: 'Saturno', correcta: false },
        { texto: 'La Tierra', correcta: false },
        { texto: 'Neptuno', correcta: false },
      ],
    },
    {
      tipo: 'MCQ_SINGLE',
      enunciado: '¿Cuantos dias tarda la Tierra en completar una orbita alrededor del Sol?',
      explicacion: 'La Tierra tarda aproximadamente 365 dias en dar una vuelta completa al Sol.',
      tema: 'Sistema solar',
      dificultad: 'EASY',
      pagina: 2,
      opciones: [
        { texto: '365 dias', correcta: true },
        { texto: '24 horas', correcta: false },
        { texto: '30 dias', correcta: false },
        { texto: '100 dias', correcta: false },
      ],
    },
    {
      tipo: 'MCQ_MULTI',
      enunciado: '¿Cuales de los siguientes son planetas interiores?',
      explicacion:
        'Mercurio, Venus, la Tierra y Marte son los planetas interiores, rocosos y mas cercanos al Sol.',
      tema: 'Sistema solar',
      dificultad: 'MEDIUM',
      pagina: 1,
      opciones: [
        { texto: 'Mercurio', correcta: true },
        { texto: 'Venus', correcta: true },
        { texto: 'Jupiter', correcta: false },
        { texto: 'Saturno', correcta: false },
      ],
    },
    {
      tipo: 'TRUE_FALSE',
      enunciado: 'Saturno es conocido por sus anillos visibles.',
      explicacion: 'Saturno posee el sistema de anillos mas grande y visible del sistema solar.',
      tema: 'Sistema solar',
      dificultad: 'EASY',
      pagina: 3,
      opciones: [
        { texto: 'Verdadero', correcta: true },
        { texto: 'Falso', correcta: false },
      ],
    },
    {
      tipo: 'SHORT_ANSWER',
      enunciado: 'Escribe el nombre del cuerpo celeste alrededor del cual orbitan los planetas.',
      explicacion: 'Todos los planetas del sistema solar orbitan alrededor del Sol.',
      tema: 'Sistema solar',
      dificultad: 'EASY',
      pagina: 1,
      opciones: [{ texto: 'Sol', correcta: true }],
    },
  ];

  const preguntasCreadas = [];
  for (const definicion of definiciones) {
    const pregunta = await prisma.question.create({
      data: {
        type: definicion.tipo,
        statement: definicion.enunciado,
        explanation: definicion.explicacion,
        topic: definicion.tema,
        difficulty: definicion.dificultad,
        sourcePage: definicion.pagina,
        status: 'APPROVED',
        origin: 'MANUAL',
        points: 1,
        authorId: docente.id,
        documentId: documentoDemo.id,
        options: {
          create: definicion.opciones.map((opcion, indice) => ({
            label: String.fromCharCode(65 + indice),
            text: opcion.texto,
            isCorrect: opcion.correcta,
            position: indice,
          })),
        },
      },
    });
    preguntasCreadas.push(pregunta);
  }

  // --- Quiz demo publicado --------------------------------------------------
  const quizDemo = await prisma.quiz.create({
    data: {
      title: 'Quiz de ejemplo: el sistema solar',
      description:
        'Quiz de demostracion con cinco preguntas sobre el sistema solar. Usalo para probar el flujo completo del estudiante.',
      authorId: docente.id,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      availableFrom: dias(-1),
      availableTo: dias(30),
      navigationMode: 'FREE',
      timeLimitSec: 600,
      shuffleQuestions: true,
      shuffleOptions: true,
      maxAttempts: 2,
      questionCount: null,
      defaultPoints: 1,
      passingScore: 3,
      maxGrade: 5,
      showResults: 'SCORE_AND_ANSWERS',
      allowReview: true,
      secureMode: false,
      infractionThreshold: 3,
      infractionAction: 'AUTO_SUBMIT',
      blockWithoutFullscreen: true,
      questions: {
        create: preguntasCreadas.map((pregunta, indice) => ({
          questionId: pregunta.id,
          position: indice,
          points: 1,
        })),
      },
      assignments: {
        create: [{ groupId: grupoDecimo.id }],
      },
    },
  });

  await prisma.setting.createMany({
    data: [
      { key: 'institucion.nombre', value: 'Colegio San Ejemplo' },
      { key: 'institucion.anio', value: anio },
      { key: 'academico.notaMinima', value: '3' },
      { key: 'academico.notaMaxima', value: '5' },
      { key: 'quiz.intentosMaximos', value: '2' },
      { key: 'quiz.modoSeguroPorDefecto', value: 'false' },
      { key: 'quiz.umbralInfracciones', value: '3' },
      { key: 'archivos.maxMB', value: process.env.MAX_UPLOAD_MB ?? '15' },
    ],
  });

  console.log('\nDatos de ejemplo creados correctamente.\n');
  console.log('Credenciales de acceso:');
  console.log('  Administrador  admin@colegio.edu         / Admin123!');
  console.log('  Docente        docente@colegio.edu       / Docente123!');
  console.log('  Estudiante 1   estudiante1@colegio.edu   / Estudiante123!');
  console.log('  Estudiante 2   estudiante2@colegio.edu   / Estudiante123!');
  console.log('  Estudiante 3   estudiante3@colegio.edu   / Estudiante123!');
  console.log('\nGrupos: Decimo A (2 estudiantes), Noveno B (1 estudiante)');
  console.log(`Quiz publicado: "${quizDemo.title}" asignado a Decimo A\n`);
}

main()
  .catch((error) => {
    console.error('Error al sembrar la base de datos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
