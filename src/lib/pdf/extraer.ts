import { env } from '@/lib/env';

export type ResultadoExtraccion = {
  paginas: string[];
  texto: string;
  pageCount: number;
  usadoOcr: boolean;
  caracteres: number;
  aviso?: string;
};

export class ErrorPdf extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorPdf';
    this.codigo = codigo;
  }
}

type ItemTexto = { str?: string; hasEOL?: boolean };

/**
 * Extrae el texto de un PDF usando pdfjs-dist (build legacy para Node).
 * Si el PDF no tiene capa de texto (documento escaneado) y el OCR esta
 * habilitado, se intenta reconocer el texto con tesseract.js.
 */
export async function extraerTextoPdf(datos: Buffer): Promise<ResultadoExtraccion> {
  if (datos.length === 0) {
    throw new ErrorPdf('PDF_VACIO', 'El archivo PDF esta vacio (0 bytes).');
  }
  const cabecera = datos.subarray(0, 5).toString('latin1');
  if (!cabecera.startsWith('%PDF')) {
    throw new ErrorPdf(
      'PDF_INVALIDO',
      'El archivo no parece ser un PDF valido (no se encontro la cabecera %PDF).',
    );
  }

  const paginas = await extraerConPdfjs(datos);
  const texto = paginas.join('\n\n').trim();

  // Umbral heuristico: menos de 40 caracteres suele indicar un PDF escaneado.
  if (texto.length >= 40) {
    return {
      paginas,
      texto,
      pageCount: paginas.length,
      usadoOcr: false,
      caracteres: texto.length,
    };
  }

  if (!env.pdf.ocrActivo) {
    return {
      paginas,
      texto,
      pageCount: paginas.length,
      usadoOcr: false,
      caracteres: texto.length,
      aviso:
        'El PDF no tiene capa de texto utilizable (parece escaneado). Activa OCR_ENABLED=true en el archivo .env para intentar reconocerlo con OCR.',
    };
  }

  const ocr = await extraerConOcr(datos, paginas.length);
  return {
    paginas: ocr.paginas,
    texto: ocr.texto,
    pageCount: ocr.paginas.length,
    usadoOcr: true,
    caracteres: ocr.texto.length,
    aviso: ocr.aviso,
  };
}

async function extraerConPdfjs(datos: Buffer): Promise<string[]> {
  let pdfjs: any;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    throw new ErrorPdf(
      'PDFJS_NO_DISPONIBLE',
      `No se pudo cargar el motor de PDF: ${(error as Error).message}`,
    );
  }

  const tarea = pdfjs.getDocument({
    data: new Uint8Array(datos),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    // Evita que pdfjs intente descargar datos de fuentes por red.
    useWorkerFetch: false,
  });

  let documento: any;
  try {
    documento = await tarea.promise;
  } catch (error) {
    throw new ErrorPdf(
      'PDF_CORRUPTO',
      `No se pudo leer el PDF (archivo corrupto o protegido): ${(error as Error).message}`,
    );
  }

  const paginas: string[] = [];
  try {
    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      const pagina = await documento.getPage(numero);
      const contenido = await pagina.getTextContent();
      let textoPagina = '';
      for (const item of contenido.items as ItemTexto[]) {
        if (typeof item.str === 'string') textoPagina += item.str;
        if (item.hasEOL) textoPagina += '\n';
      }
      paginas.push(limpiarTexto(textoPagina));
      pagina.cleanup?.();
    }
  } finally {
    await documento.destroy?.();
  }

  return paginas;
}

function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * OCR opcional. Se necesita renderizar cada pagina a imagen; para ello se
 * importa dinamicamente "@napi-rs/canvas" (opcional). Si no esta instalado se
 * devuelve un aviso claro en lugar de fallar.
 */
async function extraerConOcr(
  datos: Buffer,
  paginasEstimadas: number,
): Promise<{ paginas: string[]; texto: string; aviso?: string }> {
  let canvas: any;
  try {
    canvas = await import('@napi-rs/canvas');
  } catch {
    return {
      paginas: [''],
      texto: '',
      aviso:
        'OCR solicitado, pero falta el paquete opcional "@napi-rs/canvas" para rasterizar las paginas. Ejecuta "npm install @napi-rs/canvas" para habilitarlo.',
    };
  }

  const { createWorker } = await import('tesseract.js');
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const documento = await pdfjs.getDocument({ data: new Uint8Array(datos), isEvalSupported: false })
    .promise;

  const maximo = Math.min(documento.numPages, Math.max(env.pdf.ocrMaxPaginas, 1));
  const trabajador = await createWorker(env.pdf.ocrIdioma);
  const paginas: string[] = [];

  try {
    for (let numero = 1; numero <= maximo; numero += 1) {
      const pagina = await documento.getPage(numero);
      const viewport = pagina.getViewport({ scale: 2 });
      const lienzo = canvas.createCanvas(viewport.width, viewport.height);
      const contexto = lienzo.getContext('2d');
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, viewport.width, viewport.height);
      await pagina.render({ canvasContext: contexto, viewport, canvas: lienzo }).promise;
      const png: Buffer = lienzo.toBuffer('image/png');
      const resultado = await trabajador.recognize(png);
      paginas.push(limpiarTexto(resultado.data.text ?? ''));
      pagina.cleanup?.();
    }
  } finally {
    await trabajador.terminate();
    await documento.destroy?.();
  }

  const aviso =
    documento.numPages > maximo
      ? `Se aplico OCR solo a las primeras ${maximo} de ${documento.numPages} paginas (OCR_MAX_PAGES).`
      : undefined;

  return { paginas: paginas.length ? paginas : [`(${paginasEstimadas} paginas sin texto reconocible)`], texto: paginas.join('\n\n'), aviso };
}
