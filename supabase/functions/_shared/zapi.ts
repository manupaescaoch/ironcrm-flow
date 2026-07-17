// Helpers compartilhados para envios de WhatsApp com proteções anti-bloqueio.
// Suporta dois canais: 'comercial' (leads/alunos, Z-API) e 'operacional' (equipe interna).
//
// O canal 'operacional' é roteado automaticamente para D-API quando as variáveis
// DAPI_API_KEY e DAPI_SESSION_ID estão configuradas. Caso contrário, cai no Z-API
// legado. Assim, todas as edge functions existentes continuam usando a mesma
// interface (getZapiCreds, sendText, phoneExists, checkZapiStatus, logEnvio).

export const RATE_LIMIT_MS = 10000; // 10s entre envios — mais seguro para evitar bloqueios do chip.

export type ZapiChannel = 'comercial' | 'operacional';
export type Provider = 'zapi' | 'dapi';

export interface ZapiCreds {
  provider: Provider;
  channel: ZapiChannel;
  // Z-API
  instanceId: string;
  token: string;
  clientToken: string;
  // D-API
  apiKey?: string;
  sessionId?: string;
}

const DAPI_BASE = 'https://api.d-api.cloud';

/**
 * Resolve credenciais WhatsApp por canal.
 * - 'comercial'   → Z-API (ZAPI_COMERCIAL_*, fallback ZAPI_*)
 * - 'operacional' → D-API (DAPI_*) se configurada, senão Z-API (ZAPI_OPERACIONAL_* / ZAPI_*)
 */
export function getZapiCreds(channel: ZapiChannel = 'operacional'): ZapiCreds | null {
  if (channel === 'operacional') {
    const apiKey = Deno.env.get('DAPI_API_KEY');
    const sessionId = Deno.env.get('DAPI_SESSION_ID');
    if (apiKey && sessionId) {
      return {
        provider: 'dapi',
        channel,
        apiKey,
        sessionId,
        instanceId: sessionId, // compat p/ logs
        token: '',
        clientToken: '',
      };
    }
  }

  const prefix = channel === 'comercial' ? 'ZAPI_COMERCIAL_' : 'ZAPI_OPERACIONAL_';
  const instanceId = Deno.env.get(prefix + 'INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get(prefix + 'TOKEN') ?? Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get(prefix + 'CLIENT_TOKEN') ?? Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '';

  if (!instanceId || !token) return null;
  return { provider: 'zapi', channel, instanceId, token, clientToken };
}

/**
 * Retorna lista de instanceIds esperados para validação de webhooks Z-API
 * (aceita qualquer uma das duas instâncias configuradas + legacy).
 * Nota: webhooks D-API têm formato próprio e não passam por esta validação.
 */
export function getExpectedInstanceIds(): { id: string; channel: ZapiChannel | 'legacy' }[] {
  const out: { id: string; channel: ZapiChannel | 'legacy' }[] = [];
  const com = Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID');
  const op = Deno.env.get('ZAPI_OPERACIONAL_INSTANCE_ID');
  const legacy = Deno.env.get('ZAPI_INSTANCE_ID');
  if (com) out.push({ id: com, channel: 'comercial' });
  if (op) out.push({ id: op, channel: 'operacional' });
  if (legacy && !out.find((x) => x.id === legacy)) out.push({ id: legacy, channel: 'legacy' });
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function dapiHeaders(creds: ZapiCreds): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: creds.apiKey ?? '',
  };
}

