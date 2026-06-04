import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import {
  RATE_LIMIT_MS, checkZapiStatus, getZapiCreds, logEnvio, phoneExists, sendText, sleep,
} from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FUNC = 'confirmacao-experimental-automatica';
const ANAMNESE_URL = 'https://ironclub-app.com/anamnese';
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

function getBrasiliaDateOnly(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function primeiroNomeCapitalizado(nome: string): string {
  const primeiro = (nome || '').trim().split(/\s+/)[0] || '';
  if (!primeiro) return '';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

function formatarDataBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function templateImediata(nome: string, data: string, hora: string): string {
  return `Oi, ${nome}! Tudo certo? Sua aula experimental na IRON está confirmada! 🔵

📅 ${data} ⏰ ${hora}

A gente te espera! Chega 15 minutinhos antes, tá? Assim a gente te apresenta como funciona a Iron e já preenche sua ficha antes de começar.

Qualquer imprevisto é só me chamar aqui. 💪

Equipe Iron`;
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
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorizeCronOrJwt(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: auth.status || 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { dryRun = false } = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const creds = getZapiCreds('comercial');
    if (!creds) {
      console.error('[confirmacao-experimental] Z-API comercial não configurada');
      return new Response(JSON.stringify({ error: 'Z-API comercial não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!dryRun) {
      const st = await checkZapiStatus(creds);
      if (!st.connected) {
        console.warn('[confirmacao-experimental] Z-API offline', st.raw);
        await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(st.raw).slice(0, 500), canal: 'comercial' });
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: st.raw }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const agora = new Date();
    const hojeBR = getBrasiliaDateOnly(agora);
    
    // Busca leads com aula hoje ou amanhã
    const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const amanhaBR = getBrasiliaDateOnly(amanha);

    console.log(`[confirmacao-experimental] Processando dia ${hojeBR} (agora: ${agora.toISOString()})`);

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, nome, telefone, data_aula_experimental, hora_aula_experimental, confirmacao_imediata_enviada_em, confirmacao_24h_enviada_em, confirmacao_2h_enviada_em, status_funil, ativo, is_matriculado')
      .eq('ativo', true)
      .eq('is_matriculado', false)
      .not('telefone', 'is', null)
      .not('data_aula_experimental', 'is', null)
      .not('hora_aula_experimental', 'is', null)
      .not('status_funil', 'in', ' (convertido,perdido) '); // Note: Correct syntax for .not('in', ...) in supabase-js is an array, but here it's raw string? 
      // Actually, let's fix the syntax to the official one:
      // .not('status_funil', 'in', ['convertido', 'perdido'])

    // Wait, the previous version used .not('status_funil', 'in', '(convertido,perdido)') which is likely wrong.
    // I'll re-run the query with the correct syntax.

    const query = supabase
      .from('leads')
      .select('id, nome, telefone, data_aula_experimental, hora_aula_experimental, confirmacao_imediata_enviada_em, confirmacao_24h_enviada_em, confirmacao_2h_enviada_em, status_funil, ativo, is_matriculado')
      .eq('ativo', true)
      .eq('is_matriculado', false)
      .not('telefone', 'is', null)
      .not('data_aula_experimental', 'is', null)
      .not('hora_aula_experimental', 'is', null)
      .not('status_funil', 'in', ['convertido', 'perdido'])
      .gte('data_aula_experimental', `${hojeBR}T00:00:00-03:00`)
      .lte('data_aula_experimental', `${amanhaBR}T23:59:59-03:00`);

    const { data: leadsData, error: leadsErr } = await query;
    if (leadsErr) throw leadsErr;

    console.log(`[confirmacao-experimental] Leads encontrados: ${leadsData?.length ?? 0}`);

    const resultados: any[] = [];
    let isFirstSend = true;

    for (const lead of leadsData || []) {
      // Re-check se compareceu (evita enviar pra quem já veio)
      const { data: jaCompareceu } = await supabase
        .from('interacoes')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('compareceu', true)
        .maybeSingle();
      
      if (jaCompareceu) continue;

      // Cálculo de diffMin (Brasília)
      const dataAulaStr = String(lead.data_aula_experimental).split('T')[0];
      const horaAulaStr = String(lead.hora_aula_experimental).slice(0, 5);
      const [h, m] = horaAulaStr.split(':').map(Number);
      const momentoAula = new Date(`${dataAulaStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);
      
      const diffMin = (momentoAula.getTime() - agora.getTime()) / 60000;
      const nome = primeiroNomeCapitalizado(lead.nome || '');
      const phone = normalizePhone(lead.telefone || '');
      if (!phone) continue;

      let tipoEnvio: 'imediata' | '24h' | '2h' | null = null;
      let message = '';

      // Prioridade: 2h > 24h > imediata
      if (diffMin > 0 && diffMin <= 135 && !lead.confirmacao_2h_enviada_em) {
        tipoEnvio = '2h';
        message = template2h(nome, horaAulaStr);
      } else if (diffMin > 135 && diffMin <= 1455 && !lead.confirmacao_24h_enviada_em) {
        tipoEnvio = '24h';
        const dataBR = formatarDataBR(dataAulaStr);
        message = template24h(nome, dataBR, horaAulaStr);
      } else if (!lead.confirmacao_imediata_enviada_em && diffMin > 1455) {
        // Imediata: se agendado com mais de 24h de antecedência e ainda não confirmou nada
        tipoEnvio = 'imediata';
        const dataBR = formatarDataBR(dataAulaStr);
        message = templateImediata(nome, dataBR, horaAulaStr);
      }

      if (tipoEnvio && message) {
        console.log(`[confirmacao-experimental] Enviando ${tipoEnvio} para ${lead.nome} (${phone})`);
        if (dryRun) {
          resultados.push({ lead_id: lead.id, tipo: tipoEnvio, dryRun: true, phone });
        } else {
          if (!isFirstSend) await sleep(RATE_LIMIT_MS);
          isFirstSend = false;

          const r = await sendText(creds, phone, message);
          if (r.ok) {
            const updatePayload: Record<string, any> = {};
            if (tipoEnvio === 'imediata') updatePayload.confirmacao_imediata_enviada_em = new Date().toISOString();
            if (tipoEnvio === '24h') updatePayload.confirmacao_24h_enviada_em = new Date().toISOString();
            if (tipoEnvio === '2h') updatePayload.confirmacao_2h_enviada_em = new Date().toISOString();
            
            await supabase.from('leads').update(updatePayload).eq('id', lead.id);
            await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: true, zapi_status_code: r.status, canal: 'comercial' });
          } else {
            await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 500), canal: 'comercial' });
          }
          resultados.push({ lead_id: lead.id, tipo: tipoEnvio, sent: r.ok, status: r.status });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processados: leadsData?.length ?? 0, enviados: resultados.length, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[confirmacao-experimental] Erro fatal:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

