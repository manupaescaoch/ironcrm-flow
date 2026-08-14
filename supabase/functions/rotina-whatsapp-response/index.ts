import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { buildIdempotencyKey, getZapiCreds, sendTextIdempotent } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Whitelist EXATA de respostas textuais (após normalização).
const WHITELIST_FEITO = new Set([
  'feito', 'concluido', 'concluída', 'concluida', 'realizado', 'realizada', 'ok',
]);
const WHITELIST_NAO_FEITO = new Set([
  'nao feito', 'não feito', 'nao consegui', 'não consegui', 'nao realizado', 'não realizado',
]);

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}
function maskPhone(phone: string): string {
  const p = normalizePhone(phone);
  if (p.length < 4) return '***';
  return `***${p.slice(-4)}`;
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\p{L}\p{N}\s]/gu, '') // remove pontuação
    .replace(/\s+/g, ' ')
    .trim();
}

// Schema aceita:
//  - Z-API (campos flat: instanceId, phone, text.message, buttonsResponseMessage, ...)
//  - D-API (event="messages.received", sessionId, data:{ id, message, fromMe, is_group,
//    from:{ jid }, data:{ selected_display_text, selected_id, selected_title, selected_row_id } })
// Não aceita rotina_id/status no payload.
const DapiInnerData = z.object({
  selected_id: z.string().max(200).optional(),
  selected_display_text: z.string().max(400).optional(),
  selected_title: z.string().max(400).optional(),
  selected_row_id: z.string().max(200).optional(),
  description: z.string().max(400).optional(),
}).passthrough().optional();

const DapiData = z.object({
  id: z.string().max(200).optional(),
  type: z.string().max(60).optional(),
  message: z.string().max(4000).optional(),
  fromMe: z.boolean().optional(),
  is_group: z.boolean().optional(),
  from_name: z.string().max(200).optional(),
  from: z.object({
    jid: z.string().max(120).optional(),
    lid: z.string().max(120).optional(),
    name: z.string().max(200).optional(),
  }).passthrough().optional(),
  data: DapiInnerData,
}).passthrough().optional();

const PayloadSchema = z.object({
  // Z-API
  instanceId: z.string().max(80).optional(),
  messageId: z.string().max(120).optional(),
  zaapId: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  chatId: z.string().max(80).optional(),
  from: z.union([z.string().max(80), z.object({}).passthrough()]).optional(),
  fromMe: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  type: z.string().max(60).optional(),
  status: z.string().max(60).optional(),
  text: z.object({ message: z.string().max(4000).optional() }).optional(),
  message: z.string().max(4000).optional(),
  body: z.string().max(4000).optional(),
  buttonsResponseMessage: z.object({
    selectedButtonId: z.string().max(200).optional(),
    buttonId: z.string().max(200).optional(),
  }).optional(),
  buttonResponseMessage: z.object({
    selectedButtonId: z.string().max(200).optional(),
    buttonId: z.string().max(200).optional(),
  }).optional(),
  // D-API
  event: z.string().max(60).optional(),
  sessionId: z.string().max(120).optional(),
  traceId: z.string().max(120).optional(),
  data: DapiData,
}).passthrough();

