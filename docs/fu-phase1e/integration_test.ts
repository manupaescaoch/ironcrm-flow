// Explicit loopback-only integration: synthetic JWTs, real SDK verifier, handler and SQL.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler } from '../fu-phase1d/functions/handler.ts';
const base = ['-h', '/tmp/fu-phase1e/socket', '-p', '55441', '-U', 'lovable', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function sql(query: string) {
  const result = await new Deno.Command('psql', { args: [...base, '-c', query] }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim().split('\n').filter(v => v !== 'SET').join('\n');
}
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kty: 'EC', key_ops: ['verify'], kid: 'isolated', alg: 'ES256', use: 'sig' };
const b64 = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const encode = (v: unknown) => b64(new TextEncoder().encode(JSON.stringify(v)));
async function token(actor: string, expired = false) {
  const unsigned = `${encode({ alg: 'ES256', typ: 'JWT', kid: 'isolated' })}.${encode({ sub: actor, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + (expired ? -10 : 3600) })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64(new Uint8Array(signature))}`;
}
const verifier = createClient('http://127.0.0.1:55442', 'isolated-public-key', { auth: { persistSession: false, autoRefreshToken: false } });
const handler = createHandler('internal', {
  actor: async jwt => {
    const { data, error } = await verifier.auth.getClaims(jwt, { jwks: { keys: [jwk] } });
    return !error && typeof data?.claims.sub === 'string' ? data.claims.sub : null;
  },
  rpc: async (name, args) => {
    // Handler validates every UUID/stage. This test adapter is NOT a production SQL endpoint.
    if (name !== 'fu_crm_confirmar_envio' || Object.values(args).some(v => typeof v !== 'string' || !/^[a-zA-Z0-9+\-]+$/.test(v))) return { data: null, error: { code: '22023' } };
    try {
      const values = ['p_task', 'p_actor', 'p_lead', 'p_matricula', 'p_unidade', 'p_etapa'].map(k => `'${args[k]}'`).join(',');
      return { data: JSON.parse(await sql(`SET ROLE service_role; SELECT ${name}(${values});`)), error: null };
    } catch (e) { return { data: null, error: { code: /ERROR:  (\w{5}):/.exec(String(e))?.[1] ?? 'XX000' } }; }
  },
});
const response = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } });
const server = Deno.serve({ hostname: '127.0.0.1', port: 55442, onListen: () => {} }, async req => {
  const path = new URL(req.url).pathname;
  if (path === '/session') return response({ access_token: await token(id(105)), refresh_token: 'synthetic', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: id(105), email: 'moderator@example.invalid', user_metadata: {} } });
  if (path === '/snapshot') return response(JSON.parse(await sql(`SELECT json_build_object('tasks',(SELECT json_agg(t) FROM tasks t WHERE id='${id(390)}'),'leads',(SELECT json_agg(l) FROM leads l WHERE id='${id(20390)}'));`)));
  return handler(req);
});
async function seedTask() {
  const result = await new Deno.Command('python3', { args: ['-c', "import sys;sys.path.insert(0,'docs/fu-phase1e');from structural import task;from prepare import sql;task(390,'matriculados','M+3') if sql(\"SELECT count(*) FROM tasks WHERE id='00000000-0000-4000-8000-000000000390'\")=='0' else None"] }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
}
const body = { task_id: id(390), lead_id: id(20390), matricula_id: id(10390), unidade_id: id(1), etapa: 'M+3' };
async function request(jwt: string, data: unknown = body) {
  return fetch('http://127.0.0.1:55442/confirm', { method: 'POST', headers: { authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
if (Deno.env.get('FU_E2E_SERVE') === 'true') {
  await seedTask();
  await server.finished;
} else {
  Deno.test('real signed JWT HTTP → handler → service SQL → unique history/evidence → read-back', async () => {
    await seedTask();
    for (const actor of [102, 103, 106, 107]) {
      const r = await request(await token(id(actor))); assertEquals(r.status, 403); await r.text();
    }
    let r = await request(await token(id(105), true)); assertEquals(r.status, 401); await r.text();
    r = await request('invalid'); assertEquals(r.status, 401); await r.text();
    r = await request(await token(id(105)), { ...body, p_actor: id(101) }); assertEquals(r.status, 400); await r.text();
    const moderator = await token(id(105));
    const results = await Promise.all([request(moderator), request(moderator)]);
    assertEquals(results.map(v => v.status), [200, 200]);
    const values = await Promise.all(results.map(v => v.json()));
    assertEquals(values.map(v => v.duplicado).sort(), [false, true]);
    assertEquals(values[0].confirmado_em, values[1].confirmado_em);
    for (const actor of [101, 104, 105]) { r = await request(await token(id(actor))); assertEquals(r.status, 200); assertEquals((await r.json()).duplicado, true); }
    assertEquals(await sql(`SELECT count(*) FROM task_history WHERE task_id='${id(390)}';`), '1');
    assertEquals(await sql(`SELECT count(*) FROM contato_execucoes WHERE chave='manual:fu_matriculados:${id(390)}';`), '1');
    assertEquals(await sql(`SELECT status FROM tasks WHERE id='${id(390)}';`), 'a_fazer');
    // Lost response after commit is recovered by a retry without another insert.
    r = await request(moderator); await r.body?.cancel();
    r = await request(moderator); assertEquals((await r.json()).duplicado, true);
    await server.shutdown();
  });
}