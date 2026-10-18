import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

/**
 * Prueba de extremo a extremo del flujo del estudiante.
 *
 *  1. Un docente (via API, usando las mismas rutas que la interfaz) crea,
 *     configura y publica dos quices asignados a "Decimo A": uno de navegacion
 *     libre y otro de navegacion solo hacia adelante.
 *  2. El primer estudiante recorre la interfaz completa: iniciar sesion,
 *     abrir el quiz, responder, enviar y ver el resultado.
 *  3. El segundo estudiante verifica que el servidor rechaza retroceder en un
 *     quiz de navegacion solo hacia adelante, incluso llamando la API
 *     directamente (la proteccion no depende del cliente).
 *
 * Requiere la base de datos sembrada (`npm run seed`) y un servidor en
 * ejecucion (`npm run dev`).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

const CREDENCIALES = {
  docente: { correo: 'docente@colegio.edu', contrasena: 'Docente123!' },
  estudiante1: { correo: 'estudiante1@colegio.edu', contrasena: 'Estudiante123!' },
  estudiante2: { correo: 'estudiante2@colegio.edu', contrasena: 'Estudiante123!' },
};

const SUFIJO = Date.now();
const TITULO_LIBRE = `E2E navegacion libre ${SUFIJO}`;
const TITULO_SOLO = `E2E solo hacia adelante ${SUFIJO}`;

let docente: APIRequestContext;
let csrf = '';
let quizLibreId = '';
let quizSoloId = '';

/** Inicia sesion en el navegador y espera el panel. */
async function iniciarSesion(page: Page, credencial: { correo: string; contrasena: string }) {
  await page.goto('/login');
  await page.locator('#email').fill(credencial.correo);
  await page.locator('#contrasena').fill(credencial.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel/);
}

/** Responde la pregunta visible (opcion multiple, seleccion multiple o texto). */
async function responderPreguntaActual(page: Page, texto: string) {
  const respuestaCorta = page.locator('#respuesta-corta');
  if ((await respuestaCorta.count()) > 0) {
    await respuestaCorta.fill(texto);
    return;
  }
  await page.locator('input[type="radio"], input[type="checkbox"]').first().check();
}

type DocenteApi = {
  get: (url: string) => ReturnType<APIRequestContext['get']>;
  post: (url: string, data?: unknown) => ReturnType<APIRequestContext['post']>;
  patch: (url: string, data?: unknown) => ReturnType<APIRequestContext['patch']>;
  put: (url: string, data?: unknown) => ReturnType<APIRequestContext['put']>;
};

/** Cliente API del docente que adjunta el token CSRF en cada peticion. */
function apiDocente(): DocenteApi {
  const cabeceras = { 'x-csrf-token': csrf };
  return {
    get: (url) => docente.get(url),
    post: (url, data) => docente.post(url, { headers: cabeceras, data }),
    patch: (url, data) => docente.patch(url, { headers: cabeceras, data }),
    put: (url, data) => docente.put(url, { headers: cabeceras, data }),
  };
}

/** Crea, configura y publica un quiz con las preguntas indicadas. */
async function crearQuizPublicado(opciones: {
  titulo: string;
  navegacion: 'FREE' | 'FORWARD_ONLY';
  permitirRevision: boolean;
  grupoId: string;
  preguntaIds: string[];
}): Promise<string> {
  const api = apiDocente();

  const creado = await api.post('/api/quices', {
    titulo: opciones.titulo,
    descripcion: 'Quiz creado automaticamente por la prueba de extremo a extremo.',
  });
  expect(creado.ok(), 'crear quiz').toBeTruthy();
  const { datos: creadoDatos } = (await creado.json()) as { datos: { quiz: { id: string } } };
  const id = creadoDatos.quiz.id;

  const configurado = await api.patch(`/api/quices/${id}`, {
    grupoIds: [opciones.grupoId],
    navegacion: opciones.navegacion,
    tiempoTotalSeg: 900,
    tiempoPorPreguntaSeg: null,
    mezclarPreguntas: false,
    mezclarOpciones: false,
    intentosMaximos: 1,
    cantidadPreguntas: null,
    puntosPorDefecto: 1,
    notaAprobacion: 2,
    notaMaxima: 5,
    mostrarResultados: 'SCORE_AND_ANSWERS',
    permitirRevision: opciones.permitirRevision,
    modoSeguro: false,
  });
  expect(configurado.ok(), 'configurar quiz').toBeTruthy();

  const preguntas = await api.put(`/api/quices/${id}/preguntas`, {
    preguntas: opciones.preguntaIds.map((preguntaId) => ({ id: preguntaId })),
  });
  expect(preguntas.ok(), 'asignar preguntas').toBeTruthy();

  const publicado = await api.post(`/api/quices/${id}/publicar`, { confirmoRevision: true });
  expect(publicado.ok(), 'publicar quiz').toBeTruthy();

  return id;
}

