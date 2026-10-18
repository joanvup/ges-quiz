/**
 * Generador de PDF minimo (sin dependencias) usado para crear documentos de
 * demostracion y para las pruebas automatizadas.
 *
 * Produce un PDF 1.4 valido con texto usando la fuente base Helvetica, con
 * tabla xref correcta, de forma que pdfjs-dist pueda extraer el texto.
 */

function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escaparCadenaPdf(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

type Objeto = { numero: number; contenido: string };

export function crearPdfSimple(paginas: string[][], titulo = 'Documento de demostracion'): Buffer {
  const FUENTE = 12;
  const ANCHO = 612;
  const ALTO = 792;
  const MARGEN_X = 56;
  const MARGEN_Y = 60;
  const INTERLINEADO = 16;
  const lineasPorPagina = Math.floor((ALTO - MARGEN_Y * 2) / INTERLINEADO);

  // Divide el contenido en lineas fisicas respetando el ancho aproximado.
  const lineasFisicas: string[] = [];
  for (const pagina of paginas) {
    if (lineasFisicas.length > 0) lineasFisicas.push('\f');
    for (const parrafo of pagina) {
      const maxCaracteres = Math.floor((ANCHO - MARGEN_X * 2) / (FUENTE * 0.5));
      let resto = parrafo.trim();
      if (resto === '') {
        lineasFisicas.push('');
        continue;
      }
      while (resto.length > maxCaracteres) {
        let corte = resto.lastIndexOf(' ', maxCaracteres);
        if (corte < maxCaracteres * 0.5) corte = maxCaracteres;
        lineasFisicas.push(resto.slice(0, corte));
        resto = resto.slice(corte).trim();
      }
      lineasFisicas.push(resto);
    }
  }

  // Reparte las lineas en paginas reales.
  const paginasFinales: string[][] = [];
  let actual: string[] = [];
  for (const linea of lineasFisicas) {
    if (linea === '\f' || actual.length >= lineasPorPagina) {
      if (actual.length > 0) paginasFinales.push(actual);
      actual = [];
      if (linea === '\f') continue;
    }
    actual.push(linea);
  }
  if (actual.length > 0) paginasFinales.push(actual);
  if (paginasFinales.length === 0) paginasFinales.push(['(documento vacio)']);

  const objetos: Objeto[] = [];
  const totalPaginas = paginasFinales.length;
  const idPaginas = 2;
  const idFuente = 3;
  const primerContenido = 4;

  objetos.push({ numero: 1, contenido: `<< /Type /Catalog /Pages ${idPaginas} 0 R >>` });

  const idsPaginas: number[] = [];
  const idsContenido: number[] = [];
  for (let i = 0; i < totalPaginas; i += 1) {
    idsPaginas.push(primerContenido + i * 2);
    idsContenido.push(primerContenido + i * 2 + 1);
  }

  objetos.push({
    numero: idPaginas,
    contenido: `<< /Type /Pages /Kids [${idsPaginas
      .map((id) => `${id} 0 R`)
      .join(' ')}] /Count ${totalPaginas} >>`,
  });

  objetos.push({
    numero: idFuente,
    contenido: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  });

  for (let i = 0; i < totalPaginas; i += 1) {
    const numeroPagina = idsPaginas[i]!;
    const numeroContenido = idsContenido[i]!;

    objetos.push({
      numero: numeroPagina,
      contenido:
        `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
        `/Resources << /Font << /F1 ${idFuente} 0 R >> >> /Contents ${numeroContenido} 0 R >>`,
    });

    const lineas = paginasFinales[i]!;
    let flujo = 'BT\n';
    lineas.forEach((linea, indice) => {
      const y = ALTO - MARGEN_Y - indice * INTERLINEADO;
      flujo += `/F1 ${FUENTE} Tf 1 0 0 1 ${MARGEN_X} ${y} Tm (${escaparTexto(linea)}) Tj\n`;
    });
    flujo += 'ET';

    objetos.push({
      numero: numeroContenido,
      contenido: `<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream`,
    });
  }

  objetos.push({
    numero: idFuente + totalPaginas * 2 + 1,
    contenido: `<< /Title (${escaparCadenaPdf(titulo)}) /Producer (QuizColegio) >>`,
  });

  objetos.sort((a, b) => a.numero - b.numero);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const objeto of objetos) {
    offsets[objeto.numero] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${objeto.numero} 0 obj\n${objeto.contenido}\nendobj\n`;
  }

  const maxObjeto = Math.max(...objetos.map((o) => o.numero));
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${maxObjeto + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObjeto; i += 1) {
    const offset = offsets[i];
    pdf += offset === undefined
      ? '0000000000 65535 f \n'
      : `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjeto + 1} /Root 1 0 R /Info ${maxObjeto} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
