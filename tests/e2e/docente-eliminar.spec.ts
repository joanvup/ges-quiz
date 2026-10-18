import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

/**
 * Pruebas de extremo a extremo del borrado:
 *
 *  1. Eliminar un banco de preguntas completo (el banco general / manual).
 *  2. Eliminar un quiz que nunca se ha ejecutado (aunque este publicado).
 *  3. No poder eliminar un quiz que ya tiene intentos (el servidor lo impide).
 *  4. La interfaz ofrece el borrado del banco elegido.
 *  5. La interfaz ofrece el borrado de un quiz nunca ejecutado.
 *
 * Requiere la base de datos sembrada (`npm run seed`) y un servidor en
 * ejecucion (`npm run dev`). El banco general debe estar limpio.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

const CREDENCIALES = {
  docente: { correo: 'docente@colegio.edu', contrasena: 'Docente123!' },
  estudiante1: { correo: 'estudiante1@colegio.edu', contrasena: 'Estudiante123!' },
};

const SUFIJO = Date.now();

let docente: APIRequestContext;
let csrf = '';
let estudiante: APIRequestContext;
let csrfEstudiante = '';
let grupoDecimoId = '';
let preguntaIds: string[] = [];

function apiDocente() {
  const cabeceras = { 'x-csrf-token': csrf };
  return {
    get: (url: string) => docente.get(url),
    post: (url: string, data?: unknown) => docente.post(url, { headers: cabeceras, data }),
    patch: (url: string, data?: unknown) => docente.patch(url, { headers: cabeceras, data }),
    put: (url: string, data?: unknown) => docente.put(url, { headers: cabeceras, data }),
    del: (url: string, data?: unknown) => docente.delete(url, { headers: cabeceras, data }),
  };
}

async function iniciarSesion(page: Page, credencial: { correo: string; contrasena: string }) {
  await page.goto('/login');
  await page.locator('#email').fill(credencial.correo);
  await page.locator('#contrasena').fill(credencial.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel/);
}

/** Crea un quiz (con grupo asignado y preguntas) y, si se pide, lo publica. */
async function crearQuiz(titulo: string, opciones: { publicar?: boolean } = {}): Promise<string> {
  const api = apiDocente();

  const creado = await api.post('/api/quices', {
    titulo,
    descripcion: 'Quiz creado por la prueba de eliminacion.',
  });
  expect(creado.ok(), 'crear quiz').toBeTruthy();
  const { datos: datosCreado } = (await creado.json()) as { datos: { quiz: { id: string } } };
  const id = datosCreado.quiz.id;

  const configurado = await api.patch(`/api/quices/${id}`, {
    grupoIds: [grupoDecimoId],
    intentosMaximos: 1,
    notaAprobacion: 1,
    notaMaxima: 5,
  });
  expect(configurado.ok(), 'configurar quiz').toBeTruthy();

  const asignar = await api.put(`/api/quices/${id}/preguntas`, {
    preguntas: preguntaIds.slice(0, 2).map((preguntaId) => ({ id: preguntaId })),
  });
  expect(asignar.ok(), 'asignar preguntas').toBeTruthy();

  if (opciones.publicar) {
    const publicado = await api.post(`/api/quices/${id}/publicar`, { confirmoRevision: true });
    expect(publicado.ok(), 'publicar quiz').toBeTruthy();
  }

  return id;
}

