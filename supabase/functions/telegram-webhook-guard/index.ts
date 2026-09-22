// Guardião do webhook do Telegram.
// Verifica periodicamente se o bot ainda aponta para ESTE projeto. Se outro
// aplicativo reapontar o webhook (roubando as mensagens do bot), reapontamos
// automaticamente e avisamos a gestão pelo Telegram.

import {
  adminClient,
  resolveTelegramUsuarioPorTelefone,
  sendTelegramUserText,
  telegramApi,
  webhookSecretToken,
} from '../_shared/telegram.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = adminClient();
    const expectedUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`;

    const info = await telegramApi('getWebhookInfo', {});
    if (!info.ok) return json({ error: 'falha_webhook_info', details: info.description }, 502);

    const currentUrl: string = info.result?.url ?? '';
    const ok = currentUrl === expectedUrl;

    if (ok) {
      return json({
        ok: true,
        corrigido: false,
        url: currentUrl,
        pending_update_count: info.result?.pending_update_count ?? 0,
        last_error_message: info.result?.last_error_message ?? null,
      });
    }

    // Webhook apontando para outro lugar → reapontar imediatamente.
    const secret = await webhookSecretToken();
    const fix = await telegramApi('setWebhook', {
      url: expectedUrl,
      secret_token: secret,
      allowed_updates: ['message', 'edited_message', 'my_chat_member'],
      drop_pending_updates: true,
    });

    await admin.from('telegram_message_logs').insert({
      recipient_type: 'usuario',
      message_type: 'webhook_guard',
      status: fix.ok ? 'enviado' : 'erro',
      error_message: fix.ok
        ? `webhook estava em "${currentUrl || '(vazio)'}" e foi reapontado`
        : `falha ao reapontar (estava em "${currentUrl || '(vazio)'}"): ${fix.description ?? 'erro'}`,
    });

    // Avisa a gestão
    const telefone = Deno.env.get('TELEGRAM_RESUMO_TELEFONE') || '81996392285';
    const alvo = await resolveTelegramUsuarioPorTelefone(admin, telefone);
    if (alvo) {
      const texto = fix.ok
        ? `⚠️ *BOT DO TELEGRAM REAPONTADO*\n\nO bot estava respondendo por outro sistema (webhook em \`${currentUrl || 'vazio'}\`).\n\nJá corrigi automaticamente: as mensagens voltam para o CRM EVO.`
        : `🚨 *BOT DO TELEGRAM FORA DO CRM*\n\nO webhook está em \`${currentUrl || 'vazio'}\` e não consegui corrigir: ${fix.description ?? 'erro'}`;
      await sendTelegramUserText(admin, alvo, texto, 'webhook_guard');
    }

    return json({ ok: fix.ok, corrigido: fix.ok, url_anterior: currentUrl, url: expectedUrl, details: fix.description ?? null }, fix.ok ? 200 : 502);
  } catch (e) {
    console.error('telegram-webhook-guard error', e);
    return json({ error: 'internal_error', details: e instanceof Error ? e.message : String(e) }, 500);
  }
});
