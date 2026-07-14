import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes and verifies correctly', async () => {
    const hash = await svc.hash('ValidPass!2026');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await svc.verify(hash, 'ValidPass!2026')).toBe(true);
    expect(await svc.verify(hash, 'WrongPass!2026')).toBe(false);
  });

  it('produces different hashes for the same input (salted)', async () => {
    const a = await svc.hash('same');
    const b = await svc.hash('same');
    expect(a).not.toBe(b);
  });
});
