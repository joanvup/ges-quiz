import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

/**
 * Pruebas de extremo a extremo de la base de datos:
 *
 *  1. El estado reporta el motor activo y el conteo de filas.
 *  2. El respaldo SQL incluye la estructura y los datos.
 *  3. El respaldo JSON incluye todas las tablas.
 *  4. Restaurar un respaldo devuelve la base al estado del archivo.
 *  5. Se puede probar una conexion destino (y falla si no existe).
 *  6. La migracion copia todos los datos a un archivo SQLite nuevo y el
 *     resultado se puede leer con Prisma.
 *  7. La interfaz ofrece el respaldo, la restauracion y la migracion.
 *  8. La interfaz pide confirmacion antes de inicializar sin datos de prueba.
 *  9. Inicializar sin datos borra los datos de trabajo y conserva la cuenta de
 *     administrador, la configuracion y la auditoria.
 *
 * Requiere la base de datos sembrada (`npm run seed`) y un servidor en
 * ejecucion (`npm run dev`).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

const CREDENCIALES = { correo: 'admin@colegio.edu', contrasena: 'Admin123!' };

const SUFIJO = Date.now();
const DIR_TEMPORAL = fs.mkdtempSync(path.join(os.tmpdir(), 'quizcolegio-e2e-'));

/** Ruta con barras normales, como la espera el CLI de Prisma. */
function rutaSqlite(nombre: string): string {
  return path.join(DIR_TEMPORAL, nombre).split(path.sep).join('/');
}

const DESTINO_PRUEBA = rutaSqlite('prueba.db');
const DESTINO_MIGRACION = rutaSqlite('migracion.db');

let admin: APIRequestContext;
let csrf = '';
let respaldoJson = '';

function api() {
  const cabeceras = { 'x-csrf-token': csrf };
  return {
    get: (url: string) => admin.get(url),
    post: (url: string, data?: unknown) => admin.post(url, { headers: cabeceras, data }),
    put: (url: string, data?: unknown) => admin.put(url, { headers: cabeceras, data }),
  };
}

