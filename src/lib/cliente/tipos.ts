/** Tipos compartidos entre el servidor y los componentes de cliente. */

export type UsuarioDto = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  activo: boolean;
  grupos: { id: string; nombre: string }[];
};

export type GrupoDto = {
  id: string;
  nombre: string;
  grado: string | null;
  anio: string;
  descripcion: string | null;
  activo: boolean;
  miembros: number;
  asignaciones: number;
};

export type AjusteDto = {
  clave: string;
  etiqueta: string;
  descripcion: string;
  tipo: 'texto' | 'entero' | 'decimal' | 'booleano';
  grupo: 'institucion' | 'academico' | 'quiz' | 'archivos' | 'seguridad';
};

export type DocumentoDto = {
  id: string;
  titulo: string;
  nombreArchivo: string;
  bytes: number;
  paginas: number;
  caracteres: number;
  fragmentos: number;
  estado: string;
  error: string | null;
  usoOcr: boolean;
  subidoPor?: string;
  preguntas?: number;
  creadoEn: string;
};

export type FragmentoDto = {
  indice: number;
  paginaInicio: number;
  paginaFin: number;
  caracteres: number;
  vistaPrevia: string;
};

export type OpcionDto = {
  id: string;
  etiqueta: string;
  texto: string;
  correcta: boolean;
};

export type PreguntaDto = {
  id: string;
  tipo: string;
  enunciado: string;
  explicacion: string | null;
  tema: string | null;
  pagina: number | null;
  dificultad: string;
  estado: string;
  origen: string;
  puntos: number;
  respuestaPendiente: boolean;
  creadaEn: string;
  documento: { id: string; titulo: string } | null;
  usadaEnQuices: number;
  opciones: OpcionDto[];
};

export type ResultadoGeneracionDto = {
  fragmento: number;
  totalFragmentos: number;
  creadas: number;
  omitidas: number;
  pendientes: number;
  descartadas: { enunciado: string; motivo: string }[];
  proveedor?: string;
  modelo?: string;
};

/* ------------------------------------------------------------------ *
 * Quices
 * ------------------------------------------------------------------ */

export type OpcionQuizDto = {
  id: string;
  etiqueta: string;
  texto: string;
  correcta: boolean;
};

export type PreguntaQuizDto = {
  id: string; // id de QuizQuestion
  preguntaId: string;
  posicion: number;
  puntos: number;
  tipo: string;
  enunciado: string;
  explicacion: string | null;
  tema: string | null;
  dificultad: string;
  estado: string;
  respuestaPendiente: boolean;
  documento: { id: string; titulo: string } | null;
  opciones: OpcionQuizDto[];
};

export type QuizResumenDto = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  autor: { id: string; nombre: string };
  creadoEn: string;
  actualizadoEn: string;
  publicadoEn: string | null;
  disponibleDesde: string | null;
  disponibleHasta: string | null;
  navegacion: string;
  tiempoTotalSeg: number | null;
  tiempoPorPreguntaSeg: number | null;
  mezclarPreguntas: boolean;
  mezclarOpciones: boolean;
  intentosMaximos: number;
  cantidadPreguntas: number | null;
  puntosPorDefecto: number;
  notaAprobacion: number;
  notaMaxima: number;
  mostrarResultados: string;
  permitirRevision: boolean;
  modoSeguro: boolean;
  umbralInfracciones: number;
  accionInfraccion: string;
  bloquearSinPantallaCompleta: boolean;
  grupos: { id: string; nombre: string }[];
  totalPreguntas: number;
  totalPuntos: number;
  intentos: number;
};

export type QuizDetalleDto = QuizResumenDto & {
  preguntas: PreguntaQuizDto[];
};

export type GrupoQuizDto = {
  id: string;
  nombre: string;
  grado: string | null;
  anio: string;
  miembros: number;
};

export type RevisionQuizDto = {
  errores: string[];
  advertencias: string[];
  listo: boolean;
};

/* ------------------------------------------------------------------ *
 * Intentos del estudiante
 * ------------------------------------------------------------------ */

