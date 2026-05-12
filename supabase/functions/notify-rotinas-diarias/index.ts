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

/** Retorna hora Brasília atual (via Intl) */
function getBrasiliaTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const brasiliaDate = new Date(`${v.year}-${v.month}-${v.day}T12:00:00Z`);
  return {
    hour: Number(v.hour),
    minute: Number(v.minute),
    dayOfWeek: brasiliaDate.getUTCDay(),
    dateStr: `${v.year}-${v.month}-${v.day}`,
  };
}

const DAY_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
};

/**
 * Verifica se a rotina deve ser enviada hoje baseado na frequência.
 * Formatos suportados:
 *   - "diaria"
 *   - "seg_a_sex"
 *   - "seg_a_sab"
 *   - "semanal:seg,ter,qua,qui,sex"
 *   - "semanal_seg", "semanal_ter", etc.
 */
function shouldSendToday(frequencia: string, dayOfWeek: number): boolean {
  if (!frequencia) return true;

  const freq = frequencia.toLowerCase().trim();

  if (freq === 'diaria') return true;

  if (freq === 'seg_a_sex') return dayOfWeek >= 1 && dayOfWeek <= 5;

  if (freq === 'seg_a_sab') return dayOfWeek >= 1 && dayOfWeek <= 6;

  // Formato "semanal:seg,ter,qua,qui,sex"
  if (freq.startsWith('semanal:')) {
    const dias = freq.replace('semanal:', '').split(',').map(d => d.trim());
    return dias.some(d => DAY_MAP[d] === dayOfWeek);
  }

  // Formato legado "semanal_seg", "semanal_ter", etc.
  if (freq.startsWith('semanal_')) {
    const dia = freq.replace('semanal_', '');
    return DAY_MAP[dia] === dayOfWeek;
  }

  // Desconhecido — enviar por segurança
  return true;
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

    // Aceitar force_hour para disparo manual
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

    console.log(`[notify-rotinas] Hora Brasília: ${currentHour}:${String(currentMinute).padStart(2, '0')}, dia semana: ${dayOfWeek}, data: ${todayStr}${isForced ? ' (FORÇADO)' : ''}`);

    // Buscar rotinas ativas e não arquivadas
    const { data: rotinas, error: rotinasError } = await supabase
      .from('rotinas')
      .select('id, nome, descricao, setor, responsavel_principal, horario_esperado, unidade_id, frequencia')
      .eq('ativo', true)
      .eq('arquivada', false);

    if (rotinasError) {
      console.error('Erro ao buscar rotinas:', rotinasError);
      return new Response(
        JSON.stringify({ error: 'Erro interno ao processar a solicitação.' }),
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

    // 1. Filtrar por frequência / dia da semana
    const eligibleByDay = rotinas.filter(r => shouldSendToday(r.frequencia, dayOfWeek));
    console.log(`[notify-rotinas] Total: ${rotinas.length}, Elegíveis pelo dia: ${eligibleByDay.length}`);

    // 2. Filtrar por janela de horário (-2 a +12 min)
    const eligibleByTime = eligibleByDay.filter(r => {
      if (!r.horario_esperado) return false;
      const [hStr, mStr] = r.horario_esperado.split(':');
      const rHour = parseInt(hStr, 10);
      const rMinute = parseInt(mStr, 10);

      if (isForced) {
        return rHour === currentHour;
      }

      const rTotalMin = rHour * 60 + rMinute;
      const nowTotalMin = currentHour * 60 + currentMinute;
      return rTotalMin >= nowTotalMin - 2 && rTotalMin <= nowTotalMin + 12;
    });

    console.log(`[notify-rotinas] Na janela de horário: ${eligibleByTime.length}`);

    if (eligibleByTime.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma rotina na janela atual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rotinaIds = eligibleByTime.map(r => r.id);

    // 3. Verificar já notificadas hoje (rotina_notificacoes)
    const { data: notificacoesHoje } = await supabase
      .from('rotina_notificacoes')
      .select('rotina_id')
      .in('rotina_id', rotinaIds)
      .eq('data_envio', todayStr);

    const jaNotificadas = new Set((notificacoesHoje || []).map(n => n.rotina_id));

    // 4. Verificar já concluídas hoje (rotina_execucoes)
    const { data: execucoes } = await supabase
      .from('rotina_execucoes')
      .select('rotina_id')
      .in('rotina_id', rotinaIds)
      .eq('data_execucao', todayStr)
      .eq('concluida', true);

    const jaConcluidas = new Set((execucoes || []).map(e => e.rotina_id));

    // 5. Buscar atividades, unidades e perfis de telefone
    const { data: atividades } = await supabase
      .from('rotina_atividades')
      .select('rotina_id, titulo, responsavel, horario')
      .in('rotina_id', rotinaIds)
      .order('ordem');

    const unidadeIds = [...new Set(eligibleByTime.map(r => r.unidade_id))];
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, nome')
      .in('id', unidadeIds);
    const unidadeMap = new Map((unidades || []).map(u => [u.id, u.nome]));

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

    // 6. Enviar mensagens
    let sentCount = 0;
    let skippedNotificada = 0;
    let skippedConcluida = 0;
    const errors: string[] = [];

    for (const rotina of eligibleByTime) {
      if (jaNotificadas.has(rotina.id)) {
        skippedNotificada++;
        console.log(`[notify-rotinas] Já notificada hoje: ${rotina.nome}`);
        continue;
      }
      if (jaConcluidas.has(rotina.id)) {
        skippedConcluida++;
        console.log(`[notify-rotinas] Já concluída hoje: ${rotina.nome}`);
        continue;
      }

      const responsavel = rotina.responsavel_principal;
      if (!responsavel) {
        console.log(`[notify-rotinas] Sem responsável: ${rotina.nome}`);
        errors.push(`Sem responsável: ${rotina.nome}`);
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
          if (a.horario) label += ` — ${a.horario.substring(0, 5)}`;
          if (a.responsavel && a.responsavel !== responsavel) label += ` (${a.responsavel})`;
          return label;
        });

      const dataHoje = new Date().toLocaleDateString('pt-BR');
      const horarioRotina = rotina.horario_esperado ? rotina.horario_esperado.substring(0, 5) : null;

      let message = `🔧 *Rotina pendente*\n`;
      message += `\n`;
      message += `📍 *Unidade:* ${unidadeNome}\n`;
      message += `📅 *Data:* ${dataHoje}\n`;
      if (horarioRotina) {
        message += `🕒 *Horário previsto:* ${horarioRotina}\n`;
      }
      message += `👤 *Responsável:* ${responsavel}\n`;
      message += `\n`;
      message += `🔹 *${rotina.nome}*\n`;
      message += `_${rotina.setor}_`;

      if (rotinaAtividades.length > 0) {
        message += `\n\n📝 *Checklist:*\n`;
        message += rotinaAtividades.join('\n');
      }

      console.log(`[notify-rotinas] Enviando para ${responsavel} (${normalizedPhone}): ${rotina.nome}`);

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

        const zapiResult = await zapiResponse.json().catch(() => ({}));

        console.log(`[notify-rotinas] Z-API status=${zapiResponse.status} para ${rotina.nome}:`, JSON.stringify(zapiResult));

        if (zapiResponse.ok) {
          sentCount++;
          console.log(`[notify-rotinas] ✅ Enviado: ${rotina.nome}`);

          await supabase.from('rotina_notificacoes').insert({
            rotina_id: rotina.id,
            data_envio: todayStr,
            status: 'enviado',
          });
        } else {
          console.error(`[notify-rotinas] ❌ Erro Zapi (${zapiResponse.status}): ${rotina.nome}`, zapiResult);
          errors.push(`Erro Zapi (${zapiResponse.status}): ${responsavel} - ${rotina.nome}`);

          await supabase.from('rotina_notificacoes').insert({
            rotina_id: rotina.id,
            data_envio: todayStr,
            status: 'falhou',
          });
        }
      } catch (err) {
        console.error(`[notify-rotinas] ❌ Erro envio: ${rotina.nome}`, err);
        errors.push(`Erro envio: ${responsavel} - ${rotina.nome}`);

        await supabase.from('rotina_notificacoes').insert({
          rotina_id: rotina.id,
          data_envio: todayStr,
          status: 'falhou',
        });
      }
    }

    console.log(`[notify-rotinas] Concluído: ${sentCount} enviado(s), ${skippedNotificada} já notificada(s), ${skippedConcluida} já concluída(s), ${errors.length} erro(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped_notificada: skippedNotificada,
        skipped_concluida: skippedConcluida,
        errors,
        total_rotinas: rotinas.length,
        eligible_day: eligibleByDay.length,
        eligible_time: eligibleByTime.length,
        hora_brasilia: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
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
