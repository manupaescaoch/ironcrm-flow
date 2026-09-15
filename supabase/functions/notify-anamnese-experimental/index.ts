import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { logEnvio } from '../_shared/zapi.ts';
import { resolveGrupoUnidade, sendTelegramGroupText } from '../_shared/telegram.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FUNC = 'notify-anamnese-experimental';
const NA = 'Não informado';
const extractDateOnly = (value: unknown) => {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
};
const formatDateOnlyBR = (value: unknown) => {
  const dateOnly = extractDateOnly(value);
  if (!dateOnly) return NA;
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
};
const fmt = (v: unknown) => {
  if (v === null || v === undefined) return NA;
  if (typeof v === 'string') return v.trim().length > 0 ? v : NA;
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : NA;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // SECURITY: require cron secret header OR valid Supabase JWT.
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
    const { anamnese_id } = await req.json().catch(() => ({}));
    if (!anamnese_id) {
      return new Response(JSON.stringify({ error: 'anamnese_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: a, error } = await supabase
      .from('anamneses_experimental')
      .select('*')
      .eq('id', anamnese_id)
      .maybeSingle();
    if (error || !a) throw error || new Error('anamnese não encontrada');

    const { data: lead } = await supabase
      .from('leads')
      .select('nome, data_aula_experimental, hora_aula_experimental, unidade_id')
      .eq('id', a.lead_id)
      .maybeSingle();
    const { data: unidade } = await supabase
      .from('unidades')
      .select('nome')
      .eq('id', a.unidade_id)
      .maybeSingle();

    const dataAulaBase = formatDateOnlyBR(lead?.data_aula_experimental);
    const horaAula = lead?.hora_aula_experimental
      ? String(lead.hora_aula_experimental).slice(0, 5)
      : null;
    const dataAula = horaAula && dataAulaBase !== NA
      ? `${dataAulaBase} às ${horaAula}`
      : dataAulaBase;

    const condicao =
      a.tem_condicao_saude === true
        ? `Sim — ${fmt(a.condicao_saude_descricao)}`
        : a.tem_condicao_saude === false
          ? 'Não'
          : NA;
    const lesao =
      a.tem_lesao === true
        ? `Sim — ${fmt(a.lesao_descricao)}`
        : a.tem_lesao === false
          ? 'Não'
          : NA;

    const message = `🧪 *Nova anamnese — Aula experimental*

👤 *Nome:* ${fmt(lead?.nome)}
🎂 *Data de nascimento:* ${formatDateOnlyBR(a.data_nascimento)}
📍 *Unidade:* ${fmt(unidade?.nome)}
📅 *Data da aula:* ${dataAula}

🎯 *Objetivo*
${fmt(a.objetivo)}

🏋️ *Histórico*
${fmt(a.historico)}

📅 *Frequência disponível*
${fmt(a.dias_semana)}

🕒 *Melhor horário*
${fmt(a.preferencia_horario)}

🚧 *Maior obstáculo*
${fmt(a.obstaculo)}

🩺 *Condição de saúde*
${condicao}

⚠️ *Lesão ou limitação*
${lesao}

📝 *Observações*
${fmt(a.observacoes)}

———
_Anamnese preenchida pela recepção no momento da chegada do lead._`;

    // Grupo da unidade no Telegram (comercial; fallback coordenadores/gerência)
    const grupo = await resolveGrupoUnidade(supabase, a.unidade_id, ['comercial', 'coordenadores', 'gerencia']);

    if (!grupo) {
      console.log('[anamnese] unidade sem grupo do Telegram conectado — pulando envio.', {
        unidade: unidade?.nome,
      });
      await logEnvio(supabase, {
        funcao: FUNC,
        tipo_destino: 'grupo',
        unidade_id: a.unidade_id,
        sucesso: false,
        motivo_skip: 'unidade-sem-grupo-telegram',
        canal: 'telegram',
      });
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const r = await sendTelegramGroupText(supabase, grupo, message, 'anamnese_experimental');
    const reallyOk = r.ok;

    await logEnvio(supabase, {
      funcao: FUNC,
      destino: String(grupo.telegram_chat_id),
      tipo_destino: 'grupo',
      unidade_id: a.unidade_id,
      sucesso: reallyOk,
      erro_msg: reallyOk ? null : (r.error ?? 'erro desconhecido'),
      canal: 'telegram',
    });

    if (reallyOk) {
      await supabase.from('anamneses_experimental').update({
        notificado_em: new Date().toISOString(),
        notificacao_tentativas: (a.notificacao_tentativas ?? 0) + 1,
        notificacao_ultimo_erro: null,
      }).eq('id', anamnese_id);
    } else {
      await supabase.from('anamneses_experimental').update({
        notificacao_tentativas: (a.notificacao_tentativas ?? 0) + 1,
        notificacao_ultimo_erro: (r.error ?? 'erro desconhecido').toString().slice(0, 500),
      }).eq('id', anamnese_id);
    }

    return new Response(
      JSON.stringify({ ok: reallyOk, message_id: r.message_id ?? null, error: r.error ?? null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (e: any) {
    console.error('[notify-anamnese] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
