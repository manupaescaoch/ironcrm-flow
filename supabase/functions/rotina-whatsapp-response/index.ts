import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Aceita formato Z-API real (button response chega como objeto aninhado).
// Não aceita "rotina_id"/"status" diretamente do payload.
const PayloadSchema = z.object({
  instanceId: z.string().max(80).optional(),
  messageId: z.string().max(120).optional(),
  zaapId: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  chatId: z.string().max(80).optional(),
  from: z.string().max(80).optional(),
  fromMe: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  buttonsResponseMessage: z.object({
    selectedButtonId: z.string().max(200).optional(),
    buttonId: z.string().max(200).optional(),
  }).optional(),
  buttonResponseMessage: z.object({
    selectedButtonId: z.string().max(200).optional(),
    buttonId: z.string().max(200).optional(),
  }).optional(),
}).passthrough();

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
    });
  } catch (err) {
    console.error('[rotina-response] Falha ao gravar auditoria:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ============================================================
  // CAMADA 0 – Configuração de servidor (fail-closed)
  // ============================================================
  const expectedInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!expectedInstanceId || !supabaseUrl || !serviceKey) {
    console.error('[rotina-response] Server misconfigured: ZAPI_INSTANCE_ID / SUPABASE_* ausente');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ============================================================
  // CAMADA 1 – Parse + validação de schema (Zod)
  // ============================================================
  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
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

  const messageId = payload.messageId || payload.zaapId || null;
  const instanceId = payload.instanceId || null;
  const senderPhone = normalizePhone(payload.phone || payload.chatId || payload.from || '');
  const telefoneMascarado = senderPhone ? maskPhone(senderPhone) : null;

  const payloadResumo = {
    fromMe: payload.fromMe ?? null,
    isGroup: payload.isGroup ?? null,
    hasButton: !!(payload.buttonsResponseMessage || payload.buttonResponseMessage),
  };

  const baseAudit = {
    messageId, instanceId, telefoneMascarado,
    rotinaId: null as string | null,
    statusAplicado: null as string | null,
    payloadResumo,
  };

  // ============================================================
  // CAMADA 2 – Autenticação em camadas
  //   (a) x-webhook-secret se vier
  //   (b) Senão, validação canônica via instanceId + dados Z-API
  // ============================================================
  let authMethod: string;
  const expectedSecret = Deno.env.get('ZAPI_WEBHOOK_SECRET') || '';
  const providedSecret = req.headers.get('x-webhook-secret') || '';

  if (providedSecret) {
    // Caminho (a): se o cliente mandou o header, ele DEVE estar correto.
    if (!expectedSecret || expectedSecret.length < 16 || !constantTimeEqual(providedSecret, expectedSecret)) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'x-webhook-secret inválido',
        authMethod: 'header_secret',
      });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    authMethod = 'header_secret';
  } else {
    // Caminho (b): validação canônica obrigatória.
    if (!instanceId || !constantTimeEqual(instanceId, expectedInstanceId)) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'instanceId ausente ou divergente',
        authMethod: 'canonical',
      });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!senderPhone) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'phone ausente',
        authMethod: 'canonical',
      });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!messageId) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'messageId/zaapId ausente',
        authMethod: 'canonical',
      });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (payload.fromMe === true) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'fromMe=true (eco da própria instância)',
        authMethod: 'canonical',
      });
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    authMethod = 'canonical';
  }

  try {
    // ============================================================
    // CAMADA 3 – Botão de rotina + status canônico
    // ============================================================
    const buttonResponse = payload.buttonsResponseMessage || payload.buttonResponseMessage;
    if (!buttonResponse) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'sem button response',
        authMethod,
      });
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const selectedButtonId = buttonResponse.selectedButtonId || buttonResponse.buttonId || '';
    const isFeito = selectedButtonId.startsWith('feito_');
    const isNaoFeito = selectedButtonId.startsWith('naofeito_');

    if (!isFeito && !isNaoFeito) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'botão desconhecido',
        authMethod,
      });
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'unknown button' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rotinaId = selectedButtonId.replace(/^(feito_|naofeito_)/, '');
    if (!UUID_RE.test(rotinaId)) {
      await audit(supabase, {
        ...baseAudit, autorizado: false,
        motivoBloqueio: 'rotina_id inválido',
        authMethod,
      });
      return new Response(JSON.stringify({ ok: false, error: 'invalid rotina id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const concluida = isFeito;
    const statusAplicado = concluida ? 'completed' : 'not_completed';

    // ============================================================
    // CAMADA 4 – Idempotência por messageId (autorizados)
    // ============================================================
    if (messageId) {
      const { data: dup } = await supabase
        .from('rotina_webhook_auditoria')
        .select('id')
        .eq('message_id', messageId)
        .eq('autorizado', true)
        .limit(1)
        .maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ============================================================
    // CAMADA 5 – Rate limit por telefone+rotina (10/min)
    // ============================================================
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('rotina_webhook_auditoria')
      .select('id', { count: 'exact', head: true })
      .eq('telefone_mascarado', telefoneMascarado)
      .eq('rotina_id', rotinaId)
      .gte('created_at', oneMinAgo);

    if ((recentCount ?? 0) >= 10) {
      await audit(supabase, {
        ...baseAudit, rotinaId, statusAplicado,
        autorizado: false,
        motivoBloqueio: 'rate limit telefone+rotina',
        authMethod,
      });
      return new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // CAMADA 6 – Rotina existe + ainda pendente para hoje
    // ============================================================
    const { data: rotina } = await supabase
      .from('rotinas')
      .select('id, nome, unidade_id')
      .eq('id', rotinaId)
      .maybeSingle();

    if (!rotina) {
      await audit(supabase, {
        ...baseAudit, rotinaId, statusAplicado,
        autorizado: false,
        motivoBloqueio: 'rotina inexistente',
        authMethod,
      });
      return new Response(JSON.stringify({ ok: false, error: 'rotina not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    const { data: existing } = await supabase
      .from('rotina_execucoes')
      .select('id, concluida')
      .eq('rotina_id', rotinaId)
      .eq('data_execucao', today)
      .is('atividade_id', null)
      .maybeSingle();

    if (existing && existing.concluida === concluida) {
      await audit(supabase, {
        ...baseAudit, rotinaId, statusAplicado,
        autorizado: false,
        motivoBloqueio: 'rotina já registrada com mesmo status',
        authMethod,
      });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // CAMADA 7 – Vínculo telefone -> rotina via unidade
    // ============================================================
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('telefone, user_id, unidade_id')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    let matchedUserName = 'Usuário (via WhatsApp)';
    let matchedUserId: string | null = null;
    let phoneBelongsToUnit = false;

    for (const profile of (userProfiles || [])) {
      const profilePhone = normalizePhone(profile.telefone || '');
      if (!profilePhone) continue;
      const isPhoneMatch =
        senderPhone === profilePhone ||
        senderPhone.endsWith(profilePhone) ||
        profilePhone.endsWith(senderPhone);
      if (!isPhoneMatch) continue;
      matchedUserId = profile.user_id;
      const user = authUsers.find((u) => u.id === profile.user_id);
      if (user) {
        matchedUserName = user.user_metadata?.full_name || user.user_metadata?.name || matchedUserName;
      }
      // Verifica acesso à unidade da rotina via has_role/get_user_unidades
      const { data: unidades } = await supabase.rpc('get_user_unidades', { _user_id: profile.user_id });
      const unidadeIds = Array.isArray(unidades) ? unidades.map((u: { get_user_unidades?: string } | string) =>
        typeof u === 'string' ? u : u.get_user_unidades) : [];
      if (unidadeIds.includes(rotina.unidade_id)) {
        phoneBelongsToUnit = true;
        break;
      }
    }

    if (!matchedUserId || !phoneBelongsToUnit) {
      await audit(supabase, {
        ...baseAudit, rotinaId, statusAplicado,
        autorizado: false,
        motivoBloqueio: matchedUserId
          ? 'telefone não pertence à unidade da rotina'
          : 'telefone não vinculado a nenhum usuário',
        authMethod,
      });
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // CAMADA 8 – Aplica execução
    // ============================================================
    if (existing) {
      await supabase
        .from('rotina_execucoes')
        .update({
          concluida,
          concluida_por: `${matchedUserName} (via WhatsApp)`,
          concluida_em: concluida ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('rotina_execucoes')
        .insert({
          rotina_id: rotinaId,
          atividade_id: null,
          data_execucao: today,
          concluida,
          concluida_por: `${matchedUserName} (via WhatsApp)`,
          concluida_em: concluida ? new Date().toISOString() : null,
          unidade_id: rotina.unidade_id,
        });
    }

    // Audit autorizado (cravando idempotência por messageId).
    await audit(supabase, {
      ...baseAudit, rotinaId, statusAplicado,
      autorizado: true,
      motivoBloqueio: null,
      authMethod,
    });

    // ============================================================
    // Confirmação via Z-API (best-effort, depois das validações)
    // ============================================================
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
    if (ZAPI_TOKEN) {
      const confirmMessage = concluida
        ? `✅ *Rotina concluída*\n\n🔹 *${rotina.nome}*\n👤 *Registrado por:* ${matchedUserName}\n\nObrigado pela confirmação! 👏`
        : `⚠️ *Rotina não realizada*\n\n🔹 *${rotina.nome}*\n👤 *Registrado por:* ${matchedUserName}\n\nRegistro feito. Caso precise reagendar, fale com a coordenação.`;
      const zapiUrl = `https://api.z-api.io/instances/${expectedInstanceId}/token/${ZAPI_TOKEN}/send-text`;
      try {
        await fetch(zapiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN || '' },
          body: JSON.stringify({ phone: senderPhone, message: confirmMessage }),
        });
      } catch (err) {
        console.error('[rotina-response] Erro ao enviar confirmação:', err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, rotina_id: rotinaId, status: statusAplicado, user: matchedUserName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[rotina-response] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