export type OpcionEnCursoDto = {
  id: string;
  etiqueta: string;
  texto: string;
};

export type PreguntaEnCursoDto = {
  id: string;
  tipo: string;
  enunciado: string;
  dificultad: string;
  tema: string | null;
  puntos: number;
  opciones: OpcionEnCursoDto[];
  ayuda: string;
  respuesta: { opciones: string[]; texto: string };
};

export type EstadoIntentoDto = {
  id: string;
  quizId: string;
  tituloQuiz: string;
  descripcionQuiz: string | null;
  estado: string;
  posicion: number;
  total: number;
  esUltima: boolean;
  navegacion: string;
  puedeRetroceder: boolean;
  pregunta: PreguntaEnCursoDto | null;
  expiraEn: string | null;
  preguntaExpiraEn: string | null;
  ahora: string;
  segundosRestantes: number | null;
  segundosPreguntaRestantes: number | null;
  permitirRevision: boolean;
  mostrarResultados: string;
  modoSeguro: boolean;
  umbralInfracciones: number;
  accionInfraccion: string;
  bloquearSinPantallaCompleta: boolean;
  respondidas: number;
};

export type RespuestaRevisadaDto = {
  id: string;
  etiqueta: string;
  texto: string;
};

export type ResultadoPreguntaDto = {
  posicion: number;
  preguntaId: string;
  enunciado: string;
  tipo: string;
  puntos: number;
  puntosObtenidos: number;
  correcta: boolean;
  respondida: boolean;
  seleccion: RespuestaRevisadaDto[];
  textoRespuesta: string | null;
  correctas: RespuestaRevisadaDto[];
  explicacion: string | null;
};

export type ResultadoIntentoDto = {
  id: string;
  quizId: string;
  tituloQuiz: string;
  estado: string;
  motivo: string | null;
  enviadoEn: string | null;
  mostrar: string;
  puntaje: number | null;
  puntajeMaximo: number | null;
  nota: number | null;
  aprobada: boolean | null;
  preguntas: ResultadoPreguntaDto[];
};

export type ResumenIntentoDto = {
  respondidas: number;
  total: number;
  preguntas: { posicion: number; enunciado: string; respondida: boolean }[];
};

/* ------------------------------------------------------------------ *
 * Panel del estudiante
 * ------------------------------------------------------------------ */

export type EstadoQuizEstudiante =
  | 'EN_PROGRESO'
  | 'DISPONIBLE'
  | 'PROXIMO'
  | 'COMPLETADO'
  | 'CERRADO';

export type QuizEstudianteDto = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoQuizEstudiante;
  publicadoEn: string | null;
  disponibleDesde: string | null;
  disponibleHasta: string | null;
  navegacion: string;
  tiempoTotalSeg: number | null;
  tiempoPorPreguntaSeg: number | null;
  intentosMaximos: number;
  intentosUsados: number;
  intentosRestantes: number;
  totalPreguntas: number;
  totalPuntos: number;
  modoSeguro: boolean;
  permitirRevision: boolean;
  mostrarResultados: string;
  notaMaxima: number;
  notaAprobacion: number;
  grupos: { id: string; nombre: string }[];
  mejorNota: number | null;
  aprobada: boolean | null;
  intentoEnProgresoId: string | null;
  ultimoIntentoId: string | null;
};

/* ------------------------------------------------------------------ *
 * Vista del docente: intentos e infracciones
 * ------------------------------------------------------------------ */

export type EventoProctorDto = {
  id: string;
  tipo: string;
  detalle: string | null;
  severidad: string;
  infraccion: boolean;
  ocurridoEn: string;
};

export type IntentoDocenteDto = {
  id: string;
  estudiante: { id: string; nombre: string; correo: string };
  numero: number;
  estado: string;
  motivo: string | null;
  iniciadoEn: string;
  enviadoEn: string | null;
  puntaje: number | null;
  puntajeMaximo: number;
  nota: number | null;
  aprobada: boolean | null;
  infracciones: number;
  eventos: EventoProctorDto[];
};
