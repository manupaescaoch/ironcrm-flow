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
 * Retorna a hora atual em Brasília (UTC-3) como { hour, minute, dayOfWeek, dateStr }
 */
function getBrasiliaTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const hour = Number(v.hour);
  const minute = Number(v.minute);
  // Calcular dia da semana usando data Brasília
  const brasiliaDate = new Date(`${v.year}-${v.month}-${v.day}T12:00:00Z`);
  return {
    hour,
    minute,
    dayOfWeek: brasiliaDate.getUTCDay(),
    dateStr: `${v.year}-${v.month}-${v.day}`,
    fullDate: brasiliaDate,
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

    // Verifica status do Z-API antes de qualquer envio
    let zapiConnected = false;
    try {
      const statusUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`;
      const statusResp = await fetch(statusUrl, {
        headers: { 'Client-Token': ZAPI_CLIENT_TOKEN || '' },
      });
      const statusData = await statusResp.json();
      zapiConnected = statusResp.ok && statusData?.connected === true;
      console.log(`[send-cronograma] Z-API status: connected=${zapiConnected}`, statusData);
    } catch (e) {
      console.error('[send-cronograma] Erro ao verificar status Z-API:', e);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Aceitar force_hour e force_minute para disparo manual
    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }

    const brasilia = getBrasiliaTime();
    const forceHour = body?.force_hour;
    const forceMinute = body?.force_minute ?? 0;
    const currentHour = forceHour !== undefined ? forceHour : brasilia.hour;
    const currentMinute = forceHour !== undefined ? forceMinute : brasilia.minute;
    const dayOfWeek = brasilia.dayOfWeek;
    const todayStr = brasilia.dateStr;
    const isForced = forceHour !== undefined;

    console.log(`[send-cronograma] Hora Brasília: ${currentHour}:${String(currentMinute).padStart(2, '0')}, dia semana: ${dayOfWeek}, data: ${todayStr}${isForced ? ' (FORÇADO)' : ''}`);

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
        JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
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

    // Filtrar atividades cujo horário está na janela atual
    const atividadesNaJanela = atividades.filter(a => {
      if (!a.horario) return false;
      const [hStr, mStr] = a.horario.split(':');
      const aHour = parseInt(hStr, 10);
      const aMinute = parseInt(mStr, 10);
      if (isForced) {
        // Quando forçado, enviar todas do horário exato
        return aHour === currentHour;
      }
      const aTotalMin = aHour * 60 + aMinute;
      const nowTotalMin = currentHour * 60 + currentMinute;
      // Janela de -20 a +2 minutos: cobre o horário-alvo + janela de recuperação
      // Com cron a cada 3 min, cada horário é tentado ~7 vezes (recuperação se Z-API falhar)
      // Duplicação é evitada via tabela cronograma_envios
      return aTotalMin >= nowTotalMin - 20 && aTotalMin <= nowTotalMin + 2;
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
      .gte('created_at', todayStr + 'T00:00:00-03:00')
      .lte('created_at', todayStr + 'T23:59:59-03:00');

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
        const formTitulo = formularioMap.get(atividade.formulario_id) || 'Formulário';
        const formLink = `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/formulario/${atividade.formulario_id}`;
        message =
          `✅ *${atividade.titulo}*\n` +
          `\n` +
          `📍 *Unidade:* ${unidadeNome}\n` +
          `🕒 *Horário:* ${atividade.horario?.substring(0, 5)}\n` +
          `👤 *Responsável:* ${resp.nome}\n` +
          `\n` +
          `📝 *Formulário:* ${formTitulo}\n` +
          `🔗 ${formLink}`;
      } else {
        message =
          `✅ *${atividade.titulo}*\n` +
          `\n` +
          `📍 *Unidade:* ${unidadeNome}\n` +
          `🕒 *Horário:* ${atividade.horario?.substring(0, 5)}\n` +
          `👤 *Responsável:* ${resp.nome}`;
      }

      console.log(`[send-cronograma] Enviando para ${resp.nome} (${normalizedPhone}): ${atividade.titulo}`);

      // Se Z-API está offline, registra erro imediatamente sem tentar enviar
      if (!zapiConnected) {
        console.error(`[send-cronograma] ❌ Z-API offline — marcando erro para ${resp.nome}`);
        await supabase.from('cronograma_envios').insert({
          atividade_id: atividade.id,
          formulario_id: atividade.formulario_id || null,
          funcionario_id: funcionarioId,
          unidade_id: atividade.unidade_id,
          status: 'erro',
          enviado_em: new Date().toISOString(),
        });
        errors.push(`Z-API offline: ${resp.nome} - ${atividade.titulo}`);
        continue;
      }

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
        await supabase.from('cronograma_envios').insert({
          atividade_id: atividade.id,
          formulario_id: formularioId || null,
          funcionario_id: funcionarioId,
          unidade_id: atividade.unidade_id,
          status: zapiResponse.ok ? 'enviado' : 'erro',
          enviado_em: new Date().toISOString(),
        });

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
