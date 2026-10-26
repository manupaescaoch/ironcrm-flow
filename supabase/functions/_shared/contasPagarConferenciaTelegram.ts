// Botões CONFIRMAR / EDITAR nos documentos recebidos pelo grupo "Contas a Pagar" do Telegram.
// Altera o lançamento de verdade; edições só são gravadas após "CONFIRMAR ALTERAÇÕES".
import { telegramApi } from './telegram.ts';
import { CATEGORIAS } from './extrairDocumentoConta.ts';
import { formatarDataBR, formatarValorBR } from './contasPagarMensagem.ts';
import { autorizar, tecladoCobranca } from './contasPagarBotoes.ts';
import { CAMPOS, documentoFornecedorValido, interpretarCampo, nomeNormalizado, soDig } from './contasPagarEdicaoRegras.ts';

const BUCKET = 'contas-pagar-docs';
export const PREFIXOS_CONFERENCIA = ['cdc:', 'cde:', 'cdf:', 'cdu:', 'cdk:', 'cds:', 'cdx:'];

export function tecladoConferencia(contaId: string) {
  return { inline_keyboard: [[
    { text: '✅ CONFIRMAR', callback_data: `cdc:${contaId}` },
    { text: '✏️ EDITAR', callback_data: `cde:${contaId}` },
  ]] };
}

function tecladoCampos(contaId: string) {
  const b = (k: string) => ({ text: CAMPOS[k].rotulo, callback_data: `cdf:${contaId}:${k}` });
  return { inline_keyboard: [
    [b('u'), b('f')], [b('j'), b('d')], [b('k'), b('v')], [b('t'), b('c')], [b('l')],
    [{ text: '✖️ CANCELAR', callback_data: `cdx:${contaId}` }],
  ] };
}

function tecladoRevisao(contaId: string) {
  return { inline_keyboard: [
    [{ text: '✅ CONFIRMAR ALTERAÇÕES', callback_data: `cds:${contaId}` }],
    [{ text: '✏️ CONTINUAR EDITANDO', callback_data: `cde:${contaId}` }, { text: '✖️ CANCELAR', callback_data: `cdx:${contaId}` }],
  ] };
}

async function grupoIds(admin: any): Promise<number[]> {
  const { data } = await admin.from('telegram_groups').select('telegram_chat_id')
    .eq('group_type', 'contas_pagar').eq('status', 'conectado').not('telegram_chat_id', 'is', null);
  return (data ?? []).map((g: any) => Number(g.telegram_chat_id));
}

async function unidades(admin: any) {
  const { data } = await admin.from('unidades').select('id, nome').eq('ativo', true).order('nome');
  return data ?? [];
}

async function carregar(admin: any, id: string) {
  const { data } = await admin.from('contas_pagar').select('*, unidades(nome)').eq('id', id).is('deleted_at', null).maybeSingle();
  return data;
}

async function edicaoAberta(admin: any, contaId: string) {
  const { data } = await admin.from('contas_pagar_telegram_edicoes').select('*').eq('conta_id', contaId).eq('status', 'aberta').maybeSingle();
  return data;
}

async function historico(admin: any, contaId: string, campo: string, anterior: unknown, novo: unknown, nome: string, acao = 'edicao') {
  await admin.from('contas_pagar_historico').insert({
    conta_id: contaId, acao, campo,
    valor_anterior: anterior == null ? null : String(anterior), valor_novo: novo == null ? null : String(novo), user_nome: nome,
  });
}

const STATUS_LABEL: Record<string, string> = {
  pendente_conferencia: 'Pendente de conferência', conferida: 'Conferida — aguardando aprovação', aprovada: 'Pendente de pagamento',
};

