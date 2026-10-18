import { describe, expect, it } from 'vitest';
import { construirPlantillaExcel, construirPlantillaCsv } from '@/lib/importacion/plantilla';
import { parsearCsv, parsearHoja, parsearSpreadsheetXml } from '@/lib/importacion/parsear';
import { validarFilas, type ContextoValidacion } from '@/lib/importacion/validar';
import { ErrorImportacion, type FilaCruda } from '@/lib/importacion/tipos';
import { anioEscolarActual, normalizarAnioEscolar } from '@/lib/dominio/anio';

const contextoBase = (): ContextoValidacion => ({
  anioDefecto: '2026-2027',
  contrasenaPorDefecto: 'Estudiante123!',
  correosExistentes: new Set(['existe@colegio.edu']),
  gruposExistentes: new Set(['decimo a']),
});

describe('normalizarAnioEscolar', () => {
  it('acepta un ano suelto en rango', () => {
    expect(normalizarAnioEscolar('2026')).toBe('2026');
    expect(normalizarAnioEscolar('  2026 ')).toBe('2026');
  });

  it('normaliza un ciclo lectivo de dos anos', () => {
    expect(normalizarAnioEscolar('2026-2027')).toBe('2026-2027');
    expect(normalizarAnioEscolar('2026/2027')).toBe('2026-2027');
    expect(normalizarAnioEscolar('2026 - 2027')).toBe('2026-2027');
    expect(normalizarAnioEscolar('2026-27')).toBe('2026-2027');
    expect(normalizarAnioEscolar("'2026-2027")).toBe('2026-2027');
  });

  it('rechaza anos fuera de rango, rangos no consecutivos y basura', () => {
    expect(normalizarAnioEscolar('1999')).toBeNull();
    expect(normalizarAnioEscolar('2026-2028')).toBeNull();
    expect(normalizarAnioEscolar('hola')).toBeNull();
    expect(normalizarAnioEscolar('26-27')).toBeNull();
    expect(normalizarAnioEscolar('')).toBeNull();
  });

  it('calcula el ciclo activo a partir de una fecha', () => {
    expect(anioEscolarActual(new Date('2026-03-01'))).toBe('2026-2027');
  });
});

describe('parsearCsv', () => {
  it('detecta el separador punto y coma y respeta las comillas', () => {
    const tabla = parsearCsv(
      'tipo;nombre;correo\r\nESTUDIANTE;"Gomez, Ana";ana@colegio.edu\r\n',
    );
    expect(tabla[0]).toEqual(['tipo', 'nombre', 'correo']);
    expect(tabla[1]).toEqual(['ESTUDIANTE', 'Gomez, Ana', 'ana@colegio.edu']);
  });

  it('admite comillas escapadas', () => {
    const tabla = parsearCsv('a;b\n1;"di ""hola"""\n');
    expect(tabla[1]![1]).toBe('di "hola"');
  });

  it('detecta el separador coma', () => {
    const tabla = parsearCsv('tipo,nombre\nGRUPO,Decimo A\n');
    expect(tabla[0]).toEqual(['tipo', 'nombre']);
    expect(tabla[1]).toEqual(['GRUPO', 'Decimo A']);
  });
});

describe('parsearSpreadsheetXml', () => {
  it('respeta los huecos ss:Index entre celdas', () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
      '<Worksheet ss:Name="Datos"><Table>',
      '<Row><Cell><Data ss:Type="String">tipo</Data></Cell>',
      '<Cell><Data ss:Type="String">nombre</Data></Cell>',
      '<Cell ss:Index="7"><Data ss:Type="String">anio</Data></Cell></Row>',
      '<Row><Cell><Data ss:Type="String">GRUPO</Data></Cell>',
      '<Cell><Data ss:Type="String">Decimo A</Data></Cell>',
      '<Cell ss:Index="7"><Data ss:Type="Number">2026</Data></Cell></Row>',
      '</Table></Worksheet></Workbook>',
    ].join('');
    const tabla = parsearSpreadsheetXml(xml);
    expect(tabla[0]).toEqual(['tipo', 'nombre', '', '', '', '', 'anio']);
    expect(tabla[1]).toEqual(['GRUPO', 'Decimo A', '', '', '', '', '2026']);
  });
});

