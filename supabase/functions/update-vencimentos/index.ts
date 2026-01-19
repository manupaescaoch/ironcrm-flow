import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateItem {
  nome: string;
  vencimento: string;
}

// Parse vencimento date from DD/MM/YYYY format
const parseVencimentoDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  try {
    const [day, month, year] = dateStr.trim().split('/');
    if (!day || !month || !year) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { updates, unidade_id } = await req.json() as { 
      updates: UpdateItem[]; 
      unidade_id: string;
    };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de atualizações vazia ou inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: 0,
      notFound: 0,
      errors: [] as string[],
    };

    for (const item of updates) {
      try {
        const dataVencimento = parseVencimentoDate(item.vencimento);
        if (!dataVencimento) {
          results.errors.push(`${item.nome}: data de vencimento inválida`);
          continue;
        }

        // Find lead by name
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidade_id)
          .ilike('nome', item.nome.trim())
          .maybeSingle();

        if (!lead) {
          results.notFound++;
          continue;
        }

        // Update the most recent matricula interaction
        const { error: updateError } = await supabase
          .from('interacoes')
          .update({ data_vencimento: dataVencimento })
          .eq('lead_id', lead.id)
          .eq('fechou_matricula', true)
          .order('data_fechamento', { ascending: false })
          .limit(1);

        if (updateError) {
          results.errors.push(`${item.nome}: ${updateError.message}`);
          continue;
        }

        results.success++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${item.nome}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Atualização concluída: ${results.success} atualizados, ${results.notFound} não encontrados`,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
