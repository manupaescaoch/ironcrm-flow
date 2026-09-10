// Helpers compartilhados para envios de WhatsApp com proteções anti-bloqueio.
// Suporta dois canais: 'comercial' (leads/alunos, Z-API) e 'operacional' (equipe interna).
//
// O canal 'operacional' é roteado automaticamente para D-API quando as variáveis
// DAPI_API_KEY e DAPI_SESSION_ID estão configuradas. Caso contrário, cai no Z-API
// legado. Assim, todas as edge functions existentes continuam usando a mesma
// interface (getZapiCreds, sendText, phoneExists, checkZapiStatus, logEnvio).

export const RATE_LIMIT_MS = 10000; // 10s entre envios — mais seguro para evitar bloqueios do chip.

// 'operacional'  → chip D-API MANU (histórico; secrets DAPI_API_KEY / DAPI_SESSION_ID)
// 'operacional2'  → chip D-API OPERACIONAL (secrets DAPI_OPERACIONAL_API_KEY / DAPI_OPERACIONAL_SESSION_ID)
export type ZapiChannel = 'comercial' | 'operacional' | 'operacional2';
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
  if (channel === 'operacional2') {
    const apiKey = Deno.env.get('DAPI_OPERACIONAL_API_KEY');
    const sessionId = Deno.env.get('DAPI_OPERACIONAL_SESSION_ID');
    if (!apiKey || !sessionId) return null;
    return {
      provider: 'dapi',
      channel,
      apiKey,
      sessionId,
      instanceId: sessionId,
      token: '',
      clientToken: '',
    };
  }

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
      // erro 463 (JID inválido).
      // ATENÇÃO: o provedor às vezes devolve um JID de LID ("1477640716...@lid"),
      // que NÃO é telefone. Enviar para esse número gera
      // "no LID found for ...@s.whatsapp.net". Só aceitamos JIDs de s.whatsapp.net
      // com formato plausível de telefone; caso contrário usamos o número original.
      const jidRaw = typeof item?.jid === 'string' ? item.jid : '';
      const jidHost = jidRaw.includes('@') ? jidRaw.split('@')[1].toLowerCase() : '';
      const jidDigits = jidRaw ? jidRaw.split('@')[0].split(':')[0].replace(/\D/g, '') : '';
      const jidPhone =
        jidHost === 's.whatsapp.net' && jidDigits.length >= 10 && jidDigits.length <= 15
          ? jidDigits
          : null;
      const fallbackPhone =
        (typeof item?.phone === 'string' ? item.phone.replace(/\D/g, '') : null)
        || (typeof item?.number === 'string' ? item.number.replace(/\D/g, '') : null)
        || (typeof item?.query === 'string' ? item.query.replace(/\D/g, '') : null);
      const plausible = (p: string | null) => (p && p.length >= 10 && p.length <= 15 ? p : null);
      const outPhone = jidPhone || plausible(fallbackPhone) || phone.replace(/\D/g, '');
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

/**
 * Normaliza destino para D-API. Grupos no Z-API usam `<id>-group`;
 * a D-API exige o JID completo `<id>@g.us`.
 */
export function dapiDestino(dest: string): string {
  const d = (dest || '').trim();
  if (d.endsWith('@g.us')) return d;
  if (d.endsWith('-group')) return `${d.replace(/-group$/, '')}@g.us`;
  if (/^\d{15,}$/.test(d.replace(/\D/g, '')) && d.replace(/\D/g, '').length >= 17) {
    return `${d.replace(/\D/g, '')}@g.us`;
  }
  return d;
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
      body: JSON.stringify({ sessionId: creds.sessionId, to: dapiDestino(phone), text: message }),
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

// ---------------------------------------------------------------------------
// IDEMPOTÊNCIA DE ENVIO (proteção anti-duplicidade)
// ---------------------------------------------------------------------------
// Toda mensagem deve ter uma chave determinística (funcao + destino + contexto).
// claimEnvio() reserva a chave de forma atômica no banco ANTES do envio.
// Se retornar false, alguém já enviou (ou está enviando) → NÃO envie.
// Em caso de falha real no provedor, chame releaseEnvio() para permitir retry.

export function buildIdempotencyKey(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => String(p ?? '').trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean)
    .join(':');
}

