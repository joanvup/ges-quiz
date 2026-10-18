/**
 * Constantes de dominio y etiquetas en espanol.
 *
 * SQLite no soporta enums nativos en Prisma, asi que todos los "enum" viven
 * aqui y se validan con Zod en los bordes del servidor.
 */
import { z } from 'zod';

// --- Usuarios --------------------------------------------------------------

export const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const;
export type Rol = (typeof ROLES)[number];
export const rolSchema = z.enum(ROLES);

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

// --- Documentos ------------------------------------------------------------

export const ESTADOS_DOCUMENTO = ['PENDING', 'EXTRACTED', 'EMPTY', 'FAILED', 'OCR_USED'] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  PENDING: 'Pendiente de extraccion',
  EXTRACTED: 'Texto extraido',
  EMPTY: 'Sin texto utilizable',
  FAILED: 'Error al procesar',
  OCR_USED: 'Extraido con OCR',
};

// --- Preguntas -------------------------------------------------------------

export const TIPOS_PREGUNTA = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT_ANSWER'] as const;
export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number];
export const tipoPreguntaSchema = z.enum(TIPOS_PREGUNTA);

export const ETIQUETA_TIPO_PREGUNTA: Record<TipoPregunta, string> = {
  MCQ_SINGLE: 'Opcion multiple (una respuesta)',
  MCQ_MULTI: 'Seleccion multiple (varias respuestas)',
  TRUE_FALSE: 'Verdadero / Falso',
  SHORT_ANSWER: 'Respuesta corta',
};

export const DIFICULTADES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Dificultad = (typeof DIFICULTADES)[number];
export const dificultadSchema = z.enum(DIFICULTADES);

export const ETIQUETA_DIFICULTAD: Record<Dificultad, string> = {
  EASY: 'Facil',
  MEDIUM: 'Media',
  HARD: 'Dificil',
};

export const ESTADOS_PREGUNTA = ['DRAFT', 'PENDING_REVIEW', 'APPROVED'] as const;
export type EstadoPregunta = (typeof ESTADOS_PREGUNTA)[number];

export const ORIGENES_PREGUNTA = ['MANUAL', 'GENERATED', 'IMPORTED'] as const;
export type OrigenPregunta = (typeof ORIGENES_PREGUNTA)[number];

export const ETIQUETA_ORIGEN_PREGUNTA: Record<OrigenPregunta, string> = {
  MANUAL: 'Manual',
  GENERATED: 'Generada por IA',
  IMPORTED: 'Importada de PDF',
};

// --- Quices ----------------------------------------------------------------

export const ESTADOS_QUIZ = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const;
export type EstadoQuiz = (typeof ESTADOS_QUIZ)[number];

export const ETIQUETA_ESTADO_QUIZ: Record<EstadoQuiz, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  CLOSED: 'Cerrado',
};

export const MODOS_NAVEGACION = ['FORWARD_ONLY', 'FREE'] as const;
export type ModoNavegacion = (typeof MODOS_NAVEGACION)[number];
export const modoNavegacionSchema = z.enum(MODOS_NAVEGACION);

export const ETIQUETA_MODO_NAVEGACION: Record<ModoNavegacion, string> = {
  FORWARD_ONLY: 'Solo hacia adelante (sin retroceder)',
  FREE: 'Permitir retroceder y cambiar respuestas',
};

export const MODOS_RESULTADO = ['NONE', 'SCORE', 'SCORE_AND_ANSWERS'] as const;
export type ModoResultado = (typeof MODOS_RESULTADO)[number];
export const modoResultadoSchema = z.enum(MODOS_RESULTADO);

export const ETIQUETA_MODO_RESULTADO: Record<ModoResultado, string> = {
  NONE: 'No mostrar nada al terminar',
  SCORE: 'Mostrar solo la nota',
  SCORE_AND_ANSWERS: 'Mostrar nota y respuestas correctas',
};

export const ACCIONES_INFRACCION = ['VOID', 'AUTO_SUBMIT', 'REGISTER_ONLY'] as const;
export type AccionInfraccion = (typeof ACCIONES_INFRACCION)[number];
export const accionInfraccionSchema = z.enum(ACCIONES_INFRACCION);

export const ETIQUETA_ACCION_INFRACCION: Record<AccionInfraccion, string> = {
  VOID: 'Anular el intento',
  AUTO_SUBMIT: 'Enviar automaticamente el intento',
  REGISTER_ONLY: 'Solo registrar y notificar al docente',
};

// --- Intentos --------------------------------------------------------------

export const ESTADOS_INTENTO = ['IN_PROGRESS', 'SUBMITTED', 'VOIDED'] as const;
export type EstadoIntento = (typeof ESTADOS_INTENTO)[number];

export const ETIQUETA_ESTADO_INTENTO: Record<EstadoIntento, string> = {
  IN_PROGRESS: 'En progreso',
  SUBMITTED: 'Enviado',
  VOIDED: 'Anulado',
};

export const MOTIVOS_ENVIO = ['MANUAL', 'TIME_UP', 'INFRACTIONS', 'FORCED'] as const;
export type MotivoEnvio = (typeof MOTIVOS_ENVIO)[number];

export const ETIQUETA_MOTIVO_ENVIO: Record<MotivoEnvio, string> = {
  MANUAL: 'Envio manual',
  TIME_UP: 'Tiempo agotado',
  INFRACTIONS: 'Infracciones excedidas',
  FORCED: 'Forzado por el docente o el sistema',
};

// --- Proctoring ------------------------------------------------------------

export const TIPOS_EVENTO_PROCTOR = [
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'TAB_HIDDEN',
  'WINDOW_BLUR',
  'CONTEXT_MENU',
  'COPY',
  'PASTE',
  'CUT',
  'PRINT',
  'SHORTCUT',
  'SELECTION',
  'NO_FULLSCREEN_SUPPORT',
  'RESUMED',
] as const;
export type TipoEventoProctor = (typeof TIPOS_EVENTO_PROCTOR)[number];
export const tipoEventoProctorSchema = z.enum(TIPOS_EVENTO_PROCTOR);

export const ETIQUETA_EVENTO_PROCTOR: Record<TipoEventoProctor, string> = {
  FULLSCREEN_EXIT: 'Salida de pantalla completa',
  FULLSCREEN_ENTER: 'Entrada a pantalla completa',
  TAB_HIDDEN: 'Cambio de pestana / app oculta',
  WINDOW_BLUR: 'Pérdida de foco de la ventana',
  CONTEXT_MENU: 'Intento de abrir menu contextual',
  COPY: 'Copia',
  PASTE: 'Pegado',
  CUT: 'Corte',
  PRINT: 'Intento de imprimir',
  SHORTCUT: 'Atajo de teclado restringido',
  SELECTION: 'Intento de seleccionar texto',
  NO_FULLSCREEN_SUPPORT: 'Navegador sin soporte de pantalla completa',
  RESUMED: 'Reanudacion del intento',
};

/** Tipos de evento que cuentan como infraccion (suman al contador). */
export const EVENTOS_INFRACCION: TipoEventoProctor[] = [
  'FULLSCREEN_EXIT',
  'TAB_HIDDEN',
  'WINDOW_BLUR',
  'CONTEXT_MENU',
  'COPY',
  'CUT',
  'PRINT',
  'SELECTION',
  'NO_FULLSCREEN_SUPPORT',
];

// --- Utilidades ------------------------------------------------------------

export function etiqueta<T extends string>(mapa: Record<T, string>, clave: string): string {
  return (mapa as Record<string, string>)[clave] ?? clave;
}

/** Convierte un texto en slug seguro para nombres de archivo. */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}