/** Resumo da conta com o rascunho de edição aplicado. */
export function resumo(c: any, rascunho: Record<string, unknown> = {}, nomeUnidade?: string, titulo = 'DOCUMENTO RECEBIDO') {
  const v = { ...c, ...rascunho };
  const mud = (col: string) => (col in rascunho ? ' ✏️' : '');
  const linhas = [
    titulo, '',
    `Unidade: ${nomeUnidade ?? c.unidades?.nome ?? '—'}${mud('unidade_id')}`,
    `Fornecedor: ${v.fornecedor ?? '—'}${mud('fornecedor')}`,
    `CNPJ do fornecedor: ${v.fornecedor_documento ?? '—'}${mud('fornecedor_documento')}`,
    `Descrição: ${v.descricao ?? '—'}${mud('descricao')}`,
    `Categoria: ${v.categoria ?? '—'}${mud('categoria')}`,
    `Valor: ${v.valor != null ? formatarValorBR(v.valor) : '—'}${mud('valor')}`,
    `Vencimento: ${v.data_vencimento ? formatarDataBR(v.data_vencimento) : '—'}${mud('data_vencimento')}`,
    `Competência: ${v.competencia ?? '—'}${mud('competencia')}`,
    `Linha digitável: ${v.linha_digitavel ?? '—'}${mud('linha_digitavel')}`,
    `Status: ${c.status === 'paga' ? 'Paga' : STATUS_LABEL[c.conferencia_status] ?? 'Pendente'}`,
  ];
  if (c.fornecedor_validar && !('fornecedor' in rascunho)) linhas.push('', 'Fornecedor sem CNPJ/CPF válido: corrija em EDITAR.');
  return linhas.join('\n');
}

const alerta = (cq: any, text: string, show_alert = false) =>
  telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert });

