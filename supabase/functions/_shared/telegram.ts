// Utilitários da integração com o Telegram.
// O TELEGRAM_BOT_TOKEN só é lido aqui, no servidor, e nunca é retornado ao cliente.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export const TELEGRAM_API = 'https://api.telegram.org';

export function botToken(): string {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurado');
  return token;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Segredo do webhook em formato aceito pelo Telegram (A-Z a-z 0-9 _ -). */
export async function webhookSecretToken(): Promise<string> {
  const raw = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (!raw) throw new Error('TELEGRAM_WEBHOOK_SECRET não configurado');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`telegram-webhook:${raw}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function telegramApi(method: string, body: unknown): Promise<{ ok: boolean; result?: any; description?: string }> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok || parsed?.ok !== true) {
    return { ok: false, description: String(parsed?.description ?? `HTTP ${res.status}`) };
  }
  return { ok: true, result: parsed.result };
}

export interface SendParams {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: unknown;
  recipient_type?: 'usuario' | 'grupo';
  recipient_id?: string | null;
  message_type?: string;
}

/** Envia mensagem (privada ou em grupo) e registra o log de envio. */
export async function sendTelegramMessage(
  params: SendParams,
  admin: SupabaseClient = adminClient(),
): Promise<{ ok: boolean; error?: string; message_id?: number }> {
  const { chat_id, text, parse_mode = 'HTML', reply_markup } = params;

  let ok = false;
  let error: string | undefined;
  let messageId: number | undefined;

  try {
    const r = await telegramApi('sendMessage', {
      chat_id,
      text,
      parse_mode,
      ...(reply_markup ? { reply_markup } : {}),
    });
    ok = r.ok;
    if (ok) messageId = r.result?.message_id;
    else error = r.description;
  } catch (e) {
    error = e instanceof Error ? e.message : 'falha de rede';
  }

  const chatNumber = Number(chat_id);
  await admin.from('telegram_message_logs').insert({
    recipient_type: params.recipient_type ?? (chatNumber < 0 ? 'grupo' : 'usuario'),
    recipient_id: params.recipient_id ?? null,
    telegram_chat_id: Number.isFinite(chatNumber) ? chatNumber : null,
    message_type: params.message_type ?? 'texto',
    status: ok ? 'enviado' : 'erro',
    error_message: ok ? null : (error ?? 'erro desconhecido'),
  });

  return { ok, error, message_id: messageId };
}

export type TelegramGroupType = 'coordenadores' | 'comercial' | 'gerencia' | 'nps' | 'anamnese';

export interface TelegramGrupoUnidade {
  id: string;
  group_type: TelegramGroupType;
  telegram_chat_id: number;
  telegram_title: string | null;
}

/**
 * Resolve o grupo conectado da unidade seguindo a ordem de prioridade informada.
 */
export async function resolveGrupoUnidade(
  admin: any,
  unidadeId: string | null,
  prioridade: TelegramGroupType[],
): Promise<TelegramGrupoUnidade | null> {
  if (!unidadeId) return null;
  const { data } = await admin
    .from('telegram_groups')
    .select('id, group_type, telegram_chat_id, telegram_title')
    .eq('status', 'conectado')
    .eq('unidade_id', unidadeId)
    .not('telegram_chat_id', 'is', null);
  if (!data || data.length === 0) return null;
  for (const tipo of prioridade) {
    const found = data.find((g: any) => g.group_type === tipo);
    if (found) {
      return {
        id: found.id,
        group_type: found.group_type,
        telegram_chat_id: Number(found.telegram_chat_id),
        telegram_title: found.telegram_title ?? null,
      };
    }
  }
  return null;
}

/** Descobre o unidade_id a partir do nome (ex.: "MADALENA" → EVO MADALENA). */
export async function resolveUnidadeId(
  admin: any,
  nome: string | null | undefined,
): Promise<string | null> {
  const termo = (nome ?? '').trim();
  if (!termo) return null;
  const { data } = await admin
    .from('unidades')
    .select('id, nome')
    .ilike('nome', `%${termo}%`)
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Envia texto ao grupo, com fallback sem Markdown se o parser do Telegram falhar.
 */
export async function sendTelegramGroupText(
  admin: any,
  grupo: TelegramGrupoUnidade,
  text: string,
  messageType: string,
): Promise<{ ok: boolean; error?: string; message_id?: number }> {
  let r = await sendTelegramMessage({
    chat_id: grupo.telegram_chat_id,
    text,
    parse_mode: 'Markdown',
    recipient_type: 'grupo',
    recipient_id: grupo.id,
    message_type: messageType,
  }, admin);
  if (!r.ok) {
    r = await sendTelegramMessage({
      chat_id: grupo.telegram_chat_id,
      text: text.replace(/\*/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      recipient_type: 'grupo',
      recipient_id: grupo.id,
      message_type: messageType,
    }, admin);
  }
  return r;
}

/** Variantes de um telefone brasileiro (com/sem 55, com/sem o nono dígito). */
export function telefoneVariantes(raw: string | null | undefined): string[] {
  const d = (raw ?? '').replace(/\D/g, '');
  if (!d) return [];
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  const out = new Set<string>([local]);
  if (local.length === 11) out.add(local.slice(0, 2) + local.slice(3));
  if (local.length === 10) out.add(local.slice(0, 2) + '9' + local.slice(2));
  return [...out];
}

export interface TelegramDestinoUsuario {
  user_id: string;
  telegram_user_id: number;
}

/**
 * Encontra o usuário conectado ao bot a partir de um telefone (ex.: telefone
 * cadastrado em cronograma_funcionarios). Retorna null se ninguém conectado
 * corresponder ao número.
 */
export async function resolveTelegramUsuarioPorTelefone(
  admin: any,
  telefone: string | null | undefined,
): Promise<TelegramDestinoUsuario | null> {
  const alvos = telefoneVariantes(telefone);
  if (alvos.length === 0) return null;

  const { data: conectados } = await admin
    .from('telegram_users')
    .select('user_id, telegram_user_id')
    .eq('status', 'conectado')
    .not('telegram_user_id', 'is', null);
  if (!conectados || conectados.length === 0) return null;

  const { data: perfis } = await admin
    .from('user_profiles')
    .select('user_id, telefone')
    .in('user_id', conectados.map((c: any) => c.user_id));

  const porVariante = new Map<string, string>();
  for (const p of perfis || []) {
    for (const v of telefoneVariantes(p.telefone)) porVariante.set(v, p.user_id);
  }

  for (const v of alvos) {
    const userId = porVariante.get(v);
    if (!userId) continue;
    const row = conectados.find((c: any) => c.user_id === userId);
    if (row) return { user_id: userId, telegram_user_id: Number(row.telegram_user_id) };
  }

  return await resolveTelegramFuncionarioPorTelefone(admin, telefone);
}

/**
 * Fallback: funcionários do cronograma (treinadores, estagiários líderes) que não
 * têm conta no CRM mas conectaram o bot pelo link pessoal.
 */
export async function resolveTelegramFuncionarioPorTelefone(
  admin: any,
  telefone: string | null | undefined,
): Promise<TelegramDestinoUsuario | null> {
  const alvos = telefoneVariantes(telefone);
  if (alvos.length === 0) return null;

  const { data } = await admin
    .from('telegram_funcionarios')
    .select('funcionario_id, telefone, telegram_user_id')
    .eq('status', 'conectado')
    .not('telegram_user_id', 'is', null);
  if (!data || data.length === 0) return null;

  for (const row of data) {
    const variantes = telefoneVariantes(row.telefone);
    if (variantes.some((v) => alvos.includes(v))) {
      return { user_id: row.funcionario_id, telegram_user_id: Number(row.telegram_user_id) };
    }
  }
  return null;
}

/** Envia mensagem privada ao colaborador, com fallback sem Markdown. */
export async function sendTelegramUserText(
  admin: any,
  alvo: TelegramDestinoUsuario,
  text: string,
  messageType: string,
): Promise<{ ok: boolean; error?: string; message_id?: number }> {
  let r = await sendTelegramMessage({
    chat_id: alvo.telegram_user_id,
    text,
    parse_mode: 'Markdown',
    recipient_type: 'usuario',
    recipient_id: alvo.user_id,
    message_type: messageType,
  }, admin);
  if (!r.ok) {
    r = await sendTelegramMessage({
      chat_id: alvo.telegram_user_id,
      text: text.replace(/\*/g, ''),
      recipient_type: 'usuario',
      recipient_id: alvo.user_id,
      message_type: messageType,
    }, admin);
  }
  return r;
}
