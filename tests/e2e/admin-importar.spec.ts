import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

/**
 * Pruebas de extremo a extremo de la importacion de estudiantes y grupos:
 *
 *  1. Se descarga la plantilla (CSV y Excel) con los encabezados correctos.
 *  2. La validacion reporta los errores por fila sin escribir en la base.
 *  3. La importacion crea los estudiantes y los grupos, y evita duplicados.
 *  4. Un archivo sin filas validas se rechaza.
 *  5. La interfaz valida el archivo, muestra la vista previa e importa.
 *
 * Requiere la base de datos sembrada (`npm run seed`) y un servidor en
 * ejecucion (`npm run dev`).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

const ADMIN = { correo: 'admin@colegio.edu', contrasena: 'Admin123!' };

const SUFIJO = Date.now();
const CORREO_UNO = `import.e2e.uno.${SUFIJO}@colegio.edu`;
const CORREO_DOS = `import.e2e.dos.${SUFIJO}@colegio.edu`;
const GRUPO_NUEVO = `Grupo E2E ${SUFIJO}`;

function archivoCsv(filas: string[]) {
  return {
    name: `importacion-${SUFIJO}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(`\uFEFF${filas.join('\r\n')}\r\n`, 'utf8'),
  };
}

const CABECERA = 'tipo;nombre;correo;contrasena;grupo;grado;anio';

const FILAS = [
  CABECERA,
  `ESTUDIANTE;E2E Uno;${CORREO_UNO};;Decimo A;10;2026`,
  `ESTUDIANTE;E2E Dos;${CORREO_DOS};Clave123!;${GRUPO_NUEVO};11;2026`,
  'ESTUDIANTE;E2E Correo Malo;correo-invalido;;',
  `GRUPO;${GRUPO_NUEVO};;;11;2026`,
];

let admin: APIRequestContext;
let csrf = '';

function apiAdmin() {
  const cabeceras = { 'x-csrf-token': csrf };
  return {
    get: (url: string) => admin.get(url),
    post: (url: string, data?: unknown) => admin.post(url, { headers: cabeceras, data }),
    postArchivo: (url: string, archivo: ReturnType<typeof archivoCsv>) =>
      admin.post(url, { headers: cabeceras, multipart: { archivo } }),
  };
}

async function iniciarSesion(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(ADMIN.correo);
  await page.locator('#contrasena').fill(ADMIN.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe.serial('Importar estudiantes y grupos', () => {
  test.beforeAll(async () => {
    admin = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const sesion = await admin.post('/api/auth/login', { data: ADMIN });
    expect(sesion.ok(), 'login administrador').toBeTruthy();
    const cookieCsrf = (await admin.storageState()).cookies.find((c) => c.name === 'qc_csrf');
    expect(cookieCsrf, 'cookie CSRF').toBeTruthy();
    csrf = cookieCsrf!.value;
  });

  test.afterAll(async () => {
    await admin?.dispose();
  });

  test('descarga la plantilla CSV con los encabezados', async () => {
    const respuesta = await admin.get('/api/admin/importar/plantilla?formato=csv');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-disposition']).toContain('attachment');
    const texto = await respuesta.text();
    expect(texto).toContain('tipo;nombre;correo;contrasena;grupo;grado;anio');
    expect(texto).toContain('ESTUDIANTE');
    expect(texto).toContain('GRUPO');
  });

  test('descarga la plantilla Excel en formato SpreadsheetML', async () => {
    const respuesta = await admin.get('/api/admin/importar/plantilla?formato=excel');
    expect(respuesta.status()).toBe(200);
    const texto = await respuesta.text();
    expect(texto).toContain('<Workbook');
    expect(texto).toContain('ss:Name="Datos"');
    expect(texto).toContain('ss:Name="Instrucciones"');
  });

  test('rechaza los archivos .xlsx con un mensaje claro', async () => {
    const api = apiAdmin();
    const respuesta = await admin.post('/api/admin/importar/validar', {
      headers: { 'x-csrf-token': csrf },
      multipart: {
        archivo: {
          name: 'datos.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        },
      },
    });
    expect(respuesta.status()).toBe(400);
    const cuerpo = (await respuesta.json()) as { error?: { mensaje?: string } };
    expect(cuerpo.error?.mensaje).toContain('.xlsx');
    void api;
  });

  test('valida el archivo y reporta los errores por fila sin importar', async () => {
    const api = apiAdmin();
    const respuesta = await api.postArchivo('/api/admin/importar/validar', archivoCsv(FILAS));
    expect(respuesta.status()).toBe(200);

    const { datos } = (await respuesta.json()) as {
      datos: {
        filas: { fila: number; estado: string; mensajes: string[] }[];
        resumen: {
          total: number;
          listas: number;
          errores: number;
          duplicadas: number;
          estudiantes: number;
          grupos: number;
        };
      };
    };

    expect(datos.resumen).toMatchObject({
      total: 4,
      listas: 3,
      errores: 1,
      duplicadas: 0,
      estudiantes: 2,
      grupos: 1,
    });
    // La fila con el correo invalido se marca como error.
    const filaMala = datos.filas.find((fila) => fila.fila === 4);
    expect(filaMala?.estado).toBe('ERROR');

    // Todavia no se creo nada: el usuario no existe.
    const usuarios = await api.get(`/api/admin/usuarios?buscar=${CORREO_UNO}`);
    const { datos: datosUsuarios } = (await usuarios.json()) as { datos: { usuarios: unknown[] } };
    expect(datosUsuarios.usuarios).toHaveLength(0);
  });

  test('importa y crea los estudiantes y el grupo', async () => {
    const api = apiAdmin();
    const respuesta = await api.postArchivo('/api/admin/importar', archivoCsv(FILAS));
    expect(respuesta.status()).toBe(201);

    const { datos } = (await respuesta.json()) as {
      datos: {
        resultado: { usuariosCreados: number; gruposCreados: number; membresiasCreadas: number };
      };
    };
    expect(datos.resultado).toMatchObject({
      usuariosCreados: 2,
      gruposCreados: 1,
      membresiasCreadas: 2,
    });

    const usuarios = await api.get(`/api/admin/usuarios?buscar=${SUFIJO}`);
    const { datos: datosUsuarios } = (await usuarios.json()) as {
      datos: { usuarios: { correo: string; grupos: { nombre: string }[] }[] };
    };
    const correos = datosUsuarios.usuarios.map((usuario) => usuario.correo);
    expect(correos).toContain(CORREO_UNO);
    expect(correos).toContain(CORREO_DOS);

    const segundo = datosUsuarios.usuarios.find((usuario) => usuario.correo === CORREO_DOS);
    expect(segundo?.grupos.map((grupo) => grupo.nombre)).toContain(GRUPO_NUEVO);
  });

  test('al reimportar, detecta los duplicados y rechaza el archivo', async () => {
    const api = apiAdmin();

    const validado = await api.postArchivo('/api/admin/importar/validar', archivoCsv(FILAS));
    const { datos } = (await validado.json()) as {
      datos: { resumen: { listas: number; duplicadas: number; errores: number } };
    };
    expect(datos.resumen.listas).toBe(0);
    expect(datos.resumen.duplicadas).toBe(3);
    expect(datos.resumen.errores).toBe(1);

    const importado = await api.postArchivo('/api/admin/importar', archivoCsv(FILAS));
    expect(importado.status()).toBe(400);
    const cuerpo = (await importado.json()) as { error?: { codigo?: string } };
    expect(cuerpo.error?.codigo).toBe('SOLICITUD_INVALIDA');
  });

  test('la interfaz valida el archivo, muestra la vista previa e importa', async ({ page }) => {
    const uiSufijo = Date.now();
    const uiGrupo = `Grupo UI ${uiSufijo}`;
    const uiNombre = `Alumna UI ${uiSufijo}`;
    const uiCorreo = `import.ui.${uiSufijo}@colegio.edu`;
    const filasUi = [
      CABECERA,
      `ESTUDIANTE;${uiNombre};${uiCorreo};;${uiGrupo};10;2026`,
      `GRUPO;${uiGrupo};;;10;2026`,
    ];

    await iniciarSesion(page);
    await page.goto('/admin/importar');
    await expect(
      page.getByRole('heading', { name: 'Importar estudiantes y grupos', exact: true }),
    ).toBeVisible();

    await page.locator('#archivo-importacion').setInputFiles({
      name: 'importacion-ui.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`\uFEFF${filasUi.join('\r\n')}\r\n`, 'utf8'),
    });

    await page.getByRole('button', { name: 'Validar archivo' }).click();
    await expect(page.getByText(/Archivo validado/)).toBeVisible();
    await expect(page.getByText(uiNombre)).toBeVisible();

    await page.getByRole('button', { name: /Importar 2 fila/ }).click();
    await expect(page.getByText(/Importacion completada/)).toBeVisible();
    await expect(page.getByText(/1 estudiante\(s\) y 1 grupo\(s\)/)).toBeVisible();
  });
});
