// Helpers compartilhados para envios via Z-API com proteções anti-bloqueio.
// Suporta duas instâncias: 'comercial' (leads/alunos) e 'operacional' (equipe interna).

export const RATE_LIMIT_MS = 10000; // 10s entre envios — mais seguro para evitar bloqueios do chip.

export type ZapiChannel = 'comercial' | 'operacional';

export interface ZapiCreds {
  instanceId: string;
  token: string;
  clientToken: string;
  channel: ZapiChannel;
}

/**
 * Resolve credenciais Z-API por canal.
 * - 'comercial'   → ZAPI_COMERCIAL_*   (fallback: ZAPI_*)
 * - 'operacional' → ZAPI_OPERACIONAL_* (fallback: ZAPI_*)
 * O fallback evita downtime durante a migração; será removido em fase posterior.
 */
export function getZapiCreds(channel: ZapiChannel = 'operacional'): ZapiCreds | null {
  const prefix = channel === 'comercial' ? 'ZAPI_COMERCIAL_' : 'ZAPI_OPERACIONAL_';
  const instanceId =
    Deno.env.get(prefix + 'INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get(prefix + 'TOKEN') ?? Deno.env.get('ZAPI_TOKEN');
  const clientToken =
    Deno.env.get(prefix + 'CLIENT_TOKEN') ?? Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '';
  if (!instanceId || !token) return null;
  return { instanceId, token, clientToken, channel };
}

/**
 * Retorna lista de instanceIds esperados para validação de webhooks
 * (aceita qualquer uma das duas instâncias configuradas + legacy).
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

export async function checkZapiStatus(creds: ZapiCreds): Promise<{ connected: boolean; raw: any }> {
  try {
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
