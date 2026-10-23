// Assistente financeiro do grupo "Contas a Pagar" no Telegram.
// A IA só transforma a pergunta em filtros estruturados; os cálculos são feitos aqui,
// somente leitura, sobre a tabela oficial contas_pagar. Nenhum SQL é gerado pela IA.
import { telegramApi } from './telegram.ts';
import { autorizar, tecladoCobranca } from './contasPagarBotoes.ts';
import { formatarDataBR, formatarValorBR } from './contasPagarMensagem.ts';
import { classificar, dataEfetiva, hojeRecife, intervalo, Periodo, saldoPendente, valorPago } from './contasPagarPeriodos.ts';

type Intencao = 'abertas' | 'pagas' | 'resumo' | 'vencidas' | 'nao_conciliadas' | 'divergencias' | 'pago_banco' | 'resumo_conciliacao' | 'fora_escopo';
interface Filtros {
  intencao: Intencao; periodo: Periodo; data_inicio: string | null; data_fim: string | null;
  unidade: string | null; fornecedor: string | null; detalhar: boolean;
}

const MAX_BOTOES = 8;
const LINHA = '━━━━━━━━━━━━━━';

const schema = {
  type: 'object', additionalProperties: false,
  required: ['intencao', 'periodo', 'data_inicio', 'data_fim', 'unidade', 'fornecedor', 'detalhar'],
  properties: {
    intencao: { type: 'string', enum: ['abertas', 'pagas', 'resumo', 'vencidas', 'nao_conciliadas', 'divergencias', 'pago_banco', 'resumo_conciliacao', 'fora_escopo'] },
    periodo: { type: 'string', enum: ['hoje', 'semana_atual', 'semana_passada', 'mes_atual', 'mes_passado', 'proximos_7_dias', 'ate_domingo', 'personalizado', 'nenhum'] },
    data_inicio: { type: ['string', 'null'], description: 'yyyy-mm-dd, só para personalizado' },
    data_fim: { type: ['string', 'null'], description: 'yyyy-mm-dd, só para personalizado' },
    unidade: { type: ['string', 'null'], description: 'Nome da unidade citada (BOA VIAGEM, MADALENA, SETÚBAL, SANTA CRUZ) ou null para todas' },
    fornecedor: { type: ['string', 'null'] },
    detalhar: { type: 'boolean', description: 'true quando pede a lista ("quais", "mostra", "fornecedores"); false para só totais ("quanto")' },
  },
};

async function interpretar(pergunta: string, hoje: string, anterior: Filtros | null): Promise<Filtros | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  const prompt = `Você converte perguntas financeiras em português sobre CONTAS A PAGAR da EVO Club em filtros JSON.
Hoje é ${hoje} (fuso America/Recife). Semana = segunda a domingo.
Intenções: abertas (contas não pagas/quanto falta pagar), pagas (pagamentos feitos/quanto pagamos), resumo (resumo financeiro, total de despesas), vencidas (atrasadas/pendentes de períodos anteriores, ex. "pendentes da semana passada"), nao_conciliadas (pagas mas sem transação bancária / não conciliadas), divergencias (divergências de conciliação), pago_banco (quanto pagamos segundo o banco), resumo_conciliacao (resumo de conciliação), fora_escopo (não é sobre contas a pagar).
"Quanto falta pagar até o final do mês" = abertas, personalizado de hoje até o último dia do mês.
"Pendentes da semana passada" = abertas, semana_passada.
Se a pergunta for complementar ("e na semana passada?", "quais foram?", "e o total de todas as unidades?", "mostra os fornecedores"), herde os filtros anteriores e mude só o que foi pedido. "todas as unidades" => unidade null.
Filtros anteriores: ${anterior ? JSON.stringify(anterior) : 'nenhum'}.`;
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra', store: false, reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'filtros_financeiros', strict: true, schema } },
      input: [{ role: 'system', content: prompt }, { role: 'user', content: pergunta.slice(0, 1000) }],
    }),
  });
  if (!resp.ok) { console.error('[assistente] AI', resp.status, (await resp.text()).slice(0, 300)); throw new Error(`ai_${resp.status}`); }
  const j = await resp.json();
  const txt = j.output_text ?? j.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === 'output_text')?.text;
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/^EVO\s+/, '').trim();

