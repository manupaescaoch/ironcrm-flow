// Ações administrativas da integração com o Telegram.
// Somente administradores. O token do bot nunca é retornado.

import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { adminClient, sendTelegramMessage, telegramApi, webhookSecretToken } from '../_shared/telegram.ts';

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const admin = adminClient();
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    switch (action) {
      // Gera link exclusivo de conexão para um colaborador
      case 'generate_link': {
        const targetUserId = String(body?.user_id ?? '');
        if (!targetUserId) return json({ error: 'user_id obrigatório' }, 400);

        const me = await telegramApi('getMe', {});
        if (!me.ok) return json({ error: 'bot_indisponivel', details: me.description }, 502);

        const token = randomToken();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        const { error } = await admin.from('telegram_connection_tokens')
          .insert({ user_id: targetUserId, token, expires_at: expiresAt });
        if (error) return json({ error: error.message }, 400);

        await admin.from('telegram_users').upsert(
          { user_id: targetUserId, status: 'nao_conectado' },
          { onConflict: 'user_id', ignoreDuplicates: true },
        );

        return json({
          link: `https://t.me/${me.result.username}?start=${token}`,
          expires_at: expiresAt,
          bot_username: me.result.username,
        });
      }

      case 'disconnect_user': {
        const targetUserId = String(body?.user_id ?? '');
        if (!targetUserId) return json({ error: 'user_id obrigatório' }, 400);
        const { error } = await admin.from('telegram_users').update({
          telegram_user_id: null,
          telegram_username: null,
          telegram_first_name: null,
          telegram_last_name: null,
          connected_at: null,
          status: 'nao_conectado',
        }).eq('user_id', targetUserId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // Vincula um chat detectado a um tipo de grupo
      case 'assign_group': {
        const groupType = String(body?.group_type ?? '');
        const chatId = Number(body?.telegram_chat_id);
        if (!groupType || !Number.isFinite(chatId)) return json({ error: 'dados inválidos' }, 400);

        const { data: chat } = await admin.from('telegram_detected_chats')
          .select('title').eq('telegram_chat_id', chatId).maybeSingle();

        const { error } = await admin.from('telegram_groups').update({
          telegram_chat_id: chatId,
          telegram_title: chat?.title ?? null,
          status: 'conectado',
          connected_at: new Date().toISOString(),
        }).eq('group_type', groupType);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'disconnect_group': {
        const groupType = String(body?.group_type ?? '');
        if (!groupType) return json({ error: 'group_type obrigatório' }, 400);
        const { error } = await admin.from('telegram_groups').update({
          telegram_chat_id: null,
          telegram_title: null,
          status: 'nao_conectado',
          connected_at: null,
        }).eq('group_type', groupType);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // Envia mensagem de teste ao Telegram do próprio administrador (ou a um grupo)
      case 'test_integration': {
        const groupType = body?.group_type ? String(body.group_type) : null;

        if (groupType) {
          const { data: grupo } = await admin.from('telegram_groups')
            .select('telegram_chat_id, name').eq('group_type', groupType).maybeSingle();
          if (!grupo?.telegram_chat_id) return json({ error: 'grupo_nao_conectado' }, 400);
          const r = await sendTelegramMessage({
            chat_id: grupo.telegram_chat_id,
            text: `✅ <b>EVO CLUB</b>\nTeste de integração do grupo <b>${grupo.name}</b> realizado com sucesso.`,
            recipient_type: 'grupo',
            message_type: 'teste',
          }, admin);
          return r.ok ? json({ ok: true }) : json({ error: 'falha_envio', details: r.error }, 502);
        }

        const { data: link } = await admin.from('telegram_users')
          .select('telegram_user_id').eq('user_id', user.id).maybeSingle();
        if (!link?.telegram_user_id) return json({ error: 'admin_nao_conectado' }, 400);

        const r = await sendTelegramMessage({
          chat_id: link.telegram_user_id,
          text: '✅ <b>EVO CLUB</b>\nIntegração com o Telegram funcionando corretamente.',
          recipient_type: 'usuario',
          recipient_id: user.id,
          message_type: 'teste',
        }, admin);
        return r.ok ? json({ ok: true }) : json({ error: 'falha_envio', details: r.error }, 502);
      }

      // (Re)registra o webhook do bot
      case 'setup_webhook': {
        const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`;
        const secret = await webhookSecretToken();
        const r = await telegramApi('setWebhook', {
          url,
          secret_token: secret,
          allowed_updates: ['message', 'edited_message', 'my_chat_member'],
          drop_pending_updates: false,
        });
        if (!r.ok) return json({ error: 'falha_webhook', details: r.description }, 502);
        const info = await telegramApi('getWebhookInfo', {});
        return json({ ok: true, webhook: info.ok ? { url: info.result?.url, pending: info.result?.pending_update_count } : null });
      }

      case 'webhook_info': {
        const info = await telegramApi('getWebhookInfo', {});
        if (!info.ok) return json({ error: 'falha_webhook', details: info.description }, 502);
        return json({
          url: info.result?.url ?? null,
          pending_update_count: info.result?.pending_update_count ?? 0,
          last_error_message: info.result?.last_error_message ?? null,
        });
      }

      default:
        return json({ error: 'acao_invalida' }, 400);
    }
  } catch (e) {
    console.error('telegram-admin error', e);
    return json({ error: 'internal_error', details: e instanceof Error ? e.message : String(e) }, 500);
  }
});
