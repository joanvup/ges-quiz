import Link from 'next/link';
import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/* ------------------------------------------------------------------ *
 * Kit de interfaz reutilizable (solo presentacional, sin hooks)
 * ------------------------------------------------------------------ */

export function cx(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(' ');
}

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma' | 'exito';

const ESTILOS_BOTON: Record<VarianteBoton, string> = {
  primario:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secundario:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 disabled:text-slate-400',
  peligro: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
  fantasma: 'bg-transparent text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
  exito: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
};

/**
 * Alturas pensadas para el dedo: en movil conviene apuntar a 44 px.
 * Las `min-h-*` mantienen el area tactil aunque la etiqueta sea corta.
 */
const TAMANOS_BOTON = {
  sm: 'min-h-[38px] px-3 py-2 text-sm',
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[48px] px-5 py-3 text-base',
};

export function Boton({
  variante = 'primario',
  tamano = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
  tamano?: keyof typeof TAMANOS_BOTON;
}) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed',
        ESTILOS_BOTON[variante],
        TAMANOS_BOTON[tamano],
        className,
      )}
    />
  );
}

export function EnlaceBoton({
  href,
  variante = 'primario',
  tamano = 'md',
  className,
  descarga,
  children,
}: {
  href: string;
  variante?: VarianteBoton;
  tamano?: keyof typeof TAMANOS_BOTON;
  className?: string;
  descarga?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      download={descarga ? '' : undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        ESTILOS_BOTON[variante],
        TAMANOS_BOTON[tamano],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Tarjeta({
  children,
  className,
  titulo,
  descripcion,
  acciones,
}: {
  children?: ReactNode;
  className?: string;
  titulo?: ReactNode;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {titulo && <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
          </div>
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </header>
      )}
      {children && <div className="px-5 py-4">{children}</div>}
    </section>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido,
  htmlFor,
  children,
}: {
  etiqueta?: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {etiqueta && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {etiqueta}
          {requerido && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {ayuda && !error && <p className="text-xs text-slate-500">{ayuda}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * `text-base` en movil evita que iOS amplie la pantalla al enfocar un
 * campo (Safari hace zoom automatico si la fuente es menor de 16 px).
 */
const ESTILO_ENTRADA =
  'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-100 sm:text-sm';

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(ESTILO_ENTRADA, className)} />;
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(ESTILO_ENTRADA, 'min-h-[90px]', className)} />;
}

export function Selector({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(ESTILO_ENTRADA, className)}>
      {children}
    </select>
  );
}

export function Casilla({
  etiqueta,
  descripcion,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; descripcion?: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3.5 hover:bg-slate-50">
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-xs text-slate-500">{descripcion}</span>}
      </span>
    </label>
  );
}

type TonoEtiqueta = 'gris' | 'azul' | 'verde' | 'ambar' | 'rojo' | 'violeta';

const TONOS: Record<TonoEtiqueta, string> = {
  gris: 'bg-slate-100 text-slate-700 border-slate-200',
  azul: 'bg-brand-50 text-brand-700 border-brand-200',
  verde: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ambar: 'bg-amber-50 text-amber-800 border-amber-200',
  rojo: 'bg-red-50 text-red-700 border-red-200',
  violeta: 'bg-violet-50 text-violet-700 border-violet-200',
};

export function Insignia({ children, tono = 'gris' }: { children: ReactNode; tono?: TonoEtiqueta }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TONOS[tono],
      )}
    >
      {children}
    </span>
  );
}

export function Alerta({
  tipo = 'info',
  children,
  titulo,
}: {
  tipo?: 'info' | 'exito' | 'error' | 'aviso';
  children: ReactNode;
  titulo?: string;
}) {
  const estilos = {
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    exito: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    aviso: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', estilos)}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? 'mt-1' : ''}>{children}</div>
    </div>
  );
}

export function Vacio({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm text-slate-600">{mensaje}</p>
      {accion}
    </div>
  );
}

export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {texto}
    </div>
  );
}

/**
 * Tabla de datos.
 *
 * En pantallas pequenas (< 768px) cada fila se convierte en una tarjeta:
 * las cabeceras se muestran como etiquetas junto a cada valor (ver
 * `globals.css`). Para no repetir los textos en cada `<td>`, aqui se copian
 * las `cabeceras` a un atributo `data-etiqueta` de cada celda. Se puede
 * ajustar asi:
 *   - `principal`: indice de la columna que titula la tarjeta (por defecto 0).
 *   - `data-etiqueta="..."` en un `<td>`: fija una etiqueta propia.
 *   - `data-sin-etiqueta` en un `<td>`: oculta la etiqueta de esa celda.
 */
export function Tabla({
  cabeceras,
  children,
  principal = 0,
}: {
  cabeceras: string[];
  children: ReactNode;
  /** Indice de la columna que encabeza la tarjeta en pantallas pequenas. */
  principal?: number;
}) {
  const filas = Children.toArray(children).map((fila): ReactNode => {
    if (!isValidElement(fila)) return fila;
    const propsFila = fila.props as { children?: ReactNode };
    let indice = -1;

    const celdas = Children.toArray(propsFila.children).map((celda): ReactNode => {
      if (!isValidElement(celda)) return celda;
      indice += 1;
      const posicion = indice;
      const propsCelda = celda.props as {
        'data-etiqueta'?: string;
        'data-sin-etiqueta'?: boolean;
        className?: string;
      };
      const etiqueta = cabeceras[posicion];
      const esPrincipal = posicion === principal;
      const esAcciones = !esPrincipal && (etiqueta ?? '').toLowerCase().startsWith('accion');
      const atributos: Record<string, string | undefined> = {};

      if (
        !esPrincipal &&
        !esAcciones &&
        etiqueta &&
        propsCelda['data-etiqueta'] === undefined &&
        !propsCelda['data-sin-etiqueta']
      ) {
        atributos['data-etiqueta'] = etiqueta;
      }

      if (esPrincipal || esAcciones) {
        atributos.className = cx(
          propsCelda.className,
          esPrincipal ? 'tabla-principal' : 'tabla-acciones',
        );
      }

      return cloneElement(celda, atributos);
    });

    return cloneElement(fila, {}, celdas);
  });

  return (
    <div className="overflow-x-auto">
      <table className="tabla-adaptable w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {cabeceras.map((cabecera) => (
              <th key={cabecera} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{filas}</tbody>
      </table>
    </div>
  );
}

export function Estadistica({ etiqueta, valor, tono = 'azul' }: { etiqueta: string; valor: ReactNode; tono?: TonoEtiqueta }) {
  const fondos: Record<TonoEtiqueta, string> = {
    gris: 'bg-slate-50',
    azul: 'bg-brand-50',
    verde: 'bg-emerald-50',
    ambar: 'bg-amber-50',
    rojo: 'bg-red-50',
    violeta: 'bg-violet-50',
  };
  return (
    <div className={cx('rounded-xl border border-slate-200 px-4 py-3', fondos[tono])}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}