async function unidadesPermitidas(admin: any, userId: string): Promise<{ id: string; nome: string }[]> {
  const { data: todas } = await admin.from('unidades').select('id, nome').order('nome');
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (isAdmin) return todas ?? [];
  const { data: ids } = await admin.rpc('get_user_unidades', { _user_id: userId });
  const set = new Set((ids ?? []).map((x: any) => (typeof x === 'string' ? x : x.get_user_unidades ?? Object.values(x)[0])));
  return (todas ?? []).filter((u: any) => set.has(u.id));
}

async function enviar(chatId: number, replyTo: number | null, text: string, reply_markup?: unknown) {
  // Divide em blocos de até ~3800 caracteres (limite do Telegram: 4096).
  const blocos: string[] = [];
  let atual = '';
  for (const linha of text.split('\n')) {
    if ((atual + '\n' + linha).length > 3800) { blocos.push(atual); atual = linha; } else atual = atual ? `${atual}\n${linha}` : linha;
  }
  if (atual) blocos.push(atual);
  for (let i = 0; i < blocos.length; i++) {
    await telegramApi('sendMessage', {
      chat_id: chatId, text: blocos[i],
      ...(i === 0 && replyTo ? { reply_to_message_id: replyTo, allow_sending_without_reply: true } : {}),
      ...(i === blocos.length - 1 && reply_markup ? { reply_markup } : {}),
    });
  }
}

const curto = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const nomeConta = (c: any) => String(c.fornecedor || c.descricao || '').toUpperCase();

