import { adminCorsHeaders } from '../_shared/cors.ts';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    ...adminCorsHeaders(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const auth = await authorizeCronOrJwt(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status ?? 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // JWT callers must be admin. Cron/internal callers are already trusted.
    if (auth.method === 'jwt') {
      const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
        _user_id: auth.userId,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Forbidden: admin only' }, 403);
    }

    const body = await req.json().catch(() => null) as
      | { email?: string; user_id?: string; password?: string }
      | null;

    const password = body?.password?.trim();
    if (!password || password.length < 6) {
      return json({ error: 'Senha inválida: mínimo 6 caracteres' }, 400);
    }

    let userId = body?.user_id?.trim();
    if (!userId) {
      const email = body?.email?.trim().toLowerCase();
      if (!email) return json({ error: 'Informe email ou user_id' }, 400);

      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) return json({ error: listErr.message }, 500);
      const found = list?.users?.find((u) => (u.email || '').toLowerCase() === email);
      if (!found) return json({ error: 'Usuário não encontrado' }, 404);
      userId = found.id;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);

    console.log(`Password updated for user ${userId} by ${auth.method}`);
    return json({ success: true, user_id: userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('update-user-password error:', msg);
    return json({ error: msg }, 500);
  }
});