test.describe.serial('Eliminar banco de preguntas y quices', () => {
  test.beforeAll(async () => {
    docente = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const sesion = await docente.post('/api/auth/login', { data: CREDENCIALES.docente });
    expect(sesion.ok(), 'login docente').toBeTruthy();
    const cookieCsrf = (await docente.storageState()).cookies.find((c) => c.name === 'qc_csrf');
    expect(cookieCsrf, 'cookie CSRF docente').toBeTruthy();
    csrf = cookieCsrf!.value;

    const api = apiDocente();

    const grupos = await api.get('/api/admin/grupos');
    expect(grupos.ok(), 'listar grupos').toBeTruthy();
    const { datos: datosGrupos } = (await grupos.json()) as {
      datos: { grupos: { id: string; nombre: string }[] };
    };
    grupoDecimoId = datosGrupos.grupos.find((grupo) => grupo.nombre === 'Decimo A')!.id;
    expect(grupoDecimoId, 'grupo Decimo A').toBeTruthy();

    const preguntas = await api.get('/api/preguntas?estado=APPROVED&limite=20');
    expect(preguntas.ok(), 'listar preguntas').toBeTruthy();
    const { datos: datosPreguntas } = (await preguntas.json()) as {
      datos: { preguntas: { id: string; opciones: { correcta: boolean }[] }[] };
    };
    preguntaIds = datosPreguntas.preguntas
      .filter((pregunta) => pregunta.opciones.some((opcion) => opcion.correcta))
      .slice(0, 3)
      .map((pregunta) => pregunta.id);
    expect(preguntaIds.length, 'preguntas aprobadas con respuesta').toBeGreaterThanOrEqual(2);

    estudiante = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const sesionEst = await estudiante.post('/api/auth/login', { data: CREDENCIALES.estudiante1 });
    expect(sesionEst.ok(), 'login estudiante1').toBeTruthy();
    const cookieEst = (await estudiante.storageState()).cookies.find((c) => c.name === 'qc_csrf');
    csrfEstudiante = cookieEst!.value;
  });

  test.afterAll(async () => {
    await Promise.allSettled([docente?.dispose(), estudiante?.dispose()]);
  });

  test('elimina un banco de preguntas completo (general)', async () => {
    const api = apiDocente();
    const creadas: string[] = [];

    for (let n = 1; n <= 3; n += 1) {
      const creada = await api.post('/api/preguntas', {
        enunciado: `Pregunta manual E2E ${SUFIJO} numero ${n}`,
        tipo: 'MCQ_SINGLE',
        opciones: [
          { texto: 'Correcta', correcta: true },
          { texto: 'Incorrecta', correcta: false },
        ],
        estado: 'APPROVED',
        documentoId: null,
      });
      expect(creada.ok(), 'crear pregunta manual').toBeTruthy();
      const { datos } = (await creada.json()) as { datos: { id: string } };
      creadas.push(datos.id);
    }

    const borrado = await api.del('/api/preguntas/banco', { documentoId: null });
    expect(borrado.status()).toBe(200);
    const { datos: resultado } = (await borrado.json()) as {
      datos: { total: number; eliminadas: number; archivadas: number };
    };
    expect(resultado.eliminadas).toBeGreaterThanOrEqual(3);

    const listado = await api.get('/api/preguntas?limite=100');
    const { datos: datosListado } = (await listado.json()) as {
      datos: { preguntas: { id: string }[] };
    };
    const restantes = new Set(datosListado.preguntas.map((pregunta) => pregunta.id));
    for (const id of creadas) {
      expect(restantes.has(id), `la pregunta ${id} fue eliminada`).toBeFalsy();
    }
  });

  test('elimina un quiz publicado que nunca se ejecuto', async () => {
    const api = apiDocente();
    const titulo = `E2E eliminar publicado ${SUFIJO}`;
    const id = await crearQuiz(titulo, { publicar: true });

    const borrado = await api.del(`/api/quices/${id}`);
    expect(borrado.status()).toBe(200);

    const ficha = await api.get(`/api/quices/${id}`);
    expect(ficha.status()).toBe(404);
  });

  test('no elimina un quiz que ya fue presentado', async () => {
    const api = apiDocente();
    const titulo = `E2E eliminar con intento ${SUFIJO}`;
    const id = await crearQuiz(titulo, { publicar: true });

    const iniciado = await estudiante.post('/api/intentos', {
      headers: { 'x-csrf-token': csrfEstudiante },
      data: { quizId: id },
    });
    expect([200, 201]).toContain(iniciado.status());

    const borrado = await api.del(`/api/quices/${id}`);
    expect(borrado.status()).toBe(409);
    const cuerpo = (await borrado.json()) as { error?: { codigo?: string } };
    expect(cuerpo.error?.codigo).toBe('CONFLICTO');

    // Limpieza: se cierra para no dejar el quiz disponible.
    await api.post(`/api/quices/${id}/cerrar`);
  });

  test('la interfaz elimina el banco de preguntas elegido', async ({ page }) => {
    const api = apiDocente();
    const enunciado = `Pregunta manual E2E interfaz ${SUFIJO}`;
    const creada = await api.post('/api/preguntas', {
      enunciado,
      tipo: 'TRUE_FALSE',
      opciones: [
        { texto: 'Verdadero', correcta: true },
        { texto: 'Falso', correcta: false },
      ],
      estado: 'APPROVED',
      documentoId: null,
    });
    expect(creada.ok(), 'crear pregunta manual').toBeTruthy();

    await iniciarSesion(page, CREDENCIALES.docente);
    page.on('dialog', (dialogo) => void dialogo.accept());

    await page.goto('/docentes/preguntas');
    await page.locator('#banco-filtro').selectOption('GENERAL');

    const boton = page.getByRole('button', { name: /Eliminar banco/ });
    await expect(boton).toBeEnabled();
    await boton.click();

    await expect(page.getByText(enunciado)).toHaveCount(0, { timeout: 10_000 });
  });

  test('la interfaz elimina un quiz nunca ejecutado', async ({ page }) => {
    const titulo = `E2E eliminar interfaz ${SUFIJO}`;
    await crearQuiz(titulo, { publicar: true });

    await iniciarSesion(page, CREDENCIALES.docente);
    page.on('dialog', (dialogo) => void dialogo.accept());

    await page.goto('/docentes/quices');
    const tarjeta = page.locator('section').filter({ hasText: titulo });
    await expect(tarjeta).toBeVisible();
    await tarjeta.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.locator('section').filter({ hasText: titulo })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
