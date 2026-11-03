import { handleCancelamento } from './index.ts';

const assert = (value: boolean, reason: string) => { if (!value) throw new Error(reason); };
const base = {
  nome: 'TESTE ISOLADO', ddi: '+55', telefone: '81900000000', telefone_formatado: '+55 81 90000-0000',
  unidade: 'EVO SETÚBAL', plano: 'Anual', motivos: ['Falta de tempo'], detalhamento: 'HORÁRIO',
  problemas: ['Nenhum problema específico'], acompanhamento: 'Sim, sempre', evolucao: 'Sim, bastante', nota: 9,
  pontos_positivos: 'EQUIPE', evitaria_saida: 'HORÁRIO', solucoes_retencao: ['Mudança de horário'],
  vai_treinar_outro_local: 'Não', proxima_escolha: null, fator_escolha: 'Horário',
};

async function run(extra: Record<string, unknown> = {}) {
  let inserted: Record<string, unknown> = {};
  let text = '';
  const updates: Record<string, unknown>[] = [];
  const admin = { from: (table: string) => {
    assert(table === 'cancelamento_solicitacoes', 'não deve alterar outros módulos');
    return {
      insert: (row: Record<string, unknown>) => {
        inserted = row;
        return { select: () => ({ single: async () => ({ data: { id: 'isolado' }, error: null }) }) };
      },
      update: (row: Record<string, unknown>) => {
        updates.push(row);
        return { eq: async () => ({ error: null }) };
      },
    };
  } };
  const response = await handleCancelamento(new Request('https://example.invalid', {
    method: 'POST', body: JSON.stringify({ ...base, ...extra }),
  }), {
    adminClient: () => admin as any,
    resolveUnidadeId: async () => 'unit-test',
    resolveGrupoUnidade: async (_admin: unknown, unit: string | null, types: string[]) => {
      assert(unit === 'unit-test' && types[0] === 'gerencia', 'destino original preservado');
      return { id: 'test', group_type: 'gerencia' as const, telegram_chat_id: -1, telegram_title: 'TESTE' };
    },
    sendTelegramGroupText: async (_admin: unknown, _group: unknown, message: string) => {
      text = message;
      return { ok: true } as any;
    },
  });
  return { response, inserted, text, updates };
}

Deno.test('Solicitação sem consentimento retorna 200, registra null e não concede autorização', async () => {
  const r = await run();
  assert(r.response.status === 200, 'envio sem perguntas removidas deve funcionar');
  assert(r.inserted.aceita_contato_antes === null && r.inserted.aceita_contato_futuro === null, 'ausência não é consentimento');
  assert(r.inserted.plano === 'Anual' && r.inserted.nota === 9, 'dados do plano/experiência preservados');
  assert(JSON.stringify(r.inserted.solucoes_retencao) === '["Mudança de horário"]', 'possível solução preservada');
  assert(r.updates.length === 1 && r.updates[0].telegram_enviado === true, 'confirmação de notificação preservada');
});

for (const value of [true, false]) {
  Deno.test(`Cliente anterior com preferência ${value} permanece compatível sem aviso de contato`, async () => {
    const r = await run({ aceita_contato_antes: value, aceita_contato_futuro: value });
    assert(r.response.status === 200, 'contrato antigo permanece aceito');
    assert(r.inserted.aceita_contato_antes === value && r.inserted.aceita_contato_futuro === value, 'preferência explícita não é invertida');
    assert(!/autorizou|contato para retenção|OPORTUNIDADE DE RETENÇÃO/i.test(r.text), 'não deve compor avisos de consentimento');
    assert(r.text.includes('*Aceitaria solução:* Mudança de horário') && r.text.includes('*Experiência geral:* 9/10'), 'outras respostas preservadas');
  });
}