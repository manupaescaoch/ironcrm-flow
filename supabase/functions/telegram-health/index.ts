// Valida a conexão com o bot do Telegram via getMe e registra o estado em public.integracoes.
// Restrito a admins. O TELEGRAM_BOT_TOKEN nunca é retornado ao cliente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      await admin.from('integracoes').upsert({
        provider: 'telegram',
        status: 'nao_configurado',
        active: false,
      }, { onConflict: 'provider' });
      return json({ status: 'nao_configurado', configured: false, checkedAt: new Date().toISOString() });
    }

    let ok = false;
    let bot: { id?: number; first_name?: string; username?: string } = {};
    let detail = '';
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const body = await res.json().catch(() => ({}));
      ok = res.ok && body?.ok === true;
      if (ok) bot = body.result ?? {};
      else detail = String(body?.description ?? res.status);
    } catch (e) {
      detail = e instanceof Error ? e.message : 'falha de rede';
    }

    const now = new Date().toISOString();
    const status = ok ? 'conectado' : 'erro';

    const { data: current } = await admin
      .from('integracoes').select('connected_at').eq('provider', 'telegram').maybeSingle();

    await admin.from('integracoes').upsert({
      provider: 'telegram',
      status,
      active: ok,
      external_id: ok ? String(bot.id ?? '') : null,
      external_name: ok ? (bot.first_name ?? null) : null,
      external_username: ok ? (bot.username ?? null) : null,
      connected_at: ok ? (current?.connected_at ?? now) : null,
    }, { onConflict: 'provider' });

    return json({
      status,
      configured: true,
      checkedAt: now,
      bot: ok ? { id: bot.id, name: bot.first_name, username: bot.username } : null,
      detail: ok ? null : detail,
    });
  } catch (e) {
    console.error('telegram-health error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
