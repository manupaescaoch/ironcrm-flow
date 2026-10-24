// Recebimento de documentos no grupo "Contas a Pagar" do Telegram → lançamento em Contas a Pagar.
// Nota/boleto lançam conta nova (pendente de conferência); comprovante de pagamento anexa e dá baixa.
// Idempotente por (chat, mensagem).
import { botToken, telegramApi, TELEGRAM_API } from './telegram.ts';
import { extrairDocumentoConta, CATEGORIAS } from './extrairDocumentoConta.ts';
import {
  acharCorrespondencia, identificarUnidade, msgAguardandoVencimento, msgConfirmarUnidade,
  msgDuplicado, msgProcessado, soDigitos, UnidadeCnpj,
} from './contasPagarTelegramRegras.ts';
import {
  acharContaComprovante, CandidataComprovante, ContaComprovante, ehComprovante,
  msgComprovanteEscolha, msgComprovanteJaPaga, msgComprovanteProcessado, msgComprovanteSemConta,
  msgComprovanteSemDados, msgComprovanteSemPermissao,
} from './contasPagarComprovanteRegras.ts';
import { autorizar } from './contasPagarBotoes.ts';
import { conciliarConta, textoConciliado } from './conciliacaoBancaria.ts';
import { garantirFornecedor, tecladoConferencia } from './contasPagarConferenciaTelegram.ts';


const BUCKET = 'contas-pagar-docs';
const MAX_BYTES = 20 * 1024 * 1024;

const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', xml: 'application/xml',
};

export async function integracaoAtiva(admin: any): Promise<boolean> {
  const { data } = await admin.from('app_config').select('valor').eq('chave', 'contas_pagar_telegram_ativo').maybeSingle();
  return data?.valor === 'true';
}

async function grupoContasPagarChatIds(admin: any): Promise<number[]> {
  const { data } = await admin.from('telegram_groups').select('telegram_chat_id')
    .eq('group_type', 'contas_pagar').eq('status', 'conectado').not('telegram_chat_id', 'is', null);
  return (data ?? []).map((g: any) => Number(g.telegram_chat_id));
}

async function unidadesAtivas(admin: any): Promise<UnidadeCnpj[]> {
  const { data } = await admin.from('unidades').select('id, nome, cnpj').eq('ativo', true).order('nome');
  return data ?? [];
}

function arquivoDaMensagem(msg: any): { file_id: string; file_name: string; mime: string; size?: number } | null {
  if (msg?.document) {
    const nome: string = msg.document.file_name ?? 'documento';
    const ext = nome.split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME_POR_EXT[ext] ?? msg.document.mime_type ?? '';
    if (!Object.values(MIME_POR_EXT).includes(mime) && mime !== 'text/xml') return null;
    return { file_id: msg.document.file_id, file_name: nome, mime: mime === 'text/xml' ? 'application/xml' : mime, size: msg.document.file_size };
  }
  if (Array.isArray(msg?.photo) && msg.photo.length) {
    const p = msg.photo[msg.photo.length - 1];
    return { file_id: p.file_id, file_name: `foto_${msg.message_id}.jpg`, mime: 'image/jpeg', size: p.file_size };
  }
  return null;
}

function remetente(from: any): string {
  return [from?.first_name, from?.last_name].filter(Boolean).join(' ') || (from?.username ? `@${from.username}` : 'Telegram');
}

async function responder(admin: any, chatId: number, replyTo: number, text: string, reply_markup?: unknown) {
  const r = await telegramApi('sendMessage', {
    chat_id: chatId, text, parse_mode: 'Markdown', reply_to_message_id: replyTo, allow_sending_without_reply: true,
    ...(reply_markup ? { reply_markup } : {}),
  });
  if (!r.ok) {
    await telegramApi('sendMessage', { chat_id: chatId, text: text.replace(/\*/g, ''), ...(reply_markup ? { reply_markup } : {}) });
  }
  await admin.from('telegram_message_logs').insert({
    recipient_type: 'grupo', telegram_chat_id: chatId, message_type: 'contas_pagar_documento',
    status: r.ok ? 'enviado' : 'erro', error_message: r.ok ? null : r.description,
  });
  return r.result?.message_id ?? null;
}

