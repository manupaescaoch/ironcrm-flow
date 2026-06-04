// Webhook inbound do WhatsApp (Z-API).
//
// 1) Salva a mensagem em whatsapp_messages.
// 2) Gerencia a conversa em whatsapp_conversations.
// 3) Vincula a lead se existir.
// 4) Não cria lead automaticamente.
//
// Auth: x-webhook-secret (ZAPI_WEBHOOK_SECRET)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const UNIDADE_CAIXA_ENTRADA = '00000000-0000-0000-0000-000000000000'; // Fallback

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

    if (body.isStatusReply || body.isGroup) {
      return new Response(JSON.stringify({ ok: true, ignored: 'status_or_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telefoneOriginal = body.phone || '';
    const telefoneNormalizado = normalizePhone(telefoneOriginal);
    if (!telefoneNormalizado) {
      return new Response(JSON.stringify({ ok: true, ignored: 'no_phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageText = body.text?.message?.trim() || '';
    const externalMessageId = body.messageId || body.zaapId || null;
    const fromMe = !!body.fromMe;
    const senderName = (body.senderName || body.chatName || '').trim() || null;
    const now = new Date().toISOString();
    const direction = fromMe ? 'outbound' : 'inbound';

    // 1) Verificar se o telefone já existe na tabela leads
    const { data: leadExistente } = await supabase
      .from('leads')
      .select('id, unidade_id')
      .eq('telefone_normalizado', telefoneNormalizado)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const leadId = leadExistente?.id || null;
    const unidadeId = leadExistente?.unidade_id || null;

    // 2) Gerenciar whatsapp_conversations
    let { data: conversa } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_normalized', telefoneNormalizado)
      .maybeSingle();

    if (!conversa) {
      const { data: novaConversa, error: errConv } = await supabase
        .from('whatsapp_conversations')
        .insert({
          phone: telefoneOriginal,
          phone_normalized: telefoneNormalizado,
          contact_name: senderName,
          lead_id: leadId,
          unidade_id: unidadeId,
          last_message_text: messageText,
          last_message_at: now,
          last_message_direction: direction,
          first_inbound_at: direction === 'inbound' ? now : null,
          first_response_at: null,
          status_conversa: direction === 'inbound' ? 'aguardando_resposta' : 'respondido',
          is_linked_to_lead: !!leadId
        })
        .select('*')
        .single();
      
      if (errConv) throw errConv;
      conversa = novaConversa;
    } else {
      // Atualizar conversa existente
      const updates: any = {
        last_message_text: messageText,
        last_message_at: now,
        last_message_direction: direction,
        updated_at: now,
        status_conversa: direction === 'inbound' ? 'aguardando_resposta' : 'respondido'
      };

      if (!conversa.first_inbound_at && direction === 'inbound') {
        updates.first_inbound_at = now;
      }

      if (direction === 'outbound' && conversa.first_inbound_at && !conversa.first_response_at) {
        updates.first_response_at = now;
      }

      if (leadId && !conversa.lead_id) {
        updates.lead_id = leadId;
        updates.is_linked_to_lead = true;
        if (unidadeId) updates.unidade_id = unidadeId;
      }

      const { data: updatedConv, error: errUpdate } = await supabase
        .from('whatsapp_conversations')
        .update(updates)
        .eq('id', conversa.id)
        .select('*')
        .single();
      
      if (errUpdate) throw errUpdate;
      conversa = updatedConv;
    }

    // 3) Salvar mensagem em whatsapp_messages
    const { error: errMsg } = await supabase
      .from('whatsapp_messages')
      .insert({
        message_id: externalMessageId,
        phone: telefoneOriginal,
        phone_normalized: telefoneNormalizado,
        contact_name: senderName,
        direction: direction,
        message_text: messageText,
        message_type: body.type || 'chat',
        timestamp: body.momment?.toString(),
        received_at: now,
        unidade_id: conversa.unidade_id,
        lead_id: conversa.lead_id,
        status: 'received',
        first_response_at: direction === 'outbound' ? now : null
      });

    if (errMsg && !errMsg.message.includes('duplicate key')) {
      console.error('Erro ao inserir mensagem:', errMsg);
    }

    // 4) Atualizar o lead (opcional, para compatibilidade com o legado se necessário)
    if (leadId) {
      await supabase.from('leads').update({
        ultima_interacao_at: now,
        status_conversa: direction === 'outbound' ? 'respondido' : 'aguardando_resposta',
        updated_at: now
      }).eq('id', leadId);
    }

    return new Response(JSON.stringify({ ok: true, conversation_id: conversa.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Erro whatsapp-inbound-webhook:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});