import { tecladoFuTecnico, notificacaoFuTecnico, recifeTecnicoDia, telefoneFuTecnico } from './fuTecnicoRules.ts';
function eq(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
Deno.test('Recife owns the send day before UTC midnight rollover', () => eq(recifeTecnicoDia(new Date('2026-11-03T01:00:00Z')), '2026-11-02'));
Deno.test('Brazilian phone normalization and invalid phone rejection', () => { eq(telefoneFuTecnico('(81) 99999-1234'), '5581999991234'); eq(telefoneFuTecnico('123'), null); });
Deno.test('WhatsApp link targets only the actual student and carries encoded editable message', () => {
  const p = notificacaoFuTecnico('M+7','LÍVIA SILVA','EVO SETÚBAL','81999991234',null,null);
  const link = new URL(p.link ?? '');
  eq(link.pathname, '/5581999991234'); eq(link.searchParams.get('text'), p.mensagem);
  eq(p.mensagem.includes('[COORDENADOR]'), true);
});
Deno.test('Invalid phone still produces individual notification without a WhatsApp link', () => eq(notificacaoFuTecnico('M+21','ALUNO','EVO MADALENA','123',null,null).link, null));
Deno.test('Open button is URL-only and confirmation uniquely identifies the task', () => {
  const k = tecladoFuTecnico('00000000-0000-0000-0000-000000000001','https://wa.me/5581999991234?text=Oi');
  eq(k.inline_keyboard[0][0], { text: '💬 Abrir', url: 'https://wa.me/5581999991234?text=Oi' });
  eq(k.inline_keyboard[0][1], { text: '✅ Enviado', callback_data: 'ftc:00000000-0000-0000-0000-000000000001' });
  eq(tecladoFuTecnico('id',null).inline_keyboard[0].length, 1);
});