/** Ponto de entrada do webhook para mensagens com arquivo. Retorna true se tratou a mensagem. */
export async function receberMensagemContasPagar(admin: any, update: any): Promise<boolean> {
  const msg = update.message;
  const chatId = Number(msg?.chat?.id);
  if (!msg || !chatId) return false;
  const grupos = await grupoContasPagarChatIds(admin);
  if (!grupos.includes(chatId)) return false;
  const arquivo = arquivoDaMensagem(msg);
  if (!arquivo) return true; // mensagens de texto do grupo são ignoradas
  if (!(await integracaoAtiva(admin))) return true;

  const { data: doc, error } = await admin.from('contas_pagar_telegram_docs').insert({
    telegram_chat_id: chatId,
    telegram_message_id: msg.message_id,
    update_id: update.update_id ?? null,
    file_id: arquivo.file_id,
    file_name: arquivo.file_name,
    mime_type: arquivo.mime,
    remetente: remetente(msg.from),
    telegram_user_id: msg.from?.id ?? null,
    recebido_em: new Date((msg.date ?? Date.now() / 1000) * 1000).toISOString(),
  }).select('id').maybeSingle();
  if (error || !doc) return true; // já recebido (reenvio do Telegram)

  if (arquivo.size && arquivo.size > MAX_BYTES) {
    await admin.from('contas_pagar_telegram_docs').update({ status: 'erro', erro: 'Arquivo maior que 20 MB' }).eq('id', doc.id);
    await responder(admin, chatId, msg.message_id, 'Não consegui ler este arquivo: ele passa de 20 MB. Envie uma versão menor ou cadastre manualmente.');
    return true;
  }
  await processarDocumento(admin, doc.id);
  return true;
}

/** Botão "Selecione a unidade" (callback_data = cpu:<docId>:<índice>). */
export async function receberCallbackContasPagar(admin: any, cq: any): Promise<boolean> {
  const data: string = cq?.data ?? '';
  if (data.startsWith('cpv:')) return await receberBotaoComprovante(admin, cq);
  if (!data.startsWith('cpu:')) return false;
  const [, docId, idxStr] = data.split(':');
  const chatId = Number(cq.message?.chat?.id);
  const grupos = await grupoContasPagarChatIds(admin);
  if (!grupos.includes(chatId)) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id });
    return true;
  }
  const unidades = await unidadesAtivas(admin);
  const unidade = unidades[Number(idxStr)];
  const { data: doc } = await admin.from('contas_pagar_telegram_docs').select('id, status').eq('id', docId).maybeSingle();
  if (!doc || doc.status !== 'aguardando_unidade' || !unidade) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Este documento já foi processado.' });
    return true;
  }
  // Reserva: só um clique continua o processamento
  const { data: reservado } = await admin.from('contas_pagar_telegram_docs')
    .update({ unidade_id: unidade.id, unidade_metodo: `manual:${remetente(cq.from)}`, status: 'recebido' })
    .eq('id', docId).eq('status', 'aguardando_unidade').select('id').maybeSingle();
  await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: reservado ? `Unidade: ${unidade.nome}` : 'Já confirmado.' });
  if (!reservado) return true;
  await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
  await processarDocumento(admin, docId);
  return true;
}