export async function checkZapiStatus(creds: ZapiCreds): Promise<{ connected: boolean; raw: any }> {
  try {
    if (creds.provider === 'dapi') {
      const url = `${DAPI_BASE}/api/v1/sessions/${creds.sessionId}`;
      const resp = await fetch(url, { headers: dapiHeaders(creds) });
      const raw = await resp.json().catch(() => ({}));
      // D-API não padroniza um único campo de status. Aceita como saudável
      // qualquer resposta HTTP 2xx que não indique desconexão explícita.
      const status = String(raw?.status ?? raw?.data?.status ?? raw?.session?.status ?? '').toLowerCase();
      const explicitlyDown =
        status === 'disconnected' ||
        status === 'offline' ||
        status === 'stopped' ||
        raw?.connected === false ||
        raw?.data?.connected === false;
      const connected = resp.ok && !explicitlyDown;
      return { connected, raw };
    }

    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/status`;
    const resp = await fetch(url, { headers: { 'Client-Token': creds.clientToken } });
    const raw = await resp.json().catch(() => ({}));
    const alreadyConnectedQuirk =
      raw?.connected === true &&
      raw?.smartphoneConnected === true &&
      typeof raw?.error === 'string' &&
      raw.error.toLowerCase().includes('already connected');
    const healthy =
      resp.ok &&
      raw?.connected === true &&
      raw?.smartphoneConnected === true &&
      (raw?.session === true || alreadyConnectedQuirk);
    return { connected: healthy, raw };
  } catch (e) {
    return { connected: false, raw: { error: String(e) } };
  }
}

export async function phoneExists(creds: ZapiCreds, phone: string): Promise<boolean | null> {
  const result = await lookupWhatsAppPhone(creds, phone);
  return result.exists;
}

export async function lookupWhatsAppPhone(
  creds: ZapiCreds,
  phone: string,
): Promise<{ exists: boolean | null; phone: string | null; raw: any }> {
  try {
    if (creds.provider === 'dapi') {
      const url = `${DAPI_BASE}/api/v1/contacts/check`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: dapiHeaders(creds),
        body: JSON.stringify({ sessionId: creds.sessionId, numbers: [phone] }),
      });
      if (!resp.ok) return { exists: null, phone: null, raw: null };
      const raw = await resp.json().catch(() => ({}));
      // D-API retorna: { success, users: [{ jid, isWhatsApp, query, ... }] }
      const arr: any[] = raw?.users ?? raw?.data ?? raw?.results ?? raw?.numbers
        ?? (Array.isArray(raw) ? raw : []);
      const item = Array.isArray(arr) ? arr[0] : null;
      const exists =
        typeof item?.isWhatsApp === 'boolean'
          ? item.isWhatsApp
          : typeof item?.exists === 'boolean'
            ? item.exists
            : typeof item?.isRegistered === 'boolean'
              ? item.isRegistered
              : typeof item?.registered === 'boolean'
                ? item.registered
                : null;
      // JID vem como "558194249453@s.whatsapp.net" — extrai apenas os dígitos.
      // Isso é essencial no Brasil, pois o nono dígito (9) só existe em registros novos:
      // números antigos são registrados no WhatsApp SEM o 9, e enviar com o 9 causa
      // erro 463 (JID inválido). Sempre usamos o phone canônico devolvido pelo próprio JID.
      const jidPhone = typeof item?.jid === 'string'
        ? item.jid.split('@')[0].split(':')[0].replace(/\D/g, '')
        : null;
      const outPhone = jidPhone
        || (typeof item?.phone === 'string' ? item.phone.replace(/\D/g, '') : null)
        || (typeof item?.number === 'string' ? item.number.replace(/\D/g, '') : null);
      return { exists, phone: outPhone, raw };
    }

    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/phone-exists/${phone}`;
    const resp = await fetch(url, { headers: { 'Client-Token': creds.clientToken } });
    if (!resp.ok) {
      return { exists: null, phone: null, raw: null };
    }
    const raw = await resp.json().catch(() => ({}));
    return {
      exists: typeof raw?.exists === 'boolean' ? raw.exists : null,
      phone: typeof raw?.phone === 'string' ? raw.phone.replace(/\D/g, '') : null,
      raw,
    };
  } catch {
    return { exists: null, phone: null, raw: null };
  }
}

export async function sendText(
  creds: ZapiCreds,
  phone: string,
  message: string,
): Promise<{ ok: boolean; status: number; body: any }> {
  if (creds.provider === 'dapi') {
    const url = `${DAPI_BASE}/api/v1/messages/send/text`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: dapiHeaders(creds),
      body: JSON.stringify({ sessionId: creds.sessionId, to: phone, text: message }),
    });
    const body = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, body };
  }

  const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': creds.clientToken },
    body: JSON.stringify({ phone, message }),
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, body };
}

export interface LogPayload {
  funcao: string;
  destino?: string | null;
  tipo_destino?: 'lead' | 'grupo' | 'recepcao' | 'funcionario' | 'interno' | null;
  unidade_id?: string | null;
  sucesso: boolean;
  erro_msg?: string | null;
  zapi_status_code?: number | null;
  motivo_skip?: string | null;
  canal?: ZapiChannel | null;
  // Status normalizado para diagnóstico: 'enviado' | 'falhou' | 'nao_encontrado'
  status_envio?: 'enviado' | 'falhou' | 'nao_encontrado' | null;
  // Resposta bruta do provedor (D-API ou Z-API) para debug preciso
  resposta_completa?: unknown;
}

export async function logEnvio(supabase: any, p: LogPayload): Promise<void> {
  try {
    await supabase.from('whatsapp_envios_log').insert({
      ...p,
      canal: p.canal ?? 'operacional',
    });
  } catch (e) {
    console.error('[zapi.logEnvio] falhou', e);
  }
}
