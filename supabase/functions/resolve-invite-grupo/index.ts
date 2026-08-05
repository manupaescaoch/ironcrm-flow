// Utilitário somente-leitura: resolve o ID interno de um grupo a partir do link
// de convite, sem gravar nada no banco. Somente admin. Nunca retorna credenciais.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZapiCreds } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function pickId(raw: any): { id: string | null; nome: string | null } {
  const id =
    raw?.phone ??
    raw?.groupId ??
    raw?.chatId ??
    raw?.data?.id?._serialized ??
    raw?.data?.id ??
    raw?.id?._serialized ??
    (typeof raw?.id === 'string' ? raw.id : null);
  const nome =
    raw?.subject ?? raw?.name ?? raw?.data?.subject ?? raw?.data?.name ?? raw?.groupName ?? null;
  return { id: id ? String(id) : null, nome: nome ? String(nome) : null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Permissão negada' }, 403);

    const body = await req.json().catch(() => ({}));
    const inviteUrl: string = typeof body?.invite_url === 'string' ? body.invite_url.trim() : '';
    const m = inviteUrl.match(/^https:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    if (!m) return json({ error: 'Link de convite inválido' }, 400);
    const code = m[1];

    const attempts: any[] = [];
    let resolved: { id: string | null; nome: string | null } = { id: null, nome: null };

    // 1) D-API (canal operacional)
    const dapi = getZapiCreds('operacional');
    if (dapi?.provider === 'dapi') {
      for (const url of [
        `https://api.d-api.cloud/api/v1/groups/invite-info?sessionId=${encodeURIComponent(dapi.sessionId!)}&inviteCode=${code}`,
      ]) {
        try {
          const r = await fetch(url, { headers: { Authorization: dapi.apiKey! } });
          const txt = await r.text();
          attempts.push({ provider: 'dapi', http: r.status, body: txt.slice(0, 300) });
          if (r.ok) {
            try { resolved = pickId(JSON.parse(txt)); } catch { /* raw */ }
          }
        } catch (e) {
          attempts.push({ provider: 'dapi', error: String(e) });
        }
        if (resolved.id) break;
      }
    }

    // 2) Z-API comercial
    if (!resolved.id) {
      const z = getZapiCreds('comercial');
      if (z?.provider === 'zapi') {
        const base = `https://api.z-api.io/instances/${z.instanceId}/token/${z.token}`;
        try {
          const r = await fetch(
            `${base}/group-invitation-metadata?url=${encodeURIComponent(inviteUrl)}`,
            { headers: { 'Content-Type': 'application/json', 'Client-Token': z.clientToken } },
          );
          const txt = await r.text();
          attempts.push({ provider: 'zapi', http: r.status, body: txt.slice(0, 300) });
          if (r.ok) {
            try { resolved = pickId(JSON.parse(txt)); } catch { /* raw */ }
          }
        } catch (e) {
          attempts.push({ provider: 'zapi', error: String(e) });
        }
      }
    }

    return json({ ok: !!resolved.id, invite_code: code, ...resolved, attempts });
  } catch (e) {
    console.error('[resolve-invite-grupo]', e);
    return json({ error: 'Erro interno' }, 500);
  }
});
