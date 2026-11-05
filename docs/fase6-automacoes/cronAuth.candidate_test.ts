import { assertEquals } from 'jsr:@std/assert@1';
import { authorizeCronOnlyWith, authorizeCronOrRoleWith } from './cronAuth.candidate.ts';

// Dados fictícios — nenhum valor real.
const JOB = 'fict-job-secret-0000000000';
const BKP = 'fict-backup-secret-111111111';
const env = (k: string) => ({ CRON_JOB_SECRET: JOB, BACKUP_CRON_SECRET: BKP } as Record<string, string>)[k];
const users: Record<string, string[]> = { 'tok-admin': ['admin'], 'tok-comum': ['user'] };
const deps = {
  env,
  claims: async (t: string) => (t in users ? t : null),
  hasRole: async (u: string, r: string) => users[u]?.includes(r) ?? false,
};
const req = (h: Record<string, string>) => new Request('http://x', { method: 'POST', headers: h });

Deno.test('agendamento com chave nova (CRON_JOB_SECRET) passa', () => {
  assertEquals(authorizeCronOnlyWith(req({ 'x-cron-secret': JOB }), env).ok, true);
});
Deno.test('agendamento com chave antiga (BACKUP) passa durante a transição', () => {
  assertEquals(authorizeCronOnlyWith(req({ 'x-cron-secret': BKP }), env).ok, true);
});
Deno.test('JWT comum NÃO substitui a chave em rotina só-agendamento', () => {
  assertEquals(authorizeCronOnlyWith(req({ Authorization: 'Bearer tok-comum' }), env).status, 401);
});
Deno.test('chave errada bloqueada', () => {
  assertEquals(authorizeCronOnlyWith(req({ 'x-cron-secret': 'x'.repeat(26) }), env).status, 401);
});
Deno.test('sem chave configurada falha fechado', () => {
  assertEquals(authorizeCronOnlyWith(req({ 'x-cron-secret': JOB }), () => undefined).status, 500);
});
Deno.test('rotina admin: usuário comum recebe 403', async () => {
  assertEquals((await authorizeCronOrRoleWith(req({ Authorization: 'Bearer tok-comum' }), ['admin'], deps)).status, 403);
});
Deno.test('rotina admin: admin passa', async () => {
  assertEquals((await authorizeCronOrRoleWith(req({ Authorization: 'Bearer tok-admin' }), ['admin'], deps)).ok, true);
});
Deno.test('rotina admin: agendamento continua passando', async () => {
  assertEquals((await authorizeCronOrRoleWith(req({ 'x-cron-secret': JOB }), ['admin'], deps)).method, 'cron');
});
Deno.test('token inválido 401', async () => {
  assertEquals((await authorizeCronOrRoleWith(req({ Authorization: 'Bearer falso' }), ['admin'], deps)).status, 401);
});
Deno.test('após revogar chave antiga, BACKUP antigo é bloqueado', () => {
  const novo = (k: string) => (k === 'CRON_JOB_SECRET' || k === 'BACKUP_CRON_SECRET' ? JOB : undefined);
  assertEquals(authorizeCronOnlyWith(req({ 'x-cron-secret': BKP }), novo).status, 401);
});
