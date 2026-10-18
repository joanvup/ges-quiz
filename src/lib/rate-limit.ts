/**
 * Rate limiting en memoria (ventana deslizante por cubos).
 *
 * Limitacion honesta: es un limiter por proceso. Con varias instancias de
 * Next.js o serverless cada instancia tiene su propio contador. Para
 * produccion en varias instancias se debe usar Redis/Upstash. Se documenta
 * en el README.
 */

type Cubo = { conteo: number; expira: number };

const cubos = new Map<string, Cubo>();
let ultimaLimpieza = Date.now();

function limpiar(): void {
  const ahora = Date.now();
  if (ahora - ultimaLimpieza < 60_000) return;
  ultimaLimpieza = ahora;
  for (const [clave, cubo] of cubos) {
    if (cubo.expira <= ahora) cubos.delete(clave);
  }
}

export type ResultadoLimite = {
  permitido: boolean;
  restantes: number;
  reintentarEn: number;
};

export function limitar(clave: string, max: number, ventanaSeg: number): ResultadoLimite {
  limpiar();
  const ahora = Date.now();
  const actual = cubos.get(clave);

  if (!actual || actual.expira <= ahora) {
    cubos.set(clave, { conteo: 1, expira: ahora + ventanaSeg * 1000 });
    return { permitido: true, restantes: Math.max(max - 1, 0), reintentarEn: 0 };
  }

  actual.conteo += 1;
  if (actual.conteo > max) {
    return {
      permitido: false,
      restantes: 0,
      reintentarEn: Math.ceil((actual.expira - ahora) / 1000),
    };
  }
  return { permitido: true, restantes: max - actual.conteo, reintentarEn: 0 };
}

/** Reinicia un contador (por ejemplo tras un login correcto). */
export function reiniciarLimite(clave: string): void {
  cubos.delete(clave);
}

/** Solo para pruebas. */
export function _reiniciarTodo(): void {
  cubos.clear();
}
