import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processarEnvio } from './contasPagarEnvio.ts';

Deno.test('cobrança envia linha isolada como resposta ao aviso e retenta só os dados se falhar', async () => {
  const originalFetch = globalThis.fetch;
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  Deno.env.set('TELEGRAM_BOT_TOKEN', 'TEST_ONLY');
  const linha = '26090.82488 88362.242435 44000.000008 2 16130000311850';
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const conta = { id: 'conta-1', unidade_id: 'unidade-1', status: 'pendente', conferencia_status: 'aprovada', data_vencimento: hoje, descricao: 'WHEYS VITA BRASIL', valor: 3118.50, forma_pagamento: 'boleto', linha_digitavel: linha };
  const envio: Record<string, any> = { id: 'envio-1', tentativas: 0 };
  const mensagens: any[] = [];
  let falharPagamento = true;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init && 'body' in init ? init.body : ''));
    mensagens.push(body);
    if (body.text === linha && falharPagamento) {
      return new Response(JSON.stringify({ ok: false, description: 'temporary failure' }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }));
  };
  const admin = {
    rpc: () => { envio.tentativas += 1; return Promise.resolve({ data: { ...envio } }); },
    from: (table: string) => {
      let patch: any;
      const query: any = {
        select: () => query, eq: () => query, not: () => query,
        update: (value: any) => { patch = value; return query; },
        insert: () => Promise.resolve({}),
        maybeSingle: () => Promise.resolve({ data: table === 'contas_pagar' ? conta : { nome: 'EVO SETÚBAL' } }),
        then: (resolve: any) => {
          if (table === 'contas_pagar_envios' && patch) Object.assign(envio, patch);
          return Promise.resolve({ data: table === 'telegram_groups' ? [{ id: 'grupo-1', unidade_id: 'unidade-1', telegram_chat_id: -123 }] : null }).then(resolve);
        },
      };
      return query;
    },
  };
  try {
    assertEquals((await processarEnvio(admin, conta.id, 'VENCIMENTO')).ok, false);
    assertEquals(mensagens.length, 2);
    assertEquals(mensagens[1].text, linha);
    assertEquals(mensagens[1].reply_parameters.message_id, 123);
    assertEquals(envio.status, 'falhou');
    falharPagamento = false;
    assertEquals((await processarEnvio(admin, conta.id, 'VENCIMENTO')).ok, true);
    assertEquals(mensagens.length, 3);
    assertEquals(mensagens[2].text, linha);
    assertEquals(envio.status, 'enviado');
  } finally {
    globalThis.fetch = originalFetch;
    if (token === undefined) Deno.env.delete('TELEGRAM_BOT_TOKEN');
    else Deno.env.set('TELEGRAM_BOT_TOKEN', token);
  }
});