// One-shot admin utility: resolve WhatsApp invite codes via D-API and update
// formulario_grupos_whatsapp with the resolved group IDs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZapiCreds } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Mapping {
  formulario_key: 'estagiario_lider' | 'coordenador_unidade' | 'coordenador_horario' | 'relatorio_comercial';
  unidade: 'ZONA NORTE' | 'ZONA SUL';
  invite_code: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Admin JWT check
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'auth' });
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: claims } = await anon.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims?.sub) return json(401, { error: 'auth' });
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', claims.claims.sub);
    if (!roles?.some((r: any) => r.role === 'admin')) return json(403, { error: 'not admin' });

    const body = await req.json();
    const mappings: Mapping[] = body.mappings;
    if (!Array.isArray(mappings)) return json(400, { error: 'mappings required' });

    const creds = getZapiCreds('operacional');
    if (!creds || creds.provider !== 'dapi') return json(500, { error: 'D-API não configurada' });

    const results: any[] = [];
    for (const m of mappings) {
      try {
        // D-API: get group id from invite code
        const url = `https://api.d-api.cloud/api/v1/groups/inviteinfo?sessionId=${creds.sessionId}&inviteCode=${m.invite_code}`;
        const r = await fetch(url, {
          headers: { 'Authorization': `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' },
        });
        const txt = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch { /* raw */ }
        const groupId =
          parsed?.id?._serialized ||
          parsed?.groupId ||
          parsed?.id ||
          parsed?.data?.id?._serialized ||
          parsed?.data?.id ||
          null;
        const groupName = parsed?.subject || parsed?.name || parsed?.data?.subject || null;

        if (!groupId || typeof groupId !== 'string') {
          results.push({ ...m, ok: false, http: r.status, raw: txt.slice(0, 300) });
          continue;
        }

        const { error: upErr } = await svc
          .from('formulario_grupos_whatsapp')
          .upsert(
            {
              formulario_key: m.formulario_key,
              unidade: m.unidade,
              grupo_id: groupId,
              grupo_nome: groupName,
              ativo: true,
            },
            { onConflict: 'formulario_key,unidade' },
          );

        results.push({ ...m, ok: !upErr, groupId, groupName, upErr: upErr?.message });
      } catch (e: any) {
        results.push({ ...m, ok: false, error: e?.message });
      }
    }

    return json(200, { results });
  } catch (e: any) {
    return json(500, { error: e?.message });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
