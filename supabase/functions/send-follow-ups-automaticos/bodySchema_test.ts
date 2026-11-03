import { followUpBodySchema } from './bodySchema.ts';

const assert = (v: boolean, msg: string) => { if (!v) throw new Error(msg); };

Deno.test('Cron diário: corpo exato com triggered_at é aceito', () => {
  const r = followUpBodySchema.safeParse({ triggered_at: '2026-11-03T12:00:00.123456+00:00' });
  assert(r.success, 'corpo do cron diário deve ser aceito');
});

Deno.test('Cron de recuperação: corpo exato com auto_retry é aceito', () => {
  const r = followUpBodySchema.safeParse({ auto_retry: true });
  assert(r.success, 'corpo do cron de recuperação deve ser aceito');
});

Deno.test('Corpo vazio e dry_run continuam aceitos', () => {
  assert(followUpBodySchema.safeParse({}).success, 'corpo vazio deve ser aceito');
  assert(followUpBodySchema.safeParse({ dry_run: true, triggered_at: '2026-11-03T12:00:00Z' }).success, 'dry_run com triggered_at deve ser aceito');
});

Deno.test('Campos desconhecidos e tipos errados continuam rejeitados', () => {
  assert(!followUpBodySchema.safeParse({ unknown: true }).success, 'campo desconhecido deve ser rejeitado');
  assert(!followUpBodySchema.safeParse({ triggered_at: 123 }).success, 'triggered_at numérico deve ser rejeitado');
  assert(!followUpBodySchema.safeParse({ dry_run: 'sim' }).success, 'dry_run texto deve ser rejeitado');
});
