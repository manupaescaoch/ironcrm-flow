import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (!normalized.startsWith('55')) {
    normalized = '55' + normalized;
  }
  return normalized;
}

function shouldSendToday(frequencia: string): boolean {
  const now = new Date();
  // Convert to Brasília time (UTC-3)
  const brasiliaOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const brasiliaDate = new Date(utcMs + brasiliaOffset * 60000);
  const dayOfWeek = brasiliaDate.getDay(); // 0=Sun, 1=Mon...6=Sat

  switch (frequencia) {
    case 'diaria':
      return true;
    case 'seg_a_sex':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'seg_a_sab':
      return dayOfWeek >= 1 && dayOfWeek <= 6;
    case 'semanal_seg':
      return dayOfWeek === 1;
    case 'semanal_ter':
      return dayOfWeek === 2;
    case 'semanal_qua':
      return dayOfWeek === 3;
    case 'semanal_qui':
      return dayOfWeek === 4;
    case 'semanal_sex':
      return dayOfWeek === 5;
    case 'semanal_sab':
      return dayOfWeek === 6;
    case 'semanal_dom':
      return dayOfWeek === 0;
    default:
      // For unknown frequencies, default to sending
      return true;
  }
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
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];
    console.log(`[notify-rotinas] Buscando rotinas ativas para hoje: ${today}`);

    const { data: rotinas, error: rotinasError } = await supabase
      .from('rotinas')
      .select('id, nome, descricao, setor, responsavel_principal, horario_esperado, unidade_id, frequencia')
      .eq('ativo', true)
      .eq('arquivada', false);

    if (rotinasError) {
      console.error('Erro ao buscar rotinas:', rotinasError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch rotinas', details: rotinasError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!rotinas || rotinas.length === 0) {
      console.log('[notify-rotinas] Nenhuma rotina ativa encontrada');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma rotina ativa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by frequency / day-of-week
    const eligibleRotinas = rotinas.filter(r => shouldSendToday(r.frequencia));
    const skippedByFrequency = rotinas.length - eligibleRotinas.length;
    console.log(`[notify-rotinas] Total: ${rotinas.length}, Elegíveis hoje: ${eligibleRotinas.length}, Ignoradas por frequência: ${skippedByFrequency}`);

    if (eligibleRotinas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped_frequency: skippedByFrequency, message: 'Nenhuma rotina elegível hoje' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which are already completed today
    const rotinaIds = eligibleRotinas.map(r => r.id);
    const { data: execucoes } = await supabase
      .from('rotina_execucoes')
      .select('rotina_id, concluida')
      .eq('data_execucao', today)
      .eq('concluida', true)
      .in('rotina_id', rotinaIds);

    const rotinasConcluidas = new Set((execucoes || []).map(e => e.rotina_id));

    // Fetch activities
    const { data: atividades } = await supabase
      .from('rotina_atividades')
      .select('rotina_id, titulo, responsavel, horario')
      .in('rotina_id', rotinaIds)
      .order('ordem');

    // Fetch unit names
    const unidadeIds = [...new Set(eligibleRotinas.map(r => r.unidade_id))];
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, nome')
      .in('id', unidadeIds);

    const unidadeMap = new Map((unidades || []).map(u => [u.id, u.nome]));

    // Fetch user phone profiles
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('telefone, user_id')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    function findPhoneByName(name: string): string | null {
      const normalizedName = name.toUpperCase().trim();
      const user = authUsers.find(u => {
        const userName = (u.user_metadata?.full_name || u.user_metadata?.name || '').toUpperCase().trim();
        return userName === normalizedName;
      });
      if (!user) return null;
      const profile = userProfiles?.find(p => p.user_id === user.id);
      return profile?.telefone || null;
    }

    // Send one message per eligible rotina
    let sentCount = 0;
    let skippedConcluida = 0;
    const errors: string[] = [];

    for (const rotina of eligibleRotinas) {
      if (rotinasConcluidas.has(rotina.id)) {
        skippedConcluida++;
        console.log(`[notify-rotinas] Ignorada (já concluída): ${rotina.nome}`);
        continue;
      }

      const responsavel = rotina.responsavel_principal;
      if (!responsavel) {
        console.log(`[notify-rotinas] Ignorada (sem responsável): ${rotina.nome}`);
        continue;
      }

      const phone = findPhoneByName(responsavel);
      if (!phone) {
        console.log(`[notify-rotinas] Telefone não encontrado para: ${responsavel}`);
        errors.push(`Telefone não encontrado: ${responsavel}`);
        continue;
      }

      const normalizedPhone = normalizePhone(phone);
      const unidadeNome = unidadeMap.get(rotina.unidade_id) || 'Unidade';

      const rotinaAtividades = (atividades || [])
        .filter(a => a.rotina_id === rotina.id)
        .map(a => {
          let label = `• ${a.titulo}`;
          if (a.horario) label += ` (${a.horario.substring(0, 5)})`;
          if (a.responsavel && a.responsavel !== responsavel) label += ` - ${a.responsavel}`;
          return label;
        });

      let message = `📋 *Rotina Pendente*\n`;
      message += `📍 *${unidadeNome}*\n`;
      message += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;
      message += `🔹 *${rotina.nome}* (${rotina.setor})`;
      if (rotina.horario_esperado) {
        message += ` - ${rotina.horario_esperado.substring(0, 5)}`;
      }
      message += `\n`;

      if (rotinaAtividades.length > 0) {
        message += rotinaAtividades.join('\n') + '\n';
      }

      message += `\nClique abaixo para confirmar:`;

      console.log(`[notify-rotinas] Enviando para ${responsavel} (${normalizedPhone}): ${rotina.nome}`);

      const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-button-list`;

      try {
        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': ZAPI_CLIENT_TOKEN || '',
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            message,
            buttonList: {
              buttons: [
                { id: `feito_${rotina.id}`, label: '✅ Feito' },
                { id: `naofeito_${rotina.id}`, label: '❌ Não feito' },
              ],
            },
          }),
        });

        const zapiResult = await zapiResponse.json();

        if (zapiResponse.ok) {
          sentCount++;
          console.log(`[notify-rotinas] ✅ Enviado para ${responsavel}:`, zapiResult);
        } else {
          console.error(`[notify-rotinas] ❌ Erro Zapi para ${responsavel}:`, zapiResult);
          errors.push(`Erro Zapi: ${responsavel} - ${rotina.nome}`);
        }
      } catch (err) {
        console.error(`[notify-rotinas] ❌ Erro ao enviar para ${responsavel}:`, err);
        errors.push(`Erro envio: ${responsavel} - ${rotina.nome}`);
      }
    }

    console.log(`[notify-rotinas] Concluído: ${sentCount} enviado(s), ${skippedConcluida} já concluída(s), ${skippedByFrequency} fora da frequência, ${errors.length} erro(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped_frequency: skippedByFrequency,
        skipped_concluida: skippedConcluida,
        errors,
        total_rotinas: rotinas.length,
        eligible: eligibleRotinas.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[notify-rotinas] Erro geral:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
