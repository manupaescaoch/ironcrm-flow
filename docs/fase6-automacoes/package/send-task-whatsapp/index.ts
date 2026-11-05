import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { buildIdempotencyKey, checkZapiStatus, getZapiCreds, sendTextIdempotent, logEnvio } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Interface kept for documentation but made more flexible

/**
 * Normaliza telefone para formato brasileiro (55DDDNUMERO)
 */
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  
  // Se não começa com 55, adiciona
  if (!normalized.startsWith('55')) {
    normalized = '55' + normalized;
  }
  
  return normalized;
}


function getOperacionalCreds() {
  return getZapiCreds('operacional');
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: require cron secret header OR valid Supabase JWT for any non-OPTIONS request.
  {
    const __auth = await authorizeCronOrJwt(req);
    if (!__auth.ok) {
      return new Response(
        JSON.stringify({ error: __auth.error || 'Unauthorized' }),
        { status: __auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  try {
    const creds = getOperacionalCreds();
    if (!creds) {
      console.error('WhatsApp operacional não configurado');
      return new Response(
        JSON.stringify({ error: 'WhatsApp operacional não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // [WhatsApp health] aborta cedo se o chip estiver offline
    {
      const __st = await checkZapiStatus(creds);
      if (!__st.connected) {
        console.warn(`[send-task-whatsapp] ${creds.provider} offline — abortando`, __st.raw);
        return new Response(
          JSON.stringify({ error: 'WhatsApp operacional desconectado', provider: creds.provider, status: __st.raw }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
    const supabase = createClient(

      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { task_id, task_title, task_description, responsavel_name, responsavel, tipo, creator_name, isNewTask, unidade_nome, prazo, hora_prazo } = body;
    
    // Support both old and new parameter names
    const targetName = responsavel_name || responsavel;
    const notificationType = tipo || (isNewTask ? 'nova_tarefa' : 'tarefa_atualizada');
    const description = task_description || null;
    const title = task_title || body.taskTitle;

    console.log(`Processing WhatsApp for task: ${task_id || 'new'}, responsavel: ${targetName}`);

    if (!targetName) {
      return new Response(
        JSON.stringify({ error: 'Missing responsavel name' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar telefone diretamente via query (evita problema de schema cache com RPC)
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('telefone, user_id')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    if (userError) {
      console.error('Error fetching user profiles:', userError);
      return new Response(
        JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Buscar todos os usuários para fazer match pelo nome
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return new Response(
        JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Encontrar usuário pelo nome
    const targetUser = authUsers.users.find(u => {
      const userName = u.user_metadata?.full_name || u.user_metadata?.name || '';
      return userName.toUpperCase() === targetName.toUpperCase().trim();
    });

    if (!targetUser) {
      console.log(`User not found: ${targetName}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'user_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Encontrar telefone do usuário
    const userProfile = userData?.find(p => p.user_id === targetUser.id);
    const phone = userProfile?.telefone;

    if (!phone) {
      console.log(`No phone found for user: ${targetName}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'no_phone_registered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    console.log(`Sending WhatsApp to: ${normalizedPhone}`);

    // Format deadline string
    let prazoStr = '';
    if (prazo) {
      const [year, month, day] = prazo.split('-');
      prazoStr = `${day}/${month}/${year}`;
      if (hora_prazo) {
        prazoStr += ` às ${hora_prazo.substring(0, 5)}`;
      }
    }

    // Montar mensagem
    let message = '';
    if (notificationType === 'nova_tarefa') {
      message = `📝 *Nova tarefa atribuída*\n\n`;
      message += `📋 *Tarefa:* ${title}\n`;
      if (unidade_nome) message += `📍 *Unidade:* ${unidade_nome}\n`;
      if (prazoStr) message += `🕒 *Prazo:* ${prazoStr}\n`;
      message += `👤 *Responsável:* ${targetName}\n`;
      if (creator_name) message += `👤 *Atribuída por:* ${creator_name}\n`;
      if (description) {
        message += `\n💬 *Descrição:*\n${description}\n`;
      }
      message += `\nAcesse o sistema para ver os detalhes.`;
    } else {
      message = `🔄 *Tarefa transferida*\n\n`;
      message += `📋 *Tarefa:* ${title}\n`;
      if (unidade_nome) message += `📍 *Unidade:* ${unidade_nome}\n`;
      if (prazoStr) message += `🕒 *Prazo:* ${prazoStr}\n`;
      message += `👤 *Novo responsável:* ${targetName}\n`;
      if (description) {
        message += `\n💬 *Descrição:*\n${description}\n`;
      }
      message += `\nAcesse o sistema para ver os detalhes.`;
    }

    // Enviar via D-API (operacional)
    const chave = buildIdempotencyKey(['send-task-whatsapp', task_id, notificationType, targetUser.id, prazo, hora_prazo, normalizedPhone]);
    const sendResult = await sendTextIdempotent(supabase, creds, normalizedPhone, message, { chave, funcao: 'send-task-whatsapp' });
    if (sendResult.skipped) return new Response(JSON.stringify({ success: true, duplicate: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const zapiResult = sendResult.body;
    const success = sendResult.ok && !!(zapiResult?.messageId || zapiResult?.id);
    const errorMsg = success ? null : (zapiResult?.error || JSON.stringify(zapiResult).slice(0, 500));

    await logEnvio(supabase, {
      funcao: 'send-task-whatsapp',
      destino: normalizedPhone,
      tipo_destino: 'funcionario',
      sucesso: success,
      erro_msg: errorMsg,
      zapi_status_code: sendResult.status,
      canal: 'operacional',
      resposta_completa: zapiResult,
    });

    if (!success) {
      console.error(`${creds.provider} error:`, zapiResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp', details: zapiResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`${creds.provider} sent successfully:`, zapiResult);

    return new Response(
      JSON.stringify({ success: true, zapiResponse: zapiResult, provider: creds.provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );


  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in send-task-whatsapp:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
