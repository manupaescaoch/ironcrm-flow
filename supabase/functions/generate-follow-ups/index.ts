import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional unidade_id from request body
    let unidadeId: string | null = null;
    try {
      const body = await req.json();
      unidadeId = body.unidade_id || null;
    } catch {
      // No body or invalid JSON, proceed with all unidades
    }

    // Use today's date as reference for all leads (reset mode)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    console.log('Starting follow-up generation with reset mode...', { unidadeId, dataReferencia: hoje.toISOString() });

    // Get all active leads that are not convertido or perdido
    let leadsQuery = supabase
      .from('leads')
      .select('id, nome, status_funil, unidade_id')
      .eq('ativo', true)
      .not('status_funil', 'in', '("convertido","perdido")');

    if (unidadeId) {
      leadsQuery = leadsQuery.eq('unidade_id', unidadeId);
    }

    const { data: leads, error: leadsError } = await leadsQuery;

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    console.log(`Found ${leads?.length || 0} eligible leads`);

    let generatedCount = 0;

    for (const lead of leads || []) {
      // Use today as the reference date for all leads
      const dataReferencia = hoje;

      // Check existing follow-ups for this lead
      const { data: existingFollowUps } = await supabase
        .from('follow_ups')
        .select('tipo, status')
        .eq('lead_id', lead.id);

      const existingTypes = new Set(existingFollowUps?.map(f => f.tipo) || []);

      // Generate follow-ups for each type if not exists
      const followUpTypes: { tipo: string; dias: number }[] = [
        { tipo: 'D+1', dias: 1 },
        { tipo: 'D+7', dias: 7 },
        { tipo: 'D+15', dias: 15 },
        { tipo: 'D+30', dias: 30 },
      ];

      for (const { tipo, dias } of followUpTypes) {
        if (existingTypes.has(tipo)) continue;

        const dataPrevista = new Date(dataReferencia);
        dataPrevista.setDate(dataPrevista.getDate() + dias);

        // Generate all follow-ups unconditionally (reset mode)
        const { error: insertError } = await supabase
          .from('follow_ups')
          .insert({
            lead_id: lead.id,
            unidade_id: lead.unidade_id,
            tipo,
            data_referencia: dataReferencia.toISOString(),
            data_prevista: dataPrevista.toISOString(),
            status: 'pendente',
          });

        if (insertError) {
          console.error(`Error inserting follow-up ${tipo} for lead ${lead.id}:`, insertError);
        } else {
          generatedCount++;
          console.log(`Generated ${tipo} follow-up for lead ${lead.nome}`);
        }
      }
    }

    console.log(`Follow-up generation complete. Generated ${generatedCount} new follow-ups.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${generatedCount} new follow-ups`,
        generatedCount 
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
