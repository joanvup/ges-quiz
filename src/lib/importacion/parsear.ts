import {
  ErrorImportacion,
  type ColumnaImportacion,
  type FilaCruda,
} from './tipos';

/* ------------------------------------------------------------------ *
 * Lectura de la plantilla: CSV y XML Spreadsheet 2003 (.xls/.xml)
 * ------------------------------------------------------------------ */

const ALIAS_COLUMNAS: Record<string, ColumnaImportacion> = {
  tipo: 'tipo',
  clase: 'tipo',
  registro: 'tipo',
  nombre: 'nombre',
  'nombre completo': 'nombre',
  estudiante: 'nombre',
  alumno: 'nombre',
  correo: 'correo',
  email: 'correo',
  'e-mail': 'correo',
  'correo electronico': 'correo',
  contrasena: 'contrasena',
  password: 'contrasena',
  clave: 'contrasena',
  grupo: 'grupo',
  curso: 'grupo',
  grado: 'grado',
  nivel: 'grado',
  anio: 'anio',
  ano: 'anio',
  year: 'anio',
  ciclo: 'anio',
};

/** Normaliza un texto: minusculas, sin tildes, sin espacios sobrantes. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodificarXml(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCharCode(Number(codigo)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, codigo: string) => String.fromCharCode(parseInt(codigo, 16)))
    .replace(/&amp;/g, '&');
}

/** Decodifica el archivo a texto, con respaldo para codificaciones ANSI (Windows-1252). */
function decodificarTexto(contenido: Buffer): string {
  let texto = contenido.toString('utf8');
  if (texto.includes('\uFFFD')) {
    // Los bytes no eran UTF-8 validos: es casi seguro un CSV guardado en ANSI.
    texto = contenido.toString('latin1');
  }
  return texto.replace(/^\uFEFF/, '');
}

/* ---------------------------- CSV ---------------------------- */

function detectarSeparador(primeraLinea: string): string {
  const candidatos = [';', ',', '\t'];
  let mejor = ';';
  let maximo = -1;
  for (const candidato of candidatos) {
    const cuenta = primeraLinea.split(candidato).length - 1;
    if (cuenta > maximo) {
      maximo = cuenta;
      mejor = candidato;
    }
  }
  return mejor;
}

/** Parser CSV con soporte de comillas, comillas escapadas y saltos dentro de comillas. */
export function parsearCsv(texto: string): string[][] {
  const separador = detectarSeparador(texto.split(/\r?\n/, 1)[0] ?? '');
  const filas: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let entreComillas = false;

  const cerrarFila = () => {
    fila.push(campo);
    filas.push(fila);
    fila = [];
    campo = '';
  };

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];
    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }
    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === separador) {
      fila.push(campo);
      campo = '';
    } else if (caracter === '\n') {
      cerrarFila();
    } else if (caracter === '\r') {
      if (texto[i + 1] !== '\n') cerrarFila();
    } else {
      campo += caracter;
    }
  }
  if (campo !== '' || fila.length > 0) cerrarFila();
  return filas;
}

/* -------------------- XML Spreadsheet 2003 -------------------- */

function parsearWorksheet(xml: string): string[][] {
  const filas: string[][] = [];
  const reFila = /<Row\b[^>]*>([\s\S]*?)<\/Row>/g;
  let coincidenciaFila: RegExpExecArray | null;

  while ((coincidenciaFila = reFila.exec(xml)) !== null) {
    const contenido = coincidenciaFila[1] ?? '';
    const celdas: string[] = [];
    let columna = 0;
    const reCelda = /<Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Cell>)/g;
    let coincidenciaCelda: RegExpExecArray | null;

    while ((coincidenciaCelda = reCelda.exec(contenido)) !== null) {
      const atributos = coincidenciaCelda[1] ?? '';
      const cuerpo = coincidenciaCelda[2] ?? '';

      const indice = /ss:Index="(\d+)"/.exec(atributos);
      if (indice) {
        const objetivo = Number(indice[1]) - 1;
        while (columna < objetivo) {
          celdas.push('');
          columna += 1;
        }
      }

      const dato = /<Data\b[^>]*>([\s\S]*?)<\/Data>/.exec(cuerpo);
      celdas.push(dato ? decodificarXml(dato[1] ?? '') : '');
      columna += 1;
    }

    filas.push(celdas);
  }
  return filas;
}

