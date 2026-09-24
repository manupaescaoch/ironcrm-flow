import { z } from 'npm:zod@3';
import { adminClient, resolveGrupoUnidade, resolveUnidadeId, sendTelegramGroupText } from '../_shared/telegram.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UNIDADES: Record<string, { env: string; busca: string }> = {
  'EVO MADALENA': { env: 'GERENCIA_MADALENA', busca: 'MADALENA' },
  'EVO BOA VIAGEM': { env: 'GERENCIA_BOA_VIAGEM', busca: 'BOA VIAGEM' },
  'EVO SETÚBAL': { env: 'GERENCIA_SETUBAL', busca: 'SET' },
  'EVO SANTA CRUZ DO CAPIBARIBE': { env: 'GERENCIA_SANTA_CRUZ', busca: 'SANTA CRUZ' },
};

const s = (max: number) => z.string().trim().max(max).optional().nullable();
const arr = z.array(z.string().trim().max(200)).max(30).default([]);

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  ddi: z.string().trim().regex(/^\+\d{1,4}$/),
  telefone: z.string().trim().regex(/^\d{6,15}$/),
  telefone_formatado: z.string().trim().max(40),
  unidade: z.enum(Object.keys(UNIDADES) as [string, ...string[]]),
  plano: s(120),
  motivos: arr,
  detalhamento: s(2000),
  problemas: arr,
  acompanhamento: s(120),
  evolucao: s(120),
  nota: z.number().int().min(0).max(10).nullable().optional(),
  pontos_positivos: s(2000),
  evitaria_saida: s(2000),
  solucoes_retencao: arr,
  vai_treinar_outro_local: s(60),
  proxima_escolha: s(300),
  fator_escolha: s(120),
  aceita_contato_antes: z.boolean().nullable().optional(),
  aceita_contato_futuro: z.boolean().nullable().optional(),
});

const clean = (t?: string | null) => (t && t.trim() ? t.replace(/[*_`\[\]]/g, '') : '—');
const list = (a: string[]) => (a.length ? a.map(clean).join(', ') : '—');
const ALERTA_RE = /professor|recep|comercial|estrutura|cobran|acompanhamento/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const d = parsed.data;
    const admin = adminClient();
    const cfg = UNIDADES[d.unidade];
    const unidadeId = await resolveUnidadeId(admin, cfg.busca);

    const { data: row, error } = await admin.from('cancelamento_solicitacoes').insert({
      nome: d.nome.toUpperCase(), telefone: d.telefone, ddi: d.ddi, unidade: d.unidade, unidade_id: unidadeId,
      plano: d.plano, motivos: d.motivos, detalhamento: d.detalhamento, problemas: d.problemas,
      acompanhamento: d.acompanhamento, evolucao: d.evolucao, nota: d.nota ?? null,
      pontos_positivos: d.pontos_positivos, evitaria_saida: d.evitaria_saida, solucoes_retencao: d.solucoes_retencao,
      vai_treinar_outro_local: d.vai_treinar_outro_local, proxima_escolha: d.proxima_escolha, fator_escolha: d.fator_escolha,
      aceita_contato_antes: d.aceita_contato_antes ?? null, aceita_contato_futuro: d.aceita_contato_futuro ?? null,
    }).select('id, created_at').single();
    if (error) throw error;

    // Monta mensagem
    const alertas: string[] = [];
    if (d.nota != null && d.nota <= 6) alertas.push('🚨 *EXPERIÊNCIA NEGATIVA*');
    const relatos = [...d.problemas, ...d.motivos].filter((p) => !/nenhum/i.test(p));
    if (relatos.some((p) => ALERTA_RE.test(p))) alertas.push('⚠️ *ATENÇÃO GERENCIAL*');
    if (d.aceita_contato_antes) alertas.push('🔥 *OPORTUNIDADE DE RETENÇÃO*');

    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' });
    const texto = [
      '🔴 *NOVA SOLICITAÇÃO DE CANCELAMENTO*',
      ...(alertas.length ? ['', ...alertas] : []),
      '',
      `📍 *Unidade:* ${d.unidade}`,
      `👤 *Aluno:* ${clean(d.nome.toUpperCase())}`,
      `📱 *WhatsApp:* ${clean(d.telefone_formatado)}`,
      `📋 *Plano:* ${clean(d.plano)}`,
      '',
      `❌ *Motivo principal:* ${list(d.motivos)}`,
      `📝 *Detalhamento:* ${clean(d.detalhamento)}`,
      `⚠️ *Problemas relatados:* ${list(d.problemas)}`,
      `🏋️ *Acompanhamento:* ${clean(d.acompanhamento)}`,
      `📈 *Percebeu evolução:* ${clean(d.evolucao)}`,
      `⭐ *Experiência geral:* ${d.nota ?? '—'}/10`,
      '',
      `❤️ *O que mais gostou:* ${clean(d.pontos_positivos)}`,
      `🔎 *O que poderia evitar a saída:* ${clean(d.evitaria_saida)}`,
      `💡 *Aceitaria solução:* ${list(d.solucoes_retencao)}`,
      '',
      `🏢 *Vai treinar em outro local:* ${clean(d.vai_treinar_outro_local)}`,
      `🎯 *Próxima escolha:* ${clean(d.proxima_escolha)}`,
      `💬 *Principal fator:* ${clean(d.fator_escolha)}`,
      '',
      d.aceita_contato_antes
        ? '🔥 *OPORTUNIDADE DE RETENÇÃO*\n✅ Aluno autorizou contato antes da conclusão do cancelamento.'
        : '🚫 Aluno não autorizou contato para retenção.',
      '',
      `🕒 ${dataHora}`,
    ].join('\n');

    // Destino: variável de ambiente da unidade; senão grupo de gerência cadastrado
    let grupo: { id: string; group_type: any; telegram_chat_id: number; telegram_title: string | null } | null = null;
    const envChat = Deno.env.get(cfg.env);
    if (envChat && /^-?\d+$/.test(envChat.trim())) {
      grupo = { id: null as any, group_type: 'gerencia', telegram_chat_id: Number(envChat.trim()), telegram_title: null };
    } else {
      grupo = await resolveGrupoUnidade(admin, unidadeId, ['gerencia', 'coordenadores']);
    }

    let enviado = false;
    if (grupo) {
      const r = await sendTelegramGroupText(admin, grupo, texto, 'formulario_cancelamento');
      enviado = r.ok;
      if (!r.ok) console.error('Falha Telegram cancelamento', r.error);
    } else {
      console.warn('Sem grupo de gerência para', d.unidade);
    }
    if (enviado) await admin.from('cancelamento_solicitacoes').update({ telegram_enviado: true }).eq('id', row.id);

    return new Response(JSON.stringify({ success: true, id: row.id }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Erro ao registrar solicitação' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
