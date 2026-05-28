// Helpers compartilhados para envios via Z-API com proteções anti-bloqueio.
// - checkZapiStatus: verifica se o chip está conectado antes de qualquer envio.
// - phoneExists: valida se o número tem WhatsApp ativo (evita "spray and pray").
// - sendText: envia texto.
// - sleep / RATE_LIMIT_MS: intervalo mínimo entre envios sequenciais.
// - logEnvio: registra cada envio na tabela whatsapp_envios_log.

export const RATE_LIMIT_MS = 10000; // 10s entre envios — mais seguro para evitar bloqueios do chip.

export interface ZapiCreds {
  instanceId: string;
  token: string;
  clientToken: string;
}

export function getZapiCreds(): ZapiCreds | null {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
  if (!instanceId || !token) return null;
  return { instanceId, token, clientToken };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function checkZapiStatus(creds: ZapiCreds): Promise<{ connected: boolean; raw: any }> {
  try {
    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/status`;
    const resp = await fetch(url, { headers: { 'Client-Token': creds.clientToken } });
    const raw = await resp.json().catch(() => ({}));
    return { connected: resp.ok && raw?.connected === true, raw };
  } catch (e) {
    return { connected: false, raw: { error: String(e) } };
  }
}

export async function phoneExists(creds: ZapiCreds, phone: string): Promise<boolean | null> {
  try {
    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/phone-exists/${phone}`;
    const resp = await fetch(url, { headers: { 'Client-Token': creds.clientToken } });
    if (!resp.ok) return null;
    const raw = await resp.json().catch(() => ({}));
    // Z-API retorna { exists: true/false } ou { exists: true, phone: ... }
    if (typeof raw?.exists === 'boolean') return raw.exists;
    return null;
  } catch {
    return null;
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
}

export async function logEnvio(supabase: any, p: LogPayload): Promise<void> {
  try {
    await supabase.from('whatsapp_envios_log').insert(p);
  } catch (e) {
    console.error('[zapi.logEnvio] falhou', e);
  }
}
