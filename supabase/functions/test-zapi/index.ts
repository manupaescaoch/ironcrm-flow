import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZapiCreds, checkZapiStatus } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const creds = getZapiCreds('comercial');
    if (!creds) throw new Error('Credenciais não encontradas');

    const status = await checkZapiStatus(creds);
    
    return new Response(JSON.stringify({ creds_found: !!creds, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
