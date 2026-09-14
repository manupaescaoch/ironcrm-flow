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

    // Modo auxiliar: listar grupos do chip para localizar IDs manualmente.
    if (body.list_groups) {
      const creds0 = getZapiCreds('operacional2') || getZapiCreds('operacional');
      if (!creds0 || creds0.provider !== 'dapi') return json(500, { error: 'D-API não configurada' });
      const out: any[] = [];
      for (const url of [
        `https://api.d-api.cloud/api/v1/groups?sessionId=${encodeURIComponent(creds0.sessionId!)}`,
        `https://api.d-api.cloud/api/v1/chats?sessionId=${encodeURIComponent(creds0.sessionId!)}`,
      ]) {
        try {
          const r = await fetch(url, { headers: { Authorization: creds0.apiKey! } });
          const txt = await r.text();
          out.push({ url, http: r.status, body: txt.slice(0, 8000) });
          if (r.ok) break;
        } catch (e) { out.push({ url, error: String(e) }); }
      }
      return json(200, { attempts: out });
    }

    const mappings: Mapping[] = body.mappings;
    if (!Array.isArray(mappings)) return json(400, { error: 'mappings required' });

    const creds = getZapiCreds('operacional');
    if (!creds || creds.provider !== 'dapi') return json(500, { error: 'D-API não configurada' });

    const headers = { 'Content-Type': 'application/json', Authorization: creds.apiKey! };
    const candidates = (code: string) => [
      { method: 'POST', url: `https://api.d-api.cloud/api/v1/groups/invite-info`, body: { sessionId: creds.sessionId, inviteCode: code } },
      { method: 'POST', url: `https://api.d-api.cloud/api/v1/groups/join`, body: { sessionId: creds.sessionId, inviteCode: code } },
      { method: 'POST', url: `https://api.d-api.cloud/api/v1/groups/accept-invite`, body: { sessionId: creds.sessionId, inviteCode: code } },
      { method: 'GET', url: `https://api.d-api.cloud/api/v1/groups/invite-info?sessionId=${creds.sessionId}&inviteCode=${code}`, body: null },
    ];

    const results: any[] = [];
    for (const m of mappings) {
      let groupId: string | null = null;
      let groupName: string | null = null;
      const attempts: any[] = [];
      for (const c of candidates(m.invite_code)) {
        try {
          const r = await fetch(c.url, {
            method: c.method,
            headers,
            body: c.body ? JSON.stringify(c.body) : undefined,
          });
          const txt = await r.text();
          let parsed: any = null;
          try { parsed = JSON.parse(txt); } catch { /* raw */ }
          attempts.push({ url: c.url, http: r.status, body: txt.slice(0, 250) });
          const id =
            parsed?.id?._serialized ||
            parsed?.groupId ||
            parsed?.gid?._serialized ||
            parsed?.data?.id?._serialized ||
            parsed?.data?.id ||
            parsed?.data?.groupId ||
            parsed?.chatId ||
            (typeof parsed?.id === 'string' ? parsed.id : null);
          const name = parsed?.subject || parsed?.name || parsed?.data?.subject || parsed?.data?.name || null;
          if (id && typeof id === 'string' && id.includes('@')) {
            groupId = id;
            groupName = name;
            break;
          }
          if (id && typeof id === 'string' && /^\d+/.test(id)) {
            groupId = id.includes('@') ? id : `${id}@g.us`;
            groupName = name;
            break;
          }
        } catch (e) {
          attempts.push({ url: c.url, error: String(e) });
        }
      }

      if (!groupId) {
        results.push({ ...m, ok: false, attempts });
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