async function editar(cq: any, text: string, reply_markup: unknown = { inline_keyboard: [] }) {
  const r = await telegramApi('editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text, reply_markup });
  if (!r.ok) console.warn('[conferencia] editMessageText', r.description);
}

/** Procura o fornecedor por CNPJ ou nome; cadastra se não existir. Nunca duplica. */
export async function garantirFornecedor(admin: any, c: { fornecedor?: unknown; fornecedor_documento?: unknown }): Promise<{ id: string; criado?: boolean } | { erro: string }> {
  const doc = soDig(c.fornecedor_documento);
  if (doc && !documentoFornecedorValido(doc)) return { erro: 'O CNPJ do fornecedor está inconsistente. Corrija em EDITAR.' };
  if (doc) {
    const { data } = await admin.from('fornecedores').select('id').eq('cnpj', doc).maybeSingle();
    if (data) return { id: data.id };
  }
  const alvo = nomeNormalizado(c.fornecedor);
  if (!alvo) return { erro: 'Falta o nome do fornecedor. Preencha em EDITAR.' };
  const { data: todos } = await admin.from('fornecedores').select('id, nome, cnpj');
  const mesmo = (todos ?? []).find((f: any) => nomeNormalizado(f.nome) === alvo && (!f.cnpj || !doc || f.cnpj === doc));
  if (mesmo) {
    if (doc && !mesmo.cnpj) await admin.from('fornecedores').update({ cnpj: doc }).eq('id', mesmo.id);
    return { id: mesmo.id };
  }
  if (!doc) return { erro: 'Fornecedor não cadastrado e sem CNPJ. Informe o CNPJ em EDITAR.' };
  const { data: novo, error } = await admin.from('fornecedores')
    .insert({ nome: String(c.fornecedor).toUpperCase(), cnpj: doc, unidade_id: null, observacoes: 'Cadastrado pelo Telegram (Contas a Pagar)' })
    .select('id').maybeSingle();
  if (novo) return { id: novo.id, criado: true };
  if (String(error?.code) === '23505') {
    const { data } = await admin.from('fornecedores').select('id').eq('cnpj', doc).maybeSingle();
    if (data) return { id: data.id };
  }
  return { erro: `Não consegui cadastrar o fornecedor: ${error?.message ?? 'erro'}` };
}

/** CONFIRMAR bloqueado: avisa e já abre a edição para a pessoa corrigir na hora. */
async function bloqueado(admin: any, cq: any, c: any, motivo: string) {
  await alerta(cq, motivo, true);
  const ed = await abrirEdicao(admin, cq, c);
  await editar(cq, resumo(c, ed?.rascunho ?? {}, await nomeUnidadeRascunho(admin, ed?.rascunho), 'EDITAR DOCUMENTO') +
    `\n\n⚠️ ${motivo}\nQuer corrigir agora? Escolha o campo:`, tecladoCampos(c.id));
}

async function confirmar(admin: any, cq: any, contaId: string, user: { userId: string; nome: string }) {
  const c = await carregar(admin, contaId);
  if (!c) return alerta(cq, 'Lançamento não encontrado.', true);
  if (c.status === 'paga') return alerta(cq, 'Esta conta já está paga.', true);
  if (c.conferencia_status !== 'pendente_conferencia') return alerta(cq, 'Este documento já foi confirmado.', true);
  if (await edicaoAberta(admin, contaId)) return alerta(cq, 'Há uma edição em andamento. Confirme ou cancele as alterações primeiro.', true);
  if (!c.valor || !c.data_vencimento) return bloqueado(admin, cq, c, 'Faltam valor ou vencimento.');

  let fornecedorId = c.fornecedor_id ?? null;
  if (c.fornecedor_validar || !fornecedorId) {
    const r = await garantirFornecedor(admin, c);
    if ('erro' in r) {
      if (c.fornecedor_validar) return bloqueado(admin, cq, c, r.erro);
    } else fornecedorId = r.id;
  }

  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.userId, _role: 'admin' });
  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = {
    conferencia_status: isAdmin ? 'aprovada' : 'conferida', conferido_por_nome: user.nome, conferido_em: agora,
    fornecedor_validar: false, fornecedor_id: fornecedorId,
    ...(isAdmin ? { aprovado_por_nome: user.nome, aprovado_em: agora } : {}),
  };
  const { data: ok } = await admin.from('contas_pagar').update(patch)
    .eq('id', contaId).eq('conferencia_status', 'pendente_conferencia').neq('status', 'paga').select('id').maybeSingle();
  if (!ok) return alerta(cq, 'Este documento já foi confirmado.', true);
  await historico(admin, contaId, 'conferencia', 'pendente_conferencia', patch.conferencia_status, user.nome, isAdmin ? 'aprovacao' : 'conferencia');
  if (c.fornecedor_validar && fornecedorId) await historico(admin, contaId, 'fornecedor', null, `${c.fornecedor} validado/cadastrado`, user.nome);

  await alerta(cq, isAdmin ? 'Lançamento confirmado.' : 'Conferido. Falta a aprovação de um administrador.');
  const atual = await carregar(admin, contaId);
  if (isAdmin) {
    await editar(cq, resumo(atual, {}, undefined, 'DOCUMENTO CONFIRMADO') + `\n\nLançamento confirmado no sistema financeiro por ${user.nome}.`, tecladoCobranca(contaId));
  } else {
    await editar(cq, resumo(atual, {}, undefined, 'DOCUMENTO CONFERIDO') +
      `\n\nConferido por ${user.nome}. Aguardando aprovação de um administrador para liberar o pagamento.`,
      { inline_keyboard: [[{ text: '✅ APROVAR (admin)', callback_data: `cdc:${contaId}` }]] });
  }
}

/** Admin aprova uma conta já conferida (mesmo botão CONFIRMAR). */
async function aprovarConferida(admin: any, cq: any, contaId: string, user: { userId: string; nome: string }) {
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.userId, _role: 'admin' });
  if (!isAdmin) return alerta(cq, 'Só um administrador pode aprovar.', true);
  const agora = new Date().toISOString();
  const { data: ok } = await admin.from('contas_pagar').update({ conferencia_status: 'aprovada', aprovado_por_nome: user.nome, aprovado_em: agora })
    .eq('id', contaId).eq('conferencia_status', 'conferida').neq('status', 'paga').select('id').maybeSingle();
  if (!ok) return alerta(cq, 'Este documento já foi aprovado.', true);
  await historico(admin, contaId, 'conferencia', 'conferida', 'aprovada', user.nome, 'aprovacao');
  await alerta(cq, 'Lançamento aprovado.');
  const atual = await carregar(admin, contaId);
  await editar(cq, resumo(atual, {}, undefined, 'DOCUMENTO CONFIRMADO') + `\n\nLançamento confirmado no sistema financeiro por ${user.nome}.`, tecladoCobranca(contaId));
}

