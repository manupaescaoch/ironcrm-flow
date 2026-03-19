import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');

    if (!instanceId || !zapiToken) {
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), { status: 500, headers: corsHeaders });
    }

    const url = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/chats`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Z-API error: ${response.status}`);
    }

    const chats = await response.json();
    const groups = (Array.isArray(chats) ? chats : [])
      .filter((c: any) => c.isGroup === true)
      .map((c: any) => ({ id: c.phone || c.id, name: c.name || c.phone || 'Sem nome' }));

    return new Response(JSON.stringify(groups), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error listing WhatsApp groups:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch groups' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
