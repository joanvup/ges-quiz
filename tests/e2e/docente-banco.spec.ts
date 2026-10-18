import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';

/**
 * Prueba de extremo a extremo del banco de preguntas por documento.
 *
 * Verifica que, al armar un quiz, el docente puede elegir el banco de un
 * documento (el PDF) y cargar todas sus preguntas de una sola vez, y que la
 * seleccion se guarda.
 *
 * Requiere la base de datos sembrada (`npm run seed`), donde el documento
 * "Material de estudio: el sistema solar" tiene su propio banco de 5 preguntas.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

const TITULO_QUIZ = `E2E banco por documento ${Date.now()}`;

let docente: APIRequestContext;
let csrf = '';
let quizId = '';

test.describe('Banco de preguntas por documento', () => {
  test.beforeAll(async () => {
    docente = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const sesion = await docente.post('/api/auth/login', {
      data: { correo: 'docente@colegio.edu', contrasena: 'Docente123!' },
    });
    expect(sesion.ok(), 'login docente').toBeTruthy();
    csrf = (await docente.storageState()).cookies.find((c) => c.name === 'qc_csrf')!.value;

    const creado = await docente.post('/api/quices', {
      headers: { 'x-csrf-token': csrf },
      data: { titulo: TITULO_QUIZ, descripcion: 'Quiz de prueba del banco por documento.' },
    });
    expect(creado.ok(), 'crear quiz').toBeTruthy();
    const { datos } = (await creado.json()) as { datos: { quiz: { id: string } } };
    quizId = datos.quiz.id;
  });

  test.afterAll(async () => {
    await docente?.dispose();
  });

  test('el docente elige un banco y carga todas sus preguntas', async ({ page }) => {
    expect(quizId).toBeTruthy();

    await page.goto('/login');
    await page.locator('#email').fill('docente@colegio.edu');
    await page.locator('#contrasena').fill('Docente123!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/panel/);

    await page.goto(`/docentes/quices/${quizId}`);
    await expect(page.getByRole('heading', { name: TITULO_QUIZ })).toBeVisible();

    // Pestana de preguntas, vacia al inicio.
    await page.getByRole('button', { name: 'Preguntas (0)' }).click();
    await page.getByRole('button', { name: '+ Agregar preguntas' }).first().click();

    // Elige el banco del documento sembrado.
    const opcionBanco = page.locator('#quiz-banco option').filter({ hasText: 'Material de estudio' });
    await expect(opcionBanco).toHaveCount(1);
    const valorBanco = await opcionBanco.getAttribute('value');
    expect(valorBanco).toBeTruthy();
    await page.locator('#quiz-banco').selectOption(valorBanco!);

    // Carga todo el banco de una sola vez (5 preguntas sembradas).
    await page.getByRole('button', { name: /Cargar todo el banco/ }).click();
    await expect(page.getByRole('button', { name: 'Preguntas (5)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quitar' })).toHaveCount(5);

    // Guarda y confirma la persistencia tras recargar.
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Cambios guardados correctamente.')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Preguntas (5)' }).click();
    await expect(page.getByRole('button', { name: 'Quitar' })).toHaveCount(5);
  });
});