export function montarResposta(f: Filtros, contas: any[], unidades: { id: string; nome: string }[], hoje: string) {
  const { inicio, fim, rotulo } = intervalo(f.periodo, hoje, f.data_inicio, f.data_fim);
  const forn = f.fornecedor ? norm(f.fornecedor) : null;
  const filtradas = forn ? contas.filter((c) => norm(`${c.fornecedor ?? ''} ${c.descricao ?? ''}`).includes(forn)) : contas;
  const porUnidade = unidades.map((u) => ({ u, ...classificar(filtradas.filter((c) => c.unidade_id === u.id), inicio, fim) }));
  const soma = (arr: any[], fn: (c: any) => number) => arr.reduce((s, c) => s + fn(c), 0);
  const nomeU = (n: string) => n.toUpperCase().startsWith('EVO') ? n.toUpperCase() : `EVO ${n.toUpperCase()}`;
  const curtoU = (n: string) => norm(n).toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());
  const out: string[] = [];
  const pendentesBotao: any[] = [];
  const intencao = f.intencao === 'vencidas' ? 'vencidas' : f.intencao;

  if (['nao_conciliadas', 'divergencias', 'pago_banco', 'resumo_conciliacao'].includes(intencao)) {
    const titulos: Record<string, string> = {
      nao_conciliadas: 'PAGAS SEM TRANSAÇÃO BANCÁRIA', divergencias: 'DIVERGÊNCIAS DE CONCILIAÇÃO',
      pago_banco: 'PAGO SEGUNDO O BANCO', resumo_conciliacao: 'RESUMO DE CONCILIAÇÃO',
    };
    out.push(`${titulos[intencao]} | ${rotulo}`, '');
    let tot = 0, qtd = 0, totPend = 0, qtdPend = 0;
    for (const x of porUnidade) {
      const conc = x.pagas.filter((c: any) => c.conciliacao_status === 'conciliado');
      const div = x.pagas.filter((c: any) => c.conciliacao_status === 'divergencia');
      const sem = x.pagas.filter((c: any) => c.conciliacao_status !== 'conciliado' && c.conciliacao_status !== 'divergencia');
      const debito = (c: any) => Number(c.valor_debitado ?? valorPago(c));
      if (intencao === 'resumo_conciliacao') {
        if (!x.pagas.length) continue;
        out.push(`🏢 ${curtoU(x.u.nome)}`, `   Conciliadas: ${conc.length} — ${formatarValorBR(soma(conc, debito))}`,
          `   Aguardando transação: ${sem.length} — ${formatarValorBR(soma(sem, valorPago))}`,
          `   Divergências: ${div.length} — ${formatarValorBR(soma(div, valorPago))}`);
        tot += soma(conc, debito); qtd += conc.length; totPend += soma([...sem, ...div], valorPago); qtdPend += sem.length + div.length;
        continue;
      }
      if (intencao === 'pago_banco') {
        if (!x.pagas.length) continue;
        out.push(`🏦 ${curtoU(x.u.nome)}: ${formatarValorBR(soma(conc, debito))} (${conc.length} conciliadas)` +
          (sem.length + div.length ? ` + ${sem.length + div.length} sem confirmação bancária (${formatarValorBR(soma([...sem, ...div], valorPago))})` : ''));
        tot += soma(conc, debito); qtd += conc.length; totPend += soma([...sem, ...div], valorPago); qtdPend += sem.length + div.length;
        continue;
      }
      const lista = intencao === 'divergencias' ? div : [...sem, ...div];
      if (!lista.length) continue;
      out.push(`🟡 ${nomeU(x.u.nome)}`, LINHA);
      lista.forEach((c: any, i: number) => out.push(`${i + 1}. ${nomeConta(c)} — ${formatarValorBR(valorPago(c))} (pago ${curto(c.data_pagamento)})${c.conciliacao_status === 'divergencia' ? ' ⚠️ divergência' : ''}`));
      out.push(`Subtotal ${curtoU(x.u.nome)}: ${formatarValorBR(soma(lista, valorPago))} (${lista.length})`, '');
      tot += soma(lista, valorPago); qtd += lista.length;
    }
    out.push(LINHA);
    if (intencao === 'pago_banco' || intencao === 'resumo_conciliacao') {
      out.push(`TOTAL CONFIRMADO NO BANCO: ${formatarValorBR(tot)} (${qtd})`, `TOTAL AINDA SEM CONCILIAÇÃO: ${formatarValorBR(totPend)} (${qtdPend})`);
    } else out.push(qtd ? `TOTAL EVO: ${formatarValorBR(tot)} (${qtd})` : 'Nada pendente de conciliação no período. ✅');
    return { texto: out.join('\n'), pendentesBotao };
  }

  if (intencao === 'resumo') {
    out.push(`RESUMO FINANCEIRO | ${rotulo}`, '');
    let tp = 0, ta = 0, tv = 0, np = 0, na = 0;
    for (const x of porUnidade) {
      const p = soma(x.pagas, valorPago), a = soma(x.abertas, saldoPendente), v = soma(x.vencidasAnteriores, saldoPendente);
      tp += p; ta += a; tv += v; np += x.pagas.length; na += x.abertas.length;
      out.push(`🏢 ${curtoU(x.u.nome)}`, `   Pago: ${formatarValorBR(p)} (${x.pagas.length})`, `   Em aberto: ${formatarValorBR(a)} (${x.abertas.length})`);
      if (v > 0) out.push(`   Vencido anterior: ${formatarValorBR(v)} (${x.vencidasAnteriores.length})`);
    }
    out.push(LINHA, `TOTAL EVO`, `   Pago no período: ${formatarValorBR(tp)}`, `   Em aberto com vencimento no período: ${formatarValorBR(ta)}`,
      `   Vencido e não pago de períodos anteriores: ${formatarValorBR(tv)}`, `   Contas pagas: ${np}`, `   Contas pendentes: ${na}`);
    return { texto: out.join('\n'), pendentesBotao };
  }

  const pagas = intencao === 'pagas';
  const titulo = pagas ? `PAGAMENTOS | ${rotulo}` : intencao === 'vencidas' ? `CONTAS VENCIDAS ANTES DE ${formatarDataBR(inicio)}` : `CONTAS ABERTAS | ${rotulo}`;
  out.push(titulo + (forn ? ` | ${f.fornecedor!.toUpperCase()}` : ''), '');
  let total = 0, qtd = 0;
  for (const x of porUnidade) {
    const lista = pagas ? x.pagas : intencao === 'vencidas' ? x.vencidasAnteriores : x.abertas;
    if (!lista.length) continue;
    const ordenada = [...lista].sort((a, b) => (pagas ? String(a.data_pagamento).localeCompare(String(b.data_pagamento)) : dataEfetiva(a).localeCompare(dataEfetiva(b))));
    const sub = soma(ordenada, pagas ? valorPago : saldoPendente);
    total += sub; qtd += ordenada.length;
    out.push(`${pagas ? '🟢' : '🔴'} ${nomeU(x.u.nome)}`, LINHA);
    if (f.detalhar) {
      ordenada.forEach((c, i) => {
        if (pagas) out.push(`${i + 1}. ${nomeConta(c)} — ${formatarValorBR(valorPago(c))} (pago ${curto(c.data_pagamento)})`);
        else {
          out.push(`${i + 1}. ${nomeConta(c)}`, `    Vencimento: ${curto(c.data_vencimento)}`);
          if (c.data_pagamento_prevista) out.push(`    Pagamento previsto: ${curto(c.data_pagamento_prevista)} (reagendado)`);
          out.push(`    Valor: ${formatarValorBR(saldoPendente(c))}`, `    Status: ${dataEfetiva(c) < hoje ? 'Vencida' : 'Pendente'}`);
          pendentesBotao.push({ ...c, _unidade: x.u.nome });
        }
      });
      out.push('');
    }
    out.push(`${pagas ? 'Total pago' : 'Total aberto'} ${curtoU(x.u.nome)}: ${formatarValorBR(sub)} (${ordenada.length} ${ordenada.length === 1 ? 'conta' : 'contas'})`, '');
  }
  if (qtd === 0) out.push(pagas ? 'Nenhum pagamento encontrado no período.' : 'Nenhuma conta em aberto no período. ✅');
  else out.push(LINHA, `${pagas ? 'TOTAL PAGO' : 'TOTAL ABERTO'}${unidades.length > 1 ? ' NA REDE' : ''}: ${formatarValorBR(total)} (${qtd} ${qtd === 1 ? 'conta' : 'contas'})`);
  return { texto: out.join('\n').trim(), pendentesBotao };
}

