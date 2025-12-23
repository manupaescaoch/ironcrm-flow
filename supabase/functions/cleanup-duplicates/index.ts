import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IDs of duplicate leads to deactivate (keeping the oldest ones)
    const duplicateIds = [
      'eefcf28f-a45e-487a-b44b-f0b24b1636ee', // ANAMELIA NOVAES DE SOUZA MENEZES (newer by name)
      '63c8b839-ee83-4ede-8533-346712fde293', // LUCAS MENDES CARBONERA (newer by name)
      '06682eb1-2cc7-4bf7-bdaf-eba4e3402897', // KLEDSON ALMEIDA SILVA (newer by phone)
      'f9bbb062-9842-4848-8b41-70bfa5c719b6', // ANAMELIA NOVAES DE SOUZA MENEZES (newer by phone)
      '6f3aed98-b6e5-4fcc-9a5f-20ae7f64bd5f', // ADONIAS EVANGELISTA DO NASCIMENTO (newer by phone)
      'fda5a0a5-21d0-4170-a556-23643cb62605', // GERALDO MARTINS DA SILVA (newer by phone)
      'db07c3dc-82e3-4f35-8022-7f42d8eae0f1', // PEDRO ADVINCULA FALCÃO FILHO (newer by phone)
    ];

    console.log(`Deactivating ${duplicateIds.length} duplicate leads...`);

    // Deactivate duplicate leads
    const { data, error } = await supabase
      .from('leads')
      .update({ ativo: false })
      .in('id', duplicateIds)
      .select('id, nome, telefone, cadastrado_por, created_at');

    if (error) {
      console.error('Error deactivating leads:', error);
      throw error;
    }

    console.log(`Successfully deactivated ${data?.length || 0} leads:`, data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${data?.length || 0} leads duplicados foram desativados`,
        deactivated: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in cleanup-duplicates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

