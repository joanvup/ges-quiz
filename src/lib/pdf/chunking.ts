import { env } from '@/lib/env';

export type Fragmento = {
  indice: number;
  texto: string;
  paginaInicio: number;
  paginaFin: number;
  caracteres: number;
};

const MARCA_PAGINA = /\[\[PAGINA (\d+)\]\]/g;

/**
 * Divide el documento en fragmentos (chunks) con solape, respetando limites de
 * parrafo y oracion, y conservando de que pagina proviene cada fragmento.
 */
export function fragmentarPaginas(
  paginas: string[],
  tamano = env.pdf.chunkSize,
  solape = env.pdf.chunkSolape,
): Fragmento[] {
  const tamanoSeguro = Math.max(tamano, 500);
  const solapeSeguro = Math.min(Math.max(solape, 0), Math.floor(tamanoSeguro / 2));

  // Texto marcado con la pagina de origen.
  const marcado = paginas
    .map((pagina, indice) => `\n[[PAGINA ${indice + 1}]]\n${pagina}`)
    .join('\n')
    .trim();

  if (marcado.length === 0) return [];

  const fragmentos: Fragmento[] = [];
  let inicio = 0;
  let indice = 0;

  while (inicio < marcado.length) {
    let fin = Math.min(inicio + tamanoSeguro, marcado.length);

    if (fin < marcado.length) {
      // Busca un buen punto de corte: doble salto, salto de pagina o punto.
      const ventana = marcado.slice(inicio, fin);
      const minimo = Math.floor(ventana.length * 0.6);
      const candidatos = [
        ventana.lastIndexOf('\n\n', ventana.length),
        ventana.lastIndexOf('. ', ventana.length),
        ventana.lastIndexOf('\n', ventana.length),
      ].filter((posicion) => posicion >= minimo);
      if (candidatos.length > 0) {
        fin = inicio + Math.max(...candidatos) + 1;
      }
    }

    const crudo = marcado.slice(inicio, fin);
    const paginasDetectadas: number[] = [];
    for (const coincidencia of crudo.matchAll(MARCA_PAGINA)) {
      paginasDetectadas.push(Number(coincidencia[1]));
    }

    const texto = crudo.replace(MARCA_PAGINA, '').trim();

    if (texto.length >= 40) {
      const anterior = fragmentos[fragmentos.length - 1];
      fragmentos.push({
        indice,
        texto,
        paginaInicio: paginasDetectadas[0] ?? anterior?.paginaFin ?? 1,
        paginaFin: paginasDetectadas[paginasDetectadas.length - 1] ?? paginasDetectadas[0] ?? anterior?.paginaFin ?? 1,
        caracteres: texto.length,
      });
      indice += 1;
    }

    if (fin >= marcado.length) break;
    inicio = Math.max(fin - solapeSeguro, inicio + 1);
  }

  return fragmentos;
}

/** Resumen legible del contenido de un fragmento (para la interfaz). */
export function vistaPreviaFragmento(fragmento: Fragmento, largo = 160): string {
  const texto = fragmento.texto.replace(/\s+/g, ' ').trim();
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}
