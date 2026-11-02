import { evaluateTransition } from './fuTransition.ts';
const assert = (value: boolean) => { if (!value) throw new Error('Assertion failed'); };
const candidate = { familia: 'R02' as const, etapa: 'M+7', lead_id: 'lead', unidade_id: 'unit', referencia: '2026-11-02' };
for (const modo of ['LEGADO','OBSERVACAO'] as const) {
  Deno.test(`${modo} preserves legacy execution and records no completion`, async () => {
    const calls: string[] = [];
    const admin = { rpc: (name: string, args: any) => { calls.push(name); assert(args.p_candidato === candidate); return { data: { modo, suprimir: false, motivo: 'preservado' } }; } };
    const decision = await evaluateTransition(admin, candidate);
    assert(!decision.suprimir && calls.length === 1 && calls[0] === 'fu_transicao_avaliar');
  });
}
Deno.test('Only server decision can authorize suppression', async () => {
  const result = await evaluateTransition({rpc: () => ({data:{modo:'NOVO',suprimir:true,motivo:'substituto_homologado'}})}, candidate);
  assert(result.suprimir);
});
Deno.test('Unavailable decision cannot authorize a contact suppression', async () => {
  let failed = false;
  try { await evaluateTransition({rpc: () => ({error:{message:'denied'}})}, candidate); } catch { failed = true; }
  assert(failed);
});
Deno.test('Dry observation is read-only', async () => {
  let recorded = true;
  await evaluateTransition({rpc: (_: string, args: any) => {recorded = args.p_registrar; return {data:{modo:'OBSERVACAO',suprimir:false}};}}, candidate, false);
  assert(!recorded);
});