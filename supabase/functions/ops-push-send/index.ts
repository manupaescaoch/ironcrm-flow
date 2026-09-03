import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

/**
 * Envia Web Push do EVO OPS.
 * Modos:
 * - { action: 'test' }                    → envia para os aparelhos do próprio usuário autenticado.
 * - { usuario_id, titulo, mensagem, url } → exige admin OU o header x-cron-secret (uso interno/cron).
 * Chaves VAPID vivem apenas nos secrets do backend.
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
    const publicKey = Deno.env.get('OPS_VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('OPS_VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('OPS_VAPID_SUBJECT') || 'mailto:contato@ironclub-app.com';
    if (!publicKey || !privateKey) return json({ error: 'Push não configurado' }, 503);
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? 'send');

    let alvoUsuarioId: string | null = null;
    let titulo = '';
    let mensagem = '';
    let url = '/ops/alertas';

    if (action === 'test') {
      const token = req.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !user) return json({ error: 'Unauthorized' }, 401);
      alvoUsuarioId = user.id;
      titulo = 'EVO OPS';
      mensagem = 'Notificações ativadas neste aparelho.';
    } else {
      const cronSecret = req.headers.get('x-cron-secret');
      const { data: expectedSecret } = await supabase.rpc('get_cron_secret');
      let autorizado = !!cronSecret && !!expectedSecret && cronSecret === expectedSecret;

      if (!autorizado) {
        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) return json({ error: 'Unauthorized' }, 401);
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !user) return json({ error: 'Unauthorized' }, 401);
        const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        autorizado = !!isAdmin;
      }
      if (!autorizado) return json({ error: 'Forbidden' }, 403);

      alvoUsuarioId = typeof body?.usuario_id === 'string' ? body.usuario_id : null;
      titulo = String(body?.titulo ?? '').slice(0, 120);
      mensagem = String(body?.mensagem ?? '').slice(0, 300);
      if (typeof body?.url === 'string' && body.url.startsWith('/')) url = body.url;
      if (!alvoUsuarioId || !titulo) return json({ error: 'usuario_id e titulo são obrigatórios' }, 400);
    }

    const { data: subs, error: subsErr } = await supabase
      .from('ops_push_subscriptions')
      .select('id, endpoint, subscription')
      .eq('usuario_id', alvoUsuarioId)
      .eq('ativo', true);
    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) return json({ success: true, enviados: 0, motivo: 'sem_inscricoes' });

    const payload = JSON.stringify({ titulo, mensagem, url, tag: body?.tag ?? undefined });
    let enviados = 0;
    const expirados: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription as never, payload, { TTL: 3600 });
        enviados += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        console.error('push falhou', statusCode, (err as Error)?.message);
        if (statusCode === 404 || statusCode === 410) expirados.push(sub.endpoint as string);
      }
    }

    if (expirados.length > 0) {
      await supabase
        .from('ops_push_subscriptions')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .in('endpoint', expirados);
    }

    return json({ success: true, enviados, expirados: expirados.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    console.error('ops-push-send:', message);
    return json({ error: message }, 500);
  }
});
