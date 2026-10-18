import { sendManagerFuDigest } from './fuGerenteDigest.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.test('Telegram manager digest sends only each unit pending FU and does not mark them complete', async () => {
  const original = globalThis.fetch;
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  Deno.env.set('TELEGRAM_BOT_TOKEN', 'fake-test-token');
  const sent: { chat_id: number; text: string }[] = [];
  const claims = new Set<string>();
  const units = [{ id: 'unit-a', nome: 'A' }, { id: 'unit-b', nome: 'B' }];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const options = init as { method?: string; body?: unknown } | undefined;
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    let data: unknown = [];
    if (url.hostname === 'api.telegram.org') {
      sent.push(body);
      return Response.json({ ok: true, result: { message_id: sent.length } });
    }
    const table = url.pathname.split('/').pop();
    if (table === 'unidades') data = units;
    if (table === 'telegram_groups') data = [{ id: 'group', group_type: 'gerencia', telegram_chat_id: url.searchParams.get('unidade_id') === 'eq.unit-a' ? -1 : -2 }];
    if (table === 'interacoes') {
      const unit = url.searchParams.get('unidade_id')?.slice(3);
      const make = (id: string, name: string, date = '2026-10-08', active = true) => ({ id, lead_id: id, data_fechamento: date, leads: { id, nome: name, telefone: '81999990000', unidade_id: unit, ativo: active, is_matriculado: true } });
      data = unit === 'unit-a'
        ? [make('recent', 'RECENT', '2026-10-18'), make('eligible', 'ALUNO A'), make('done', 'DONE'), make('future', 'FUTURE'), make('inactive', 'INACTIVE', '2026-10-12', false), make('recent', 'OLD', '2026-10-12')]
        : [make('b', 'ALUNO B')];
    }
    if (table === 'follow_ups') {
      if (method !== 'GET') throw new Error('Digest must never write FU completion');
      data = [{ lead_id: 'done', tipo: 'G+7', status: 'concluido', data_prevista: null }, { lead_id: 'future', tipo: 'G+7', status: 'pendente', data_prevista: '2026-10-20T00:00:00-03:00' }];
    }
    if (table === 'formulario_envios_log' && method === 'POST') {
      if (body.origem !== 'internal_test' || body.status !== 'pendente') throw new Error('Invalid database claim enum');
      if (claims.has(body.idempotency_key)) return Response.json({ code: '23505', message: 'duplicate' }, { status: 409 });
      claims.add(body.idempotency_key);
    }
    return Response.json(data);
  };
  try {
    const admin = createClient('http://mock.local', 'fake', { auth: { persistSession: false, autoRefreshToken: false } });
    const monday = new Date('2026-10-19T11:00:00Z');
    await sendManagerFuDigest(admin, false, monday);
    if (sent.length !== 2 || sent[0].chat_id !== -1 || sent[1].chat_id !== -2) throw new Error('Must send one message to each unit management group');
    if (!sent[0].text.includes('ALUNO A') || sent[0].text.includes('ALUNO B') || /DONE|FUTURE|INACTIVE|RECENT|OLD/.test(sent[0].text)) throw new Error('Wrong eligible students or cross-unit disclosure');
    if (!sent[1].text.includes('ALUNO B') || sent[1].text.includes('ALUNO A')) throw new Error('Cross-unit disclosure');
    await sendManagerFuDigest(admin, false, monday);
    if (sent.length !== 2) throw new Error('Duplicate digest sent');
    await sendManagerFuDigest(admin, false, new Date('2026-10-25T11:00:00Z'));
    if (sent.length !== 2) throw new Error('Sent on Sunday');
  } finally {
    globalThis.fetch = original;
    if (token) Deno.env.set('TELEGRAM_BOT_TOKEN', token); else Deno.env.delete('TELEGRAM_BOT_TOKEN');
  }
});