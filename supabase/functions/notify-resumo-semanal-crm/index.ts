import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZN_ID = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
const ZS_ID = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';
const DEST_PHONE = '5581999095748';

function getBrasiliaDate(): Date {
  const now = new Date();
  const str = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(str);
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekRange(ref: Date): { sunday: Date; saturday: Date } {
  // Sempre retorna a semana COMPLETA mais recente (domingo a sábado).
  // Se ref for sábado: usa o próprio sábado como fim.
  // Caso contrário: usa o sábado anterior.
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = d.getDay(); // 0=Dom, 6=Sab
  const daysBackToSaturday = dow === 6 ? 0 : dow + 1;
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - daysBackToSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() - 6);
  return { sunday, saturday };
}

function pct(num: number, den: number): string {
  if (!den) return '0';
  const v = (num / den) * 100;
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

async function buildUnitData(supabase: any, unidadeId: string, sundayIso: string, saturdayIso: string) {
  // Leads criados no período
  const { data: leads } = await supabase
    .from('leads')
    .select('id, origem, created_at')
    .eq('unidade_id', unidadeId)
    .gte('created_at', `${sundayIso}T00:00:00-03:00`)
    .lte('created_at', `${saturdayIso}T23:59:59-03:00`);

  const totalLeads = leads?.length ?? 0;

  const origemCount: Record<string, number> = {
    'Instagram': 0,
    'Indicação': 0,
    'Visita Presencial': 0,
    'Tráfego Pago': 0,
  };
  for (const l of leads || []) {
    const o = (l.origem || '').trim();
    // normalização
    const map: Record<string, string> = {
      'INSTAGRAM': 'Instagram',
      'Instagram': 'Instagram',
      'INDICAÇÃO': 'Indicação',
      'INDICACAO': 'Indicação',
      'Indicação': 'Indicação',
      'VISITA PRESENCIAL': 'Visita Presencial',
      'Visita Presencial': 'Visita Presencial',
      'TRÁFEGO PAGO': 'Tráfego Pago',
      'TRAFEGO PAGO': 'Tráfego Pago',
      'Tráfego Pago': 'Tráfego Pago',
    };
    const key = map[o.toUpperCase()] || map[o] || null;
    if (key && key in origemCount) origemCount[key]++;
  }

  // Experimentais com data_experimental no período
  const { data: exps } = await supabase
    .from('interacoes')
    .select('lead_id')
    .eq('unidade_id', unidadeId)
    .gte('data_experimental', sundayIso)
    .lte('data_experimental', saturdayIso)
    .not('data_experimental', 'is', null);
  const experimentais = new Set((exps || []).map((e: any) => e.lead_id)).size;

  // Convertidos no período
  const { data: convs } = await supabase
    .from('interacoes')
    .select('lead_id')
    .eq('unidade_id', unidadeId)
    .eq('fechou_matricula', true)
    .gte('data_fechamento', sundayIso)
    .lte('data_fechamento', saturdayIso);
  const convertidos = new Set((convs || []).map((c: any) => c.lead_id)).size;

  return {
    leads: totalLeads,
    experimentais,
    convertidos,
    taxa: pct(convertidos, totalLeads),
    origem: origemCount,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const dryRun = body?.dry_run === true;
    const phoneOverride = body?.phone || DEST_PHONE;

    const ref = body?.force_date ? new Date(body.force_date + 'T12:00:00') : getBrasiliaDate();
    const { sunday, saturday } = getWeekRange(ref);
    const sundayIso = isoDate(sunday);
    const saturdayIso = isoDate(saturday);

    console.log(`[resumo-semanal] período: ${sundayIso} → ${saturdayIso}`);

    const zn = await buildUnitData(supabase, ZN_ID, sundayIso, saturdayIso);
    const zs = await buildUnitData(supabase, ZS_ID, sundayIso, saturdayIso);

    const totalLeads = zn.leads + zs.leads;
    const totalConv = zn.convertidos + zs.convertidos;
    const taxaGeral = pct(totalConv, totalLeads);

    const message =
`📊 *RESUMO SEMANAL CRM*

*Período: ${fmtDate(sunday)} a ${fmtDate(saturday)}*

*ZN — Zona Norte*

Leads: ${zn.leads}

Experimentais: ${zn.experimentais}

Convertidos: ${zn.convertidos}

Conversão: ${zn.taxa}%

Origem:

Instagram: ${zn.origem['Instagram']}

Indicação: ${zn.origem['Indicação']}

Visita Presencial: ${zn.origem['Visita Presencial']}

Tráfego Pago: ${zn.origem['Tráfego Pago']}

———

*ZS — Zona Sul*

Leads: ${zs.leads}

Experimentais: ${zs.experimentais}

Convertidos: ${zs.convertidos}

Conversão: ${zs.taxa}%

Origem:

Instagram: ${zs.origem['Instagram']}

Indicação: ${zs.origem['Indicação']}

Visita Presencial: ${zs.origem['Visita Presencial']}

———

*CONSOLIDADO*

Total Leads: ${totalLeads}

Total Convertidos: ${totalConv}

Conversão Geral: ${taxaGeral}%`;

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dry_run: true, period: { sundayIso, saturdayIso }, zn, zs, message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured', message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const resp = await fetch(zapiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN || '' },
      body: JSON.stringify({ phone: phoneOverride, message }),
    });
    const result = await resp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: resp.ok,
        status: resp.status,
        zapi: result,
        period: { sundayIso, saturdayIso },
        zn, zs,
        message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: resp.ok ? 200 : 500 }
    );
  } catch (err: any) {
    console.error('[resumo-semanal] erro', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