describe('parsearHoja', () => {
  it('lee la plantilla Excel generada (hoja Datos)', () => {
    const filas = parsearHoja('plantilla.xls', Buffer.from(construirPlantillaExcel('2026-2027'), 'utf8'));
    expect(filas.length).toBe(4);
    expect(filas[0]!.valores.tipo).toBe('ESTUDIANTE');
    expect(filas[0]!.valores.correo).toBe('ana.gomez@colegio.edu');
    expect(filas[2]!.valores).toMatchObject({ tipo: 'GRUPO', nombre: 'Decimo A', anio: '2026-2027' });
  });

  it('lee la plantilla CSV generada y quita el BOM', () => {
    const contenido = Buffer.from('\uFEFF' + construirPlantillaCsv('2026-2027'), 'utf8');
    const filas = parsearHoja('plantilla.csv', contenido);
    expect(filas.length).toBe(4);
    expect(filas[1]!.valores.nombre).toBe('Luis Perez');
  });

  it('rechaza los archivos .xlsx con un mensaje claro', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(() => parsearHoja('datos.xlsx', zip)).toThrow(ErrorImportacion);
  });

  it('falla si no encuentra los encabezados de la plantilla', () => {
    expect(() => parsearHoja('raro.csv', Buffer.from('uno;dos\n1;2\n', 'utf8'))).toThrow(
      ErrorImportacion,
    );
  });
});

describe('validarFilas', () => {
  const crudas: FilaCruda[] = [
    { fila: 2, valores: { tipo: 'ESTUDIANTE', nombre: 'Ana Gomez', correo: 'Ana@Colegio.edu', grupo: 'Decimo A' } },
    { fila: 3, valores: { tipo: 'ESTUDIANTE', nombre: 'Beto Ruiz', correo: 'beto', grupo: 'Nuevo Grupo' } },
    { fila: 4, valores: { tipo: 'ESTUDIANTE', nombre: 'Carlos Diaz', correo: 'existe@colegio.edu' } },
    { fila: 5, valores: { tipo: 'ESTUDIANTE', nombre: 'Diana Pena', correo: 'ana@colegio.edu' } },
    { fila: 6, valores: { tipo: 'GRUPO', nombre: 'Decimo A', anio: '2026' } },
    { fila: 7, valores: { tipo: 'GRUPO', nombre: 'Noveno B', grado: '9' } },
    { fila: 8, valores: { tipo: 'GRUPO', nombre: 'Once', anio: '1999' } },
  ];

  it('clasifica cada fila y resume los resultados', () => {
    const { filas, listas, resumen } = validarFilas(crudas, contextoBase());
    const estado = (fila: number) => filas.find((f) => f.fila === fila)?.estado;

    expect(estado(2)).toBe('LISTO');
    expect(estado(3)).toBe('ERROR'); // correo invalido
    expect(estado(4)).toBe('DUPLICADO'); // ya existe en la base
    expect(estado(5)).toBe('DUPLICADO'); // repetido en el archivo
    expect(estado(6)).toBe('DUPLICADO'); // grupo ya existente
    expect(estado(7)).toBe('LISTO');
    expect(estado(8)).toBe('ERROR'); // anio fuera de rango

    expect(resumen).toEqual({
      total: 7,
      listas: 2,
      errores: 2,
      duplicadas: 3,
      estudiantes: 1,
      grupos: 1,
    });

    const estudiante = listas.find((f) => f.tipo === 'ESTUDIANTE');
    expect(estudiante).toMatchObject({
      nombre: 'Ana Gomez',
      correo: 'ana@colegio.edu',
      contrasena: 'Estudiante123!',
      grupo: 'Decimo A',
      anio: '2026-2027',
    });
  });

  it('normaliza el ciclo lectivo de las filas', () => {
    const { listas } = validarFilas(
      [{ fila: 2, valores: { tipo: 'GRUPO', nombre: 'Once A', anio: '2026/27' } }],
      contextoBase(),
    );
    expect(listas[0]).toMatchObject({ tipo: 'GRUPO', anio: '2026-2027' });
  });

  it('asume ESTUDIANTE cuando hay correo y no hay tipo', () => {
    const { listas } = validarFilas(
      [{ fila: 2, valores: { nombre: 'Sin Tipo', correo: 'sintipo@colegio.edu' } }],
      contextoBase(),
    );
    expect(listas[0]).toMatchObject({ tipo: 'ESTUDIANTE', correo: 'sintipo@colegio.edu' });
  });

  it('exige una contrasena valida si no hay contrasena por defecto', () => {
    const { filas } = validarFilas(
      [{ fila: 2, valores: { tipo: 'ESTUDIANTE', nombre: 'Ana Gomez', correo: 'ana@colegio.edu' } }],
      { ...contextoBase(), contrasenaPorDefecto: 'corta' },
    );
    expect(filas[0]!.estado).toBe('ERROR');
  });
});
