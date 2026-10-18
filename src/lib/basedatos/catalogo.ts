/**
 * Catalogo de tablas del sistema.
 *
 * Se usa para leer todos los datos (respaldo), volver a insertarlos (restaurar
 * y migrar entre motores) y para mostrar contadores. El orden de la lista es
 * seguro respecto a las claves foraneas: primero las tablas de las que se
 * depende.
 */

export type TipoColumna = 'texto' | 'entero' | 'real' | 'booleano' | 'fecha';

export type ColumnaTabla = { nombre: string; tipo: TipoColumna };

/** Nombre del modelo en el cliente de Prisma. */
export type ModeloPrisma =
  | 'user'
  | 'setting'
  | 'session'
  | 'group'
  | 'groupMembership'
  | 'document'
  | 'question'
  | 'questionOption'
  | 'quiz'
  | 'quizQuestion'
  | 'quizAssignment'
  | 'attempt'
  | 'answer'
  | 'proctorEvent'
  | 'auditLog';

export type DefinicionTabla = {
  modelo: ModeloPrisma;
  /** Nombre real de la tabla en SQL (Prisma no lo renombra). */
  tabla: string;
  etiqueta: string;
  columnas: ColumnaTabla[];
};

const t = (nombre: string): ColumnaTabla => ({ nombre, tipo: 'texto' });
const n = (nombre: string): ColumnaTabla => ({ nombre, tipo: 'entero' });
const r = (nombre: string): ColumnaTabla => ({ nombre, tipo: 'real' });
const b = (nombre: string): ColumnaTabla => ({ nombre, tipo: 'booleano' });
const f = (nombre: string): ColumnaTabla => ({ nombre, tipo: 'fecha' });