async function baixarArquivo(fileId: string): Promise<Uint8Array> {
  const info = await telegramApi('getFile', { file_id: fileId });
  if (!info.ok || !info.result?.file_path) throw new Error(`getFile: ${info.description ?? 'sem caminho'}`);
  const res = await fetch(`${TELEGRAM_API}/file/bot${botToken()}/${info.result.file_path}`);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const nomeSeguro = (n: string) => n.replace(/[^\w.\-]/g, '_');

async function moverParaUnidade(admin: any, doc: any, unidadeId: string): Promise<string> {
  if (doc.storage_path?.startsWith(`${unidadeId}/`)) return doc.storage_path;
  const destino = `${unidadeId}/documentos/${Date.now()}_tg_${nomeSeguro(doc.file_name ?? 'documento')}`;
  const { error } = await admin.storage.from(BUCKET).move(doc.storage_path, destino);
  if (error) throw new Error(`mover anexo: ${error.message}`);
  await admin.from('contas_pagar_telegram_docs').update({ storage_path: destino }).eq('id', doc.id);
  return destino;
}

async function historico(admin: any, contaId: string, campo: string, texto: string) {
  await admin.from('contas_pagar_historico').insert({ conta_id: contaId, acao: 'edicao', campo, valor_novo: texto, user_nome: 'TELEGRAM' });
}

/** Processa (ou reprocessa) um documento recebido. Seguro para repetir. */
export async function processarDocumento(admin: any, docId: string): Promise<{ status: string; erro?: string }> {
  const { data: atual } = await admin.from('contas_pagar_telegram_docs').select('*').eq('id', docId).maybeSingle();
  if (!atual) return { status: 'erro', erro: 'Documento não encontrado' };
  if (['criado', 'vinculado', 'duplicado', 'processando'].includes(atual.status)) return { status: atual.status };

  const { data: doc } = await admin.from('contas_pagar_telegram_docs')
    .update({ status: 'processando', tentativas: (atual.tentativas ?? 0) + 1, erro: null })
    .eq('id', docId).eq('status', atual.status).select('*').maybeSingle();
  if (!doc) return { status: 'processando' };

  const fim = async (status: string, patch: Record<string, unknown> = {}) => {
    await admin.from('contas_pagar_telegram_docs').update({ status, ...patch }).eq('id', docId);
    return { status, erro: patch.erro as string | undefined };
  };

  try {
    // 1. Arquivo guardado no armazenamento privado
    let bytes: Uint8Array | null = null;
    if (!doc.storage_path) {
      bytes = await baixarArquivo(doc.file_id);
      const path = `${doc.unidade_id ?? 'telegram'}/documentos/${Date.now()}_tg_${nomeSeguro(doc.file_name ?? 'documento')}`;
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: doc.mime_type, upsert: false });
      if (error) throw new Error(`upload: ${error.message}`);
      doc.storage_path = path;
      await admin.from('contas_pagar_telegram_docs').update({ storage_path: path }).eq('id', docId);
    }

    // 2. Leitura por IA (reaproveita leitura anterior no reprocessamento)
    let dados = doc.dados;
    if (!dados) {
      if (!bytes) {
        const { data: blob, error } = await admin.storage.from(BUCKET).download(doc.storage_path);
        if (error || !blob) throw new Error('não foi possível abrir o arquivo guardado');
        bytes = new Uint8Array(await blob.arrayBuffer());
      }
      const ehXml = doc.mime_type === 'application/xml';
      const r = await extrairDocumentoConta(ehXml
        ? { mimeType: doc.mime_type, xmlText: new TextDecoder().decode(bytes) }
        : { base64: toBase64(bytes), mimeType: doc.mime_type, fileName: doc.file_name });
      if (!r.ok) {
        await responder(admin, doc.telegram_chat_id, doc.telegram_message_id,
          'Não consegui ler este documento. Ele ficou guardado em Contas a Pagar → Telegram para cadastro manual ou nova tentativa.');
        return await fim('erro', { erro: r.error });
      }
      dados = r.dados;
      if (dados.categoria && !CATEGORIAS.includes(dados.categoria)) dados.categoria = 'Outros';
      await admin.from('contas_pagar_telegram_docs').update({ dados }).eq('id', docId);
    }

    // 3. Unidade
    const unidades = await unidadesAtivas(admin);
    let unidadeId: string | null = doc.unidade_id;
    if (!unidadeId) {
      const ident = identificarUnidade(dados, unidades);
      if (ident) {
        unidadeId = ident.unidade_id;
        await admin.from('contas_pagar_telegram_docs').update({ unidade_id: unidadeId, unidade_metodo: ident.metodo }).eq('id', docId);
      }
    }
    if (!unidadeId) {
      const teclado = { inline_keyboard: unidades.map((u, i) => [{ text: u.nome, callback_data: `cpu:${docId}:${i}` }]) };
      const promptId = await responder(admin, doc.telegram_chat_id, doc.telegram_message_id, msgConfirmarUnidade(dados), teclado);
      return await fim('aguardando_unidade', { prompt_message_id: promptId });
    }
    const unidade = unidades.find((u) => u.id === unidadeId);
    const unidadeNome = unidade?.nome ?? '';
    const path = await moverParaUnidade(admin, doc, unidadeId);

    // Comprovante de pagamento: anexa à conta correspondente e dá baixa. Nunca cria conta nova.
    if (ehComprovante(dados)) {
      return await processarComprovante(admin, doc, dados, unidadeId, path);
    }


    // 4. Duplicidade / vínculo com lançamento existente
    const { data: contas } = await admin.from('contas_pagar')
      .select('id, valor, data_vencimento, linha_digitavel, codigo_barras, chave_nfe, numero_fatura, fornecedor_documento, status, documentos_fiscais, documento_url, conferencia_status, aprovado_em')
      .eq('unidade_id', unidadeId).is('deleted_at', null).neq('status', 'cancelada')
      .order('created_at', { ascending: false }).limit(500);
    const corr = acharCorrespondencia(dados, contas ?? []);

    if (corr) {
      const c: any = corr.conta;
      const docs: string[] = c.documentos_fiscais?.length ? c.documentos_fiscais : (c.documento_url ? [c.documento_url] : []);
      if (corr.tipo === 'duplicado') {
        await responder(admin, doc.telegram_chat_id, doc.telegram_message_id, msgDuplicado(false));
        await admin.storage.from(BUCKET).remove([path]);
        return await fim('duplicado', { conta_id: c.id, storage_path: null, resultado: 'Documento já existente no lançamento' });
      }
      const patch: Record<string, unknown> = { documentos_fiscais: [...docs, path], documento_url: docs[0] ?? path };
      if (!c.linha_digitavel && dados.linha_digitavel) patch.linha_digitavel = dados.linha_digitavel;
      if (!c.codigo_barras && dados.codigo_barras) patch.codigo_barras = dados.codigo_barras;
      if (!c.chave_nfe && dados.chave_nfe) patch.chave_nfe = soDigitos(dados.chave_nfe);
      if (!c.numero_fatura && dados.numero_documento) patch.numero_fatura = dados.numero_documento;
      if (c.status !== 'paga' && !c.aprovado_em && dados.data_vencimento && dados.data_vencimento !== c.data_vencimento && (dados.linha_digitavel || dados.codigo_barras)) {
        patch.data_vencimento = dados.data_vencimento;
      }
      if (corr.divergente && c.status !== 'paga') patch.conferencia_status = 'pendente_conferencia';
      await admin.from('contas_pagar').update(patch).eq('id', c.id);
      await historico(admin, c.id, 'telegram', `Documento "${doc.file_name}" vinculado pelo Telegram (enviado por ${doc.remetente})` +
        (corr.divergente ? ' — valores divergentes, conferir' : ''));
      await responder(admin, doc.telegram_chat_id, doc.telegram_message_id,
        msgDuplicado(true) + (corr.divergente ? '\n\n⚠️ Há diferença de valor entre os documentos: o lançamento voltou para conferência.' : ''));
      return await fim(corr.divergente ? 'conferencia_manual' : 'vinculado', { conta_id: c.id, resultado: 'Anexado a lançamento existente' });
    }

    // 4b. Nota parada aguardando o boleto da mesma cobrança
    const fornDig = soDigitos(dados.cpf_cnpj);
    let notaParada: any = null;
    if (dados.data_vencimento && fornDig) {
      const { data: parados } = await admin.from('contas_pagar_telegram_docs').select('id, dados, storage_path, file_name')
        .eq('status', 'aguardando_vencimento').eq('unidade_id', unidadeId);
      notaParada = (parados ?? []).find((p: any) => soDigitos(p.dados?.cpf_cnpj) === fornDig &&
        (p.dados?.valor == null || dados.valor == null || Math.abs(p.dados.valor - dados.valor) <= 0.01));
    }

    // 5. Nota sem vencimento: não presume data; espera o boleto
    const parcelas = (Array.isArray(dados.parcelas) ? dados.parcelas : []).filter((p: any) => p?.vencimento && p?.valor != null);
    if (!dados.data_vencimento && parcelas.length === 0) {
      await responder(admin, doc.telegram_chat_id, doc.telegram_message_id, msgAguardandoVencimento(dados, unidadeNome));
      return await fim('aguardando_vencimento', { resultado: 'Nota sem vencimento' });
    }

    // 6. Novo lançamento (pendente de conferência)
    const base = notaParada ? { ...notaParada.dados, ...Object.fromEntries(Object.entries(dados).filter(([, v]) => v != null && v !== '')) } : dados;
    const nomeForn = String(base.fornecedor ?? '').trim().toUpperCase();
    // Fornecedor: busca por CNPJ/CPF (depois nome); cria só com documento válido, nunca inventa dados.
    const forn = await garantirFornecedor(admin, { fornecedor: nomeForn, fornecedor_documento: base.cpf_cnpj });
    const fornecedorId = 'erro' in forn ? null : forn.id;
    const fornCadastrado = !!fornecedorId;
    const fornMsg = 'erro' in forn ? `Fornecedor não identificado: ${forn.erro.replace(' em EDITAR', ' pelo botão EDITAR')}`
      : forn.criado ? 'Fornecedor cadastrado automaticamente.' : 'Fornecedor identificado no cadastro.';
    const anexos = notaParada?.storage_path ? [notaParada.storage_path, path] : [path];
    const linhas = parcelas.length > 1 ? parcelas : [{ numero: 1, valor: base.valor, vencimento: base.data_vencimento ?? parcelas[0]?.vencimento }];

    const criadas: string[] = [];
    for (let i = 0; i < linhas.length; i++) {
      const p = linhas[i];
      const descricao = String(base.descricao || base.fornecedor || 'DOCUMENTO RECEBIDO PELO TELEGRAM').toUpperCase() +
        (linhas.length > 1 ? ` (${i + 1}/${linhas.length})` : '');
      const { data: nova, error } = await admin.from('contas_pagar').insert({
        unidade_id: unidadeId,
        descricao,
        fornecedor: nomeForn || null,
        fornecedor_documento: base.cpf_cnpj ?? null,
        fornecedor_validar: !fornCadastrado,
        fornecedor_id: fornecedorId,
        categoria: base.categoria ?? 'Outros',
        prioridade: 'normal',
        competencia: base.competencia ?? null,
        valor: Number(p.valor ?? 0),
        data_vencimento: p.vencimento,
        data_emissao: base.data_emissao ?? null,
        forma_pagamento: base.linha_digitavel || base.codigo_barras ? 'boleto' : base.codigo_pix || base.chave_pix ? 'pix' : null,
        numero_fatura: base.numero_documento ?? null,
        chave_nfe: base.chave_nfe ? soDigitos(base.chave_nfe) : null,
        pagador_cnpj: base.pagador_cnpj ?? null,
        linha_digitavel: base.linha_digitavel ?? null,
        codigo_barras: base.codigo_barras ?? null,
        codigo_pix: base.codigo_pix ?? null,
        chave_pix: base.chave_pix ?? null,
        documentos_fiscais: anexos,
        documento_url: anexos[0],
        status: 'pendente',
        conferencia_status: 'pendente_conferencia',
        origem: 'telegram',
        telegram_remetente: doc.remetente,
        recebido_em: doc.recebido_em,
        created_by_nome: 'TELEGRAM',
        import_key: `tg:${doc.telegram_chat_id}:${doc.telegram_message_id}:${i + 1}`,
      }).select('id').maybeSingle();
      if (error) {
        // Reprocessamento: a chave única evita lançamento repetido
        if (String(error.code) === '23505') {
          const { data: ja } = await admin.from('contas_pagar').select('id').eq('unidade_id', unidadeId)
            .eq('import_key', `tg:${doc.telegram_chat_id}:${doc.telegram_message_id}:${i + 1}`).maybeSingle();
          if (ja) criadas.push(ja.id);
          continue;
        }
        throw new Error(`cadastro: ${error.message}`);
      }
      criadas.push(nova.id);
      await historico(admin, nova.id, 'telegram', `Lançamento criado a partir do Telegram (enviado por ${doc.remetente})`);
    }

    if (notaParada) {
      await admin.from('contas_pagar_telegram_docs').update({ status: 'vinculado', conta_id: criadas[0], resultado: 'Nota vinculada ao boleto' }).eq('id', notaParada.id);
    }

    const extra = [
      linhas.length > 1 ? `${linhas.length} parcelas cadastradas.` : '',
      fornMsg,
      notaParada ? 'Nota fiscal enviada antes foi vinculada a este boleto.' : '',
    ].filter(Boolean).join('\n');
    await responder(admin, doc.telegram_chat_id, doc.telegram_message_id,
      msgProcessado({ ...base, data_vencimento: linhas[0].vencimento }, unidadeNome, extra) +
        (criadas.length > 1 ? '\n\nVárias parcelas: confira e aprove cada uma em Contas a Pagar.' : ''),
      criadas.length === 1 ? tecladoConferencia(criadas[0]) : undefined);
    return await fim('criado', { conta_id: criadas[0] ?? null, resultado: `${criadas.length} lançamento(s)` });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error('contas-pagar telegram erro', docId, erro);
    return await fim('erro', { erro: erro.slice(0, 500) });
  }
}