async function abrirEdicao(admin: any, cq: any, c: any) {
  let ed = await edicaoAberta(admin, c.id);
  if (!ed) {
    const { data } = await admin.from('contas_pagar_telegram_edicoes').insert({
      conta_id: c.id, telegram_chat_id: cq.message.chat.id, telegram_user_id: cq.from.id, message_id: cq.message.message_id,
    }).select('*').maybeSingle();
    ed = data ?? await edicaoAberta(admin, c.id);
  } else {
    await admin.from('contas_pagar_telegram_edicoes').update({
      telegram_user_id: cq.from.id, message_id: cq.message.message_id, campo_aguardando: null, updated_at: new Date().toISOString(),
    }).eq('id', ed.id);
  }
  return ed;
}

async function nomeUnidadeRascunho(admin: any, rascunho: any) {
  if (!rascunho?.unidade_id) return undefined;
  return (await unidades(admin)).find((u: any) => u.id === rascunho.unidade_id)?.nome;
}

/** Callback dos botões de conferência/edição. Retorna true se tratou. */
export async function receberBotaoConferencia(admin: any, cq: any): Promise<boolean> {
  const data: string = cq?.data ?? '';
  if (!PREFIXOS_CONFERENCIA.some((p) => data.startsWith(p))) return false;
  if (!(await grupoIds(admin)).includes(Number(cq.message?.chat?.id))) { await alerta(cq, ''); return true; }
  const user = await autorizar(admin, cq.from);
  if (!user) { await alerta(cq, 'Você não tem permissão. Vincule seu Telegram a um usuário do financeiro no CRM.', true); return true; }

  const [pref, contaId, arg] = data.split(':');
  const c = await carregar(admin, contaId);
  if (!c) { await alerta(cq, 'Lançamento não encontrado.', true); return true; }

  if (pref === 'cdc') {
    if (c.conferencia_status === 'conferida') await aprovarConferida(admin, cq, contaId, user);
    else await confirmar(admin, cq, contaId, user);
    return true;
  }
  if (c.status === 'paga') { await alerta(cq, 'Conta já paga: não pode ser editada pelo Telegram.', true); return true; }

  if (pref === 'cde') {
    const ed = await abrirEdicao(admin, cq, c);
    await alerta(cq, 'Escolha o campo.');
    await editar(cq, resumo(c, ed?.rascunho ?? {}, await nomeUnidadeRascunho(admin, ed?.rascunho), 'EDITAR DOCUMENTO') +
      '\n\nEscolha o campo que deseja alterar:', tecladoCampos(contaId));
    return true;
  }

  const ed = await edicaoAberta(admin, contaId);
  if (pref === 'cdx') {
    if (ed) await admin.from('contas_pagar_telegram_edicoes').update({ status: 'cancelada', campo_aguardando: null }).eq('id', ed.id);
    await alerta(cq, 'Edição cancelada. Nada foi alterado.');
    await editar(cq, resumo(c), c.conferencia_status === 'aprovada' ? tecladoCobranca(contaId) : tecladoConferencia(contaId));
    return true;
  }
  if (!ed) { await alerta(cq, 'Esta edição já foi encerrada. Clique em EDITAR de novo.', true); return true; }

  if (pref === 'cdf') {
    if (arg === 'u') {
      const us = await unidades(admin);
      await alerta(cq, '');
      await editar(cq, 'Selecione a unidade:', { inline_keyboard: [
        ...us.map((u: any, i: number) => [{ text: u.nome, callback_data: `cdu:${contaId}:${i}` }]),
        [{ text: '↩️ VOLTAR', callback_data: `cde:${contaId}` }],
      ] });
      return true;
    }
    if (arg === 'k') {
      const linhas: any[] = [];
      CATEGORIAS.forEach((k, i) => { if (i % 2 === 0) linhas.push([]); linhas[linhas.length - 1].push({ text: k, callback_data: `cdk:${contaId}:${i}` }); });
      linhas.push([{ text: '↩️ VOLTAR', callback_data: `cde:${contaId}` }]);
      await alerta(cq, '');
      await editar(cq, 'Selecione a categoria financeira:', { inline_keyboard: linhas });
      return true;
    }
    const campo = CAMPOS[arg];
    if (!campo) { await alerta(cq, 'Campo inválido.'); return true; }
    await admin.from('contas_pagar_telegram_edicoes').update({
      campo_aguardando: arg, telegram_user_id: cq.from.id, updated_at: new Date().toISOString(),
    }).eq('id', ed.id);
    await alerta(cq, campo.rotulo);
    const nome = [cq.from.first_name].filter(Boolean).join(' ');
    await telegramApi('sendMessage', {
      chat_id: cq.message.chat.id, reply_to_message_id: cq.message.message_id, allow_sending_without_reply: true,
      text: `${nome ? nome + ', ' : ''}${campo.pergunta.charAt(0).toLowerCase()}${campo.pergunta.slice(1)}`,
      reply_markup: { force_reply: true, selective: true },
    });
    return true;
  }

  if (pref === 'cdu' || pref === 'cdk') {
    let patch: Record<string, unknown>;
    if (pref === 'cdu') {
      const u = (await unidades(admin))[Number(arg)];
      if (!u) { await alerta(cq, 'Unidade inválida.'); return true; }
      patch = { unidade_id: u.id };
    } else {
      const k = CATEGORIAS[Number(arg)];
      if (!k) { await alerta(cq, 'Categoria inválida.'); return true; }
      patch = { categoria: k };
    }
    const rascunho = { ...(ed.rascunho ?? {}), ...patch };
    await admin.from('contas_pagar_telegram_edicoes').update({ rascunho, campo_aguardando: null, updated_at: new Date().toISOString() }).eq('id', ed.id);
    await alerta(cq, 'Alteração anotada. Confirme para salvar.');
    await editar(cq, resumo(c, rascunho, await nomeUnidadeRascunho(admin, rascunho), 'REVISAR ALTERAÇÕES'), tecladoRevisao(contaId));
    return true;
  }

  if (pref === 'cds') {
    const rascunho: Record<string, unknown> = ed.rascunho ?? {};
    const { data: fechou } = await admin.from('contas_pagar_telegram_edicoes').update({ status: 'salva', campo_aguardando: null })
      .eq('id', ed.id).eq('status', 'aberta').select('id').maybeSingle();
    if (!fechou) { await alerta(cq, 'Alterações já salvas.'); return true; }
    const mudou = Object.entries(rascunho).filter(([k, v]) => String(c[k] ?? '') !== String(v ?? ''));
    if (!mudou.length) {
      await alerta(cq, 'Nenhuma alteração para salvar.');
      await editar(cq, resumo(c), c.conferencia_status === 'aprovada' ? tecladoCobranca(contaId) : tecladoConferencia(contaId));
      return true;
    }
    const patch: Record<string, unknown> = Object.fromEntries(mudou);
    if ('fornecedor' in patch || 'fornecedor_documento' in patch) {
      // Só muda o vínculo desta despesa; o cadastro anterior e outras contas ficam intactos.
      const f = await garantirFornecedor(admin, { fornecedor: patch.fornecedor ?? c.fornecedor, fornecedor_documento: patch.fornecedor_documento ?? c.fornecedor_documento });
      if ('erro' in f) { patch.fornecedor_validar = true; patch.fornecedor_id = null; } else { patch.fornecedor_validar = false; patch.fornecedor_id = f.id; }
    }
    if ('linha_digitavel' in patch) patch.forma_pagamento = 'boleto';
    // Dados mudaram: volta para conferência (inclusive se já estava aprovada).
    patch.conferencia_status = 'pendente_conferencia';
    patch.aprovado_em = null; patch.aprovado_por_nome = null; patch.conferido_em = null; patch.conferido_por_nome = null;
    if ('unidade_id' in patch) {
      const docs: string[] = c.documentos_fiscais?.length ? c.documentos_fiscais : (c.documento_url ? [c.documento_url] : []);
      const novos: string[] = [];
      for (const p of docs) {
        if (p.startsWith(`${c.unidade_id}/`)) {
          const destino = `${patch.unidade_id}/${p.slice(String(c.unidade_id).length + 1)}`;
          const { error } = await admin.storage.from(BUCKET).move(p, destino);
          novos.push(error ? p : destino);
        } else novos.push(p);
      }
      patch.documentos_fiscais = novos; patch.documento_url = novos[0] ?? null;
    }
    const { data: ok, error } = await admin.from('contas_pagar').update(patch).eq('id', contaId).neq('status', 'paga').select('id').maybeSingle();
    if (!ok) {
      await admin.from('contas_pagar_telegram_edicoes').update({ status: 'aberta' }).eq('id', ed.id);
      await alerta(cq, `Não foi possível salvar${error ? ': ' + error.message : ''}.`, true);
      return true;
    }
    for (const [k, v] of mudou) await historico(admin, contaId, k, c[k], v, `${user.nome} (TELEGRAM)`);
    await alerta(cq, 'Alterações salvas.');
    const atual = await carregar(admin, contaId);
    await editar(cq, resumo(atual) + `\n\nAlterações salvas por ${user.nome}. Confira e clique em CONFIRMAR.`, tecladoConferencia(contaId));
    return true;
  }
  return false;
}

