import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import {
  RATE_LIMIT_MS, checkZapiStatus, getZapiCreds, logEnvio, phoneExists, sendText, sleep,
} from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function template24h(nome: string, data: string, hora: string): string {
  return `Oi, ${nome}! Tudo certo, sua experimental está confirmada! 🔵

📅 ${data} ⏰ ${hora}

Chega 15 minutinhos antes, tá? Assim a gente te apresenta como funciona a Iron e já preenche sua ficha antes de começar.

Qualquer imprevisto é só me chamar aqui. A gente se vê em breve! 💪

Equipe Iron`;
}

function template2h(nome: string, hora: string): string {
  return `Oi, ${nome}! Daqui a pouco é hora do treino. 💪

Queremos te conhecer melhor! Preenche essa ficha rapidinho antes de vir assim a gente garante a melhor experiência pra você aqui na Iron. 😊

👉 ${ANAMNESE_URL}

Te esperamos às ${hora}. Qualquer imprevisto é só me chamar aqui. 🔵

Equipe Iron`;
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

    const creds = getZapiCreds();
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
        await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(st.raw).slice(0, 500) });
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
      .select('id, nome, telefone, data_aula_experimental, hora_aula_experimental, confirmacao_24h_enviada_em, confirmacao_2h_enviada_em, status_funil, ativo, is_matriculado')
      .eq('ativo', true)
      .eq('is_matriculado', false)
      .not('telefone', 'is', null)
      .not('data_aula_experimental', 'is', null)
      .not('hora_aula_experimental', 'is', null)
      .not('status_funil', 'in', '(convertido,perdido)')
      .gte('data_aula_experimental', `${getBrasiliaDateOnly(new Date(agora.getTime() - 24 * 60 * 60 * 1000))}T00:00:00-03:00`)
      .lte('data_aula_experimental', `${getBrasiliaDateOnly(limiteFuturo)}T23:59:59-03:00`);

    if (error) throw error;

    // Busca leads que já compareceram à experimental (qualquer interação com compareceu=true)
    const leadIds = (leads || []).map((l) => l.id);
    let leadsJaCompareceram = new Set<string>();
    if (leadIds.length > 0) {
      const { data: interacoesCompareceu } = await supabase
        .from('interacoes')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('compareceu', true);
      leadsJaCompareceram = new Set((interacoesCompareceu || []).map((i: any) => i.lead_id));
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
        const message = template24h(nome, dataStr, horaStr);

        if (dryRun) {
          resultados.push({ lead_id: lead.id, tipo: '24h', dryRun: true, phone, preview: message });
        } else {
          if (!(await ensurePhoneOk(phone))) {
            await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'phone_nao_existe' });
            resultados.push({ lead_id: lead.id, tipo: '24h', skipped: 'phone_nao_existe' });
          } else {
            await rateGate();
            const r = await sendText(creds, phone, message);
            if (r.ok) {
              envios++;
              await supabase.from('leads').update({ confirmacao_24h_enviada_em: new Date().toISOString() }).eq('id', lead.id);
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: true, zapi_status_code: r.status });
            } else {
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 500) });
            }
            resultados.push({ lead_id: lead.id, tipo: '24h', sent: r.ok, status: r.status });
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
            await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, motivo_skip: 'phone_nao_existe' });
            resultados.push({ lead_id: lead.id, tipo: '2h', skipped: 'phone_nao_existe' });
          } else {
            await rateGate();
            const r = await sendText(creds, phone, message);
            if (r.ok) {
              envios++;
              await supabase.from('leads').update({ confirmacao_2h_enviada_em: new Date().toISOString() }).eq('id', lead.id);
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: true, zapi_status_code: r.status });
            } else {
              await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 500) });
            }
            resultados.push({ lead_id: lead.id, tipo: '2h', sent: r.ok, status: r.status });
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