// ===== Comprovante de pagamento: anexa à conta em aberto e dá baixa =====

function hojeBRT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function agoraBR(): string {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).slice(0, 17);
}

async function processarComprovante(admin: any, doc: any, dados: any, unidadeId: string, path: string) {
  const fim = async (status: string, patch: Record<string, unknown> = {}) => {
    await admin.from('contas_pagar_telegram_docs').update({ status, ...patch }).eq('id', doc.id);
    return { status, erro: patch.erro as string | undefined };
  };
  try {
    if (!dados.valor || !dados.fornecedor) {
      await responder(admin, doc.telegram_chat_id, doc.telegram_message_id, msgComprovanteSemDados());
      return await fim('sem_dados', { resultado: 'Comprovante sem fornecedor/valor legível' });
    }

    const { data: contas, error: qErr } = await admin.from('contas_pagar')
      .select('id, valor, fornecedor, fornecedor_documento, descricao, data_vencimento, status, comprovante_url, conferencia_status, forma_pagamento, aprovado_em')
      .eq('unidade_id', unidadeId).is('deleted_at', null).neq('status', 'cancelada')
      .order('created_at', { ascending: false }).limit(500);
    if (qErr) throw new Error(qErr.message);

    // Conta já escolhida por botão
    const escolhida = dados.__escolhida;
    if (escolhida) {
      const c = (contas ?? []).find((x: any) => x.id === escolhida);
      if (c) return await baixarComprovante(admin, doc, c, dados, path);
    }

    const r = acharContaComprovante(dados, contas ?? []);
    if (r.tipo === 'unica') return await baixarComprovante(admin, doc, r.conta, dados, path);
    if (r.tipo === 'candidatas') {
      const lista = r.candidatas.slice(0, 4);
      dados.__candidatas = lista.map((x) => x.conta.id);
      await admin.from('contas_pagar_telegram_docs').update({ dados }).eq('id', doc.id);
      const teclado = {
        inline_keyboard: lista.map((x, i) => [{
          text: `${String(x.conta.fornecedor || x.conta.descricao || 'conta').slice(0, 24)} — R$ ${Number(x.conta.valor).toFixed(2)}`.slice(0, 60),
          callback_data: `cpv:${doc.id}:${i}`,
        }]),
      };
      await responder(admin, doc.telegram_chat_id, doc.telegram_message_id, msgComprovanteEscolha(lista, dados), teclado);
      return await fim('aguardando_botao', { resultado: 'Aguardando escolha da conta' });
    }
    await responder(admin, doc.telegram_chat_id, doc.telegram_message_id, msgComprovanteSemConta(dados));
    return await fim('sem_correspondencia', { resultado: 'Nenhuma conta em aberto correspondente' });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error('comprovante telegram erro', doc.id, erro);
    return await fim('erro', { erro: erro.slice(0, 500) });
  }
}

