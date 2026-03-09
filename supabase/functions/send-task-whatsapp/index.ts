import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      console.error('ZAPI credentials not configured');
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
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
        JSON.stringify({ error: 'Failed to fetch user profiles', details: userError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Buscar todos os usuários para fazer match pelo nome
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: authError.message }),
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

    // Montar mensagem
    let message = '';
    if (notificationType === 'nova_tarefa') {
      message = `📋 *Nova Tarefa Atribuída*\n`;
      if (unidade_nome) {
        message += `📍 Unidade: *${unidade_nome}*\n`;
      }
      message += `\nVocê foi designado para: *${title}*\n`;
      if (description) {
        message += `\n📝 *Descrição:*\n${description}\n`;
      }
      if (creator_name) {
        message += `\nAtribuída por: ${creator_name}`;
      }
      message += `\n\nAcesse o sistema para ver os detalhes.`;
    } else {
      message = `🔄 *Tarefa Transferida*\n`;
      if (unidade_nome) {
        message += `📍 Unidade: *${unidade_nome}*\n`;
      }
      message += `\nA tarefa "*${title}*" foi transferida para você.\n`;
      if (description) {
        message += `\n📝 *Descrição:*\n${description}\n`;
      }
      message += `\nAcesse o sistema para ver os detalhes.`;
    }

    // Enviar via Zapi
    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN || '',
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: message,
      }),
    });

    const zapiResult = await zapiResponse.json();

    if (!zapiResponse.ok) {
      console.error('Zapi error:', zapiResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp', details: zapiResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('WhatsApp sent successfully:', zapiResult);

    return new Response(
      JSON.stringify({ success: true, zapiResponse: zapiResult }),
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
