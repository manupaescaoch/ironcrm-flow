// Ações do painel "Telegram" de Contas a Pagar: reprocessar, definir unidade e ligar/desligar.
import { adminCorsHeaders } from '../_shared/cors.ts';
import { adminClient, telegramApi } from '../_shared/telegram.ts';
import { garantirFornecedor, resumo, tecladoConferencia } from '../_shared/contasPagarConferenciaTelegram.ts';
import { processarDocumento } from '../_shared/contasPagarTelegram.ts';

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  const cors = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401);
    const admin = adminClient();
    const { data: claims } = await admin.auth.getClaims(auth.replace('Bearer ', ''));
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: 'Não autorizado' }, 401);
    const { data: pode } = await admin.rpc('can_manage_contas_pagar', { _user_id: userId });
    if (!pode) return json({ error: 'Sem permissão' }, 403);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });

    const body = await req.json().catch(() => ({}));
    const { action, doc_id, unidade_id, ativo } = body ?? {};

    if (action === 'status') {
      const { data } = await admin.from('app_config').select('valor').eq('chave', 'contas_pagar_telegram_ativo').maybeSingle();
      return json({ ativo: data?.valor === 'true', admin: !!isAdmin });
    }
    if (action === 'ativar') {
      if (!isAdmin) return json({ error: 'Somente administradores' }, 403);
      await admin.from('app_config').upsert({ chave: 'contas_pagar_telegram_ativo', valor: ativo ? 'true' : 'false' }, { onConflict: 'chave' });
      return json({ ok: true, ativo: !!ativo });
    }

    if (typeof doc_id !== 'string' || !UUID.test(doc_id)) return json({ error: 'Documento inválido' }, 400);
    const { data: doc } = await admin.from('contas_pagar_telegram_docs').select('id, status, unidade_id').eq('id', doc_id).maybeSingle();
    if (!doc) return json({ error: 'Documento não encontrado' }, 404);
    if (!isAdmin && doc.unidade_id) {
      const { data: tem } = await admin.rpc('user_has_unidade_access', { _user_id: userId, _unidade_id: doc.unidade_id });
      if (!tem) return json({ error: 'Sem permissão' }, 403);
    }

    if (action === 'definir_unidade') {
      if (typeof unidade_id !== 'string' || !UUID.test(unidade_id)) return json({ error: 'Unidade inválida' }, 400);
      if (doc.status !== 'aguardando_unidade' && doc.status !== 'erro') return json({ error: 'Documento já processado' }, 409);
      await admin.from('contas_pagar_telegram_docs').update({ unidade_id, unidade_metodo: 'manual:painel', status: 'recebido' }).eq('id', doc_id);
      return json(await processarDocumento(admin, doc_id));
    }
    if (action === 'reenviar_conferencia') {
      // Reenvia ao grupo o resumo da conta com CONFIRMAR/EDITAR (identifica/cadastra o fornecedor antes).
      const { data: d } = await admin.from('contas_pagar_telegram_docs').select('conta_id, telegram_chat_id, telegram_message_id').eq('id', doc_id).maybeSingle();
      if (!d?.conta_id) return json({ error: 'Documento sem lançamento' }, 409);
      const { data: c } = await admin.from('contas_pagar').select('*, unidades(nome)').eq('id', d.conta_id).maybeSingle();
      if (!c || c.status === 'paga' || c.conferencia_status !== 'pendente_conferencia') return json({ error: 'Conta já conferida ou paga' }, 409);
      let aviso = '';
      if (!c.fornecedor_id) {
        const f = await garantirFornecedor(admin, c);
        if ('erro' in f) aviso = `Fornecedor não identificado: ${f.erro}`;
        else {
          await admin.from('contas_pagar').update({ fornecedor_id: f.id, fornecedor_validar: false }).eq('id', c.id);
          c.fornecedor_id = f.id; c.fornecedor_validar = false;
          aviso = f.criado ? 'Fornecedor cadastrado automaticamente.' : 'Fornecedor identificado no cadastro.';
        }
      }
      const r = await telegramApi('sendMessage', {
        chat_id: d.telegram_chat_id, reply_to_message_id: d.telegram_message_id, allow_sending_without_reply: true,
        text: resumo(c) + (aviso ? `\n\n${aviso}` : '') + '\n\nDocumento anexado ao Contas a Pagar.',
        reply_markup: tecladoConferencia(c.id),
      });
      return json({ ok: r.ok, erro: r.description, aviso });
    }
    if (action === 'reprocessar') {
      if (!['erro', 'recebido'].includes(doc.status)) return json({ error: 'Só documentos com falha podem ser reprocessados' }, 409);
      return json(await processarDocumento(admin, doc_id));
    }
    return json({ error: 'Ação inválida' }, 400);
  } catch (e) {
    console.error('contas-pagar-telegram-processar', e);
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
