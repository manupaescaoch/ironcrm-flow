import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (!normalized.startsWith('55')) {
    normalized = '55' + normalized;
  }
  return normalized;
}

/**
 * Retorna a hora atual em Brasília (UTC-3) como { hour, minute, dayOfWeek }
 */
function getBrasiliaTime() {
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const brasilia = new Date(brasiliaStr);
  return {
    hour: brasilia.getHours(),
    minute: brasilia.getMinutes(),
    dayOfWeek: brasilia.getDay(), // 0=Dom, 1=Seg, ..., 6=Sab
    dateStr: brasilia.toISOString().split('T')[0],
    fullDate: brasilia,
  };
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

    const brasilia = getBrasiliaTime();
    const currentHour = brasilia.hour;
    const currentMinute = brasilia.minute;
    const dayOfWeek = brasilia.dayOfWeek;
    const todayStr = brasilia.dateStr;

    console.log(`[send-cronograma] Hora Brasília: ${currentHour}:${String(currentMinute).padStart(2, '0')}, dia semana: ${dayOfWeek}, data: ${todayStr}`);

    // Buscar atividades ativas do dia da semana atual
    const { data: atividades, error: atividadesError } = await supabase
      .from('cronograma_atividades')
      .select(`
        id, titulo, horario, mensagem, formulario_id, unidade_id,
        responsavel:cronograma_funcionarios!cronograma_atividades_responsavel_id_fkey(id, nome, telefone)
      `)
      .eq('ativo', true)
      .eq('dia_semana', dayOfWeek);

    if (atividadesError) {
      console.error('[send-cronograma] Erro ao buscar atividades:', atividadesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities', details: atividadesError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!atividades || atividades.length === 0) {
      console.log('[send-cronograma] Nenhuma atividade para hoje');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma atividade para hoje' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar atividades cujo horário está na janela atual (±7 min para cobrir cron de 15 em 15)
    const atividadesNaJanela = atividades.filter(a => {
      if (!a.horario) return false;
      const [hStr, mStr] = a.horario.split(':');
      const aHour = parseInt(hStr, 10);
      const aMinute = parseInt(mStr, 10);
      const aTotalMin = aHour * 60 + aMinute;
      const nowTotalMin = currentHour * 60 + currentMinute;
      // Janela de -2 a +12 minutos (cobre cron a cada 15 min)
      return aTotalMin >= nowTotalMin - 2 && aTotalMin <= nowTotalMin + 12;
    });

    console.log(`[send-cronograma] ${atividadesNaJanela.length} atividade(s) na janela de horário`);

    if (atividadesNaJanela.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma atividade na janela atual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar quais já foram enviadas hoje (para não duplicar)
    const atividadeIds = atividadesNaJanela.map(a => a.id);
    const { data: enviosHoje } = await supabase
      .from('cronograma_envios')
      .select('atividade_id, funcionario_id')
      .in('atividade_id', atividadeIds)
      .gte('created_at', todayStr + 'T00:00:00')
      .lte('created_at', todayStr + 'T23:59:59');

    const enviosSet = new Set(
      (enviosHoje || []).map(e => `${e.atividade_id}_${e.funcionario_id}`)
    );

    // Buscar nomes das unidades
    const unidadeIds = [...new Set(atividadesNaJanela.map(a => a.unidade_id))];
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, nome')
      .in('id', unidadeIds);
    const unidadeMap = new Map((unidades || []).map(u => [u.id, u.nome]));

    // Buscar nomes dos formulários vinculados
    const formularioIds = atividadesNaJanela
      .filter(a => a.formulario_id)
      .map(a => a.formulario_id);
    
    let formularioMap = new Map<string, string>();
    if (formularioIds.length > 0) {
      const { data: formularios } = await supabase
        .from('formularios')
        .select('id, titulo')
        .in('id', formularioIds);
      formularioMap = new Map((formularios || []).map(f => [f.id, f.titulo]));
    }

    let sentCount = 0;
    const errors: string[] = [];
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

    for (const atividade of atividadesNaJanela) {
      const resp = atividade.responsavel as any;
      if (!resp || !resp.telefone) {
        console.log(`[send-cronograma] Sem responsável/telefone para: ${atividade.titulo}`);
        continue;
      }

      const funcionarioId = resp.id;
      const chave = `${atividade.id}_${funcionarioId}`;
      if (enviosSet.has(chave)) {
        console.log(`[send-cronograma] Já enviado hoje: ${atividade.titulo} → ${resp.nome}`);
        continue;
      }

      const normalizedPhone = normalizePhone(resp.telefone);
      const unidadeNome = unidadeMap.get(atividade.unidade_id) || 'Unidade';

      // Montar a mensagem
      let message = '';
      if (atividade.mensagem) {
        // Mensagem customizada
        message = atividade.mensagem;
      } else if (atividade.formulario_id) {
        // Formulário vinculado
        const formTitulo = formularioMap.get(atividade.formulario_id) || 'Formulário';
        const formLink = `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/formulario/${atividade.formulario_id}`;
        message = `📋 *${atividade.titulo}*\n`;
        message += `📍 *${unidadeNome}*\n`;
        message += `⏰ ${atividade.horario?.substring(0, 5)}\n`;
        message += `👤 ${resp.nome}\n\n`;
        message += `Preencha o formulário: ${formTitulo}\n`;
        message += formLink;
      } else {
        // Sem mensagem e sem formulário - enviar lembrete básico
        message = `📋 *${atividade.titulo}*\n`;
        message += `📍 *${unidadeNome}*\n`;
        message += `⏰ ${atividade.horario?.substring(0, 5)}\n`;
        message += `👤 ${resp.nome}`;
      }

      console.log(`[send-cronograma] Enviando para ${resp.nome} (${normalizedPhone}): ${atividade.titulo}`);

      const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

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
          }),
        });

        const zapiResult = await zapiResponse.json();

        // Registrar envio no cronograma_envios
        const formularioId = atividade.formulario_id;
        // Se não tem formulario_id, precisamos de um para o registro (campo obrigatório)
        // Usamos o formulario_id da atividade ou criamos um registro sem
        if (formularioId) {
          await supabase.from('cronograma_envios').insert({
            atividade_id: atividade.id,
            formulario_id: formularioId,
            funcionario_id: funcionarioId,
            unidade_id: atividade.unidade_id,
            status: zapiResponse.ok ? 'enviado' : 'erro',
            enviado_em: new Date().toISOString(),
          });
        }

        if (zapiResponse.ok) {
          sentCount++;
          console.log(`[send-cronograma] ✅ Enviado para ${resp.nome}:`, zapiResult);
        } else {
          console.error(`[send-cronograma] ❌ Erro Zapi para ${resp.nome}:`, zapiResult);
          errors.push(`Erro Zapi: ${resp.nome} - ${atividade.titulo}`);
        }
      } catch (err) {
        console.error(`[send-cronograma] ❌ Erro ao enviar para ${resp.nome}:`, err);
        errors.push(`Erro envio: ${resp.nome} - ${atividade.titulo}`);
      }
    }

    console.log(`[send-cronograma] Concluído: ${sentCount} enviado(s), ${errors.length} erro(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        errors,
        total_na_janela: atividadesNaJanela.length,
        hora_brasilia: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[send-cronograma] Erro geral:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
