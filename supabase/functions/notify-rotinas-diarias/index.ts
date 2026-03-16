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

    // Buscar rotinas ativas (não arquivadas)
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
      .select('rotina_id, atividade_id, concluida')
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

    // Função para encontrar telefone por nome
    function findPhoneByName(name: string): string | null {
      const user = authUsers.find(u => {
        const userName = u.user_metadata?.full_name || u.user_metadata?.name || '';
        return userName.toUpperCase() === name.toUpperCase().trim();
      });
      if (!user) return null;
      const profile = userProfiles?.find(p => p.user_id === user.id);
      return profile?.telefone || null;
    }

    // Agrupar rotinas pendentes por responsável
    const responsavelRotinas: Record<string, { rotinas: Array<{ nome: string; setor: string; horario: string | null; atividades: string[] }>; unidadeNome: string }> = {};

    for (const rotina of rotinas) {
      // Pular rotinas já totalmente concluídas hoje
      if (rotinasConcluidas.has(rotina.id)) continue;

      const responsavel = rotina.responsavel_principal;
      if (!responsavel) continue;

      const unidadeNome = unidadeMap.get(rotina.unidade_id) || 'Unidade';
      const rotinaAtividades = (atividades || [])
        .filter(a => a.rotina_id === rotina.id)
        .map(a => {
          let label = `• ${a.titulo}`;
          if (a.horario) label += ` (${a.horario.substring(0, 5)})`;
          if (a.responsavel && a.responsavel !== responsavel) label += ` - ${a.responsavel}`;
          return label;
        });

      if (!responsavelRotinas[responsavel]) {
        responsavelRotinas[responsavel] = { rotinas: [], unidadeNome };
      }

      responsavelRotinas[responsavel].rotinas.push({
        nome: rotina.nome,
        setor: rotina.setor,
        horario: rotina.horario_esperado,
        atividades: rotinaAtividades,
      });
    }

    // Enviar WhatsApp para cada responsável
    let sentCount = 0;
    const errors: string[] = [];

    for (const [responsavel, data] of Object.entries(responsavelRotinas)) {
      const phone = findPhoneByName(responsavel);
      if (!phone) {
        console.log(`[notify-rotinas] Telefone não encontrado para: ${responsavel}`);
        errors.push(`Telefone não encontrado: ${responsavel}`);
        continue;
      }

      const normalizedPhone = normalizePhone(phone);

      // Montar mensagem consolidada
      let message = `📋 *Rotinas Pendentes de Hoje*\n`;
      message += `📍 Unidade: *${data.unidadeNome}*\n`;
      message += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;

      for (const rotina of data.rotinas) {
        message += `🔹 *${rotina.nome}* (${rotina.setor})`;
        if (rotina.horario) {
          message += ` - ${rotina.horario.substring(0, 5)}`;
        }
        message += `\n`;

        if (rotina.atividades.length > 0) {
          message += rotina.atividades.join('\n') + '\n';
        }
        message += '\n';
      }

      message += `Total: *${data.rotinas.length} rotina(s)* pendente(s)\n`;
      message += `\nAcesse o sistema para marcar como concluída.`;

      console.log(`[notify-rotinas] Enviando para ${responsavel} (${normalizedPhone}): ${data.rotinas.length} rotinas`);

      const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

      try {
        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': ZAPI_CLIENT_TOKEN || '',
          },
          body: JSON.stringify({ phone: normalizedPhone, message }),
        });

        const zapiResult = await zapiResponse.json();

        if (zapiResponse.ok) {
          sentCount++;
          console.log(`[notify-rotinas] ✅ Enviado para ${responsavel}:`, zapiResult);
        } else {
          console.error(`[notify-rotinas] ❌ Erro Zapi para ${responsavel}:`, zapiResult);
          errors.push(`Erro Zapi: ${responsavel}`);
        }
      } catch (err) {
        console.error(`[notify-rotinas] ❌ Erro ao enviar para ${responsavel}:`, err);
        errors.push(`Erro envio: ${responsavel}`);
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
