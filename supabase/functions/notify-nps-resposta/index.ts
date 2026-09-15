import { createClient } from 'npm:@supabase/supabase-js@2';
import { logEnvio } from '../_shared/zapi.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { authorizeCronOrJwt, CRON_CORS_HEADERS } from '../_shared/cronAuth.ts';

const corsHeaders = CRON_CORS_HEADERS;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


// Coordenador de cada unidade — TODA notificação de NPS vai para ele (nunca para o aluno)
const RESPONSAVEIS: Record<string, { nome: string; phone: string }> = {
  MADALENA: { nome: 'Gabriela Lima', phone: '5581991642282' },
  'BOA VIAGEM': { nome: 'Marcelo Santana', phone: '5581994145218' },
};

// A resposta do NPS é enviada ao grupo da unidade no TELEGRAM (não mais no WhatsApp).
// Prioridade: grupo de coordenadores da unidade; se não existir, grupo de gerência.
const PRIORIDADE_GRUPOS = ['coordenadores', 'gerencia'] as const;

// Fallback de unidade_id caso o nome informado no formulário não bata com a tabela.
const UNIDADE_ID_FALLBACK: Record<string, string> = {
  MADALENA: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  'BOA VIAGEM': 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  SETUBAL: '00000000-0000-0000-0000-000000000000',
};