export async function claimEnvio(
  supabase: any,
  opts: {
    chave: string;
    funcao: string;
    destino?: string | null;
    canal?: ZapiChannel | null;
    ttlMinutes?: number;
  },
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('claim_whatsapp_envio', {
      p_chave: opts.chave,
      p_funcao: opts.funcao,
      p_destino: opts.destino ?? null,
      p_canal: opts.canal ?? null,
      // Dez anos por padrão: um evento histórico jamais volta a ser elegível só
      // porque a trava expirou. Fluxos recorrentes devem incluir a data na chave.
      p_ttl_minutes: opts.ttlMinutes ?? 5256000,
    });
    if (error) {
      // Fail-closed: sem garantia de idempotência, não enviamos (evita duplicidade).
      console.error('[zapi.claimEnvio] erro — envio abortado', opts.chave, error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error('[zapi.claimEnvio] exceção — envio abortado', opts.chave, e);
    return false;
  }
}

export async function releaseEnvio(supabase: any, chave: string): Promise<void> {
  try {
    await supabase.rpc('release_whatsapp_envio', { p_chave: chave });
  } catch (e) {
    console.error('[zapi.releaseEnvio] falhou', chave, e);
  }
}

/**
 * Envio de texto com idempotência garantida no banco.
 * Retorna { skipped: true } quando a chave já foi usada (duplicidade evitada).
 */
export async function sendTextIdempotent(
  supabase: any,
  creds: ZapiCreds,
  phone: string,
  message: string,
  opts: { chave: string; funcao: string; ttlMinutes?: number },
): Promise<{ ok: boolean; skipped: boolean; status: number; body: any }> {
  const claimed = await claimEnvio(supabase, {
    chave: opts.chave,
    funcao: opts.funcao,
    destino: phone,
    canal: creds.channel,
    ttlMinutes: opts.ttlMinutes,
  });
  if (!claimed) {
    console.log('[zapi.sendTextIdempotent] DUPLICIDADE EVITADA', opts.chave);
    return { ok: false, skipped: true, status: 0, body: { skipped: 'duplicado' } };
  }
  // Fail-closed inclusive em timeout/erro ambíguo: depois que o provedor foi
  // chamado não é seguro liberar a chave, pois ele pode ter aceitado a mensagem
  // antes da conexão cair. Retry exige uma nova decisão explícita, nunca automática.
  const r = await sendText(creds, phone, message);
  // EXCEÇÃO: rejeição definitiva do provedor (HTTP 4xx com success=false) significa
  // que a mensagem com certeza NÃO foi aceita. Nesse caso liberamos a chave para
  // que o cron possa tentar novamente — sem risco de duplicidade.
  const definitiveReject =
    !r.ok && r.status >= 400 && r.status < 500 && r.body && r.body.success === false;
  if (definitiveReject) {
    await releaseEnvio(supabase, opts.chave);
  }
  return { ...r, skipped: false };

}

// ---------------------------------------------------------------------------
// MENSAGEM INTERATIVA (LISTA DE OPÇÕES)
// ---------------------------------------------------------------------------
// A D-API não expõe endpoint de "reply buttons"; o equivalente suportado é a
// mensagem de lista (/api/v1/interactive/send/list), que na tela do WhatsApp
// aparece como opções clicáveis. Em Z-API (canal comercial) caímos para texto.

export interface ListRow {
  rowId: string;
  title: string;
  description?: string;
}

export interface ListOptions {
  title?: string;
  description: string;
  buttonText: string;
  footerText?: string;
  rows: ListRow[];
  sectionTitle?: string;
}

export async function sendList(
  creds: ZapiCreds,
  phone: string,
  opts: ListOptions,
): Promise<{ ok: boolean; status: number; body: any }> {
  if (creds.provider === 'dapi') {
    const url = `${DAPI_BASE}/api/v1/interactive/send/list`;
    const payload: Record<string, unknown> = {
      sessionId: creds.sessionId,
      to: dapiDestino(phone),
      description: opts.description,
      buttonText: opts.buttonText,
      sections: [
        {
          ...(opts.sectionTitle ? { title: opts.sectionTitle } : {}),
          rows: opts.rows.map((r) => ({
            rowId: r.rowId,
            title: r.title,
            ...(r.description ? { description: r.description } : {}),
          })),
        },
      ],
    };
    if (opts.title) payload.title = opts.title;
    if (opts.footerText) payload.footerText = opts.footerText;

    const resp = await fetch(url, {
      method: 'POST',
      headers: dapiHeaders(creds),
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, body };
  }

  // Fallback: provedores sem lista interativa recebem o texto puro.
  return await sendText(creds, phone, opts.description);
}

/**
 * Lista interativa com idempotência garantida no banco (mesma semântica de
 * sendTextIdempotent).
 */
export async function sendListIdempotent(
  supabase: any,
  creds: ZapiCreds,
  phone: string,
  opts: ListOptions,
  idem: { chave: string; funcao: string; ttlMinutes?: number },
): Promise<{ ok: boolean; skipped: boolean; status: number; body: any }> {
  const claimed = await claimEnvio(supabase, {
    chave: idem.chave,
    funcao: idem.funcao,
    destino: phone,
    canal: creds.channel,
    ttlMinutes: idem.ttlMinutes,
  });
  if (!claimed) {
    console.log('[zapi.sendListIdempotent] DUPLICIDADE EVITADA', idem.chave);
    return { ok: false, skipped: true, status: 0, body: { skipped: 'duplicado' } };
  }
  const r = await sendList(creds, phone, opts);
  const definitiveReject =
    !r.ok && r.status >= 400 && r.status < 500 && r.body && r.body.success === false;
  if (definitiveReject) {
    await releaseEnvio(supabase, idem.chave);
  }
  return { ...r, skipped: false };
}

// ---------------------------------------------------------------------------
// BOTÕES DE RESPOSTA RÁPIDA (NativeFlow — aparecem embaixo da mensagem)
// ---------------------------------------------------------------------------
// D-API: POST /api/v1/interactive/send/nativeflow com buttons[type=quick_reply].
// Só renderiza no WhatsApp mobile. Em Z-API cai para texto puro.

export interface QuickButton {
  id: string;
  title: string;
}

export interface ButtonsOptions {
  title?: string;
  body: string;
  footer?: string;
  buttons: QuickButton[];
}

export async function sendButtons(
  creds: ZapiCreds,
  phone: string,
  opts: ButtonsOptions,
): Promise<{ ok: boolean; status: number; body: any }> {
  if (creds.provider === 'dapi') {
    const url = `${DAPI_BASE}/api/v1/interactive/send/nativeflow`;
    const payload: Record<string, unknown> = {
      sessionId: creds.sessionId,
      to: phone,
      body: opts.body,
      buttons: opts.buttons.slice(0, 3).map((b) => ({
        type: 'quick_reply',
        title: b.title,
        id: b.id,
      })),
    };
    if (opts.title) payload.title = opts.title;
    if (opts.footer) payload.footer = opts.footer;

    const resp = await fetch(url, {
      method: 'POST',
      headers: dapiHeaders(creds),
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, body };
  }

  return await sendText(creds, phone, opts.body);
}

export async function sendButtonsIdempotent(
  supabase: any,
  creds: ZapiCreds,
  phone: string,
  opts: ButtonsOptions,
  idem: { chave: string; funcao: string; ttlMinutes?: number },
): Promise<{ ok: boolean; skipped: boolean; status: number; body: any }> {
  const claimed = await claimEnvio(supabase, {
    chave: idem.chave,
    funcao: idem.funcao,
    destino: phone,
    canal: creds.channel,
    ttlMinutes: idem.ttlMinutes,
  });
  if (!claimed) {
    console.log('[zapi.sendButtonsIdempotent] DUPLICIDADE EVITADA', idem.chave);
    return { ok: false, skipped: true, status: 0, body: { skipped: 'duplicado' } };
  }
  const r = await sendButtons(creds, phone, opts);
  const definitiveReject =
    !r.ok && r.status >= 400 && r.status < 500 && r.body && r.body.success === false;
  if (definitiveReject) {
    await releaseEnvio(supabase, idem.chave);
  }
  return { ...r, skipped: false };
}

