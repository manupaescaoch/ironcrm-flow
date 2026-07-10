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

    // Canal: ?channel=comercial|operacional. Default: operacional.
    const url0 = new URL(req.url);
    const channelRaw = url0.searchParams.get('channel') ?? 'operacional';
    if (channelRaw !== 'comercial' && channelRaw !== 'operacional') {
      return new Response(JSON.stringify({ error: "channel inválido" }), { status: 400, headers: corsHeaders });
    }

    let groups: { phone: string; name: string }[] = [];

    // Operacional → D-API (quando configurada)
    const dapiKey = Deno.env.get('DAPI_API_KEY');
    const dapiSession = Deno.env.get('DAPI_SESSION_ID');

    if (channelRaw === 'operacional' && dapiKey && dapiSession) {
      const url = `https://api.d-api.cloud/api/v1/groups/list?sessionId=${encodeURIComponent(dapiSession)}`;
      const resp = await fetch(url, { headers: { Authorization: dapiKey } });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`D-API error: ${resp.status} - ${txt.slice(0, 200)}`);
      }
      const raw = await resp.json().catch(() => ({}));
      const arr: any[] = raw?.data ?? raw?.groups ?? (Array.isArray(raw) ? raw : []);
      groups = arr.map((g: any) => ({
        phone: g.id || g.jid || g.phone || '',
        name: g.subject || g.name || g.phone || 'Sem nome',
      })).filter((g) => g.phone);
      console.log(`[list-groups][dapi] groups=${groups.length}`);
    } else {
      const prefix = channelRaw === 'comercial' ? 'ZAPI_COMERCIAL_' : 'ZAPI_OPERACIONAL_';
      const instanceId =
        Deno.env.get(prefix + 'INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID');
      const zapiToken =
        Deno.env.get(prefix + 'TOKEN') ?? Deno.env.get('ZAPI_TOKEN');

      if (!instanceId || !zapiToken) {
        return new Response(JSON.stringify({ error: `WhatsApp not configured for ${channelRaw}` }), { status: 500, headers: corsHeaders });
      }

      const clientToken =
        Deno.env.get(prefix + 'CLIENT_TOKEN') ?? Deno.env.get('ZAPI_CLIENT_TOKEN');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientToken) headers['Client-Token'] = clientToken;

      const all: any[] = [];
      const pageSize = 100;
      for (let page = 1; page <= 50; page++) {
        const url = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/chats?page=${page}&pageSize=${pageSize}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          console.error(`[list-groups] Z-API ${resp.status} page=${page}: ${txt.slice(0, 200)}`);
          if (page === 1) throw new Error(`Z-API error: ${resp.status} - ${txt.slice(0, 200)}`);
          break;
        }
        const arr = await resp.json().catch(() => []);
        if (!Array.isArray(arr) || arr.length === 0) break;
        all.push(...arr);
        if (arr.length < pageSize) break;
      }

      groups = all
        .filter((c: any) => c.isGroup === true)
        .map((c: any) => ({ phone: c.phone || c.id, name: c.name || c.phone || 'Sem nome' }));

      console.log(`[list-groups][zapi] total chats=${all.length} groups=${groups.length}`);
    }

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
