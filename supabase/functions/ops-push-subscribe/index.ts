import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Gerencia as inscrições de Web Push do EVO OPS.
 * - action "key": devolve a chave pública VAPID (pública por definição).
 * - action "subscribe": salva/reativa a inscrição do usuário autenticado.
 * - action "unsubscribe": desativa a inscrição do endpoint informado.
 * A chave privada VAPID nunca sai do backend.
 */
Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  try {
    const publicKey = Deno.env.get('OPS_VAPID_PUBLIC_KEY') ?? '';
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action ?? 'key');

    if (action === 'key') {
      if (!publicKey) return json({ error: 'Push não configurado' }, 503);
      return json({ publicKey });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    if (action === 'subscribe') {
      const subscription = body?.subscription;
      const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
      if (!endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return json({ error: 'Inscrição inválida' }, 400);
      }
      const deviceInfo = typeof body?.device_info === 'string' ? body.device_info.slice(0, 200) : null;

      const { error } = await supabase
        .from('ops_push_subscriptions')
        .upsert(
          {
            usuario_id: user.id,
            endpoint,
            subscription,
            device_info: deviceInfo,
            ativo: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' },
        );
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'unsubscribe') {
      const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
      if (!endpoint) return json({ error: 'endpoint é obrigatório' }, 400);
      const { error } = await supabase
        .from('ops_push_subscriptions')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('endpoint', endpoint)
        .eq('usuario_id', user.id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    console.error('ops-push-subscribe:', message);
    return json({ error: message }, 500);
  }
});
