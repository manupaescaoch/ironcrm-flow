import { notificacaoFuTecnico, recifeTecnicoDia, telefoneFuTecnico } from './fuTecnicoRules.ts';
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