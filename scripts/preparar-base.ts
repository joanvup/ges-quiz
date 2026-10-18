/**
 * Prepara la base de datos antes de arrancar o compilar la aplicacion.
 *
 * Se ejecuta automaticamente antes de `npm run dev`, `npm run build` y
 * `npm run seed` (ganchos predev/prebuild/preseed) y tambien a mano con
 * `npm run db:preparar`.
 *
 * Que hace:
 *   1. Sincroniza el `provider` de `prisma/schema.prisma` con el motor de
 *      `DATABASE_URL` y regenera el cliente de Prisma solo si cambio.
 *   2. Aplica a la base de datos los cambios del modelo, y SOLO si los hay:
 *      si las tablas ya estan al dia no toca nada.
 *
 * Que NO hace: nunca carga datos de prueba, nunca recrea la base de datos y
 * nunca borra informacion (si un cambio exigiera perdida de datos, se detiene
 * y avisa). Se puede desactivar el paso 2 con `DATABASE_AUTO_SYNC=false`.
 *
 * Para inicializar una instalacion nueva sin datos de prueba usa
 * `npm run db:inicializar`.
 */
import 'dotenv/config';
import {
  PREFIJO,
  asegurarEsquemaDeLaBase,
  asegurarProveedorYCliente,
  sincronizacionAutomatica,
} from './comun-base';

async function main(): Promise<void> {
  const preparacion = await asegurarProveedorYCliente();
  if (preparacion.error) {
    console.error(`${PREFIJO} ${preparacion.error}`);
    process.exit(1);
  }
  if (!preparacion.motor) return;

  if (!sincronizacionAutomatica()) {
    console.log(`${PREFIJO} Actualizacion automatica del esquema desactivada (DATABASE_AUTO_SYNC=false).`);
    return;
  }

  const esquema = await asegurarEsquemaDeLaBase();
  if (esquema.error) {
    console.warn(`${PREFIJO} No se pudo actualizar el esquema de la base de datos:`);
    console.warn(`${PREFIJO} ${esquema.error}`);
    console.warn(
      `${PREFIJO} La aplicacion puede fallar si las tablas no coinciden con el modelo.`,
    );
  }
}

main().catch((error) => {
  console.error(`${PREFIJO} Error inesperado:`, error);
  process.exit(1);
});