const GATILHO = /\b(concilia\w*|banco|extrato|diverg\w*|conta|contas|pag|pago|pagos|pagamos|pagou|pagar|aberta|abertas|vence|vencem|vencid|pendente|resumo|financeiro|despesa|fornecedor|quanto|quais|total|semana|m[eê]s|hoje)\b/i;

/** Mensagem de texto no grupo de Contas a Pagar. Retorna true se tratou. */
export async function receberPerguntaFinanceira(admin: any, update: any): Promise<boolean> {
  const msg = update.message;
  const texto: string = (msg?.text ?? '').trim();
  const chatId = Number(msg?.chat?.id);
  if (!texto || texto.startsWith('/start') || !chatId || msg?.from?.is_bot) return false;
  const { data: grupos } = await admin.from('telegram_groups').select('telegram_chat_id')
    .eq('group_type', 'contas_pagar').eq('status', 'conectado');
  if (!(grupos ?? []).some((g: any) => Number(g.telegram_chat_id) === chatId)) return false;

  const me = await telegramApi('getMe', {});
  const botUsername: string | undefined = me.result?.username;
  const mencionou = botUsername ? texto.toLowerCase().includes(`@${botUsername.toLowerCase()}`) : false;
  const respondeuBot = !!msg.reply_to_message?.from?.is_bot;
  if (!mencionou && !respondeuBot && !GATILHO.test(texto)) return true;

  // Idempotência: o Telegram reenvia o update se o webhook demorar.
  const { data: reg, error: regErr } = await admin.from('contas_pagar_assistente_consultas').insert({
    telegram_chat_id: chatId, telegram_message_id: msg.message_id, telegram_user_id: msg.from.id, pergunta: texto.slice(0, 2000),
  }).select('id').maybeSingle();
  if (regErr || !reg) return true;

  const user = await autorizar(admin, msg.from);
  if (!user) {
    await admin.from('contas_pagar_assistente_consultas').update({ status: 'negada' }).eq('id', reg.id);
    await enviar(chatId, msg.message_id, 'Você não tem permissão para consultar o financeiro. Vincule seu Telegram ao CRM com acesso ao Contas a Pagar.');
    return true;
  }

  try {
    const hoje = hojeRecife();
    const { data: ant } = await admin.from('contas_pagar_assistente_consultas').select('filtros')
      .eq('telegram_chat_id', chatId).eq('telegram_user_id', msg.from.id).eq('status', 'respondida')
      .gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const pergunta = botUsername ? texto.replace(new RegExp(`@${botUsername}`, 'ig'), '').trim() : texto;
    const f = await interpretar(pergunta, hoje, (ant?.filtros as Filtros) ?? null);
    if (!f || f.intencao === 'fora_escopo') {
      await admin.from('contas_pagar_assistente_consultas').update({ status: 'fora_escopo', filtros: f }).eq('id', reg.id);
      if (mencionou || respondeuBot || texto.includes('?')) {
        await enviar(chatId, msg.message_id, 'Posso responder sobre contas a pagar. Ex.: "Quais contas estão abertas esta semana?", "Quanto pagamos hoje?", "Resumo financeiro do mês".');
      }
      return true;
    }

    let unidades = await unidadesPermitidas(admin, user.userId);
    if (f.unidade) {
      const alvo = norm(f.unidade);
      const achadas = unidades.filter((u) => norm(u.nome).includes(alvo) || alvo.includes(norm(u.nome)));
      if (!achadas.length) {
        await admin.from('contas_pagar_assistente_consultas').update({ status: 'respondida', filtros: f }).eq('id', reg.id);
        await enviar(chatId, msg.message_id, `Não encontrei a unidade "${f.unidade}" entre as unidades que você pode consultar.`);
        return true;
      }
      unidades = achadas;
    }
    if (!unidades.length) {
      await enviar(chatId, msg.message_id, 'Nenhuma unidade liberada para o seu usuário.');
      return true;
    }

    const { inicio, fim } = intervalo(f.periodo, hoje, f.data_inicio, f.data_fim);
    // Busca só leitura; janela cobre pagos no período e pendentes até o fim (inclui vencidos anteriores).
    const campos = 'id, unidade_id, descricao, fornecedor, valor, valor_pago, status, data_vencimento, data_pagamento_prevista, data_pagamento, forma_pagamento, linha_digitavel, codigo_barras, codigo_pix, chave_pix, conciliacao_status, valor_debitado';
    const ids = unidades.map((u) => u.id);
    const [pend, pagas] = await Promise.all([
      admin.from('contas_pagar').select(campos).in('unidade_id', ids).eq('status', 'pendente').is('deleted_at', null).limit(3000),
      admin.from('contas_pagar').select(campos).in('unidade_id', ids).eq('status', 'paga').is('deleted_at', null)
        .gte('data_pagamento', inicio).lte('data_pagamento', fim).limit(3000),
    ]);
    if (pend.error || pagas.error) throw pend.error ?? pagas.error;
    const contas = [...(pend.data ?? []), ...(pagas.data ?? [])];

    const { texto: resposta, pendentesBotao } = montarResposta(f, contas, unidades, hoje);
    await enviar(chatId, msg.message_id, resposta);

    if (pendentesBotao.length && pendentesBotao.length <= MAX_BOTOES) {
      for (const c of pendentesBotao) {
        await enviar(chatId, null, [
          `🔴 ${String(c._unidade).toUpperCase()}`,
          `Descrição: ${nomeConta(c)}`,
          `Vencimento: ${formatarDataBR(c.data_vencimento)}${c.data_pagamento_prevista ? ` (previsto ${formatarDataBR(c.data_pagamento_prevista)})` : ''}`,
          `Valor: ${formatarValorBR(saldoPendente(c))}`,
        ].join('\n'), tecladoCobranca(c.id));
      }
    } else if (pendentesBotao.length > MAX_BOTOES) {
      await enviar(chatId, null, `Para dar baixa ou reagendar pelos botões, pergunte por uma unidade ou período menor (até ${MAX_BOTOES} contas).`);
    }
    await admin.from('contas_pagar_assistente_consultas').update({ status: 'respondida', filtros: f, user_id: user.userId }).eq('id', reg.id);
  } catch (e) {
    console.error('[assistente financeiro]', e);
    const m = String((e as Error)?.message ?? '');
    await admin.from('contas_pagar_assistente_consultas').update({ status: 'erro', erro: m.slice(0, 300) }).eq('id', reg.id);
    await enviar(chatId, msg.message_id, m === 'ai_402'
      ? 'Os créditos de IA acabaram, então não consigo interpretar perguntas agora. Consulte pelo CRM.'
      : m === 'ai_429' ? 'Muitas perguntas ao mesmo tempo. Tente de novo em um minuto.'
      : 'Não consegui consultar agora. Tente de novo em instantes.');
  }
  return true;
}
