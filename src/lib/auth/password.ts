import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { env } from '@/lib/env';

const RONDAS = Math.min(Math.max(env.bcryptRounds, 8), 14);

/** Hash de contrasena con bcrypt. */
export async function hashearContrasena(plano: string): Promise<string> {
  return bcrypt.hash(plano, RONDAS);
}

/** Verifica una contrasena contra su hash. */
export async function verificarContrasena(plano: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plano, hash);
  } catch {
    return false;
  }
}

/**
 * Hash descartable para igualar tiempos de respuesta cuando el usuario no
 * existe (evita enumeracion de cuentas por temporizacion).
 */
const HASH_SENUELO = bcrypt.hashSync('senuelo-de-tiempos-quizcolegio', RONDAS);

export async function compararSenuelo(plano: string): Promise<void> {
  await bcrypt.compare(plano, HASH_SENUELO);
}

/** Token aleatorio opaco (no se guarda en claro en la base). */
export function generarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Hash determinista usado para almacenar tokens de sesion. */
export function hashearToken(token: string): string {
  return createHash('sha256').update(`${token}${env.appSecret}`).digest('hex');
}

/** Hash estable usado para deduplicar preguntas. */
export function huellaTexto(texto: string): string {
  const normalizado = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha1').update(normalizado).digest('hex').slice(0, 16);
}
