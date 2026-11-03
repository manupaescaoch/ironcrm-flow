import { boasVindasBodySchema } from './bodySchema.ts';

const assert = (v: boolean, msg: string) => { if (!v) throw new Error(msg); };

Deno.test('Cron 30min: corpo exato com time é aceito', () => {
  const r = boasVindasBodySchema.safeParse({ time: '2026-11-03T12:30:00.123456+00:00' });
  assert(r.success, 'corpo do cron deve ser aceito');
});

Deno.test('dry_run e task_id continuam aceitos, inclusive junto com time', () => {
  assert(boasVindasBodySchema.safeParse({}).success, 'corpo vazio deve ser aceito');
  assert(boasVindasBodySchema.safeParse({ dry_run: true }).success, 'dry_run deve ser aceito');
  const r = boasVindasBodySchema.safeParse({ dry_run: true, task_id: '00000000-0000-0000-0000-000000000001', time: '2026-11-03T12:30:00Z' });
  assert(r.success, 'dry_run + task_id + time devem ser aceitos');
});

Deno.test('Campos desconhecidos e tipos errados continuam rejeitados', () => {
  assert(!boasVindasBodySchema.safeParse({ unknown: 1 }).success, 'campo desconhecido deve ser rejeitado');
  assert(!boasVindasBodySchema.safeParse({ time: 123 }).success, 'time numérico deve ser rejeitado');
  assert(!boasVindasBodySchema.safeParse({ task_id: 'nao-uuid' }).success, 'task_id inválido deve ser rejeitado');
});