// Extrai o telefone do JID do WhatsApp (ex: "5581999999999@s.whatsapp.net" → "5581999999999").
function jidToPhone(jid?: string | null): string {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

// Normaliza payload Z-API OU D-API para uma forma canônica interna.
type NormalizedEvent = {
  messageId: string | null;
  instanceId: string | null; // sessionId no caso D-API
  phone: string;
  fromMe: boolean;
  isGroup: boolean;
  msgType: string | null;
  msgStatus: string | null;
  text: string;
  hasButton: boolean;
  // ID cru da opção/botão selecionado (rowId da lista ou id do botão).
  selectedId: string;
  source: 'dapi' | 'zapi';
};

function normalizeEvent(payload: z.infer<typeof PayloadSchema>): NormalizedEvent {
  // D-API: identificado por event="messages.received" ou presença de payload.data.id/from.jid
  const isDapi = payload.event === 'messages.received'
    || (!!payload.data && (!!payload.data.id || !!payload.data.from?.jid));

  if (isDapi) {
    const d = payload.data ?? {};
    const inner = d.data ?? {};
    // Prioridade texto: template_button_reply.selected_display_text/selected_id,
    // list_response.selected_title, senão o próprio d.message.
    const buttonText = inner.selected_display_text
      || inner.selected_title
      || inner.selected_id
      || inner.selected_row_id
      || '';
    const text = String(buttonText || d.message || '').trim();
    const hasButton = !!(inner.selected_display_text || inner.selected_id
      || inner.selected_title || inner.selected_row_id);
    return {
      messageId: d.id ?? null,
      instanceId: payload.sessionId ?? null,
      phone: jidToPhone(d.from?.jid),
      fromMe: d.fromMe === true,
      isGroup: d.is_group === true,
      msgType: d.type ?? null,
      msgStatus: null,
      text,
      hasButton,
      selectedId: String(inner.selected_row_id || inner.selected_id || '').trim(),
      source: 'dapi',
    };
  }

  // Z-API (formato original)
  const zPhoneRaw = payload.phone
    || payload.chatId
    || (typeof payload.from === 'string' ? payload.from : '')
    || '';
  const btn = payload.buttonsResponseMessage || payload.buttonResponseMessage;
  const btnText = btn?.selectedButtonId || btn?.buttonId || '';
  const text = String(
    btnText || payload.text?.message || payload.message || payload.body || '',
  ).trim();
  return {
    messageId: payload.messageId || payload.zaapId || null,
    instanceId: payload.instanceId ?? null,
    phone: (zPhoneRaw || '').replace(/\D/g, ''),
    fromMe: payload.fromMe === true,
    isGroup: payload.isGroup === true,
    msgType: payload.type ?? null,
    msgStatus: payload.status ?? null,
    text,
    hasButton: !!btn,
    selectedId: String(btnText || '').trim(),
    source: 'zapi',
  };
}


type AuditInput = {
  messageId: string | null;
  instanceId: string | null;
  telefoneMascarado: string | null;
  rotinaId: string | null;
  statusAplicado: string | null;
  autorizado: boolean;
  motivoBloqueio: string | null;
  authMethod: string;
  payloadResumo: Record<string, unknown>;
};

async function audit(
  supabase: ReturnType<typeof createClient>,
  data: AuditInput,
): Promise<void> {
  try {
    await supabase.from('rotina_webhook_auditoria').insert({
      message_id: data.messageId,
      instance_id: data.instanceId,
      telefone_mascarado: data.telefoneMascarado,
      rotina_id: data.rotinaId,
      status_aplicado: data.statusAplicado,
      autorizado: data.autorizado,
      motivo_bloqueio: data.motivoBloqueio,
      auth_method: data.authMethod,
      payload_resumo: data.payloadResumo,
      canal_origem: (data.payloadResumo?.canalOrigem as string | null | undefined) ?? null,
    });

  } catch (err) {
    console.error('[rotina-response] Falha auditoria:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // CAMADA 0 — config fail-closed.
  // Aceita as instâncias possíveis: Z-API comercial, Z-API operacional, Z-API legacy,
  // e o sessionId da D-API (canal operacional atual).
  const instanceComercial = Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID') || '';
  const instanceOperacional = Deno.env.get('ZAPI_OPERACIONAL_INSTANCE_ID') || '';
  const instanceLegacy = Deno.env.get('ZAPI_INSTANCE_ID') || '';
  const dapiSessionId = Deno.env.get('DAPI_SESSION_ID') || '';
  const acceptedInstances: { id: string; canal: 'comercial' | 'operacional' | 'legacy' }[] = [];
  if (instanceComercial) acceptedInstances.push({ id: instanceComercial, canal: 'comercial' });
  if (instanceOperacional) acceptedInstances.push({ id: instanceOperacional, canal: 'operacional' });
  if (instanceLegacy && !acceptedInstances.find((x) => x.id === instanceLegacy)) {
    acceptedInstances.push({ id: instanceLegacy, canal: 'legacy' });
  }
  if (dapiSessionId && !acceptedInstances.find((x) => x.id === dapiSessionId)) {
    acceptedInstances.push({ id: dapiSessionId, canal: 'operacional' });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (acceptedInstances.length === 0 || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);


  // CAMADA 1 — parse + Zod
  let rawPayload: unknown;
  try { rawPayload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const parsed = PayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const payload = parsed.data;

  // Bloqueio explícito: payloads manuais tentando forçar rotina/status livres.
  const rawObj = (rawPayload ?? {}) as Record<string, unknown>;
  const FORBIDDEN_KEYS = ['rotina_id', 'rotinaId', 'completed', 'not_completed'];
  for (const k of FORBIDDEN_KEYS) {
    if (k in rawObj) {
      return new Response(JSON.stringify({ error: 'forbidden field' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const evt = normalizeEvent(payload);
  const messageId = evt.messageId;
  const instanceId = evt.instanceId;
  // Identifica o canal de origem comparando contra as instâncias aceitas (constant-time).
  const matchedInstance = instanceId
    ? acceptedInstances.find((x) => x.id.length === instanceId.length && constantTimeEqual(x.id, instanceId))
    : undefined;
  const canalOrigem: 'comercial' | 'operacional' | 'legacy' | null =
    matchedInstance?.canal ?? null;
  const senderPhone = evt.phone;
  const telefoneMascarado = senderPhone ? maskPhone(senderPhone) : null;
  const payloadResumo = {
    type: evt.msgType,
    msgStatus: evt.msgStatus,
    fromMe: evt.fromMe,
    isGroup: evt.isGroup,
    hasButton: evt.hasButton,
    hasText: !!evt.text,
    source: evt.source,
    canalOrigem,
  };
  const baseAudit = {
    messageId, instanceId, telefoneMascarado,
    rotinaId: null as string | null,
    statusAplicado: null as string | null,
    payloadResumo,
  };

  // CAMADA 2 — auth em camadas (header secret OU validação canônica)
  let authMethod: string;
  const expectedSecret = Deno.env.get('ZAPI_WEBHOOK_SECRET') || '';
  const providedSecret = req.headers.get('x-webhook-secret') || '';

  if (providedSecret) {
    if (!expectedSecret || expectedSecret.length < 16 || !constantTimeEqual(providedSecret, expectedSecret)) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'x-webhook-secret inválido', authMethod: 'header_secret' });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    authMethod = 'header_secret';
  } else {
    if (!matchedInstance) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'instanceId divergente', authMethod: 'canonical' });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!messageId) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'messageId ausente', authMethod: 'canonical' });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    authMethod = 'canonical';
  }


  // CAMADA 3 — idempotência (autorizados anteriores com mesmo messageId)
  if (messageId) {
    const { data: dup } = await supabase
      .from('rotina_webhook_auditoria')
      .select('id')
      .eq('message_id', messageId)
      .eq('autorizado', true)
      .limit(1).maybeSingle();
    if (dup) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // Eventos não-operacionais: fromMe, eco da própria instância, status de mensagem,
    // ou ausência de phone → apenas audita, NUNCA muda status da rotina.
    if (evt.fromMe) {
      await audit(supabase, { ...baseAudit, autorizado: true, motivoBloqueio: 'fromMe=true: apenas auditado', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (evt.isGroup) {
      await audit(supabase, { ...baseAudit, autorizado: true, motivoBloqueio: 'mensagem de grupo: ignorada', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!senderPhone) {
      await audit(supabase, { ...baseAudit, autorizado: true, motivoBloqueio: 'sem phone: apenas auditado', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Respostas interativas de botão estão DESATIVADAS: nenhum botão altera rotina.
    if (evt.hasButton) {
      await audit(supabase, {
        ...baseAudit, autorizado: true,
        motivoBloqueio: 'botao_interativo_desativado',
        authMethod, statusAplicado: 'ignorado',
      });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrai texto da resposta apenas de mensagens de texto livre (Z-API text/body OU D-API message).
    const normalized = normalizeText(evt.text);
    const isFeito = !!normalized && WHITELIST_FEITO.has(normalized);
    const isNaoFeito = !!normalized && WHITELIST_NAO_FEITO.has(normalized);

    // Sem texto claro na whitelist → apenas audita (rotina NUNCA é alterada).
    if (!isFeito && !isNaoFeito) {
      await audit(supabase, {
        ...baseAudit, autorizado: true,
        motivoBloqueio: 'evento_sem_confirmacao_de_execucao',
        authMethod, statusAplicado: 'ignorado',
      });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const desiredStatus = isFeito ? 'completed' : 'not_completed';
    const concluida = isFeito;

    // CAMADA 4 — resolver telefone → user
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('telefone, user_id, unidade_id')
      .not('telefone', 'is', null).neq('telefone', '');

    const candidates: Array<{ user_id: string }> = [];
    for (const profile of (userProfiles || [])) {
      const profilePhone = normalizePhone(profile.telefone || '');
      if (!profilePhone) continue;
      const match = senderPhone === profilePhone
        || senderPhone.endsWith(profilePhone)
        || profilePhone.endsWith(senderPhone);
      if (match) candidates.push({ user_id: profile.user_id });
    }
    if (candidates.length === 0) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'telefone sem vínculo', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (candidates.length > 1) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'telefone vinculado a múltiplos usuários', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = candidates[0].user_id;

    // CAMADA 5 — uma única rotina pendente compatível para hoje desse usuário/unidade
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    const { data: unidades } = await supabase.rpc('get_user_unidades', { _user_id: userId });
    const unidadeIds: string[] = Array.isArray(unidades)
      ? unidades.map((u: { get_user_unidades?: string } | string) => typeof u === 'string' ? u : u.get_user_unidades).filter(Boolean) as string[]
      : [];
    if (unidadeIds.length === 0) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'usuário sem unidade', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rotinas pendentes hoje = rotinas das unidades sem rotina_execucoes para hoje (atividade_id null).
    const { data: rotinasUnidade } = await supabase
      .from('rotinas')
      .select('id, nome, unidade_id')
      .in('unidade_id', unidadeIds);
    if (!rotinasUnidade || rotinasUnidade.length === 0) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'sem rotinas na unidade', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rotinaIds = rotinasUnidade.map(r => r.id);
    const { data: execHoje } = await supabase
      .from('rotina_execucoes')
      .select('rotina_id')
      .in('rotina_id', rotinaIds)
      .eq('data_execucao', today)
      .is('atividade_id', null);
    const jaExecutadas = new Set((execHoje || []).map((e: { rotina_id: string }) => e.rotina_id));
    const pendentes = rotinasUnidade.filter(r => !jaExecutadas.has(r.id));

    if (pendentes.length === 0) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'nenhuma rotina pendente', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (pendentes.length > 1) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'múltiplas rotinas pendentes - ambíguo', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rotina = pendentes[0];
    if (!UUID_RE.test(rotina.id)) {
      await audit(supabase, { ...baseAudit, autorizado: false, motivoBloqueio: 'rotina_id inválido', authMethod, statusAplicado: 'ignorado' });
      return new Response(JSON.stringify({ ok: true, audited: true, action: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CAMADA 6 — rate limit por telefone+rotina
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('rotina_webhook_auditoria')
      .select('id', { count: 'exact', head: true })
      .eq('telefone_mascarado', telefoneMascarado)
      .eq('rotina_id', rotina.id)
      .gte('created_at', oneMinAgo);
    if ((recentCount ?? 0) >= 10) {
      await audit(supabase, { ...baseAudit, rotinaId: rotina.id, statusAplicado: desiredStatus, autorizado: false, motivoBloqueio: 'rate limit', authMethod });
      return new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CAMADA 7 — busca nome para registro
    const { data: authData } = await supabase.auth.admin.listUsers();
    const user = (authData?.users || []).find(u => u.id === userId);
    const matchedUserName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuário (via WhatsApp)';

    // APLICA execução (única rotina pendente, telefone vinculado, texto whitelisted)
    await supabase.from('rotina_execucoes').insert({
      rotina_id: rotina.id,
      atividade_id: null,
      data_execucao: today,
      concluida,
      concluida_por: `${matchedUserName} (via WhatsApp)`,
      concluida_em: concluida ? new Date().toISOString() : null,
      unidade_id: rotina.unidade_id,
    });

    await audit(supabase, {
      ...baseAudit, rotinaId: rotina.id, statusAplicado: desiredStatus,
      autorizado: true, motivoBloqueio: null, authMethod,
    });

    // Confirmação best-effort — canal OPERACIONAL (D-API se configurada, senão Z-API legado).
    try {
      const creds = getZapiCreds('operacional');
      if (creds) {
        const confirmMessage = concluida
          ? `✅ *Rotina concluída*\n\n🔹 *${rotina.nome}*\n👤 *Registrado por:* ${matchedUserName}`
          : `⚠️ *Rotina não realizada*\n\n🔹 *${rotina.nome}*\n👤 *Registrado por:* ${matchedUserName}`;
        const chave = buildIdempotencyKey(['rotina-whatsapp-response', messageId, rotina.id, desiredStatus, senderPhone]);
        await sendTextIdempotent(supabase, creds, senderPhone, confirmMessage, { chave, funcao: 'rotina-whatsapp-response' });
      }
    } catch (err) {
      console.error('[rotina-response] Erro confirmação:', err);
    }

    return new Response(
      JSON.stringify({ ok: true, rotina_id: rotina.id, status: desiredStatus, user: matchedUserName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[rotina-response] Erro:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