async function iniciarSesion(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(CREDENCIALES.correo);
  await page.locator('#contrasena').fill(CREDENCIALES.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe.serial('Base de datos: respaldo y migracion', () => {
  test.beforeAll(async () => {
    admin = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const sesion = await admin.post('/api/auth/login', { data: CREDENCIALES });
    expect(sesion.ok(), 'login administrador').toBeTruthy();
    const cookie = (await admin.storageState()).cookies.find((c) => c.name === 'qc_csrf');
    expect(cookie, 'cookie CSRF').toBeTruthy();
    csrf = cookie!.value;
  });

  test.afterAll(async () => {
    await admin?.dispose();
    // Limpieza "best effort": el servidor de Next mantiene abiertos los
    // archivos SQLite que creo, asi que borrar el directorio puede fallar
    // sin que ello afecte al resultado de las pruebas.
    try {
      fs.rmSync(DIR_TEMPORAL, { recursive: true, force: true });
    } catch {
      /* quedan archivos vacios en la carpeta temporal del sistema */
    }
  });

  test('el estado reporta el motor activo y las filas', async () => {
    const respuesta = await api().get('/api/admin/base-datos');
    expect(respuesta.status()).toBe(200);

    const { datos } = (await respuesta.json()) as {
      datos: {
        estado: {
          motor: string;
          conexion: string;
          totalFilas: number;
          sincronizado: boolean;
          tablas: { tabla: string; filas: number }[];
        };
      };
    };

    expect(datos.estado.motor).toBe('sqlite');
    expect(datos.estado.conexion).toContain('file:');
    expect(datos.estado.totalFilas).toBeGreaterThan(0);
    expect(datos.estado.sincronizado).toBe(true);

    const usuarios = datos.estado.tablas.find((tabla) => tabla.tabla === 'User');
    expect(usuarios?.filas).toBeGreaterThan(0);
  });

  test('descarga el respaldo SQL con estructura y datos', async () => {
    const respuesta = await api().get('/api/admin/base-datos/respaldo?formato=sql');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-disposition']).toContain('respaldo-quizcolegio-');

    const sql = await respuesta.text();
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('INSERT INTO');
    expect(sql).toContain('"User"');
    expect(sql).toContain('"Quiz"');
  });

  test('descarga el respaldo JSON con todas las tablas', async () => {
    const respuesta = await api().get('/api/admin/base-datos/respaldo?formato=json');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toContain('application/json');

    respaldoJson = await respuesta.text();
    const respaldo = JSON.parse(respaldoJson) as {
      version: number;
      motor: string;
      tablas: { tabla: string; filas: unknown[] }[];
    };

    expect(respaldo.version).toBe(1);
    expect(respaldo.motor).toBe('sqlite');
    expect(respaldo.tablas.length).toBeGreaterThanOrEqual(15);
    expect(respaldo.tablas.find((t) => t.tabla === 'User')?.filas.length).toBeGreaterThan(0);
  });

  test('restaura un respaldo y revierte un cambio posterior', async () => {
    // El respaldo se tomo antes de este cambio, asi que restaurarlo lo revierte.
    const antes = await api().get('/api/admin/ajustes');
    const { datos: datosAntes } = (await antes.json()) as {
      datos: { valores: Record<string, unknown> };
    };
    const nombreOriginal = datosAntes.valores['institucion.nombre'];

    const cambiado = await api().put('/api/admin/ajustes', {
      'institucion.nombre': 'Nombre temporal E2E',
    });
    expect(cambiado.status()).toBe(200);

    const trasCambio = await api().get('/api/admin/ajustes');
    const { datos: datosCambio } = (await trasCambio.json()) as {
      datos: { valores: Record<string, unknown> };
    };
    expect(datosCambio.valores['institucion.nombre']).toBe('Nombre temporal E2E');

    const restaurado = await admin.post('/api/admin/base-datos/restaurar', {
      headers: { 'x-csrf-token': csrf },
      multipart: {
        archivo: {
          name: 'respaldo.json',
          mimeType: 'application/json',
          buffer: Buffer.from(respaldoJson),
        },
      },
    });
    expect(restaurado.status()).toBe(200);

    const { datos: datosRestaurado } = (await restaurado.json()) as {
      datos: { informe: { totalFilas: number; respaldoPrevio: string } };
    };
    expect(datosRestaurado.informe.totalFilas).toBeGreaterThan(0);
    expect(datosRestaurado.informe.respaldoPrevio).toContain('pre-restauracion');

    const despues = await api().get('/api/admin/ajustes');
    const { datos: datosDespues } = (await despues.json()) as {
      datos: { valores: Record<string, unknown> };
    };
    expect(datosDespues.valores['institucion.nombre']).toBe(nombreOriginal);
  });

  test('prueba una conexion destino valida y otra invalida', async () => {
    const valida = await api().post('/api/admin/base-datos/probar', {
      conexion: { motor: 'sqlite', archivo: DESTINO_PRUEBA },
    });
    expect(valida.status()).toBe(200);

    const invalida = await api().post('/api/admin/base-datos/probar', {
      conexion: {
        motor: 'postgresql',
        host: '127.0.0.1',
        puerto: 1,
        baseDatos: 'noexiste',
        usuario: 'nadie',
        contrasena: 'nada',
      },
    });
    expect(invalida.status()).toBe(400);
    const { error } = (await invalida.json()) as { error: { codigo: string } };
    expect(error.codigo).toBe('OPERACION_BD_FALLIDA');
  });

  test('migra todos los datos a un archivo SQLite nuevo', async () => {
    const respuesta = await api().post('/api/admin/base-datos/migrar', {
      conexion: { motor: 'sqlite', archivo: DESTINO_MIGRACION },
      cambiarConfiguracion: false,
    });
    expect(respuesta.status()).toBe(200);

    const { datos } = (await respuesta.json()) as {
      datos: {
        informe: {
          motorOrigen: string;
          motorDestino: string;
          totalFilas: number;
          esquemaVerificado: boolean;
          configuracionActualizada: boolean;
          tablas: { tabla: string; filas: number }[];
        };
      };
    };

    expect(datos.informe.motorOrigen).toBe('sqlite');
    expect(datos.informe.motorDestino).toBe('sqlite');
    expect(datos.informe.totalFilas).toBeGreaterThan(0);
    expect(datos.informe.esquemaVerificado).toBe(true);
    expect(datos.informe.configuracionActualizada).toBe(false);
    expect(datos.informe.tablas.find((t) => t.tabla === 'User')?.filas).toBeGreaterThan(0);

    // La base destino se puede leer con Prisma y tiene los mismos usuarios.
    const { PrismaClient } = await import('@prisma/client');
    const destino = new PrismaClient({ datasourceUrl: `file:${DESTINO_MIGRACION}` });
    try {
      const origen = await api().get('/api/admin/base-datos');
      const { datos: estado } = (await origen.json()) as {
        datos: { estado: { tablas: { tabla: string; filas: number }[] } };
      };
      const usuariosOrigen = estado.estado.tablas.find((t) => t.tabla === 'User')?.filas ?? 0;

      expect(await destino.user.count()).toBe(usuariosOrigen);
      expect(await destino.quiz.count()).toBeGreaterThan(0);
    } finally {
      await destino.$disconnect();
    }
  });

  test('la interfaz ofrece respaldo, restauracion y migracion', async ({ page }) => {
    await iniciarSesion(page);
    page.on('dialog', (dialogo) => void dialogo.accept());

    await page.goto('/admin/base-datos');
    await expect(page.getByRole('heading', { name: 'Base de datos', level: 1 })).toBeVisible();
    await expect(page.locator('#motor-conexion')).toContainText('file:');
    await expect(page.locator('#respaldo-sql')).toBeVisible();
    await expect(page.locator('#respaldo-json')).toBeVisible();

    // Prueba de conexion desde el formulario.
    const destino = rutaSqlite('interfaz.db');
    await page.locator('#migrar-motor').selectOption('sqlite');
    await page.locator('#migrar-archivo').fill(destino);
    await page.locator('#migrar-probar').click();
    await expect(page.getByText('Conexion verificada')).toBeVisible({ timeout: 60_000 });

    // Restauracion desde la interfaz (con un respaldo recien descargado).
    const descarga = await api().get('/api/admin/base-datos/respaldo?formato=json');
    const rutaRespaldo = path.join(DIR_TEMPORAL, 'interfaz-respaldo.json');
    fs.writeFileSync(rutaRespaldo, await descarga.text(), 'utf8');

    await page.locator('#restaurar-archivo').setInputFiles(rutaRespaldo);
    await page.locator('#restaurar-confirmo').check();
    await page.locator('#restaurar-boton').click();
    await expect(page.getByText(/Respaldo restaurado:/)).toBeVisible({ timeout: 60_000 });
  });

  test('la interfaz pide confirmacion para inicializar sin datos de prueba', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/admin/base-datos');

    await expect(
      page.getByRole('heading', { name: 'Inicializar sin datos de prueba' }),
    ).toBeVisible();
    await expect(page.locator('#inicializar-confirmo')).toBeVisible();

    // El boton esta bloqueado hasta marcar la casilla de confirmacion.
    const boton = page.locator('#inicializar-boton');
    await expect(boton).toBeDisabled();
    await page.locator('#inicializar-confirmo').check();
    await expect(boton).toBeEnabled();
  });

  test('borra los datos de prueba y conserva la cuenta y la configuracion', async () => {
    // 1. Copia del estado actual, para devolverlo al terminar la prueba.
    const copia = await api().get('/api/admin/base-datos/respaldo?formato=json');
    expect(copia.status()).toBe(200);
    const copiaPrevia = await copia.text();

    const antes = await api().get('/api/admin/base-datos');
    const { datos: estadoAntes } = (await antes.json()) as {
      datos: { estado: { totalFilas: number; tablas: { tabla: string; filas: number }[] } };
    };
    const filas = (tablas: { tabla: string; filas: number }[], tabla: string) =>
      tablas.find((fila) => fila.tabla === tabla)?.filas ?? 0;

    expect(filas(estadoAntes.estado.tablas, 'User')).toBeGreaterThan(1);
    expect(filas(estadoAntes.estado.tablas, 'Group')).toBeGreaterThan(0);
    expect(filas(estadoAntes.estado.tablas, 'Quiz')).toBeGreaterThan(0);

    const ajustesAntes = await api().get('/api/admin/ajustes');
    const { datos: datosAjustesAntes } = (await ajustesAntes.json()) as {
      datos: { valores: Record<string, unknown> };
    };
    const nombreInstitucion = datosAjustesAntes.valores['institucion.nombre'];

    // 2. Inicializar sin datos de prueba.
    const respuesta = await api().post('/api/admin/base-datos/inicializar');
    expect(respuesta.status()).toBe(200);

    const { datos } = (await respuesta.json()) as {
      datos: {
        informe: {
          totalFilas: number;
          respaldoPrevio: string;
          conservado: { usuarios: number; configuracion: number; auditoria: number };
        };
      };
    };
    expect(datos.informe.totalFilas).toBeGreaterThan(0);
    expect(datos.informe.respaldoPrevio).toContain('pre-inicializacion');
    expect(datos.informe.conservado.usuarios).toBe(1);
    expect(datos.informe.conservado.configuracion).toBeGreaterThan(0);

    // 3. La sesion del administrador sigue abierta y los datos de trabajo desaparecieron.
    const despues = await api().get('/api/admin/base-datos');
    expect(despues.status()).toBe(200);

    const { datos: estadoDespues } = (await despues.json()) as {
      datos: { estado: { tablas: { tabla: string; filas: number }[] } };
    };
    expect(filas(estadoDespues.estado.tablas, 'User')).toBe(1);
    for (const tabla of ['Group', 'Document', 'Question', 'Quiz', 'Attempt', 'Answer', 'ProctorEvent']) {
      expect(filas(estadoDespues.estado.tablas, tabla), tabla).toBe(0);
    }

    // La configuracion y la auditoria se conservan.
    expect(filas(estadoDespues.estado.tablas, 'Setting')).toBe(
      filas(estadoAntes.estado.tablas, 'Setting'),
    );
    expect(filas(estadoDespues.estado.tablas, 'AuditLog')).toBeGreaterThanOrEqual(
      filas(estadoAntes.estado.tablas, 'AuditLog'),
    );

    const ajustesDespues = await api().get('/api/admin/ajustes');
    expect(ajustesDespues.status()).toBe(200);
    const { datos: datosAjustesDespues } = (await ajustesDespues.json()) as {
      datos: { valores: Record<string, unknown> };
    };
    expect(datosAjustesDespues.valores['institucion.nombre']).toBe(nombreInstitucion);

    // 4. Restaurar la copia previa deja la base como estaba.
    const restaurado = await admin.post('/api/admin/base-datos/restaurar', {
      headers: { 'x-csrf-token': csrf },
      multipart: {
        archivo: {
          name: 'previa.json',
          mimeType: 'application/json',
          buffer: Buffer.from(copiaPrevia),
        },
      },
    });
    expect(restaurado.status()).toBe(200);

    const final = await api().get('/api/admin/base-datos');
    const { datos: estadoFinal } = (await final.json()) as {
      datos: { estado: { tablas: { tabla: string; filas: number }[] } };
    };
    expect(filas(estadoFinal.estado.tablas, 'User')).toBe(filas(estadoAntes.estado.tablas, 'User'));
    expect(filas(estadoFinal.estado.tablas, 'Quiz')).toBe(
      filas(estadoAntes.estado.tablas, 'Quiz'),
    );
    expect(filas(estadoFinal.estado.tablas, 'Group')).toBeGreaterThan(0);
  });
});
