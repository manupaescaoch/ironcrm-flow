import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'npm:zod@3.23.8';

import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Validação por schema do payload (todos os campos opcionais — corpo vazio é válido).
const BodySchema = z
  .object({
    unidade_id: z.string().uuid().nullish(),
  })
  .partial()
  .passthrough();


Deno.serve(async (req) => {
  // Handle CORS preflight requests (no auth on OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: require cron secret header OR valid Supabase JWT for any non-OPTIONS request.
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional unidade_id from request body (validado por schema)
    let unidadeId: string | null = null;
    {
      let rawBody: unknown = null;
      try {
        rawBody = await req.json();
      } catch {
        rawBody = null; // No body or invalid JSON, proceed with all unidades
      }
      if (rawBody && typeof rawBody === 'object') {
        const parsed = BodySchema.safeParse(rawBody);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'unidade_id inválido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        unidadeId = parsed.data.unidade_id ?? null;
      }
    }



    console.log('Starting follow-up generation (attendance-based)...', { unidadeId });

    // REGRA CORRIGIDA: Buscar apenas leads que COMPARECERAM à experimental
    // E ainda não são matriculados nem perdidos
    let interacoesQuery = supabase
      .from('interacoes')
      .select(`
        lead_id,
        data_experimental,
        unidade_id,
        leads!inner (
          id,
          nome,
          status_funil,
          is_matriculado,
          ativo
        )
      `)
      .eq('compareceu', true)
      .not('data_experimental', 'is', null);

    if (unidadeId) {
      interacoesQuery = interacoesQuery.eq('unidade_id', unidadeId);
    }

    const { data: interacoes, error: interacoesError } = await interacoesQuery;

    if (interacoesError) {
      console.error('Error fetching interacoes:', interacoesError);
      throw interacoesError;
    }

    console.log(`Found ${interacoes?.length || 0} interactions with attendance`);

    // Filter to eligible leads only
    const eligibleInteracoes = interacoes?.filter((i: any) => {
      const lead = i.leads;
      if (!lead) return false;
      if (lead.ativo === false) return false;
      if (lead.is_matriculado === true) return false;
      if (lead.status_funil === 'perdido' || lead.status_funil === 'convertido') return false;
      return true;
    }) || [];

    console.log(`Filtered to ${eligibleInteracoes.length} eligible leads`);

    // Group by lead_id to get the earliest experimental date per lead
    const leadExperimentalMap = new Map<string, { data_experimental: string; unidade_id: string; nome: string }>();
    
    for (const interacao of eligibleInteracoes) {
      const leadId = interacao.lead_id;
      const existing = leadExperimentalMap.get(leadId);
      const leadData = interacao.leads as any;
      
      // Use the earliest experimental date for follow-up reference
      if (!existing || new Date(interacao.data_experimental) < new Date(existing.data_experimental)) {
        leadExperimentalMap.set(leadId, {
          data_experimental: interacao.data_experimental,
          unidade_id: interacao.unidade_id,
          nome: leadData?.nome || 'Unknown'
        });
      }
    }

    console.log(`Processing ${leadExperimentalMap.size} unique leads`);

    let generatedCount = 0;

    for (const [leadId, info] of leadExperimentalMap) {
      // Check existing follow-ups for this lead
      const { data: existingFollowUps } = await supabase
        .from('follow_ups')
        .select('tipo, status')
        .eq('lead_id', leadId);

      const existingTypes = new Set(existingFollowUps?.map((f: any) => f.tipo) || []);

      // Use the experimental date as reference (not today!) — anchored to BRT
      const dateOnlyToBrtIso = (s: string) => `${s.slice(0, 10)}T00:00:00-03:00`;
      const addDays = (s: string, days: number) => {
        const [y, m, d] = s.slice(0, 10).split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + days);
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      };

      const dataReferenciaIso = dateOnlyToBrtIso(info.data_experimental);

      // Generate follow-ups for each type if not exists
      const followUpTypes: { tipo: string; dias: number }[] = [
        { tipo: 'D+1', dias: 1 },
        { tipo: 'D+7', dias: 7 },
        { tipo: 'D+15', dias: 15 },
        { tipo: 'D+30', dias: 30 },
      ];

      for (const { tipo, dias } of followUpTypes) {
        if (existingTypes.has(tipo)) continue;

        const dataPrevistaIso = `${addDays(info.data_experimental, dias)}T00:00:00-03:00`;

        const { error: insertError } = await supabase
          .from('follow_ups')
          .insert({
            lead_id: leadId,
            unidade_id: info.unidade_id,
            tipo,
            data_referencia: dataReferenciaIso,
            data_prevista: dataPrevistaIso,
            status: 'pendente',
          });

        if (insertError) {
          console.error(`Error inserting follow-up ${tipo} for lead ${leadId}:`, insertError);
        } else {
          generatedCount++;
          console.log(`Generated ${tipo} follow-up for lead ${info.nome}`);
        }
      }
    }

    console.log(`Follow-up generation complete. Generated ${generatedCount} new follow-ups.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${generatedCount} new follow-ups`,
        generatedCount,
        leadsProcessed: leadExperimentalMap.size
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Error in generate-follow-ups function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
