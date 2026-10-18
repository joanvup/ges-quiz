# QuizColegio

Sistema web para colegios con el que un **docente** sube material (PDF u otro documento), genera o
importa preguntas con ayuda de un modelo de lenguaje (LLM), arma y publica **quices**, y consulta
**resultados y reportes**; y con el que un **estudiante** presenta los quices asignados a su grupo,
con corrección siempre en el servidor y un modo seguro de vigilancia opcional.

La interfaz está completamente en español.

---

## Características principales

- **Autenticación propia** (usuario/contraseña con `bcryptjs`) con sesiones en cookie httpOnly y
  protección CSRF de doble envío.
- **Tres roles**: Administrador, Docente y Estudiante.
- **Extracción de texto de PDF** con `pdfjs-dist` y **OCR opcional** (`tesseract.js`) para PDFs sin
  capa de texto.
- **Generación e importación de preguntas con LLM** detrás de una abstracción `LLMProvider`
  (Anthropic, OpenAI o un proveedor `mock` determinista que funciona sin conexión). La salida del
  modelo se valida con **Zod** y se reintenta hasta 2 veces.
- **Procesamiento por fragmentos (chunking)** con barra de progreso y **deduplicación** entre
  fragmentos.
- **Editor de quiz** con revisión previa a la publicación y configuración detallada.
- **Motor de intentos del lado del servidor**: una pregunta por pantalla, temporizador controlado
  por el servidor, autoguardado y reanudación tras pérdida de conexión, y calificación en el
  servidor.
- **Modo seguro** (pantalla completa + detección de infracciones registradas en el servidor) con
  umbral y acción configurable.
- **Reportes** por quiz, grupo y estudiante, análisis por pregunta y **exportación a CSV y Excel**.
- **Importación masiva** de estudiantes y grupos desde una plantilla de Excel/CSV con validación y
  reporte de errores por fila.
- **Respaldo y migración de la base de datos**: descarga un respaldo completo (SQL o JSON) con
  cualquier motor activo y copia todos los datos a PostgreSQL, MySQL o a otro archivo SQLite.
- **Auditoría** de acciones sensibles.

---

## Stack

| Capa          | Tecnología                                                       |
| ------------- | ---------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router) + React 19                               |
| Lenguaje      | TypeScript                                                       |
| Estilos       | Tailwind CSS                                                     |
| Base de datos | Prisma ORM + SQLite (migrable a PostgreSQL o MySQL desde el panel) |
| Validación    | Zod (todos los datos que entran por el servidor)                 |
| Auth          | `bcryptjs` + sesiones propias en cookie                          |
| PDF           | `pdfjs-dist` + OCR opcional con `tesseract.js`                   |
| LLM           | `fetch` nativo contra Anthropic / OpenAI, o proveedor `mock`     |
| Pruebas       | Vitest (unitarias) + Playwright (extremo a extremo)              |

---

## Requisitos previos

- **Node.js 20 LTS** o superior (Next.js 15 requiere Node 18.18+).
- npm.
- (Opcional) Una clave de API de Anthropic u OpenAI si se quiere generar preguntas con un modelo
  real. Sin claves, el sistema funciona con `LLM_PROVIDER=mock`.

---

## Puesta en marcha

```bash
# 1. Instalar dependencias (el postinstall ejecuta `prisma generate`)
npm install

# 2. Crear el archivo de entorno a partir del ejemplo
#    (en Windows PowerShell: Copy-Item .env.example .env)
cp .env.example .env

# 3. Arrancar el servidor de desarrollo (crea las tablas si faltan)
npm run dev
```

Abre <http://localhost:3000>. La raíz redirige a `/panel` (si hay sesión) o a `/login`.

### Elegir qué datos cargar

Hay dos formas de dejar la base de datos lista; elige una:

```bash
# A) Instalación real, SIN datos de prueba: crea solo el administrador.
#    Toma ADMIN_EMAIL y ADMIN_PASSWORD del .env; si no defines la contraseña,
#    genera una aleatoria y la muestra una vez por consola.
npm run db:inicializar

# B) Demostración: además carga usuarios, grupos, un documento y un quiz de ejemplo.
npm run seed
```

Desde el panel (**Administración → Base de datos**) también puedes volver a dejar la base sin
datos de prueba: el botón *Borrar los datos de prueba* vacía los datos de trabajo y conserva el
esquema, la configuración, la auditoría y tu cuenta.