async function baixarComprovante(admin: any, doc: any, conta: any, dados: any, path: string) {
  const fim = async (status: string, patch: Record<string, unknown> = {}) => {
    await admin.from('contas_pagar_telegram_docs').update({ status, ...patch }).eq('id', doc.id);
    return { status };
  };
  const chatId = doc.telegram_chat_id;
  const msgId = doc.telegram_message_id;
  const user = await autorizar(admin, { id: doc.telegram_user_id });

  if (user) {
    const patch: Record<string, unknown> = {
      comprovante_url: path,
      status: 'paga',
      valor_pago: dados.valor ?? conta.valor,
      data_pagamento: dados.data_emissao ?? hojeBRT(),
      forma_pagamento_baixa: conta.forma_pagamento ?? 'outro',
      baixado_por: user.userId,
      baixado_por_nome: user.nome,
      baixado_em: new Date().toISOString(),
      baixa_origem: 'telegram_comprovante',
      baixa_observacoes: `Comprovante anexado via Telegram por ${doc.remetente}.`,
    };
    if (conta.conferencia_status === 'pendente_conferencia') {
      patch.conferencia_status = 'conferida';
      patch.conferido_por_nome = user.nome;
      patch.conferido_em = new Date().toISOString();
    }
    // Guarda .eq('status','pendente'): conta paga concorrentemente não é baixada duas vezes
    const { data: okRow, error } = await admin.from('contas_pagar')
      .update(patch).eq('id', conta.id).eq('status', 'pendente').select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (okRow) {
      await admin.from('contas_pagar_historico').insert({
        conta_id: conta.id, acao: 'baixa', campo: 'status',
        valor_anterior: 'pendente', valor_novo: 'paga (comprovante via Telegram)',
        user_id: user.userId, user_nome: user.nome,
      });
      await admin.from('contas_pagar_telegram_docs').update({ conta_id: conta.id }).eq('id', doc.id);
      let extra = '';
      try {
        const conc = await conciliarConta(admin, conta.id, { notificar: false });
        if (conc?.status === 'conciliado') extra = '\n\n✅ Débito identificado no extrato bancário: conciliação automática concluída.';
        else if (conc?.status === 'divergencia' || conc?.status === 'ambiguo') {
          extra = '\n\n⚠️ Encontrei diferença entre o comprovante e o extrato bancário. Confira em Contas a Pagar → detalhes da conta.';
        }
      } catch (e) { console.error('conciliacao pos-comprovante', e); }
      await responder(chatId, msgId, msgComprovanteProcessado(conta, dados, user.nome, agoraBR()) + extra);
      return await fim('baixado', { conta_id: conta.id, resultado: 'Baixa com comprovante via Telegram' });
    }
    // Concorrente: já estava paga → anexa e avisa
    const { data: atual } = await admin.from('contas_pagar').select('id, status').eq('id', conta.id).maybeSingle();
    if (atual?.status === 'paga') {
      await admin.from('contas_pagar').update({ comprovante_url: path }).eq('id', conta.id).eq('status', 'paga');
      await responder(chatId, msgId, msgComprovanteJaPaga(conta));
      return await fim('vinculado', { conta_id: conta.id, resultado: 'Conta já paga; comprovante anexado' });
    }
    await responder(chatId, msgId, msgComprovanteSemConta(dados));
    return await fim('sem_correspondencia');
  }

  // Remetente sem vínculo autorizado: anexa o comprovante, mas NÃO dá baixa
  const patch: Record<string, unknown> = { comprovante_url: path };
  await admin.from('contas_pagar').update(patch).eq('id', conta.id);
  await admin.from('contas_pagar_historico').insert({
    conta_id: conta.id, acao: 'comprovante_telegram',
    valor_novo: `Comprovante "${doc.file_name}" anexado via Telegram por ${doc.remetente} — baixa pendente`,
    user_nome: doc.remetente,
  });
  await responder(chatId, msgId, msgComprovanteSemPermissao(conta));
  return await fim('anexado', { conta_id: conta.id, resultado: 'Comprovante anexado sem baixa (remetente sem permissão)' });
}

