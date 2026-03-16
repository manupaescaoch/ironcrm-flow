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

    // Buscar execuções de hoje para saber quais já foram concluídas
    const rotinaIds = rotinas.map(r => r.id);
    const { data: execucoes } = await supabase
      .from('rotina_execucoes')
      .select('rotina_id, concluida')
      .eq('data_execucao', today)
      .eq('concluida', true)
      .in('rotina_id', rotinaIds);

    const rotinasConcluidas = new Set((execucoes || []).map(e => e.rotina_id));

    // Buscar atividades de cada rotina
    const { data: atividades } = await supabase
      .from('rotina_atividades')
      .select('rotina_id, titulo, responsavel, horario')
      .in('rotina_id', rotinaIds)
      .order('ordem');

    // Buscar nomes das unidades
    const unidadeIds = [...new Set(rotinas.map(r => r.unidade_id))];
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, nome')
      .in('id', unidadeIds);

    const unidadeMap = new Map((unidades || []).map(u => [u.id, u.nome]));

    // Buscar perfis de telefone
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('telefone, user_id')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    // Buscar auth users para match por nome
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    function findPhoneByName(name: string): string | null {
      const user = authUsers.find(u => {
        const userName = u.user_metadata?.full_name || u.user_metadata?.name || '';
        return userName.toUpperCase() === name.toUpperCase().trim();
      });
      if (!user) return null;
      const profile = userProfiles?.find(p => p.user_id === user.id);
      return profile?.telefone || null;
    }

    // Enviar uma mensagem POR ROTINA com botões
    let sentCount = 0;
    const errors: string[] = [];

    for (const rotina of rotinas) {
      if (rotinasConcluidas.has(rotina.id)) continue;

      const responsavel = rotina.responsavel_principal;
      if (!responsavel) continue;

      const phone = findPhoneByName(responsavel);
      if (!phone) {
        console.log(`[notify-rotinas] Telefone não encontrado para: ${responsavel}`);
        errors.push(`Telefone não encontrado: ${responsavel}`);
        continue;
      }

      const normalizedPhone = normalizePhone(phone);
      const unidadeNome = unidadeMap.get(rotina.unidade_id) || 'Unidade';

      // Montar mensagem da rotina
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

      console.log(`[notify-rotinas] Enviando botões para ${responsavel} (${normalizedPhone}): ${rotina.nome}`);

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

    console.log(`[notify-rotinas] Concluído: ${sentCount} enviado(s), ${errors.length} erro(s)`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors, total_rotinas: rotinas.length }),
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