> **La base de datos no se reinicializa sola.** Al compilar o arrancar (`npm run dev` / `build`),
> la aplicación solo aplica a la base los cambios del modelo *si las tablas cambiaron*; si ya
> están al día no toca nada, y nunca carga datos de prueba, nunca recrea la base ni borra
> información. Si un cambio exigiera perder datos, se detiene y avisa. Puedes desactivar ese paso
> con `DATABASE_AUTO_SYNC="false"`.

### Credenciales de ejemplo (creadas por `npm run seed`)

| Rol           | Correo                      | Contraseña       |
| ------------- | --------------------------- | ---------------- |
| Administrador | `admin@colegio.edu`         | `Admin123!`      |
| Docente       | `docente@colegio.edu`       | `Docente123!`    |
| Estudiante 1  | `estudiante1@colegio.edu`   | `Estudiante123!` |
| Estudiante 2  | `estudiante2@colegio.edu`   | `Estudiante123!` |
| Estudiante 3  | `estudiante3@colegio.edu`   | `Estudiante123!` |

Grupos: **Decimo A** (estudiantes 1 y 2) y **Noveno B** (estudiante 3). El seed también crea un
**quiz publicado** de 5 preguntas sobre el sistema solar asignado a Decimo A.

### Scripts disponibles

| Comando               | Descripción                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Servidor de desarrollo en `http://localhost:3000`.                |
| `npm run build`       | Compilación de producción.                                        |
| `npm run start`       | Servidor de producción (tras `build`).                            |
| `npm run typecheck`   | Verificación de tipos con `tsc --noEmit`.                         |
| `npm run db:push`     | Crea/actualiza el esquema de la base de datos.                    |
| `npm run db:preparar` | Sincroniza el motor de `DATABASE_URL` con el esquema, regenera el cliente si cambió y aplica a la base los cambios del modelo (solo si los hay). |
| `npm run db:inicializar` | Inicializa la base de datos **sin datos de prueba**: crea las tablas y el administrador. |
| `npm run db:reset`    | Recrea la base de datos desde cero y vuelve a sembrarla.          |
| `npm run seed`        | Carga los datos de ejemplo.                                       |
| `npm test`            | Pruebas unitarias (Vitest).                                       |
| `npm run test:e2e`    | Pruebas de extremo a extremo (Playwright).                        |
| `npm run db:studio`   | Interfaz de Prisma Studio para inspeccionar la base de datos.     |

---

## Roles y módulos

### Administrador

- Gestión de **usuarios** (crear, editar, activar/desactivar, asignar grupos).
- Gestión de **grupos** y sus miembros.
- **Importación masiva** de estudiantes y grupos desde un archivo (plantilla descargable y
  validación de errores por fila).
- **Configuración global** (nombre de la institución, año escolar, nota mínima/máxima, intentos por
  defecto, modo seguro por defecto, umbral de infracciones, tamaño máximo de archivo).
- **Base de datos**: ver el motor activo, descargar un respaldo completo, migrar los datos a
  PostgreSQL, MySQL o a otro archivo SQLite y **vaciar los datos de prueba** conservando la
  configuración y el acceso.
- **Auditoría** de las acciones registradas.

### Docente

- **Documentos**: subir PDFs, ver el texto extraído y generar o importar preguntas.
- **Bancos de preguntas**: cada documento (PDF) genera su **propio banco** con las preguntas
  extraídas o generadas; hay además un banco **general** para las preguntas creadas a mano.
- **Banco de preguntas global**: ver todas las preguntas, filtrar por banco, editar y aprobar.
- **Quices**: crear, configurar, revisar, publicar, cerrar y **eliminar** (mientras no se haya
  ejecutado).
- **Intentos e infracciones**: línea de tiempo de eventos de modo seguro por quiz.
- **Reportes**: resultados por estudiante/grupo, análisis por pregunta y exportación.

### Estudiante

- Panel **Mis quices** con los quices disponibles, próximos, en progreso, completados y cerrados.
- **Presentar** un quiz (una pregunta por pantalla) y **consultar el resultado** según la
  visibilidad configurada por el docente.

---

## Flujo de creación de un quiz

1. El docente **sube un PDF** (o varios). El servidor extrae el texto por página; si una página no
   tiene capa de texto y el OCR está activado, se aplica OCR.
2. El texto se **fragmenta** (chunking) respetando límites de tamaño y solapamiento.
3. Para cada fragmento, el docente puede **generar** preguntas nuevas a partir del material o
   **importar** preguntas de un examen/banco existente. El progreso se muestra con una barra.
