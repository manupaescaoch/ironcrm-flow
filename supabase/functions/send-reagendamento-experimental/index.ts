// Dispara o ciclo "FU Reagendamento" quando o lead é marcado como Não Compareceu:
// 1) Envia mensagem automática ao lead pelo chip COMERCIAL
// 2) Cria registro em follow_ups (tipo REAG) marcado como concluído
// 3) Loga uma interação para aparecer no histórico/timeline
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildIdempotencyKey,
  checkZapiStatus,
  getZapiCreds,
  logEnvio,
  phoneExists,
  sendTextIdempotent,
} from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNC = 'send-reagendamento-experimental';

function normalizePhone(phone: string): string {
  let n = (phone || '').replace(/\D/g, '');
  if (!n) return '';
  if (!n.startsWith('55')) n = '55' + n;
  return n;
}

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || full;
}

function buildMessage(nome: string) {
  return `Olá, ${nome}! Tudo bem? 💙

Vi aqui que você não conseguiu comparecer à sua aula experimental na Iron.

Sem problema, acontece.

A experiência é a melhor forma de conhecer nossa estrutura, entender como funciona o treino com acompanhamento e sentir de perto a proposta da Iron.

Quer que eu veja um novo horário para você reagendar?`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Autentica usuário (JWT)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const leadId: string | undefined = body?.lead_id;
    const interacaoId: string | undefined = body?.interacao_id;
    const responsavelNome: string = (body?.responsavel_nome || user.email || 'RECEPÇÃO').toString();

    if (!leadId) {
      return new Response(JSON.stringify({ error: 'lead_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, nome, telefone, unidade_id, ativo')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: 'Lead não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = getZapiCreds('comercial');
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    // 1) Cria follow_up REAG (mesmo se falhar o envio — para histórico)
    let followUpId: string | null = null;
    const { data: fuInsert } = await supabase
      .from('follow_ups')
      .insert({
        lead_id: lead.id,
        unidade_id: lead.unidade_id,
        tipo: 'REAG',
        data_referencia: today,
        data_prevista: today,
        status: 'pendente',
      })
      .select('id')
      .single();
    followUpId = fuInsert?.id ?? null;

    // Validações iniciais
    if (!creds) {
      await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'credenciais_ausentes', unidade_id: lead.unidade_id, canal: 'comercial' });
      await supabase.from('interacoes').insert({
        lead_id: lead.id, unidade_id: lead.unidade_id,
        tipo: 'whatsapp', descricao: 'FU Reagendamento: falha — número comercial não configurado',
        data_interacao: nowIso, atendido_por: 'SISTEMA',
      });
      return new Response(JSON.stringify({ error: 'Número comercial não configurado', followUpId }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!lead.telefone) {
      await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'sem_telefone', unidade_id: lead.unidade_id, canal: 'comercial' });
      await supabase.from('interacoes').insert({
        lead_id: lead.id, unidade_id: lead.unidade_id,
        tipo: 'whatsapp', descricao: 'FU Reagendamento iniciado — falha: lead sem telefone',
        data_interacao: nowIso, atendido_por: 'SISTEMA',
      });
      return new Response(JSON.stringify({ error: 'Lead sem telefone', followUpId }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phone = normalizePhone(lead.telefone);
    const message = buildMessage(firstName(lead.nome));

    // 2) Verifica chip
    const st = await checkZapiStatus(creds);
    if (!st.connected) {
      await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(st.raw).slice(0, 300), unidade_id: lead.unidade_id, canal: 'comercial' });
      await supabase.from('interacoes').insert({
        lead_id: lead.id, unidade_id: lead.unidade_id,
        tipo: 'whatsapp', descricao: 'FU Reagendamento: falha — chip comercial offline',
        data_interacao: nowIso, atendido_por: 'SISTEMA',
      });
      return new Response(JSON.stringify({ error: 'Chip comercial offline', followUpId }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Verifica WhatsApp
    const exists = await phoneExists(creds, phone);
    if (exists === false) {
      await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'phone_nao_existe', unidade_id: lead.unidade_id, canal: 'comercial' });
      await supabase.from('interacoes').insert({
        lead_id: lead.id, unidade_id: lead.unidade_id,
        tipo: 'whatsapp', descricao: `FU Reagendamento: telefone ${phone} sem WhatsApp`,
        data_interacao: nowIso, atendido_por: 'SISTEMA',
      });
      return new Response(JSON.stringify({ error: 'Telefone sem WhatsApp', followUpId }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Envia
    // 4) Envia (com idempotência: 1 mensagem de reagendamento por lead/dia da aula)
    const chaveReag = buildIdempotencyKey([
      FUNC, lead.id, String(lead.data_aula_experimental ?? '').slice(0, 10) || 'sem_data',
    ]);
    const r = await sendTextIdempotent(supabase, creds, phone, message, { chave: chaveReag, funcao: FUNC });
    if (r.skipped) {
      await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'idempotencia_duplicado', unidade_id: lead.unidade_id, canal: 'comercial' });
      return new Response(JSON.stringify({ ok: true, skipped: 'duplicado', followUpId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!r.ok) {
      await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 300), unidade_id: lead.unidade_id, canal: 'comercial' });
      await supabase.from('interacoes').insert({
        lead_id: lead.id, unidade_id: lead.unidade_id,
        tipo: 'whatsapp', descricao: `FU Reagendamento: falha no envio (status ${r.status})`,
        data_interacao: nowIso, atendido_por: 'SISTEMA',
      });
      return new Response(JSON.stringify({ error: 'Falha no envio Z-API', followUpId }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5) Sucesso — marca FU concluído e registra interação
    if (followUpId) {
      await supabase.from('follow_ups').update({
        status: 'concluido',
        concluido_em: nowIso,
        concluido_por: responsavelNome,
        updated_at: nowIso,
      }).eq('id', followUpId);
    }

    await supabase.from('interacoes').insert({
      lead_id: lead.id,
      unidade_id: lead.unidade_id,
      tipo: 'whatsapp',
      descricao: 'FU Reagendamento enviado automaticamente ao lead via WhatsApp',
      data_interacao: nowIso,
      atendido_por: responsavelNome,
    });

    await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: true, zapi_status_code: r.status, unidade_id: lead.unidade_id, canal: 'comercial' });

    return new Response(JSON.stringify({ success: true, followUpId, interacaoId: interacaoId ?? null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