/** Botão de escolha do comprovante (callback_data = cpv:<docId>:<índice>). */
async function receberBotaoComprovante(admin: any, cq: any): Promise<boolean> {
  const [, docId, idxStr] = cq.data.split(':');
  const chatId = Number(cq.message?.chat?.id);
  const grupos = await grupoContasPagarChatIds(admin);
  if (!grupos.includes(chatId)) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id });
    return true;
  }
  const { data: doc } = await admin.from('contas_pagar_telegram_docs').select('*').eq('id', docId).maybeSingle();
  const candidatas: string[] = doc?.dados?.__candidatas ?? [];
  const contaId = candidatas[Number(idxStr)];
  if (!doc || doc.status !== 'aguardando_botao' || !contaId) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Este comprovante já foi processado.' });
    return true;
  }
  const user = await autorizar(admin, cq.from);
  if (!user) {
    await telegramApi('answerCallbackQuery', {
      callback_query_id: cq.id, show_alert: true,
      text: 'Você não está vinculado ao CRM com acesso financeiro. Alguém autorizado deve dar a baixa.',
    });
    return true;
  }
  // Reserva: só um clique continua
  const { data: reservado } = await admin.from('contas_pagar_telegram_docs')
    .update({ status: 'processando' }).eq('id', docId).eq('status', 'aguardando_botao').select('id').maybeSingle();
  if (!reservado) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Já processado.' });
    return true;
  }
  await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
  const dados = { ...doc.dados, __escolhida: contaId };
  delete dados.__candidatas;
  await admin.from('contas_pagar_telegram_docs').update({ dados, conta_id: contaId }).eq('id', docId);
  await processarComprovante(admin, doc, dados, doc.unidade_id, doc.storage_path);
  return true;
}