4. Las preguntas generadas/importadas se **deduplican** entre fragmentos y se guardan en el banco
   como pendientes de revisión.
5. El docente **revisa** cada pregunta (enunciado, opciones, respuesta correcta, dificultad).
6. Crea un **quiz**, ajusta su configuración, asigna **grupos** y elige las preguntas.
7. **Publica** el quiz tras confirmar explícitamente la revisión. Al publicar, las preguntas
   incluidas quedan aprobadas.

## Bancos de preguntas por documento

Cada **documento (PDF)** funciona como un **banco de preguntas independiente**: las preguntas que se
**generan** o **importan** desde ese documento quedan asociadas a él (`Question.documentId`), y las
que se crean **manualmente** sin documento van al **banco general**.

- En la ficha del documento, el apartado *"Banco de preguntas de este documento"* muestra solo sus
  preguntas para revisarlas y aprobarlas.
- En el **banco global** (`/docentes/preguntas`) hay un filtro por **banco** (documento).
- En el **editor del quiz** (pestaña *Preguntas* → *+ Agregar preguntas*) se elige el **banco** y
  aparece **"Cargar todo el banco (N)"**, que agrega de una sola vez todas las preguntas de ese
  banco al quiz. También se pueden agregar preguntas sueltas o cargar las visibles tras filtrar por
  texto y tipo.
- Se puede **eliminar un banco completo**: en la ficha del documento o eligiendo el banco en el
  banco global aparece **"Eliminar banco (N)"**, que borra de una vez todas las preguntas de ese
  banco (el documento y su archivo **no** se tocan). Las preguntas que ya fueron respondidas en algún
  intento no se borran —se conservan los resultados— y en su lugar se **archivan** (se retiran de los
  quices y vuelven a borrador).

No hace falta un modelo de datos nuevo: el banco es el propio documento al que pertenece la
pregunta.

## Eliminar un quiz

Un quiz se puede **eliminar** mientras **nunca se haya ejecutado** (sin intentos de estudiantes),
sin importar su estado (borrador o publicado). El botón **Eliminar** está en la lista de quices
(`/docentes/quices`) y en la cabecera del editor; si ya tiene intentos queda deshabilitado y hay que
**cerrarlo** en su lugar. El servidor aplica la misma regla: si el quiz ya fue presentado, responde
`409 CONFLICTO` y no lo borra.

---

## Importar estudiantes y grupos

En **Administración → Importar datos** (`/admin/importar`) el administrador puede cargar estudiantes
y grupos de una sola vez desde un archivo, en lugar de crearlos uno por uno.

1. **Descarga la plantilla** en Excel (`.xls`, SpreadsheetML 2003) o CSV. Trae las columnas y filas
   de ejemplo, además de una hoja de instrucciones en el caso de Excel.
2. **Sube el archivo**. El sistema lo **valida** sin tocar la base y muestra una **vista previa** con
   el estado de cada fila (`Listo`, `Error`, `Duplicado`) y el detalle de los problemas.
3. Si hay filas válidas, pulsa **"Importar N filas válidas"** y se crean los estudiantes, los grupos
   y sus membresías en una sola transacción. Luego se puede volver a validar el mismo archivo: las
   filas ya importadas aparecerán como duplicadas.

**Columnas de la plantilla**

| Columna      | Descripción                                                                        |
| ------------ | ---------------------------------------------------------------------------------- |
| `tipo`       | `ESTUDIANTE` o `GRUPO`. Obligatorio.                                               |
| `nombre`     | Nombre completo del estudiante, o nombre del grupo.                                |
| `correo`     | Correo del estudiante (obligatorio para `ESTUDIANTE`); no puede repetirse ni existir. |
| `contrasena` | Opcional (mínimo 8 caracteres). Si va vacía se usa la **contraseña por defecto** configurada. |
| `grupo`      | Grupo del estudiante (solo `ESTUDIANTE`). Si no existe, se crea.                    |
| `grado`      | Grado o nivel (para grupos o al crear uno nuevo).                                   |
| `anio`       | Año escolar del grupo. Admite un año (`2026`) o un ciclo (`2026-2027`). Si va vacío se usa el año activo. |

**Comportamiento**

- La validación comprueba: tipo reconocido, nombre, correo con formato válido, contraseña válida,
  año escolar válido (un año o un ciclo de dos años consecutivos), correos repetidos en el archivo o
  ya existentes, y grupos repetidos.
