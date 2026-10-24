export const BTG_AUTHORIZE = 'https://id.btgpactual.com/oauth2/authorize';
export const BTG_TOKEN = 'https://id.btgpactual.com/oauth2/token';
export const BTG_READ_SCOPE = 'openid brn:btg:empresas:banking:direct-debit.readonly';
export function credenciaisBtg() {
  const clientId = Deno.env.get('BTG_DDA_CLIENT_ID');
  const secret = Deno.env.get('BTG_DDA_CLIENT_SECRET');
  if (!clientId || !secret) throw new Error('Cadastre as credenciais do aplicativo BTG antes de autorizar');
  return { clientId, secret };
}
export async function hash(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function key() {
  const secret = Deno.env.get('BTG_DDA_ENCRYPTION_KEY');
  if (!secret) throw new Error('Proteção bancária não configurada');
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export async function cifrar(tokens: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(tokens)));
  return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}
export async function decifrar(text: string) {
  const [iv, body] = text.split('.');
  const bytes = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key(), bytes(body));
  return JSON.parse(new TextDecoder().decode(plain));
}
export async function trocarCodigo(code: string, redirectUri: string) {
  const { clientId, secret } = credenciaisBtg();
  const response = await fetch(BTG_TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${clientId}:${secret}`)}` },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId }),
  });
  // Token bodies may contain credentials: never log or relay the provider body here.
  if (!response.ok) throw new Error(`BTG recusou a autorização (HTTP ${response.status})`);
  const data = await response.json();
  if (typeof data.access_token !== 'string') throw new Error('BTG não retornou autorização válida');
  const granted = String(data.scope ?? '').split(' ');
  if (!granted.includes('brn:btg:empresas:banking:direct-debit.readonly') && !granted.includes('empresas.btgpactual.com/authorized-direct-debits.readonly')) throw new Error('BTG não concedeu consulta DDA');
  return { ...data, expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
}