test.describe.serial('Flujo del estudiante', () => {
  test.beforeAll(async () => {
    docente = await playwrightRequest.newContext({ baseURL: BASE_URL });

    const sesion = await docente.post('/api/auth/login', { data: CREDENCIALES.docente });
    expect(sesion.ok(), 'login docente').toBeTruthy();

    const estado = await docente.storageState();
    const cookieCsrf = estado.cookies.find((cookie) => cookie.name === 'qc_csrf');
    expect(cookieCsrf, 'cookie CSRF presente').toBeTruthy();
    csrf = cookieCsrf!.value;

    const api = apiDocente();

    const grupos = await api.get('/api/admin/grupos');
    expect(grupos.ok(), 'listar grupos').toBeTruthy();
    const { datos: datosGrupos } = (await grupos.json()) as {
      datos: { grupos: { id: string; nombre: string }[] };
    };
    const grupoDecimo = datosGrupos.grupos.find((grupo) => grupo.nombre === 'Decimo A');
    expect(grupoDecimo, 'grupo Decimo A sembrado').toBeTruthy();

    const preguntas = await api.get('/api/preguntas?estado=APPROVED&limite=20');
    expect(preguntas.ok(), 'listar preguntas').toBeTruthy();
    const { datos: datosPreguntas } = (await preguntas.json()) as {
      datos: { preguntas: { id: string; opciones: { correcta: boolean }[] }[] };
    };
    const conRespuesta = datosPreguntas.preguntas.filter((pregunta) =>
      pregunta.opciones.some((opcion) => opcion.correcta),
    );
    expect(conRespuesta.length, 'preguntas aprobadas con respuesta correcta').toBeGreaterThanOrEqual(3);
    const preguntaIds = conRespuesta.slice(0, 3).map((pregunta) => pregunta.id);

    quizLibreId = await crearQuizPublicado({
      titulo: TITULO_LIBRE,
      navegacion: 'FREE',
      permitirRevision: true,
      grupoId: grupoDecimo!.id,
      preguntaIds,
    });

    quizSoloId = await crearQuizPublicado({
      titulo: TITULO_SOLO,
      navegacion: 'FORWARD_ONLY',
      permitirRevision: false,
      grupoId: grupoDecimo!.id,
      preguntaIds,
    });
  });

  test.afterAll(async () => {
    await docente?.dispose();
  });

  test('recorre el quiz completo: responder, enviar y ver el resultado', async ({ page }) => {
    expect(quizLibreId).toBeTruthy();

    await iniciarSesion(page, CREDENCIALES.estudiante1);

    await page.goto('/estudiante/quices');
    const item = page.locator('li').filter({ hasText: TITULO_LIBRE }).first();
    await expect(item).toBeVisible();
    await item.getByRole('link', { name: 'Comenzar' }).click();

    await expect(page.getByRole('heading', { name: TITULO_LIBRE })).toBeVisible();
    await page.getByRole('button', { name: 'Comenzar quiz' }).click();

    await expect(page).toHaveURL(/\/estudiante\/intentos\/[^/]+$/);

    const total = 3;
    for (let posicion = 1; posicion <= total; posicion += 1) {
      await expect(page.getByText(new RegExp(`Pregunta ${posicion} de ${total}`))).toBeVisible();
      await responderPreguntaActual(page, 'Sol');

      if (posicion < total) {
        await page.getByRole('button', { name: 'Siguiente' }).click();
      } else {
        await page.getByRole('button', { name: 'Revisar y enviar' }).click();
        await page.getByRole('button', { name: 'Confirmar y enviar' }).click();
      }
    }

    await expect(page).toHaveURL(/\/estudiante\/intentos\/[^/]+\/resultado$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Detalle de tus respuestas' })).toBeVisible();
    await expect(page.getByText('Nota', { exact: true })).toBeVisible();
    await expect(page.getByText('Aprobado').or(page.getByText('Reprobado'))).toBeVisible();
  });

  test('el servidor rechaza retroceder en navegacion solo hacia adelante', async ({ page }) => {
    expect(quizSoloId).toBeTruthy();

    await iniciarSesion(page, CREDENCIALES.estudiante2);

    await page.goto(`/estudiante/quices/${quizSoloId}`);
    await page.getByRole('button', { name: 'Comenzar quiz' }).click();

    await expect(page).toHaveURL(/\/estudiante\/intentos\/[^/]+$/);
    const intentoId = page.url().split('/').filter(Boolean).pop()!;
    expect(intentoId).toBeTruthy();

    // En navegacion solo hacia adelante el cliente ni siquiera ofrece "Anterior".
    await expect(page.getByRole('button', { name: 'Anterior' })).toHaveCount(0);

    await expect(page.getByText(/Pregunta 1 de 3/)).toBeVisible();
    await responderPreguntaActual(page, 'Sol');

    // Avanza por la API (exito esperado) y luego intenta retroceder.
    const csrfPagina = (await page.context().cookies()).find((c) => c.name === 'qc_csrf')?.value;
    const cabeceras = { 'x-csrf-token': csrfPagina ?? '' };

    const avanzar = await page.request.post(`/api/intentos/${intentoId}/avanzar`, {
      headers: cabeceras,
      data: {},
    });
    expect(avanzar.status()).toBe(200);

    const retroceder = await page.request.post(`/api/intentos/${intentoId}/retroceder`, {
      headers: cabeceras,
      data: {},
    });
    expect(retroceder.status()).toBe(409);
    const cuerpo = (await retroceder.json()) as { error?: { codigo?: string; mensaje?: string } };
    expect(JSON.stringify(cuerpo)).toContain('RETROCESO_NO_PERMITIDO');

    // La interfaz sigue sin ofrecer "Anterior" tras intentar la operacion.
    await expect(page.getByRole('button', { name: 'Anterior' })).toHaveCount(0);
  });
});
