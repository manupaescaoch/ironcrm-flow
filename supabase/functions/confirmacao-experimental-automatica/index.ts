import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import {
  RATE_LIMIT_MS, buildIdempotencyKey, checkZapiStatus, getZapiCreds, logEnvio, phoneExists,
  sendTextIdempotent, sleep,
} from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FUNC = 'confirmacao-experimental-automatica';

const ANAMNESE_URL = 'https://ironclub-app.com/anamnese';
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

function getBrasiliaParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getBrasiliaDateOnly(date: Date = new Date()): string {
  const parts = getBrasiliaParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function extractDateOnly(value: string): string {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : getBrasiliaDateOnly(new Date(value));
}

function primeiroNomeCapitalizado(nome: string): string {
  const primeiro = (nome || '').trim().split(/\s+/)[0] || '';
  if (!primeiro) return '';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

function formatarDataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function template24h(nome: string, data: string, hora: string, unidade: string): string {
  return `Oi, ${nome}! Tudo certo, sua experimental está confirmada! 🔵

📅 ${data}

⏰ ${hora}

📍 Unidade EVO ${unidade}

Chega 15 minutinhos antes, tá? Assim a gente te apresenta como funciona a EVO e já preenche sua ficha antes de começar.

Qualquer imprevisto é só me chamar aqui. A gente se vê em breve! 💪

Equipe EVO`;
}

function template2h(nome: string, hora: string): string {
  return `Oi, ${nome}! Daqui a pouco é hora do treino. 💪

Queremos te conhecer melhor! Preenche essa ficha rapidinho antes de vir assim a gente garante a melhor experiência pra você aqui na EVO. 😊

👉 ${ANAMNESE_URL}

Te esperamos às ${hora}. Qualquer imprevisto é só me chamar aqui. 🔵

Equipe EVO`;
}

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Garante 55 (Brasil) na frente
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}


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
    const { dryRun = false } = await req.json().catch(() => ({}));

    const creds = getZapiCreds('comercial');
    if (!creds) {
      return new Response(JSON.stringify({ error: 'Z-API não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!dryRun) {
      const st = await checkZapiStatus(creds);
      if (!st.connected) {
        await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(st.raw).slice(0, 500), canal: 'comercial' });
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: st.raw }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }


    // Busca leads candidatos com aula nas próximas 25h
    const agora = new Date();
    const limiteFuturo = new Date(agora.getTime() + 25 * 60 * 60 * 1000);

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, nome, telefone, unidade_id, data_aula_experimental, hora_aula_experimental, confirmacao_24h_enviada_em, confirmacao_2h_enviada_em, status_funil, ativo, is_matriculado, pausado_fu')
      .eq('ativo', true)
      .neq('pausado_fu', true)
      .eq('is_matriculado', false)

      .not('telefone', 'is', null)
      .not('data_aula_experimental', 'is', null)
      .not('hora_aula_experimental', 'is', null)
      .not('status_funil', 'in', '(convertido,perdido)')
      .gte('data_aula_experimental', `${getBrasiliaDateOnly(new Date(agora.getTime() - 24 * 60 * 60 * 1000))}T00:00:00-03:00`)
      .lte('data_aula_experimental', `${getBrasiliaDateOnly(limiteFuturo)}T23:59:59-03:00`);

    if (error) throw error;

    // Nomes das unidades (para exibir na confirmação 24h)
    const unidadeIds = [...new Set((leads || []).map((l: any) => l.unidade_id).filter(Boolean))];
    const { data: unidades } = unidadeIds.length
      ? await supabase.from('unidades').select('id, nome').in('id', unidadeIds)
      : { data: [] };
    const unidadeNome = new Map((unidades || []).map((u: any) => [u.id, u.nome]));
    const unidadeCurta = (nome?: string | null) =>
      (nome || '').replace(/^(EVO|IRON)\s+/i, '').trim().toUpperCase() || 'SUA UNIDADE';

    // Busca leads que já compareceram à experimental (qualquer interação com compareceu=true)
    const leadIds = (leads || []).map((l) => l.id);
    let leadsJaCompareceram = new Set<string>();
    // Mapa lead_id -> data (YYYY-MM-DD) do reagendamento mais recente
    const reagendamentoMaisRecente = new Map<string, string | null>();
    if (leadIds.length > 0) {
      const { data: interacoesCompareceu } = await supabase
        .from('interacoes')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('compareceu', true);
      leadsJaCompareceram = new Set((interacoesCompareceu || []).map((i: any) => i.lead_id));

      // Reagendamentos: a confirmação só é válida para a data mais atual
      const { data: interacoesReagendou, error: reagErr } = await supabase
        .from('interacoes')
        .select('lead_id, reagendou, data_reagendamento, created_at')
        .in('lead_id', leadIds)
        .eq('reagendou', true)
        .order('created_at', { ascending: true });

      if (reagErr) throw reagErr;

      for (const i of interacoesReagendou || []) {
        // a última interação (created_at maior) sobrescreve as anteriores
        reagendamentoMaisRecente.set(
          i.lead_id,
          i.data_reagendamento ? extractDateOnly(String(i.data_reagendamento)) : null,
        );
      }
    }

    const resultados: any[] = [];
    let envios = 0;
    let isFirstSend = true;
    const checkedPhones = new Map<string, boolean>();

    async function ensurePhoneOk(phone: string): Promise<boolean> {
      if (checkedPhones.has(phone)) return checkedPhones.get(phone)!;
      const ex = await phoneExists(creds!, phone);
      const ok = ex !== false; // null (incerto) → permitir
      checkedPhones.set(phone, ok);
      return ok;
    }

    async function rateGate() {
      if (!isFirstSend) await sleep(RATE_LIMIT_MS);
      isFirstSend = false;
    }


    for (const lead of leads || []) {
      // GUARDA 1: pré-filtro em lote — leads com compareceu=true em qualquer interação
      if (leadsJaCompareceram.has(lead.id)) {
        console.log('[confirmacao-experimental] BLOQUEADO (pré-filtro compareceu)', { lead_id: lead.id });
        continue;
      }

      // GUARDA 2: re-checagem per-lead imediatamente antes do envio (defense-in-depth)
      // Protege contra race conditions entre o SELECT em lote e o loop de envio.
      const { count: compareceuCount, error: recheckErr } = await supabase
        .from('interacoes')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', lead.id)
        .eq('compareceu', true);

      if (recheckErr) {
        console.error('[confirmacao-experimental] erro no recheck compareceu — abortando lead', {
          lead_id: lead.id,
          error: recheckErr.message,
        });
        continue;
      }

      if ((compareceuCount ?? 0) > 0) {
        console.log('[confirmacao-experimental] BLOQUEADO (recheck compareceu>0)', {
          lead_id: lead.id,
          compareceuCount,
        });
        continue;
      }

      // Constrói momento da aula em horário local BRT
      const dataAula = extractDateOnly(String(lead.data_aula_experimental));

      // GUARDA 3: reagendamento — nunca confirmar uma data que foi substituída.
      // Se houver interação com reagendou=true, só a data mais recente vale.
      if (reagendamentoMaisRecente.has(lead.id)) {
        const novaData = reagendamentoMaisRecente.get(lead.id) ?? null;
        if (!novaData) {
          console.log('[confirmacao-experimental] BLOQUEADO (reagendou sem data definida)', { lead_id: lead.id });
          await logEnvio(supabase, { funcao: FUNC, tipo_destino: 'lead', sucesso: false, motivo_skip: 'reagendado_sem_data', canal: 'comercial' });
          continue;
        }
        if (novaData !== dataAula) {
          console.log('[confirmacao-experimental] BLOQUEADO (data antiga substituída por reagendamento)', {
            lead_id: lead.id, dataAula, novaData,
          });
          await logEnvio(supabase, { funcao: FUNC, tipo_destino: 'lead', sucesso: false, motivo_skip: 'reagendado_data_antiga', canal: 'comercial' });
          continue;
        }
        // novaData === dataAula → a grade já está atualizada, confirmação válida
      }

      const [h, m] = String(lead.hora_aula_experimental).slice(0, 5).split(':').map(Number);
      const [ano, mes, dia] = dataAula.split('-').map(Number);
      const momentoAula = new Date(`${dataAula}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);

      const diffMs = momentoAula.getTime() - agora.getTime();
      const diffMin = diffMs / (60 * 1000);

      const nome = primeiroNomeCapitalizado(lead.nome || '');
      const phone = normalizePhone(lead.telefone || '');
      if (!phone) continue;

      // Janela 24h: a qualquer momento entre 2h15 antes e 24h15 antes da aula
      // (cobre leads cadastrados em cima da hora que perderiam a janela estreita)
      const dentro24h = diffMin > 135 && diffMin <= 1455;
      // Janela 2h: entre o início da aula e 2h15 antes
      const dentro2h = diffMin > 0 && diffMin <= 135;

      // 24h
      if (dentro24h && !lead.confirmacao_24h_enviada_em) {
        // formata data e hora em BRT
        const dataStr = formatarDataBR(new Date(ano, mes - 1, dia));
        const horaStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const message = template24h(nome, dataStr, horaStr, unidadeCurta(unidadeNome.get((lead as any).unidade_id)));

        if (dryRun) {
          resultados.push({ lead_id: lead.id, tipo: '24h', dryRun: true, phone, preview: message });
        } else {
          if (!(await ensurePhoneOk(phone))) {
            await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'phone_nao_existe', canal: 'comercial' });
            resultados.push({ lead_id: lead.id, tipo: '24h', skipped: 'phone_nao_existe' });
          } else {
            // IDEMPOTÊNCIA REAL (banco): chave única por lead + tipo + data/hora da aula.
            // Mesmo que a gravação da flag no lead falhe (trigger/RLS), a chave impede reenvio.
            const chave = buildIdempotencyKey([FUNC, '24h', lead.id, dataAula, `${h}${m}`]);
            await rateGate();
            const r = await sendTextIdempotent(supabase, creds, phone, message, { chave, funcao: FUNC });

            if (r.skipped) {
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'idempotencia_duplicado', canal: 'comercial' });
              resultados.push({ lead_id: lead.id, tipo: '24h', skipped: 'duplicado' });
            } else if (r.ok) {
              envios++;
              // marcação secundária (para UI/relatórios); não é a garantia de idempotência
              await supabase.from('leads').update({ confirmacao_24h_enviada_em: new Date().toISOString() }).eq('id', lead.id);
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: true, zapi_status_code: r.status, canal: 'comercial', status_envio: 'enviado' });
              resultados.push({ lead_id: lead.id, tipo: '24h', sent: true, status: r.status });
            } else {
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 500), canal: 'comercial', status_envio: 'falhou' });
              resultados.push({ lead_id: lead.id, tipo: '24h', sent: false, status: r.status });
            }
          }
        }
      }




      // 2h
      if (dentro2h && !lead.confirmacao_2h_enviada_em) {
        const horaStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const message = template2h(nome, horaStr);

        if (dryRun) {
          resultados.push({ lead_id: lead.id, tipo: '2h', dryRun: true, phone, preview: message });
        } else {
          if (!(await ensurePhoneOk(phone))) {
            await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'phone_nao_existe', canal: 'comercial' });
            resultados.push({ lead_id: lead.id, tipo: '2h', skipped: 'phone_nao_existe' });
          } else {
            const chave = buildIdempotencyKey([FUNC, '2h', lead.id, dataAula, `${h}${m}`]);
            await rateGate();
            const r = await sendTextIdempotent(supabase, creds, phone, message, { chave, funcao: FUNC });

            if (r.skipped) {
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'idempotencia_duplicado', canal: 'comercial' });
              resultados.push({ lead_id: lead.id, tipo: '2h', skipped: 'duplicado' });
            } else if (r.ok) {
              envios++;
              await supabase.from('leads').update({ confirmacao_2h_enviada_em: new Date().toISOString() }).eq('id', lead.id);
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: true, zapi_status_code: r.status, canal: 'comercial', status_envio: 'enviado' });
              resultados.push({ lead_id: lead.id, tipo: '2h', sent: true, status: r.status });
            } else {
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 500), canal: 'comercial', status_envio: 'falhou' });
              resultados.push({ lead_id: lead.id, tipo: '2h', sent: false, status: r.status });
            }
          }


        }
      }

    }

    return new Response(
      JSON.stringify({ ok: true, processados: leads?.length ?? 0, enviados: resultados.length, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[confirmacao-experimental] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
