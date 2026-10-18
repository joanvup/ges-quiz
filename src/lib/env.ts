function texto(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? porDefecto : valor;
}

function opcional(nombre: string): string | undefined {
  const valor = process.env[nombre];
  return valor === undefined || valor.trim() === '' ? undefined : valor;
}

function entero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === '') return porDefecto;
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : porDefecto;
}

function booleano(nombre: string, porDefecto: boolean): boolean {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === '') return porDefecto;
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(valor.trim().toLowerCase());
}

export const esProduccion = process.env.NODE_ENV === 'production';

export const env = {
  appUrl: texto('APP_URL', 'http://localhost:3000'),
  appSecret: texto('APP_SECRET', 'secreto-de-desarrollo-inseguro'),
  esProduccion,

  bcryptRounds: entero('BCRYPT_ROUNDS', 10),
  sessionTtlHoras: entero('SESSION_TTL_HOURS', 12),

  maxUploadMb: entero('MAX_UPLOAD_MB', 15),
  uploadDir: texto('UPLOAD_DIR', './storage/uploads'),

  pdf: {
    ocrActivo: booleano('OCR_ENABLED', false),
    ocrIdioma: texto('OCR_LANGUAGE', 'spa+eng'),
    ocrMaxPaginas: entero('OCR_MAX_PAGES', 10),
    chunkSize: entero('CHUNK_SIZE_CHARS', 8000),
    chunkSolape: entero('CHUNK_OVERLAP_CHARS', 800),
  },

  limites: {
    loginMax: entero('LOGIN_RATE_LIMIT_MAX', 10),
    loginVentanaSeg: entero('LOGIN_RATE_LIMIT_WINDOW_SEC', 300),
    respuestaMax: entero('ANSWER_RATE_LIMIT_MAX', 120),
    respuestaVentanaSeg: entero('ANSWER_RATE_LIMIT_WINDOW_SEC', 60),
    exportMaxFilas: entero('REPORTS_EXPORT_MAX_ROWS', 5000),
  },
} as const;
