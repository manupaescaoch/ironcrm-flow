import { receberBotaoFuGerencial } from './fuGerencialBotoes.ts';
import { receberBotaoFuTecnico } from './fuTecnicoBotoes.ts';
import { receberBotaoFuMatriculados } from './fuMatriculadosBotoes.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
for (const [prefix, handler] of [['fgc', receberBotaoFuGerencial], ['ftc', receberBotaoFuTecnico], ['fmc', receberBotaoFuMatriculados]] as const) {
  Deno.test(`${prefix}: failed visual edit and acknowledgement preserve one confirmation and never resend`, async () => {
    let persisted = false;
    let confirms = 0;
    const calls: string[] = [];
    const admin = { rpc: async () => { confirms++; persisted = true; return { data: { ok: true, etapa: prefix === 'ftc' ? 'M+7' : 'M+15', unidade: 'TESTE', aluno: 'ALFA', confirmado_em: '2026-11-04T12:00:00Z', responsavel: 'TESTE' } }; } };
    const api = async (method: string) => { calls.push(method); throw new Error('isolated connection failure'); };
    const result = await handler(admin, { id: 'q', data: `${prefix}:00000000-0000-4000-8000-000000000001`, from: { id: 1 }, message: { chat: { id: -1 }, message_id: 2 } }, api);
    assertEquals(result, true); assertEquals(persisted, true); assertEquals(confirms, 1);
    assertEquals(calls, ['editMessageText', 'answerCallbackQuery']);
  });
}