export const TABLAS: DefinicionTabla[] = [
  {
    modelo: 'user',
    tabla: 'User',
    etiqueta: 'Usuarios',
    columnas: [
      t('id'),
      t('email'),
      t('name'),
      t('passwordHash'),
      t('role'),
      b('active'),
      f('createdAt'),
      f('updatedAt'),
    ],
  },
  {
    modelo: 'setting',
    tabla: 'Setting',
    etiqueta: 'Configuracion',
    columnas: [t('key'), t('value'), f('updatedAt')],
  },
  {
    modelo: 'session',
    tabla: 'Session',
    etiqueta: 'Sesiones',
    columnas: [
      t('id'),
      t('userId'),
      t('tokenHash'),
      t('csrfToken'),
      t('ip'),
      t('userAgent'),
      f('createdAt'),
      f('lastSeenAt'),
      f('expiresAt'),
      f('revokedAt'),
    ],
  },
  {
    modelo: 'group',
    tabla: 'Group',
    etiqueta: 'Grupos',
    columnas: [
      t('id'),
      t('name'),
      t('grade'),
      t('year'),
      t('description'),
      t('createdById'),
      b('active'),
      f('createdAt'),
      f('updatedAt'),
    ],
  },
  {
    modelo: 'groupMembership',
    tabla: 'GroupMembership',
    etiqueta: 'Miembros de grupo',
    columnas: [t('id'), t('userId'), t('groupId'), f('createdAt')],
  },
  {
    modelo: 'document',
    tabla: 'Document',
    etiqueta: 'Documentos',
    columnas: [
      t('id'),
      t('title'),
      t('originalName'),
      t('storagePath'),
      t('mimeType'),
      n('sizeBytes'),
      n('pageCount'),
      n('charCount'),
      n('chunkCount'),
      t('extractedText'),
      t('pagesJson'),
      t('status'),
      t('errorMessage'),
      b('usedOcr'),
      t('uploadedById'),
      f('createdAt'),
      f('updatedAt'),
    ],
  },
  {
    modelo: 'question',
    tabla: 'Question',
    etiqueta: 'Preguntas',
    columnas: [
      t('id'),
      t('type'),
      t('statement'),
      t('explanation'),
      t('topic'),
      n('sourcePage'),
      t('difficulty'),
      t('status'),
      r('points'),
      t('fingerprint'),
      t('origin'),
      t('llmModel'),
      b('answerPending'),
      t('authorId'),
      t('documentId'),
      f('createdAt'),
      f('updatedAt'),
    ],
  },
  {
    modelo: 'questionOption',
    tabla: 'QuestionOption',
    etiqueta: 'Opciones de respuesta',
    columnas: [t('id'), t('questionId'), t('label'), t('text'), b('isCorrect'), n('position')],
  },
  {
    modelo: 'quiz',
    tabla: 'Quiz',
    etiqueta: 'Quices',
    columnas: [
      t('id'),
      t('title'),
      t('description'),
      t('authorId'),
      t('status'),
      f('availableFrom'),
      f('availableTo'),
      t('navigationMode'),
      n('timeLimitSec'),
      n('perQuestionTimeSec'),
      b('shuffleQuestions'),
      b('shuffleOptions'),
      n('maxAttempts'),
      n('questionCount'),
      r('defaultPoints'),
      r('passingScore'),
      r('maxGrade'),
      t('showResults'),
      b('allowReview'),
      b('secureMode'),
      n('infractionThreshold'),
      t('infractionAction'),
      b('blockWithoutFullscreen'),
      f('createdAt'),
      f('updatedAt'),
      f('publishedAt'),
    ],
  },
  {
    modelo: 'quizQuestion',
    tabla: 'QuizQuestion',
    etiqueta: 'Preguntas de quiz',
    columnas: [t('id'), t('quizId'), t('questionId'), n('position'), r('points')],
  },
  {
    modelo: 'quizAssignment',
    tabla: 'QuizAssignment',
    etiqueta: 'Asignaciones',
    columnas: [t('id'), t('quizId'), t('groupId'), f('createdAt')],
  },
  {
    modelo: 'attempt',
    tabla: 'Attempt',
    etiqueta: 'Intentos',
    columnas: [
      t('id'),
      t('quizId'),
      t('studentId'),
      n('attemptNumber'),
      t('status'),
      f('startedAt'),
      f('expiresAt'),
      f('lastSeenAt'),
      f('submittedAt'),
      t('submitReason'),
      n('currentPosition'),
      f('questionStartedAt'),
      t('questionOrder'),
      t('optionOrder'),
      r('score'),
      r('maxScore'),
      r('grade'),
      b('passed'),
      n('infractions'),
      t('voidedReason'),
      t('ip'),
      t('userAgent'),
    ],
  },
  {
    modelo: 'answer',
    tabla: 'Answer',
    etiqueta: 'Respuestas',
    columnas: [
      t('id'),
      t('attemptId'),
      t('questionId'),
      t('selectedOptions'),
      t('textAnswer'),
      b('isCorrect'),
      r('pointsAwarded'),
      n('timeSpentSec'),
      b('isFinal'),
      f('answeredAt'),
      f('updatedAt'),
    ],
  },
  {
    modelo: 'proctorEvent',
    tabla: 'ProctorEvent',
    etiqueta: 'Eventos de modo seguro',
    columnas: [
      t('id'),
      t('attemptId'),
      t('type'),
      t('detail'),
      t('severity'),
      b('countsAsInfraction'),
      f('clientTs'),
      f('occurredAt'),
      t('ip'),
      t('userAgent'),
    ],
  },
  {
    modelo: 'auditLog',
    tabla: 'AuditLog',
    etiqueta: 'Auditoria',
    columnas: [
      t('id'),
      t('actorId'),
      t('action'),
      t('entityType'),
      t('entityId'),
      t('meta'),
      t('ip'),
      f('createdAt'),
    ],
  },
];

/** Nombres de tabla en orden inverso (para borrar respetando las claves foraneas). */
export const TABLAS_INVERSO: DefinicionTabla[] = [...TABLAS].reverse();

export function tablaPorNombre(tabla: string): DefinicionTabla | undefined {
  return TABLAS.find((definicion) => definicion.tabla === tabla);
}
