// Alerta por e-mail (Resend) quando a Z-API estiver offline e impactar envios.
// Throttle de 30 minutos por função, registrado em whatsapp_envios_log com
// motivo_skip = 'zapi_offline_alert_sent' para impedir spam.

export interface ZapiAlertParams {
  supabase: any;
  funcao: string;            // ex: 'send-cronograma-messages'
  affectedCount: number;     // qtde de envios marcados como erro nessa execução
  zapiStatus: any;           // raw status retornado pela Z-API
  threshold?: number;        // mínimo de afetados para alertar (default 2)
  throttleMinutes?: number;  // intervalo mínimo entre alertas (default 30)
}

export async function maybeSendZapiOfflineAlert(p: ZapiAlertParams): Promise<void> {
  const threshold = p.threshold ?? 2;
  const throttleMinutes = p.throttleMinutes ?? 30;

  if (p.affectedCount < threshold) return;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const ADMIN_EMAIL = Deno.env.get('BACKUP_ADMIN_EMAIL');
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    console.warn('[zapi-alert] RESEND_API_KEY ou BACKUP_ADMIN_EMAIL ausente — pulando alerta');
    return;
  }

  // Throttle: já enviou alerta para esta função nos últimos N minutos?
  const since = new Date(Date.now() - throttleMinutes * 60 * 1000).toISOString();
  try {
    const { data: recent } = await p.supabase
      .from('whatsapp_envios_log')
      .select('id')
      .eq('funcao', p.funcao)
      .eq('motivo_skip', 'zapi_offline_alert_sent')
      .gte('created_at', since)
      .limit(1);
    if (recent && recent.length > 0) {
      console.log(`[zapi-alert] alerta já enviado nos últimos ${throttleMinutes}min — skip`);
      return;
    }
  } catch (e) {
    console.error('[zapi-alert] erro ao checar throttle', e);
  }

  const subject = `🚨 Z-API offline — ${p.affectedCount} envios bloqueados (${p.funcao})`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; padding: 24px;">
      <h2 style="color: #dc2626; margin: 0 0 16px;">⚠️ Chip WhatsApp Comercial offline</h2>
      <p style="font-size: 16px; color: #374151;">
        A função <strong>${p.funcao}</strong> tentou enviar mensagens mas a Z-API está fora do ar.
      </p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; color: #7f1d1d;">
          <strong>${p.affectedCount}</strong> envios marcados como erro nesta execução.
        </p>
      </div>
      <h3 style="color: #374151; margin-top: 24px;">Status retornado pela Z-API:</h3>
      <pre style="background: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${JSON.stringify(p.zapiStatus, null, 2)}</pre>
      <h3 style="color: #374151; margin-top: 24px;">O que fazer:</h3>
      <ol style="color: #374151; font-size: 14px; line-height: 1.6;">
        <li>Acesse o painel da Z-API e verifique o status da instância</li>
        <li>Se aparecer QR Code, leia com o celular do chip comercial</li>
        <li>Não abra WhatsApp Web (Firefox/Chrome) na mesma conta</li>
        <li>Confira <a href="https://ironclub-app.com/admin/whatsapp-comercial">/admin/whatsapp-comercial</a> após reconectar</li>
      </ol>
      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
        Você só receberá outro e-mail dessa função após ${throttleMinutes} minutos para evitar spam.
      </p>
    </div>
  `;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'EVO TRAINING CLUB CRM <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });
    const ok = resp.ok;
    const body = await resp.text();
    console.log(`[zapi-alert] enviado=${ok} status=${resp.status} body=${body.slice(0, 200)}`);

    // Marca no log para o throttle (independente de sucesso do envio, evita loop em caso de falha do Resend)
    await p.supabase.from('whatsapp_envios_log').insert({
      funcao: p.funcao,
      destino: ADMIN_EMAIL,
      tipo_destino: 'interno',
      sucesso: ok,
      motivo_skip: 'zapi_offline_alert_sent',
      erro_msg: ok ? null : `Resend HTTP ${resp.status}: ${body.slice(0, 200)}`,
    });
  } catch (e) {
    console.error('[zapi-alert] falha ao enviar e-mail', e);
  }
}