/** Resposta em texto a um campo em edição. Retorna true se tratou. */
export async function receberRespostaEdicao(admin: any, update: any): Promise<boolean> {
  const msg = update.message;
  if (!msg?.text || !msg.from?.id) return false;
  const chatId = Number(msg.chat?.id);
  const { data: ed } = await admin.from('contas_pagar_telegram_edicoes').select('*')
    .eq('telegram_chat_id', chatId).eq('telegram_user_id', msg.from.id).eq('status', 'aberta')
    .not('campo_aguardando', 'is', null).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!ed) return false;
  if (Date.now() - new Date(ed.updated_at).getTime() > 30 * 60 * 1000) {
    await admin.from('contas_pagar_telegram_edicoes').update({ campo_aguardando: null }).eq('id', ed.id);
    return false;
  }
  if (!(await autorizar(admin, msg.from))) return false;
  const campo = CAMPOS[ed.campo_aguardando];
  const r = interpretarCampo(ed.campo_aguardando, msg.text);
  if ('erro' in r) {
    await telegramApi('sendMessage', { chat_id: chatId, reply_to_message_id: msg.message_id, text: `${r.erro}\n${campo?.pergunta ?? ''}`,
      reply_markup: { force_reply: true, selective: true } });
    return true;
  }
  const rascunho = { ...(ed.rascunho ?? {}), [campo.coluna]: r.valor };
  const c = await carregar(admin, ed.conta_id);
  if (!c) return true;
  const s = await telegramApi('sendMessage', {
    chat_id: chatId, reply_to_message_id: msg.message_id, allow_sending_without_reply: true,
    text: resumo(c, rascunho, await nomeUnidadeRascunho(admin, rascunho), 'REVISAR ALTERAÇÕES'), reply_markup: tecladoRevisao(ed.conta_id),
  });
  // a mensagem anterior perde os botões para não haver dois painéis ativos
  if (ed.message_id) await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: ed.message_id, reply_markup: { inline_keyboard: [] } });
  await admin.from('contas_pagar_telegram_edicoes').update({
    rascunho, campo_aguardando: null, message_id: s.result?.message_id ?? ed.message_id, updated_at: new Date().toISOString(),
  }).eq('id', ed.id);
  return true;
}