function filaTieneEncabezado(fila: string[]): boolean {
  const normalizadas = fila.map((celda) => ALIAS_COLUMNAS[normalizar(celda)]);
  return normalizadas.includes('tipo') && normalizadas.includes('nombre');
}

/** Elige, entre las hojas, la que contiene los encabezados esperados. */
function elegirHoja(hojas: string[][][]): string[][] {
  for (const hoja of hojas) {
    if (hoja.some((fila) => filaTieneEncabezado(fila))) return hoja;
  }
  return hojas[0] ?? [];
}

export function parsearSpreadsheetXml(texto: string): string[][] {
  const hojas: string[][][] = [];
  const reHoja = /<Worksheet\b[^>]*>([\s\S]*?)<\/Worksheet>/g;
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = reHoja.exec(texto)) !== null) {
    hojas.push(parsearWorksheet(coincidencia[1] ?? ''));
  }
  if (hojas.length === 0) {
    // Sin etiqueta Worksheet: tratar todo el documento como una hoja.
    return parsearWorksheet(texto);
  }
  return elegirHoja(hojas);
}

/* --------------------- Tabla -> filas crudas --------------------- */

function tablaAFilas(tabla: string[][]): FilaCruda[] {
  const indiceEncabezado = tabla.findIndex((fila) => filaTieneEncabezado(fila));
  if (indiceEncabezado === -1) {
    throw new ErrorImportacion(
      'No se encontraron las columnas de la plantilla. Descarga la plantilla y no cambies los encabezados.',
    );
  }

  const encabezado = tabla[indiceEncabezado] ?? [];
  const mapaColumnas = new Map<number, ColumnaImportacion>();
  encabezado.forEach((celda, indice) => {
    const columna = ALIAS_COLUMNAS[normalizar(celda)];
    if (columna && ![...mapaColumnas.values()].includes(columna)) {
      mapaColumnas.set(indice, columna);
    }
  });

  const filas: FilaCruda[] = [];
  for (let i = indiceEncabezado + 1; i < tabla.length; i += 1) {
    const celdas = tabla[i] ?? [];
    const valores: Partial<Record<ColumnaImportacion, string>> = {};
    let tieneDatos = false;
    for (const [indice, columna] of mapaColumnas) {
      const valor = (celdas[indice] ?? '').trim();
      if (valor !== '') {
        valores[columna] = valor;
        tieneDatos = true;
      }
    }
    if (tieneDatos) filas.push({ fila: i + 1, valores });
  }
  return filas;
}

/* ------------------------- API publica ------------------------- */

export function parsearHoja(nombreArchivo: string, contenido: Buffer): FilaCruda[] {
  if (contenido.length === 0) throw new ErrorImportacion('El archivo esta vacio.');

  const extension = (nombreArchivo.split('.').pop() ?? '').toLowerCase();
  const firma = contenido.subarray(0, 2).toString('latin1');
  const esOle2 = contenido[0] === 0xd0 && contenido[1] === 0xcf; // .xls binario antiguo

  if (extension === 'xlsx' || firma === 'PK' || esOle2) {
    throw new ErrorImportacion(
      'El formato .xlsx (y los .xls binarios antiguos) no esta soportado. En Excel usa "Guardar como" > "Hoja de calculo XML 2003" (.xls) o "CSV UTF-8", o descarga la plantilla .xls.',
    );
  }

  const texto = decodificarTexto(contenido);
  const pareceXml =
    extension === 'xml' || extension === 'xls' || /^\s*<\?xml|<Workbook[\s>]/i.test(texto);

  const tabla = pareceXml ? parsearSpreadsheetXml(texto) : parsearCsv(texto);

  if (tabla.length === 0) throw new ErrorImportacion('No se encontro ninguna fila en el archivo.');

  return tablaAFilas(tabla);
}
