import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {

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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    console.log(`Deactivating ${duplicateIds.length} duplicate leads using admin function...`);

    // Use the admin function to bypass triggers
    const { data, error } = await supabase.rpc('admin_cleanup_duplicate_leads', {
      lead_ids: duplicateIds
    });

    if (error) {
      console.error('Error deactivating leads:', error);
      throw error;
    }

    console.log(`Successfully deactivated ${data} leads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${data} leads duplicados foram desativados`,
        count: data
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