function findCoordenador(unidadeNome: string) {
  const key = (unidadeNome || '').toUpperCase().trim();
  for (const [k, v] of Object.entries(RESPONSAVEIS)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function normalizeUnidade(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function unidadeIdFallback(unidadeNome: string): string | null {
  const key = normalizeUnidade(unidadeNome);
  for (const [k, v] of Object.entries(UNIDADE_ID_FALLBACK)) {
    if (key.includes(k)) return v;
  }
  return null;
}

const RODAPE_REGRAS =
  `\n\n*REGRAS GERAIS DA TRATATIVA*\n` +
  `• Promotor: agradecer e solicitar indicação;\n` +
  `• Passivo: identificar o que falta para a experiência ser excelente;\n` +
  `• Detrator: contato prioritário, resolução e acompanhamento;\n` +
  `• Não utilizar mensagens automáticas frias ou genéricas;\n` +
  `• Personalizar a abordagem usando o nome e o comentário do aluno;\n` +
  `• Todo contato precisa gerar um registro no sistema;\n` +
  `• Casos graves ou sem solução imediata devem ser escalados para a gerência;\n` +
  `• O NPS não termina na leitura da nota. Ele termina quando a ação foi realizada e acompanhada.`;

interface NpsRespostaCompleta {
  classificacao: string;
  nome: string;
  unidade: string;
  nota: number;
  comentario: string;
  alunoPhone: string;
  estrelas_estrutura?: number | null;
  estrelas_equipe?: number | null;
  estrelas_treino?: number | null;
  pontos_positivos?: string[] | null;
  pontos_melhoria?: string[] | null;
  tempo_aluno?: string | null;
}

function stars(n?: number | null): string {
  if (n === null || n === undefined) return '—';
  return `${n}/5`;
}

function montarMensagemCoordenador(r: NpsRespostaCompleta): string {
  const { classificacao, nome, unidade, nota, comentario, alunoPhone } = r;
  const primeiroNomeAluno = (nome || '').trim().split(/\s+/)[0] || nome || 'aluno';
  const unidadeLabel = unidade || '—';
  const linkWhatsapp = `https://wa.me/${alunoPhone}`;
  const coord = '[SEU NOME]';

  const positivos = (r.pontos_positivos || []).filter(Boolean);
  const melhorias = (r.pontos_melhoria || []).filter(Boolean);

  const cabecalho =
    `🟦 *NOVA RESPOSTA NPS — EVO CLUB*\n\n` +
    `📍 *Unidade:* ${unidadeLabel}\n` +
    `👤 *Aluno:* ${nome}\n` +
    `📞 *Contato:* ${alunoPhone}\n` +
    `🕐 *Tempo de aluno:* ${r.tempo_aluno || '—'}\n` +
    `⭐ *Nota NPS:* ${nota}\n` +
    `📊 *Classificação:* ${classificacao}\n\n` +
    `*AVALIAÇÕES (0 a 5)*\n` +
    `🏋️ *Estrutura:* ${stars(r.estrelas_estrutura)}\n` +
    `🤝 *Equipe:* ${stars(r.estrelas_equipe)}\n` +
    `💪 *Treino:* ${stars(r.estrelas_treino)}\n\n` +
    `✅ *Pontos positivos:*\n` +
    (positivos.length ? positivos.map((p) => `• ${p}`).join('\n') : '• Nenhum marcado') +
    `\n\n⚠️ *Pontos de melhoria:*\n` +
    (melhorias.length ? melhorias.map((p) => `• ${p}`).join('\n') : '• Nenhum marcado') +
    `\n\n💬 *Comentário:* ${comentario || 'Não deixou comentário'}\n`;

  let bloco = '';

  if (classificacao === 'Promotor') {
    bloco =
      `\n🟢 *ANÁLISE DA RESPOSTA*\n` +
      `O aluno demonstrou estar satisfeito com a experiência na EVO e possui alto potencial de permanecer, indicar novos alunos e fortalecer a reputação da unidade.\n\n` +
      `📋 *AÇÃO NECESSÁRIA*\n` +
      `Entre em contato com o aluno de forma pessoal, agradeça pela avaliação e aproveite o momento positivo para solicitar uma indicação.\n\n` +
      `*Mensagem sugerida:*\n` +
      `"Oi, ${primeiroNomeAluno}! Tudo bem? Aqui é ${coord}, da EVO ${unidadeLabel}.\n\n` +
      `Vi que você deu nota ${nota} para a sua experiência com a gente e queria agradecer pela confiança. Ficamos muito felizes em saber que você está satisfeito!\n\n` +
      `Você conhece alguém que também gostaria de viver essa experiência na EVO? Pode me enviar o contato por aqui. Temos uma condição especial para receber a sua indicação."\n\n` +
      `💬 *Falar com o aluno:*\n${linkWhatsapp}\n\n` +
      `✅ Após o contato: registre no sistema se o aluno respondeu e se realizou alguma indicação.`;
  } else if (classificacao === 'Passivo') {
    bloco =
      `\n🟡 *ANÁLISE DA RESPOSTA*\n` +
      `O aluno não está necessariamente insatisfeito, mas ainda não percebe a experiência como excelente. Existe algum ponto da jornada que precisa ser identificado e ajustado antes que essa percepção piore.\n\n` +
      `📋 *AÇÃO NECESSÁRIA*\n` +
      `Entre em contato com o aluno para entender o que faltou para a experiência ser nota 9 ou 10. Não envie uma resposta genérica. Escute, registre o motivo e direcione o ajuste ao responsável.\n\n` +
      `*Mensagem sugerida:*\n` +
      `"Oi, ${primeiroNomeAluno}! Tudo bem? Aqui é ${coord}, da EVO ${unidadeLabel}.\n\n` +
      `Vi que você avaliou a sua experiência com a nota ${nota} e queria entender melhor a sua percepção.\n\n` +
      `O que poderíamos melhorar para que a sua experiência fosse nota 10? Pode falar com sinceridade. A sua opinião é importante para ajustarmos o que for necessário."\n\n` +
      `💬 *Falar com o aluno:*\n${linkWhatsapp}\n\n` +
      `✅ Após o contato: registre o motivo da nota, a ação definida, o responsável pelo ajuste e o prazo para retorno ao aluno.`;
  } else {
    bloco =
      `\n🔴 *ANÁLISE DA RESPOSTA*\n` +
      `O aluno demonstrou insatisfação e existe risco de cancelamento, reclamação pública ou perda de confiança na unidade. Essa resposta precisa ser tratada como prioridade.\n\n` +
      `🚨 *AÇÃO IMEDIATA*\n` +
      `O coordenador deve entrar em contato com o aluno no mesmo dia. Sempre que possível, priorize uma ligação. O objetivo inicial não é justificar ou se defender, mas ouvir, entender o problema e assumir a condução da solução.\n\n` +
      `*Mensagem sugerida:*\n` +
      `"Oi, ${primeiroNomeAluno}. Tudo bem? Aqui é ${coord}, coordenador da EVO ${unidadeLabel}.\n\n` +
      `Vi a sua avaliação e percebi que a sua experiência não está acontecendo como deveria. Quero entender pessoalmente o que aconteceu e o que precisamos fazer para corrigir isso.\n\n` +
      `Posso te ligar agora ou existe um horário melhor para conversarmos?"\n\n` +
      `💬 *Falar com o aluno:*\n${linkWhatsapp}\n\n` +
      `✅ Após o contato, registre obrigatoriamente:\n` +
      `• Motivo da insatisfação;\n` +
      `• O que foi relatado pelo aluno;\n` +
      `• Ação corretiva definida;\n` +
      `• Responsável pela resolução;\n` +
      `• Prazo combinado;\n` +
      `• Data do próximo contato;\n` +
      `• Situação final do caso.\n\n` +
      `⚠️ *Importante:* a tratativa só deve ser considerada concluída depois que o aluno receber um retorno sobre o que foi feito.`;
  }

  return cabecalho + bloco + RODAPE_REGRAS;
}


function classificar(nota: number): 'Detrator' | 'Passivo' | 'Promotor' {
  if (nota <= 6) return 'Detrator';
  if (nota <= 8) return 'Passivo';
  return 'Promotor';
}

function formatPhoneBR(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return raw;
  return d.startsWith('55') ? d : `55${d}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Só o próprio servidor (trigger/cron) ou um usuário autenticado pode disparar.
  const auth = await authorizeCronOrJwt(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status ?? 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let id: unknown;
    try {
      ({ id } = await req.json());
    } catch {
      return new Response(JSON.stringify({ error: 'payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      return new Response(JSON.stringify({ error: 'id inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const { data: resp, error } = await supabase
      .from('nps_respostas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !resp) {
      return new Response(JSON.stringify({ error: 'resposta não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nota = Number(resp.nota_nps);
    const classificacao = classificar(nota);
    const unidadeKey = (resp.unidade_nome || '').toUpperCase().trim();
    const responsavel = findCoordenador(resp.unidade_nome || '');
    const alunoPhone = formatPhoneBR(resp.whatsapp || '');
    const comentario = (resp.comentario || '').trim();

    // Resolve unidade_id a partir do unidade_nome (matches "Iron Madalena" etc.)
    let unidadeId: string | null = null;
    if (resp.unidade_nome) {
      const { data: u } = await supabase
        .from('unidades')
        .select('id')
        .ilike('nome', `%${resp.unidade_nome}%`)
        .maybeSingle();
      unidadeId = u?.id ?? null;
    }
    if (!unidadeId) unidadeId = unidadeIdFallback(resp.unidade_nome || '');

    const log: Record<string, any> = {
      resposta_id: resp.id,
      unidade_id: unidadeId,
      unidade_nome: resp.unidade_nome,
      nota_nps: nota,
      classificacao: classificacao.toLowerCase(),
      responsavel_nome: responsavel?.nome ?? null,
      responsavel_telefone: responsavel?.phone ?? null,
      aluno_telefone: alunoPhone,
    };

    // Mensagem única (detalhada) enviada apenas ao GRUPO da unidade
    const msgGrupo = montarMensagemCoordenador({
      classificacao,
      nome: resp.nome,
      unidade: resp.unidade_nome || '',
      nota,
      comentario,
      alunoPhone,
      estrelas_estrutura: resp.estrelas_estrutura,
      estrelas_equipe: resp.estrelas_equipe,
      estrelas_treino: resp.estrelas_treino,
      pontos_positivos: resp.pontos_positivos,
      pontos_melhoria: resp.pontos_melhoria,
      tempo_aluno: resp.tempo_aluno,
    });

    // Não há mais envio individual ao coordenador — tudo é consolidado no grupo
    log.interna_status = 'skip';
    log.interna_erro = 'consolidado-no-grupo';

    // Grupo da unidade (mesmo endpoint de texto do Z-API, "phone" = ID do grupo)
    const grupoId = findGrupo(resp.unidade_nome || '');
    if (grupoId) {
      const chaveGrupo = buildIdempotencyKey(['notify-nps-resposta', resp.id, 'grupo', grupoId]);
      const rg = await sendTextIdempotent(supabase, creds, grupoId, msgGrupo, { chave: chaveGrupo, funcao: 'notify-nps-resposta' });
      log.payload = {
        grupo_id: grupoId,
        grupo_status: rg.skipped ? 'duplicado' : rg.ok ? 'enviado' : 'erro',
        grupo_message_id: (rg.body as any)?.messageId ?? (rg.body as any)?.zaapId ?? null,
        grupo_erro: rg.ok ? null : JSON.stringify(rg.body).slice(0, 500),
      };
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        destino: grupoId,
        tipo_destino: 'grupo',
        sucesso: rg.ok,
        zapi_status_code: rg.status,
        erro_msg: rg.ok ? null : JSON.stringify(rg.body).slice(0, 500),
        canal: 'operacional2',
        resposta_completa: rg.body,
      });
    } else {
      log.payload = { grupo_status: 'skip', grupo_erro: `unidade-sem-grupo:${unidadeKey}` };
      await logEnvio(supabase, {
        funcao: 'notify-nps-resposta',
        tipo_destino: 'grupo',
        sucesso: false,
        motivo_skip: `unidade-sem-grupo:${unidadeKey}`,
        canal: 'operacional2',
      });
    }

    // Fluxo NPS: NENHUMA mensagem vai direto para o aluno.
    // Toda resposta é encaminhada ao coordenador e ao grupo da unidade.
    log.aluno_status = 'skip';
    log.aluno_erro = 'fluxo-coordenador-apenas';

    await supabase.from('nps_notificacoes_log').insert(log);

    return new Response(JSON.stringify({ ok: true, classificacao }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[notify-nps-resposta] erro', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
