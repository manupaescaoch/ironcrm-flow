// Resolve UMA VEZ o ID interno do grupo financeiro a partir do link de convite
// e grava em unidade_whatsapp_config. Depois disso, os envios usam só o ID.
// Somente admin. Nunca retorna credenciais.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZapiCreds } from '../_shared/zapi.ts';
import { normalizeGrupoId } from '../_shared/contasPagarEnvio.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function extrairGrupoId(raw: any): { id: string | null; nome: string | null } {
  const id =
    raw?.phone ??
    raw?.groupId ??
    raw?.id ??
    raw?.group?.phone ??
    raw?.group?.id ??
    raw?.value?.phone ??
    null;
  const nome = raw?.subject ?? raw?.name ?? raw?.group?.subject ?? raw?.groupName ?? null;
  return { id: id ? normalizeGrupoId(String(id)) : null, nome: nome ? String(nome) : null };
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
    if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(inviteUrl)) {
      return json({ error: 'Link de convite inválido' }, 400);
    }

    const creds = getZapiCreds('comercial');
    if (!creds || creds.provider !== 'zapi') {
      return json({ error: 'Integração Z-API Comercial não configurada' }, 400);
    }

    const base = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}`;
    const headers = { 'Content-Type': 'application/json', 'Client-Token': creds.clientToken };

    // 1) Metadados do convite (não precisa ser membro)
    let resolved = { id: null as string | null, nome: null as string | null };
    const metaResp = await fetch(
      `${base}/group-invitation-metadata?url=${encodeURIComponent(inviteUrl)}`,
      { headers },
    );
    const metaBody = await metaResp.json().catch(() => ({}));
    if (metaResp.ok) resolved = extrairGrupoId(metaBody);

    // 2) Fallback: entrar no grupo pelo link (uma única vez)
    if (!resolved.id) {
      const joinResp = await fetch(`${base}/join-group`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: inviteUrl, inviteUrl }),
      });
      const joinBody = await joinResp.json().catch(() => ({}));
      if (joinResp.ok) resolved = extrairGrupoId(joinBody);
      if (!resolved.id) {
        console.error('[resolve-grupo-contas-pagar] não resolveu', metaResp.status, joinResp.status);
        return json({ error: 'Não foi possível resolver o ID do grupo pelo link' }, 502);
      }
    }

    // Grava para todas as unidades ativas (grupo financeiro único, com override possível)
    const { data: unidades } = await supabase.from('unidades').select('id');
    for (const u of unidades ?? []) {
      await supabase
        .from('unidade_whatsapp_config')
        .upsert(
          {
            unidade_id: u.id,
            grupo_contas_pagar_id: resolved.id,
            grupo_contas_pagar_nome: resolved.nome,
          },
          { onConflict: 'unidade_id' },
        );
    }

    return json({ ok: true, grupo_id: resolved.id, grupo_nome: resolved.nome });
  } catch (e) {
    console.error('[resolve-grupo-contas-pagar]', e);
    return json({ error: 'Erro interno ao resolver o grupo' }, 500);
  }
});
