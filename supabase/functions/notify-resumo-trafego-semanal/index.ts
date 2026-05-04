import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZN_ID = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
const ZS_ID = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';
const DEST_PHONE = '5581999095748';

function brasiliaNow(): Date {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(s);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Última semana fechada: domingo a sábado anteriores à data de referência.
function getLastClosedWeek(ref: Date) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = d.getDay(); // 0=dom..6=sab
  // Saturday anterior: se hoje é sábado, ainda assim pegamos o sábado da semana passada
  const back = dow === 6 ? 7 : dow + 1;
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - back);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() - 6);
  return { sunday, saturday };
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysInclusive(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000) + 1;
}

async function totalUnidade(supabase: any, unidadeId: string, sunday: Date, saturday: Date): Promise<number> {
  // Busca todos investimentos cujo intervalo intersecta a semana
  const { data, error } = await supabase
    .from('investimentos_marketing')
    .select('valor, data_inicio, data_fim')
    .eq('unidade_id', unidadeId)
    .lte('data_inicio', isoDate(saturday))
    .gte('data_fim', isoDate(sunday));

  if (error) throw error;

  let total = 0;
  for (const r of data || []) {
    const ini = parseDateOnly(r.data_inicio);
    const fim = parseDateOnly(r.data_fim);
    const overlapStart = ini > sunday ? ini : sunday;
    const overlapEnd = fim < saturday ? fim : saturday;
    if (overlapEnd < overlapStart) continue;
    const totalDays = daysInclusive(ini, fim);
    const overlapDays = daysInclusive(overlapStart, overlapEnd);
    const valor = Number(r.valor) || 0;
    total += (valor * overlapDays) / totalDays;
  }
  return total;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const dryRun = body?.dry_run === true;
    const phoneOverride = body?.phone || DEST_PHONE;
    const ref = body?.force_date ? new Date(body.force_date + 'T12:00:00') : brasiliaNow();

    const { sunday, saturday } = getLastClosedWeek(ref);

    const [zn, zs] = await Promise.all([
      totalUnidade(supabase, ZN_ID, sunday, saturday),
      totalUnidade(supabase, ZS_ID, sunday, saturday),
    ]);
    const total = zn + zs;

    const message =
`📊 *RESUMO SEMANAL DE TRÁFEGO*

*Período: ${fmtDate(sunday)} a ${fmtDate(saturday)}*

*IRON ZN*
Valor investido: R$ ${fmtBRL(zn)}

*IRON ZS*
Valor investido: R$ ${fmtBRL(zs)}

*TOTAL GERAL*
Valor investido: R$ ${fmtBRL(total)}`;

    if (dryRun) {
      return new Response(
        JSON.stringify({ ok: true, dry_run: true, period: { sunday: isoDate(sunday), saturday: isoDate(saturday) }, zn, zs, total, message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured', message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN || '' },
      body: JSON.stringify({ phone: phoneOverride, message }),
    });
    const result = await resp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, zapi: result, period: { sunday: isoDate(sunday), saturday: isoDate(saturday) }, zn, zs, total, message }),
      { status: resp.ok ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[resumo-trafego-semanal] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
