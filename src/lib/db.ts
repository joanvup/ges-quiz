import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma unico (singleton) para evitar abrir demasiadas conexiones
 * durante el hot-reload de Next.js en desarrollo.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
