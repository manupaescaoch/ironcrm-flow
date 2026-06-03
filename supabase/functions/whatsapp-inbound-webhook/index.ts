// Webhook inbound do WhatsApp (Z-API) — registra automaticamente leads novos,
// vincula conversa a leads/alunos existentes e armazena mensagens.
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

const UNIDADE_NAO_DEFINIDA = '00000000-0000-0000-0000-000000000000';

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

    // Status_conversa em função de quem enviou:
    // lead enviou → aguardando_resposta; equipe respondeu → respondido.
    const novoStatusConversa = fromMe ? 'respondido' : 'aguardando_resposta';

    // 2) Buscar lead existente por telefone_normalizado
    const { data: leadExistente, error: leadErr } = await supabase
      .from('leads')
      .select('id, unidade_id, atendimento_id, is_matriculado, nome')
      .eq('telefone_normalizado', telefone)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadErr) {
      console.error('Erro buscando lead:', leadErr);
    }

    let leadId: string;
    let unidadeId: string;
    let atendimentoId: string | null = leadExistente?.atendimento_id ?? null;

    if (leadExistente) {
      leadId = leadExistente.id;
      unidadeId = leadExistente.unidade_id;
      // Atualiza última interação e status_conversa (não duplica lead)
      await supabase
        .from('leads')
        .update({
          ultima_interacao_at: now,
          status_conversa: novoStatusConversa,
          updated_at: now,
        })
        .eq('id', leadId);
    } else {
      // 3) Criar lead novo na unidade "Não definida"
      unidadeId = UNIDADE_NAO_DEFINIDA;
      const nome = senderName || `WhatsApp ${telefone.slice(-4)}`;
      const { data: novoLead, error: insertErr } = await supabase
        .from('leads')
        .insert({
          nome: nome.toUpperCase(),
          telefone,
          origem: 'WHATSAPP',
          fonte: 'WHATSAPP',
          status_funil: 'novo',
          status_conversa: novoStatusConversa,
          ultima_interacao_at: now,
          unidade_id: unidadeId,
          ativo: true,
          is_matriculado: false,
        })
        .select('id')
        .single();

      if (insertErr || !novoLead) {
        console.error('Erro criando lead:', insertErr);
        return new Response(
          JSON.stringify({ error: 'lead_insert_failed', detail: insertErr?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      leadId = novoLead.id;
    }

    // 4) Garantir atendimento (1 por lead) — reabre se inexistente
    if (!atendimentoId) {
      const { data: atendExistente } = await supabase
        .from('agente_atendimentos')
        .select('id')
        .eq('lead_id', leadId)
        .order('ultima_interacao_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (atendExistente) {
        atendimentoId = atendExistente.id;
      } else {
        // Busca o agente da unidade (qualquer um ativo, fallback para o 1º)
        const { data: agente } = await supabase
          .from('agentes_atendimento')
          .select('id')
          .eq('unidade_id', unidadeId)
          .limit(1)
          .maybeSingle();

        if (agente) {
          const { data: novoAtend } = await supabase
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
          if (novoAtend) atendimentoId = novoAtend.id;
        }
      }

      if (atendimentoId) {
        await supabase.from('leads').update({ atendimento_id: atendimentoId }).eq('id', leadId);
      }
    } else {
      // Atualiza última interação do atendimento
      await supabase
        .from('agente_atendimentos')
        .update({ ultima_interacao_at: now })
        .eq('id', atendimentoId);
    }

    // 5) Registrar mensagem (com dedupe por external_message_id)
    if (atendimentoId && messageText) {
      if (externalMessageId) {
        const { data: dup } = await supabase
          .from('agente_mensagens')
          .select('id')
          .eq('external_message_id', externalMessageId)
          .maybeSingle();
        if (dup) {
          return new Response(
            JSON.stringify({ ok: true, deduped: true, lead_id: leadId }),
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
        created_new_lead: !leadExistente,
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
