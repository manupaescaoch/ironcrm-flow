import { receberBotaoFuTecnico } from './fuTecnicoBotoes.ts';
function eq(a: unknown, b: unknown) { if (JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const cq = { id: 'query', data: 'ftc:00000000-0000-0000-0000-000000000001', from: { id: 123 }, message: { chat: { id: -456 }, message_id: 789 } };
Deno.test('Confirmation edits original message, removes buttons, and makes only confirmation RPC call', async () => {
  const calls: { method: string; body: unknown }[] = [];
  const rpcCalls: string[] = [];
  const admin = { rpc: (name: string) => { rpcCalls.push(name); return Promise.resolve({ data: { ok: true, duplicado: false, confirmado_em: '2026-11-02T11:00:00Z', responsavel: 'ANA', unidade: 'BOA VIAGEM', aluno: 'ALUNO', etapa: 'M+7' }, error: null }); } };
  await receberBotaoFuTecnico(admin,cq,async (method,body) => { calls.push({ method,body }); return { ok: true }; });
  eq(rpcCalls, ['fu_tecnico_confirmar_envio']);
  eq(calls.map(c => c.method), ['editMessageText','answerCallbackQuery']);
  const edit = calls[0].body as { chat_id: number; message_id: number; reply_markup: unknown };
  eq(edit.chat_id,-456); eq(edit.message_id,789); eq(edit.reply_markup, { inline_keyboard: [] });
});
Deno.test('Unauthorized callback does not edit or send another message', async () => {
  const calls: string[] = [];
  await receberBotaoFuTecnico({ rpc: () => Promise.resolve({ data: { ok: false, erro: 'Não autorizado' } }) }, cq, async method => { calls.push(method); return { ok: true }; });
  eq(calls, ['answerCallbackQuery']);
});
Deno.test('Other callback namespaces are untouched', async () => eq(await receberBotaoFuTecnico({}, { data: 'expc:other' }), false));
Deno.test('Duplicate confirmation can repair the same message without changing accompaniment', async () => {
  const calls: string[] = [];
  await receberBotaoFuTecnico({ rpc: () => Promise.resolve({ data: { ok: true, duplicado: true, confirmado_em: '2026-11-02T11:00:00Z', responsavel: 'ANA', unidade: 'BOA VIAGEM', aluno: 'ALUNO', etapa: 'M+7' } }) }, cq, async method => { calls.push(method); return { ok: true }; });
  eq(calls, ['editMessageText', 'answerCallbackQuery']);
});