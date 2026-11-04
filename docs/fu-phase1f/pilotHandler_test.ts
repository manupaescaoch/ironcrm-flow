import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createPilotHandler } from './pilotHandler.ts';
import { type PilotConfig } from './pilotPolicy.ts';
const listed = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
for (const family of ['internal', 'commercial'] as const) {
  const body = { lead_id: listed, unidade_id: listed, etapa: family === 'internal' ? 'M+7' : 'D+1', ...(family === 'internal' ? { task_id: listed, matricula_id: listed } : { follow_up_id: listed }) };
  const request = (data: unknown = body, jwt = 'valid') => new Request('http://localhost/', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: JSON.stringify(data) });
  for (const [label, config, actor] of [
    ['absent', {}, listed],
    ['disabled', { enabled: 'false', testUsers: listed }, listed],
    ['empty list', { enabled: 'true', testUsers: '' }, listed],
    ['malformed list', { enabled: 'true', testUsers: `${listed},invalid` }, listed],
    ['unlisted including otherwise authorized admin', { enabled: 'true', testUsers: listed }, other],
  ] as [string, PilotConfig, string][]) {
    Deno.test(`${family}: ${label} blocks before any SQL`, async () => {
      let calls = 0;
      const h = createPilotHandler(family, { actor: async () => actor, rpc: async () => { calls++; return { data: {}, error: null }; } }, () => config);
      const r = await h(request()); assertEquals(r.status, 403); assertEquals(calls, 0); assertEquals(r.headers.get('access-control-allow-origin'), '*'); await r.text();
    });
  }
  Deno.test(`${family}: invalid JWT cannot use listed identity or forged browser flag`, async () => {
    let calls = 0;
    const h = createPilotHandler(family, { actor: async () => null, rpc: async () => { calls++; return { data: {}, error: null }; } }, () => ({ enabled: 'true', testUsers: listed }));
    const r = await h(request({ ...body, enabled: true, actor: listed }, 'invalid')); assertEquals(r.status, 401); assertEquals(calls, 0); await r.text();
  });
  Deno.test(`${family}: listed JWT still undergoes strict input and SQL role/unit validation`, async () => {
    let calls = 0; let actor: unknown;
    const h = createPilotHandler(family, { actor: async () => listed, rpc: async (_name, args) => { calls++; actor = args.p_actor; return { data: null, error: { code: '42501' } }; } }, () => ({ enabled: 'true', testUsers: listed }));
    let r = await h(request({ ...body, p_actor: other })); assertEquals(r.status, 400); assertEquals(calls, 0); await r.text();
    r = await h(request()); assertEquals(r.status, 403); assertEquals(calls, 1); assertEquals(actor, listed); await r.text();
  });
  Deno.test(`${family}: server disabling takes effect on the next request without frontend release`, async () => {
    let config = { enabled: 'true', testUsers: listed }; let calls = 0;
    const h = createPilotHandler(family, { actor: async () => listed, rpc: async () => { calls++; return { data: { ok: true }, error: null }; } }, () => config);
    let r = await h(request()); assertEquals(r.status, 200); await r.text();
    config = { ...config, enabled: 'false' };
    r = await h(request()); assertEquals(r.status, 403); assertEquals(calls, 1); await r.text();
  });
}