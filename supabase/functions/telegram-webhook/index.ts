// Webhook do Telegram: vincula colaboradores via /start <token> e detecta grupos.
// Valida o header X-Telegram-Bot-Api-Secret-Token. Público (verify_jwt = false).

import { adminClient, safeEqual, sendTelegramMessage, webhookSecretToken } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const expected = await webhookSecretToken();
    const received = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!safeEqual(received, expected)) {
      console.warn('telegram-webhook: secret inválido');
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await req.json().catch(() => null);
    if (!update) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

    const admin = adminClient();
    const msg = update.message ?? update.edited_message ?? null;
    const chat = msg?.chat ?? update.my_chat_member?.chat ?? null;

    if (!chat) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

    // --- Grupos: registra/atualiza chats detectados ---
    if (chat.type === 'group' || chat.type === 'supergroup') {
      await admin.from('telegram_detected_chats').upsert({
        telegram_chat_id: chat.id,
        title: chat.title ?? null,
        chat_type: chat.type,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'telegram_chat_id' });

      // Mantém o título atualizado nos grupos já vinculados
      await admin.from('telegram_groups')
        .update({ telegram_title: chat.title ?? null })
        .eq('telegram_chat_id', chat.id);

      return new Response(JSON.stringify({ ok: true, grupo: true }), { status: 200 });
    }

    // --- Privado: comando /start com token de conexão ---
    const text: string = msg?.text ?? '';
    const from = msg?.from;
    if (!from || !text.startsWith('/start')) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const token = text.split(/\s+/)[1]?.trim();
    if (!token) {
      await sendTelegramMessage({
        chat_id: chat.id,
        text: 'Olá! Para conectar seu Telegram à EVO, use o link de conexão enviado pelo administrador.',
        message_type: 'start_sem_token',
      }, admin);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const nowIso = new Date().toISOString();
    const { data: tokenRow } = await admin
      .from('telegram_connection_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
      await sendTelegramMessage({
        chat_id: chat.id,
        text: 'Este link de conexão é inválido ou expirou. Peça um novo link ao administrador.',
        message_type: 'start_token_invalido',
      }, admin);
      return new Response(JSON.stringify({ ok: true, invalid_token: true }), { status: 200 });
    }

    const { error: upsertErr } = await admin.from('telegram_users').upsert({
      user_id: tokenRow.user_id,
      telegram_user_id: from.id,
      telegram_username: from.username ?? null,
      telegram_first_name: from.first_name ?? null,
      telegram_last_name: from.last_name ?? null,
      connected_at: nowIso,
      status: 'conectado',
    }, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('telegram-webhook upsert erro', upsertErr);
      await sendTelegramMessage({
        chat_id: chat.id,
        text: 'Não foi possível concluir a conexão agora. Tente novamente em instantes.',
        message_type: 'erro_conexao',
      }, admin);
      return new Response(JSON.stringify({ ok: false }), { status: 200 });
    }

    await admin.from('telegram_connection_tokens').update({ used_at: nowIso }).eq('id', tokenRow.id);

    await sendTelegramMessage({
      chat_id: chat.id,
      text: 'Telegram conectado com sucesso à EVO.',
      recipient_type: 'usuario',
      recipient_id: tokenRow.user_id,
      message_type: 'conexao_confirmada',
    }, admin);

    return new Response(JSON.stringify({ ok: true, connected: true }), { status: 200 });
  } catch (e) {
    console.error('telegram-webhook error', e);
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }
});
