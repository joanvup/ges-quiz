import { describe, expect, it } from 'vitest';
import { puedeRetroceder } from '@/lib/intentos/reglas';

describe('reglas de navegacion', () => {
  it('permite retroceder en modo libre cuando hay una pregunta anterior', () => {
    expect(puedeRetroceder('FREE', 1)).toBe(true);
    expect(puedeRetroceder('FREE', 4)).toBe(true);
  });

  it('no permite retroceder en modo libre desde la primera pregunta', () => {
    expect(puedeRetroceder('FREE', 0)).toBe(false);
  });

  it('nunca permite retroceder en modo solo hacia adelante', () => {
    expect(puedeRetroceder('FORWARD_ONLY', 0)).toBe(false);
    expect(puedeRetroceder('FORWARD_ONLY', 3)).toBe(false);
  });

  it('trata cualquier modo distinto de FREE como solo hacia adelante', () => {
    expect(puedeRetroceder('OTRO', 2)).toBe(false);
    expect(puedeRetroceder('', 2)).toBe(false);
  });
});
