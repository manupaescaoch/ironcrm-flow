import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert array to CSV
function arrayToCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (data.length === 0) return columns.join(',') + '\n';
  
  const header = columns.join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

// Format date for Brazil timezone
function getBrazilDate(): string {
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brazilTime = new Date(utc + (brazilOffset * 60000));
  return brazilTime.toISOString().split('T')[0];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const dateStr = getBrazilDate();
    console.log(`Starting backup for date: ${dateStr}`);

    // Fetch all leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    // Fetch all interactions
    const { data: interacoes, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (interacoesError) {
      throw new Error(`Failed to fetch interacoes: ${interacoesError.message}`);
    }

    console.log(`Fetched ${leads?.length || 0} leads and ${interacoes?.length || 0} interacoes`);

    // Define columns for leads CSV
    const leadsColumns = [
      'id', 'nome', 'email', 'telefone', 'origem', 'status_funil', 
      'plano_escolhido', 'cadastrado_por', 'atendido_por', 'observacoes',
      'data_aula_experimental', 'ativo', 'user_id', 'created_by', 'created_at', 'updated_at'
    ];

    // Define columns for interacoes CSV
    const interacoesColumns = [
      'id', 'lead_id', 'tipo', 'descricao', 'data_interacao',
      'data_experimental', 'hora_experimental', 'agendou_experimental',
      'confirmado', 'compareceu', 'reagendou', 'fechou_matricula',
      'plano_escolhido', 'valor_plano', 'responsavel_fechamento',
      'treinador_responsavel', 'treinador_experimental', 'origem_fechamento',
      'comissao_comercial', 'comissao_recepcao', 'comissao_cadastrador',
      'atendido_por', 'atendido_por_tipo', 'cadastrado_por', 'quem_agendou',
      'tipo_atendimento', 'data_fechamento', 'created_by', 'created_at'
    ];

    // Generate CSVs
    const leadsCSV = arrayToCSV(leads || [], leadsColumns);
    const interacoesCSV = arrayToCSV(interacoes || [], interacoesColumns);

    // Upload to storage
    const leadsFileName = `${dateStr}_FULL_CRM_LEADS.csv`;
    const interacoesFileName = `${dateStr}_FULL_CRM_INTERACOES.csv`;

    // Upload leads CSV
    const { error: uploadLeadsError } = await supabase.storage
      .from('backups_crm_iron')
      .upload(leadsFileName, leadsCSV, {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadLeadsError) {
      throw new Error(`Failed to upload leads backup: ${uploadLeadsError.message}`);
    }

    // Upload interacoes CSV
    const { error: uploadInteracoesError } = await supabase.storage
      .from('backups_crm_iron')
      .upload(interacoesFileName, interacoesCSV, {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadInteracoesError) {
      throw new Error(`Failed to upload interacoes backup: ${uploadInteracoesError.message}`);
    }

    console.log('Backup files uploaded successfully');

    // Get file info for response
    const { data: leadsFileInfo } = await supabase.storage
      .from('backups_crm_iron')
      .list('', { search: leadsFileName });

    const { data: interacoesFileInfo } = await supabase.storage
      .from('backups_crm_iron')
      .list('', { search: interacoesFileName });

    const result = {
      success: true,
      date: dateStr,
      files: {
        leads: {
          name: leadsFileName,
          rows: leads?.length || 0,
          size: leadsFileInfo?.[0]?.metadata?.size || leadsCSV.length
        },
        interacoes: {
          name: interacoesFileName,
          rows: interacoes?.length || 0,
          size: interacoesFileInfo?.[0]?.metadata?.size || interacoesCSV.length
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log('Backup completed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