- Los **grupos se crean antes** que los estudiantes, para que puedan referenciarlos. Un grupo
  citado por un estudiante y que no exista se da de alta automáticamente.
- La **contraseña por defecto** para estudiantes importados sin contraseña se define en
  *Configuración global → seguridad* (`seguridad.contrasenaPorDefecto`).
- **Formatos admitidos**: Excel XML 2003 (`.xls`), XML (`.xml`) y CSV (se detecta el separador `;`
  o `,`, se leen comillas y se corrigen archivos guardados en ANSI/Windows-1252). Los `.xlsx`
  binarios **no** se admiten: se debe guardar como *Hoja de cálculo XML 2003* o CSV, o usar la
  plantilla descargada. Límite de 2 MB.
- La importación queda registrada en la **auditoría** (`DATOS_IMPORTADOS`).

---

## Configuración por quiz

- Título y descripción.
- Grupos asignados.
- Ventana de disponibilidad (desde / hasta).
- **Navegación**: libre (se puede retroceder) o **solo hacia adelante**.
- **Tiempo**: total y/o por pregunta (ambos en segundos; pueden combinarse).
- **Mezclar** el orden de las preguntas y/o de las opciones.
- **Intentos máximos** por estudiante.
- **Subconjunto de preguntas** por intento (`cantidadPreguntas`).
- **Puntaje**: puntos por defecto, nota mínima de aprobación y nota máxima.
- **Visibilidad de resultados**: no mostrar, solo la nota, o nota y respuestas correctas.
- **Revisión final** antes de enviar (opcional).
- **Modo seguro**: activado/desactivado, umbral de infracciones y acción al alcanzarlo
  (anular el intento, enviarlo automáticamente o solo registrar), y bloqueo en navegadores sin
  soporte de pantalla completa.

---

## Flujo del estudiante

1. Inicia sesión y ve **Mis quices**.
2. Abre la **ficha** del quiz: reglas, tiempo, intentos, navegación y visibilidad de resultados.
3. Pulsa **Comenzar** (o **Reanudar** si quedó un intento en progreso).
4. Responde **una pregunta por pantalla**; la respuesta se **autoguarda**. Si se corta la conexión
   o se cierra el navegador, el intento se puede reanudar donde quedó (el temporizador sigue
   corriendo).
5. Al final puede **revisar** y **confirmar el envío**.
6. Ve el **resultado** según lo que el docente haya decidido mostrar.

---

## Modo seguro: alcance y limitaciones honestas

Lo que **sí** hace (y queda registrado en el servidor como `ProctorEvent` en tiempo real):

- Exige **pantalla completa** antes de empezar y durante el intento (en navegadores sin la
  **API Fullscreen** el intento se bloquea si el quiz lo exige).
- Detecta y registra: salidas de pantalla completa, cambio de pestaña/visibilidad, pérdida de
  foco de la ventana, menú contextual, copiar/cortar/pegar, impresión, selección de texto y atajos
  de teclado restringidos.
- **Pausa** la interfaz con un aviso cuando se sale de pantalla completa o se oculta la pestaña, y
  exige volver a entrar para continuar.
- Desactiva la selección de texto y el menú contextual durante el intento.
- El docente ve la **línea de tiempo de infracciones** por intento.

Lo que **no** puede hacer (limitación inherente del navegador, no del sistema):

- **No puede impedir** que el estudiante cambie de pestaña, abra otra aplicación, use otro
  dispositivo o haga **capturas de pantalla**. El navegador no expone ningún mecanismo que lo
  permita. El sistema solo puede **detectar y registrar** estos eventos, no bloquearlos.
- Un estudiante con conocimientos técnicos puede modificar el cliente (JavaScript) o cortar la
  red. Por eso las decisiones sensibles (temporizador, orden, respuestas correctas y calificación)
  se toman **siempre en el servidor**.

En otras palabras: el modo seguro **aumenta la fricción y deja evidencia**, pero **no garantiza**
que no haya ayudas externas.

---

## Seguridad del lado del servidor

Estas garantías no dependen del cliente y se aplican en los route handlers:

- Una **pregunta por pantalla**: el servidor nunca envía el banco completo ni la posición de la
  pregunta actual más allá de lo necesario.
- El servidor **nunca** envía las **respuestas correctas** de las preguntas mientras el intento está
  en progreso.
- En navegación **solo hacia adelante** el servidor **rechaza** (`409 RETROCESO_NO_PERMITIDO`)
  cualquier intento de retroceder, aunque se llame la API directamente.
