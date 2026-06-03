// Webhook inbound do WhatsApp (Z-API).
//
// NÃO cria leads automaticamente. Comportamento:
//  - Telefone já vinculado a um lead ativo → atualiza ultima_interacao_at e status_conversa,
//    e grava a mensagem no histórico (agente_mensagens). Nada muda no funil.
//  - Telefone NÃO encontrado em leads → cria/atualiza um agente_atendimento na caixa
//    de entrada (unidade Iron Setúbal, lead_id NULL) e grava a mensagem. O usuário
//    decide manualmente em /conversas-whatsapp se vira lead.
//
// Auth: x-webhook-secret (ZAPI_WEBHOOK_SECRET) — validado em tempo constante ANTES
// de qualquer leitura/processamento do body. POST sem secret válido retorna 401.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const UNIDADE_CAIXA_ENTRADA = '00000000-0000-0000-0000-000000000000'; // Iron Setúbal

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  return digits.length === 0 ? null : digits;
}

const PayloadSchema = z
  .object({
    instanceId: z.string().max(80).optional(),
    messageId: z.string().max(160).optional(),
    zaapId: z.string().max(160).optional(),
    phone: z.string().max(40).optional(),
    senderName: z.string().max(200).optional(),
    chatName: z.string().max(200).optional(),
    fromMe: z.boolean().optional(),
    isGroup: z.boolean().optional(),
    isStatusReply: z.boolean().optional(),
    type: z.string().max(60).optional(),
    text: z.object({ message: z.string().max(4000).optional() }).optional(),
    momment: z.number().optional(),
  })
  .passthrough();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // 1) Validar webhook secret ANTES de qualquer leitura/processamento do body
  const expectedSecret = Deno.env.get('ZAPI_WEBHOOK_SECRET') || '';
  const providedSecret = req.headers.get('x-webhook-secret') || '';
  if (!expectedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const raw = await req.json();
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'invalid_payload', detail: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const body = parsed.data;

    // Ignora status updates e grupos
    if (body.isStatusReply || body.isGroup) {
      return new Response(JSON.stringify({ ok: true, ignored: 'status_or_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telefone = normalizePhone(body.phone);
    if (!telefone) {
      return new Response(JSON.stringify({ ok: true, ignored: 'no_phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageText = body.text?.message?.trim() || '';
    const externalMessageId = body.messageId || body.zaapId || null;
    const fromMe = !!body.fromMe;
    const senderName = (body.senderName || body.chatName || '').trim() || null;
    const now = new Date().toISOString();

    // lead enviou → aguardando_resposta; equipe respondeu → respondido.
    const novoStatusConversa = fromMe ? 'respondido' : 'aguardando_resposta';

    // 2) Procurar lead existente por telefone normalizado (não cria nada novo aqui).
    const { data: leadExistente } = await supabase
      .from('leads')
      .select('id, unidade_id, atendimento_id, is_matriculado, nome')
      .eq('telefone_normalizado', telefone)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let unidadeId: string;
    let atendimentoId: string | null = null;
    const leadId: string | null = leadExistente?.id ?? null;

    if (leadExistente) {
      unidadeId = leadExistente.unidade_id;
      atendimentoId = leadExistente.atendimento_id ?? null;

      await supabase
        .from('leads')
        .update({
          ultima_interacao_at: now,
          status_conversa: novoStatusConversa,
          updated_at: now,
        })
        .eq('id', leadId!);
    } else {
      // Sem lead → caixa de entrada (Iron Setúbal).
      unidadeId = UNIDADE_CAIXA_ENTRADA;

      // Reusar atendimento sem lead, se já existir para este telefone.
      const { data: atendExistente } = await supabase
        .from('agente_atendimentos')
        .select('id')
        .is('lead_id', null)
        .eq('telefone', telefone)
        .eq('unidade_id', unidadeId)
        .order('ultima_interacao_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (atendExistente) {
        atendimentoId = atendExistente.id;
      }
    }

    // 3) Garantir atendimento (1 por lead OU 1 por telefone na caixa de entrada).
    if (!atendimentoId) {
      // Para leads existentes sem atendimento, ainda assim reaproveita se houver.
      if (leadId) {
        const { data: atendDoLead } = await supabase
          .from('agente_atendimentos')
          .select('id')
          .eq('lead_id', leadId)
          .order('ultima_interacao_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (atendDoLead) atendimentoId = atendDoLead.id;
      }
    }

    if (!atendimentoId) {
      // Cria novo atendimento. Precisa de um agente_id (NOT NULL).
      const { data: agente } = await supabase
        .from('agentes_atendimento')
        .select('id')
        .eq('unidade_id', unidadeId)
        .limit(1)
        .maybeSingle();

      if (!agente) {
        console.error('Nenhum agente cadastrado para unidade', unidadeId);
        return new Response(
          JSON.stringify({ error: 'no_agent_for_unit', unidade_id: unidadeId }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: novoAtend, error: atendErr } = await supabase
        .from('agente_atendimentos')
        .insert({
          agente_id: agente.id,
          unidade_id: unidadeId,
          lead_id: leadId,
          telefone,
          nome: senderName ?? undefined,
          canal: 'whatsapp',
          status: 'novo',
          primeira_interacao_at: now,
          ultima_interacao_at: now,
        })
        .select('id')
        .single();

      if (atendErr || !novoAtend) {
        console.error('Erro criando atendimento:', atendErr);
        return new Response(
          JSON.stringify({ error: 'atendimento_insert_failed', detail: atendErr?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      atendimentoId = novoAtend.id;

      // Se há lead, vincula o atendimento ao lead.
      if (leadId) {
        await supabase.from('leads').update({ atendimento_id: atendimentoId }).eq('id', leadId);
      }
    } else {
      await supabase
        .from('agente_atendimentos')
        .update({
          ultima_interacao_at: now,
          ...(senderName ? { nome: senderName } : {}),
        })
        .eq('id', atendimentoId);
    }

    // 4) Registrar mensagem (com dedupe por external_message_id).
    if (atendimentoId && messageText) {
      if (externalMessageId) {
        const { data: dup } = await supabase
          .from('agente_mensagens')
          .select('id')
          .eq('external_message_id', externalMessageId)
          .maybeSingle();
        if (dup) {
          return new Response(
            JSON.stringify({ ok: true, deduped: true, lead_id: leadId, atendimento_id: atendimentoId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      await supabase.from('agente_mensagens').insert({
        atendimento_id: atendimentoId,
        unidade_id: unidadeId,
        external_message_id: externalMessageId ?? undefined,
        role: fromMe ? 'assistant' : 'user',
        conteudo: messageText,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        lead_id: leadId,
        atendimento_id: atendimentoId,
        in_inbox: !leadId,
        is_aluno: !!leadExistente?.is_matriculado,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('Erro whatsapp-inbound-webhook:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
