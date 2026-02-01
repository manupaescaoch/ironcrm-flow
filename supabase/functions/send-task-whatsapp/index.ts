import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskNotification {
  task_id: string;
  task_title: string;
  responsavel_name: string;
  tipo: 'nova_tarefa' | 'tarefa_atualizada';
  creator_name?: string;
}

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

    const body: TaskNotification = await req.json();
    const { task_id, task_title, responsavel_name, tipo, creator_name } = body;

    console.log(`Processing WhatsApp for task: ${task_id}, responsavel: ${responsavel_name}`);

    // Buscar telefone do responsável usando a função get_user_phone_by_name
    const { data: phone, error: phoneError } = await supabase.rpc('get_user_phone_by_name', {
      p_name: responsavel_name
    });

    if (phoneError) {
      console.error('Error fetching phone:', phoneError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user phone', details: phoneError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!phone) {
      console.log(`No phone found for user: ${responsavel_name}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'no_phone_registered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    console.log(`Sending WhatsApp to: ${normalizedPhone}`);

    // Montar mensagem
    let message = '';
    if (tipo === 'nova_tarefa') {
      message = `📋 *Nova Tarefa Atribuída*\n\n`;
      message += `Você foi designado para: *${task_title}*\n`;
      if (creator_name) {
        message += `Atribuída por: ${creator_name}\n`;
      }
      message += `\nAcesse o sistema para ver os detalhes.`;
    } else {
      message = `🔄 *Tarefa Transferida*\n\n`;
      message += `A tarefa "*${task_title}*" foi transferida para você.\n`;
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