- El **temporizador** es del servidor: al agotarse el tiempo total o el de la pregunta, el intento se
  auto-avanza o se auto-envía.
- Los estados del intento (`en_progreso`, `enviado`, `anulado`) **no son reabribles**.
- **Una sesión activa por quiz y estudiante**: iniciar de nuevo devuelve el mismo intento en
  progreso en lugar de duplicarlo (evita el doble intento simultáneo).
- **Limitación de tasa** en el inicio de sesión y en los endpoints de respuesta/intento.
- **Protección CSRF** de doble envío (cookie legible `qc_csrf` + cabecera `x-csrf-token`).
- **Cabeceras de seguridad** (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-*`, HSTS en producción) aplicadas por el middleware.
- La **calificación es siempre del servidor**, comparando la selección normalizada con las opciones
  correctas (y texto normalizado en respuestas cortas).
- La **clave de API del LLM nunca llega al cliente**: el proveedor se invoca solo desde el servidor.

---

## Reportes y exportación

En `/reportes` (docente/administrador) se listan los quices con intentos. La ficha de un quiz
muestra:

- **Resumen**: participantes, enviados, aprobados, promedio, mejor/peor nota y tiempo medio.
- **Comparación por grupo**.
- **Tabla por estudiante**: nota, puntos, tiempo, intentos e infracciones.
- **Análisis por pregunta**: porcentaje de acierto y distribución de opciones.

La exportación se hace con `GET /api/reportes/quices/[id]/exportar?formato=csv|excel&tabla=...`:

- **CSV**: separador `;` y BOM UTF-8 (se abre bien en Excel en español).
- **Excel**: SpreadsheetML 2003 (`.xls`, `application/vnd.ms-excel`) con varias hojas, sin
  dependencias adicionales.

Las exportaciones quedan registradas en la auditoría.

---

## Pruebas

```bash
# Pruebas unitarias (reglas de calificación, navegación e importación)
npm test

# Pruebas de extremo a extremo del flujo del estudiante
npm run test:e2e
```

- **Unitarias (Vitest)** — `tests/unit/`. Cubren las reglas puras del motor
  (`src/lib/intentos/reglas.ts`): normalización de texto, calificación por tipo de pregunta y la
  decisión de si se puede retroceder. También cubren el **lector de la plantilla de importación**
  (CSV y XML Spreadsheet 2003) y la **validación de estudiantes y grupos**
  (`src/lib/importacion/`), y la **capa de base de datos**: detección del motor a partir de la
  cadena de conexión, construcción y lectura de cadenas, generación de literales SQL por motor
  (comillas, booleanos, fechas y escapado de textos), `INSERT`s, coerción de tipos de un respaldo,
  y el reemplazo del `provider` en el esquema de Prisma. Además cubren las reglas de la
  **inicialización sin datos de prueba** (qué tablas se vacían, en qué orden y qué se conserva) y la
  **cuenta de administrador inicial** (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, contraseña generada).
- **Extremo a extremo (Playwright)** — `tests/e2e/`. Crean y publican quices por API como docente,
  recorren el flujo completo del estudiante en la interfaz (iniciar sesión, responder, enviar y ver
  el resultado), verifican que el **servidor rechaza retroceder** en navegación solo hacia
  adelante aunque se llame la API directamente, comprueban que el docente puede **elegir el banco
  de un documento y cargar todas sus preguntas** de una vez en el editor del quiz, validan el
  **borrado de un banco completo** y el **de un quiz que nunca se ha ejecutado** (y que el servidor
  impide borrar uno que ya fue presentado), prueban la **importación de estudiantes y grupos**
  (descarga de la plantilla, validación con errores por fila, alta de estudiantes/grupos y rechazo
  de duplicados y de `.xlsx`), y validan la **capa de base de datos**: estado del motor activo,
  descarga de respaldos SQL y JSON, restauración de un respaldo que revierte un cambio, prueba de
  conexión (válida e inválida), y **migración completa de los datos a otro archivo SQLite** leído
  después con Prisma para comprobar que llegó todo. También comprueban el **borrado de los datos de
  prueba** desde la API (la sesión del administrador sigue viva, los datos de trabajo quedan a cero y
  la configuración y la auditoría se conservan) y que la base vuelve a su estado al restaurar la
  copia previa, además de que la interfaz exige confirmación antes de borrar.

Antes de ejecutar las pruebas de extremo a extremo hay que descargar el navegador una vez:

```bash
npx playwright install chromium
```

Las pruebas E2E requieren la base de datos sembrada (`npm run seed`) y un servidor en
`http://127.0.0.1:3000` (el `webServer` de Playwright lo levanta o reutiliza uno ya en ejecución).
Crean quices nuevos en cada corrida; para dejar la base de datos limpia, ejecuta `npm run seed`.

---

## Variables de entorno

Copia `.env.example` a `.env`. Las principales:

| Variable                        | Descripción                                                             | Valor por defecto              |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| `DATABASE_URL`                  | Cadena de conexión de Prisma.                                           | `file:./dev.db`                |
| `DATABASE_AUTO_SYNC`            | Aplica los cambios del modelo a la base al arrancar/compilar (solo si hay). | `true`                      |
| `ADMIN_EMAIL`                   | Correo del administrador que crea `db:inicializar`.                     | `admin@colegio.edu`           |
| `ADMIN_PASSWORD`                | Contraseña de ese administrador (si falta, se genera una y se muestra). | —                             |
| `ADMIN_NAME`                    | Nombre de ese administrador.                                            | `Administrador`               |
| `NODE_ENV`                      | Entorno.                                                                | `development`                  |
| `APP_URL`                       | URL pública de la app.                                                  | `http://localhost:3000`        |
| `APP_SECRET`                    | Secreto de la aplicación (cámbialo en producción).                      | —                              |
| `BCRYPT_ROUNDS`                 | Coste de bcrypt.                                                        | `10`                           |
| `SESSION_TTL_HOURS`             | Duración de la sesión en horas.                                         | `12`                           |
| `MAX_UPLOAD_MB`                 | Tamaño máximo por PDF en MB.                                            | `15`                           |
| `UPLOAD_DIR`                    | Carpeta de PDFs subidos.                                                | `./storage/uploads`            |
| `LLM_PROVIDER`                  | `anthropic`, `openai` o `mock`.                                         | `mock`                         |
| `ANTHROPIC_API_KEY`             | Clave de Anthropic.                                                     | —                              |
| `ANTHROPIC_MODEL`               | Modelo de Anthropic.                                                    | `claude-3-5-sonnet-latest`     |
| `OPENAI_API_KEY`                | Clave de OpenAI.                                                        | —                              |
| `OPENAI_MODEL`                  | Modelo de OpenAI.                                                       | `gpt-4o-mini`                  |
| `OPENAI_BASE_URL`               | Base URL de OpenAI (compatible con otros proveedores).                  | `https://api.openai.com/v1`    |
| `LLM_MAX_OUTPUT_TOKENS`         | Tokens máximos de salida del LLM.                                       | `8000`                         |
| `LLM_TIMEOUT_MS`                | Tiempo máximo de espera del LLM.                                        | `120000`                       |
| `OCR_ENABLED`                   | Activa OCR cuando el PDF no tiene texto.                                | `false`                        |
| `OCR_LANGUAGE`                  | Idiomas del OCR.                                                        | `spa+eng`                      |
| `OCR_MAX_PAGES`                 | Páginas máximas con OCR (es lento).                                     | `10`                           |
| `CHUNK_SIZE_CHARS`              | Tamaño de fragmento.                                                    | `8000`                         |
| `CHUNK_OVERLAP_CHARS`           | Solapamiento entre fragmentos.                                          | `800`                          |
| `LOGIN_RATE_LIMIT_MAX`          | Intentos de login por ventana.                                          | `10`                           |
| `LOGIN_RATE_LIMIT_WINDOW_SEC`   | Ventana del límite de login (segundos).                                 | `300`                          |
| `ANSWER_RATE_LIMIT_MAX`         | Peticiones de respuesta por ventana.                                    | `120`                          |
| `ANSWER_RATE_LIMIT_WINDOW_SEC`  | Ventana del límite de respuestas (segundos).                            | `60`                           |
| `REPORTS_EXPORT_MAX_ROWS`       | Filas máximas por exportación.                                          | `5000`                         |

---

## Estructura del proyecto

```
prisma/
  schema.prisma            # Modelo de datos (portable entre SQLite, PostgreSQL y MySQL)
  seed.ts                  # Datos de ejemplo
scripts/
  preparar-base.ts         # Sincroniza el motor de DATABASE_URL con el esquema y Prisma
  inicializar-base.ts      # Base de datos lista sin datos de prueba (esquema + administrador)
  comun-base.ts            # Utilidades compartidas por los scripts de base de datos
src/
  app/
    login/                 # Inicio de sesión
    (privado)/             # Rutas protegidas (panel, admin, docentes, estudiante, reportes)
    api/                   # Route handlers (auth, documentos, preguntas, quices, intentos, reportes...)
  components/ui.tsx        # Componentes de interfaz reutilizables
  lib/
    auth/                  # Sesiones, contraseñas y guardas
    basedatos/             # Motores, conexiones, volcado, respaldo y migración
    dominio/               # Constantes y validaciones de dominio
    esquemas/              # Esquemas Zod por recurso
    importacion/           # Plantilla, lectura y validación de importación de estudiantes/grupos
    pdf/                   # Extracción, chunking y generador de PDF simple
    llm/                   # Abstracción LLMProvider (anthropic, openai, mock)
    preguntas/             # Servicio y deduplicación del banco de preguntas
    quices/                # Servicio de quices y reglas de publicación
    intentos/
      reglas.ts            # Reglas puras (calificación y navegación) — probadas con Vitest
      servicio.ts          # Motor de intentos, proctoring y consultas
    reportes/              # Cálculo de reportes y exportación CSV/Excel
    middleware.ts          # Cabeceras de seguridad (en src/)
tests/
  unit/                    # Vitest
  e2e/                     # Playwright
storage/uploads/           # PDFs subidos (creado por el seed)
storage/backups/           # Copias de seguridad automáticas antes de restaurar
```

---

## Modelo de datos

`User`, `Session`, `Group`, `GroupMembership`, `Document`, `Question`, `QuestionOption`, `Quiz`,
`QuizQuestion`, `QuizAssignment`, `Attempt`, `Answer`, `ProctorEvent`, `AuditLog` y `Setting`.

Los campos de estado y rol (y los datos JSON) se guardan como `String` y se validan con Zod en la
capa de aplicación, para que el mismo esquema funcione en SQLite y PostgreSQL.

El **año escolar** de los grupos (`Group.year`) también es texto: admite un año suelto (`2026`) o un
ciclo lectivo (`2026-2027`), y se normaliza con `src/lib/dominio/anio.ts`.

---

## Base de datos: motores, respaldo y migración

El motor activo se deduce siempre de `DATABASE_URL`:

| Motor           | Ejemplo de `DATABASE_URL`                                             |
| --------------- | -------------------------------------------------------------------- |
| SQLite          | `file:./dev.db`                                                      |
| PostgreSQL      | `postgresql://usuario:clave@localhost:5432/quizcolegio?schema=public` |
| MySQL / MariaDB | `mysql://usuario:clave@localhost:3306/quizcolegio`                    |

Prisma exige que el `provider` de `prisma/schema.prisma` sea un literal, así que
`npm run db:preparar` compara el motor de `DATABASE_URL` con el del esquema: si no coinciden, lo
actualiza y **regenera el cliente de Prisma**. Se ejecuta solo antes de `dev`, `build` y `seed`.

En la misma pasada, y **solo si las tablas cambiaron** (`prisma migrate diff` detecta diferencias),
aplica los cambios del modelo a la base con `prisma db push`. Si el esquema ya está al día no hace
nada; si la base de datos todavía no existe, la crea vacía. Nunca carga datos de prueba, nunca
recrea la base y nunca borra información: si un cambio exigiera perder datos, se detiene y avisa en
lugar de aplicarlo. Se puede desactivar con `DATABASE_AUTO_SYNC="false"` (útil en un servidor de
compilación que no deba tocar la base de datos).

### Inicializar sin datos de prueba

`npm run db:inicializar` deja la base lista para una instalación real:

- Crea/actualiza las tablas y **no** carga estudiantes, grupos, documentos ni quices de ejemplo.
- Crea (o promueve a) la cuenta de administrador con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`; si
  no defines la contraseña, genera una aleatoria y la muestra una vez por consola.
- No borra nada: se puede volver a ejecutar sin riesgo (solo cambia la contraseña si defines
  `ADMIN_PASSWORD`).

Desde el panel, **Administración → Base de datos → *Borrar los datos de prueba*** hace el equivalente
sobre la base en marcha: vacía los datos de trabajo (usuarios, grupos, documentos, preguntas, quices,
intentos, respuestas y eventos de modo seguro) y conserva el esquema, la configuración
(`Setting`), la auditoría (`AuditLog`) y **tu cuenta de administrador con la sesión abierta**. Antes
de borrar guarda una copia completa en `storage/backups/`, así que siempre se puede volver atrás con
*Restaurar respaldo*.

### Respaldo

En **Administración → Base de datos** (`/admin/base-datos`) hay dos descargas que funcionan con
cualquier motor (SQLite, PostgreSQL o MySQL):

- **`.sql`** — incluye la estructura (`CREATE TABLE` e índices) y los datos. Se restaura con
  `psql`, `mysql` o `sqlite3` sobre una base **vacía** del mismo motor.
- **`.json`** — volcado con los tipos ya normalizados (fechas en ISO 8601). Es el formato que se
  puede **volver a cargar desde la interfaz** en *Restaurar respaldo*: reemplaza todos los datos y
  guarda antes una **copia automática** en `storage/backups/`.

### Migrar a PostgreSQL o MySQL

El asistente copia todos los datos de la base activa a otra base:

1. Se elige el motor destino y se rellenan los datos de conexión (o la ruta del archivo, si el
   destino es SQLite). En SQLite la ruta debe ser **absoluta** (por ejemplo
   `C:/datos/quizcolegio.db`), porque Prisma resuelve las rutas relativas respecto al esquema
   temporal con el que crea la estructura.
2. **Probar conexión** comprueba que la base existe y acepta conexiones; no crea ni modifica nada.
3. **Migrar datos** crea las tablas en el destino (`prisma db push`) y copia los datos tabla por
   tabla, comprobando al final que el esquema del destino coincide con el modelo.
4. Si se marca *"dejar el sistema apuntando a la nueva base"*, se actualizan `DATABASE_URL` (`.env`)
   y el `provider` del esquema; el cambio se aplica al **reiniciar** el servidor.

Si el destino ya tuviera contenido, la migración se detiene **sin borrar nada**: la base original no
se modifica en ningún caso.

> La migración invoca el CLI de Prisma de `node_modules`, así que debe ejecutarse en el mismo
> servidor donde corre la aplicación. Los PDFs subidos viven en `storage/` y **no** forman parte de
> la base de datos: cópialos aparte si cambias de servidor.

### Notas de portabilidad

- Los campos de estado/rol y los datos JSON son `String` (validados con Zod) para que el mismo
  esquema funcione en los tres motores.
- En PostgreSQL se pueden convertir a **enums nativos** y a `Json` sin cambiar las columnas.

---

## Limitaciones conocidas y mejoras futuras

- **Modo seguro**: ver la sección anterior. El navegador no puede impedir el cambio de pestaña ni
  las capturas de pantalla; solo detectarlas y registrarlas.
- **Limitación de tasa en memoria**: el limitador es por proceso (adecuado para un único servidor
  Node). En un despliegue con varias instancias conviene respaldarlo con Redis.
- **CSP con `'unsafe-inline'`**: Next.js inyecta scripts inline en el HTML; sin *nonces* se
  requiere `'unsafe-inline'` para scripts. Se puede endurecer añadiendo nonces en el middleware.
- **OCR**: solo se aplica a las primeras páginas configuradas (`OCR_MAX_PAGES`) porque es lento y
  pesado. Requiere las dependencias opcionales `@napi-rs/canvas` y `tesseract.js`.
- **Almacenamiento de PDFs en disco local**: en producción conviene un almacenamiento de objetos.
- **Migración de base de datos**: usa el CLI de Prisma del propio servidor y copia los datos en
  lotes de 250 filas; para bases muy grandes (cientos de miles de filas) conviene usar
  `pg_dump`/`mysqldump` y las herramientas nativas del motor.
- **Destinos PostgreSQL y MySQL**: los tipos, el DDL y el dialecto de los `INSERT` los genera
  Prisma para cada motor (comillas, booleanos y fechas se adaptan), pero conviene **probar la
  migración contra un servidor de pruebas**. La suite automática verifica el flujo completo con un
  destino SQLite, que usa el mismo código.
- **Sincronización automática del esquema**: al arrancar o compilar se aplican los cambios del
  modelo con `prisma db push`, que **no borra datos**. Si un cambio exigiera perder información
  (quitar una columna o una tabla), se detiene y avisa: ese cambio hay que aplicarlo a mano. Para
  desplegar sin que la compilación toque la base de datos, usa `DATABASE_AUTO_SYNC="false"`.
- **Borrar los datos de prueba** es irreversible desde la interfaz: la única vuelta atrás es
  restaurar la copia automática (`pre-inicializacion-*.json`) que se guarda antes de borrar.
